import asyncio
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.config import settings
from backend.database import SignalDatabase
from backend.scanner import BinanceFuturesScanner
from backend.funding import funding_rates
from backend.strategy import (
    Candle, calculate_indicators, evaluate_signal, calculate_levels,
    calculate_signal_strength, calculate_vwap
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("binance_scanner")

# Global singletons
db = SignalDatabase(settings.DATABASE_PATH)
scanner = BinanceFuturesScanner(db)

# Background tasks lifecycle
background_tasks_set = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up %s v%s (24/7 autonomous mode)...", settings.APP_NAME, settings.APP_VERSION)
    
    # Start 24/7 scanner loop in background
    scanner_task = asyncio.create_task(scanner.start())
    background_tasks_set.add(scanner_task)
    scanner_task.add_done_callback(background_tasks_set.discard)

    yield

    logger.info("Shutting down background scanner...")
    scanner.stop()
    for task in background_tasks_set:
        task.cancel()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Enable CORS for external dashboards (e.g. GitHub Pages or separate frontend hosting)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Request Models -----------------
class SettingsUpdate(BaseModel):
    timeframe: Optional[str] = None
    trend_filter: Optional[str] = None
    require_candle_color: Optional[bool] = None
    require_weekly_vwap: Optional[bool] = None
    atr_period: Optional[int] = None
    sl_atr_mult: Optional[float] = None
    tp1_ratio: Optional[float] = None
    scan_interval_seconds: Optional[int] = None

class BacktestRequest(BaseModel):
    symbol: str = "BTCUSDT"
    timeframe: str = "5m"
    bars: int = 500
    trend_filter: str = "zone"
    require_candle_color: bool = True
    require_weekly_vwap: bool = False
    atr_period: int = 14
    sl_atr_mult: float = 2.5
    tp1_ratio: float = 1.5

class AnalyzeRequest(BaseModel):
    symbol: str = "BTCUSDT"
    timeframe: str = "5m"
    bars: int = 120

# ----------------- API Endpoints -----------------

@app.get("/api/status")
async def get_system_status():
    """
    Returns full system health, scanner state, uptime, and active parameters.
    """
    stats = db.get_stats()
    return {
        "status": "online",
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "scanner_running": scanner.is_running,
        "is_scanning": scanner.is_scanning,
        "uptime": scanner.get_uptime(),
        "timeframe": scanner.timeframe,
        "scan_interval_seconds": scanner.scan_interval,
        "scan_progress": scanner.scan_progress,
        "symbols_tracked": len(scanner.valid_symbols),
        "trending_pairs_count": len(scanner.trending_pairs),
        "last_scan_time": scanner.last_scan_time.isoformat() if scanner.last_scan_time else None,
        "stats": stats,
        "timezone": settings.APP_TIMEZONE,
        "timestamp_local": datetime.now(ZoneInfo(settings.APP_TIMEZONE)).isoformat()
    }

@app.get("/api/signals")
async def get_signals(limit: int = Query(50, ge=1, le=500), status: Optional[str] = None):
    """
    Returns recent trading signals with optional status filtering.
    """
    all_signals = db.get_recent_signals(limit=limit)
    if status:
        all_signals = [s for s in all_signals if s.get("status") == status]
    return {
        "count": len(all_signals),
        "signals": all_signals
    }

@app.get("/api/stats")
async def get_statistics():
    """
    Returns aggregate performance metrics, win rates, and TP counts.
    """
    return db.get_stats()

@app.get("/api/tickers")
async def get_market_tickers():
    """
    Returns cached market tickers and trending pairs.
    """
    return {
        "trending": scanner.trending_pairs,
        "tickers": list(scanner.market_cache.values())
    }

@app.get("/api/funding/{symbol}")
async def get_funding_rate(symbol: str):
    """Return a cached current Binance Futures funding rate for simulation PnL."""
    return await funding_rates.get(symbol)

@app.post("/api/scan/toggle")
async def toggle_scanner():
    """
    Starts or pauses the 24/7 background scanner.
    """
    if scanner.is_running:
        scanner.stop()
        return {"running": False, "message": "Scanner paused."}
    else:
        asyncio.create_task(scanner.start())
        return {"running": True, "message": "Scanner resumed."}

@app.post("/api/scan/trigger")
async def trigger_manual_scan(background_tasks: BackgroundTasks):
    """
    Forces an immediate scan pass without waiting for the scheduled timer.
    """
    if scanner.is_scanning:
        return {"status": "in_progress", "message": "A scan cycle is already currently running."}
    
    background_tasks.add_task(scanner.scan_once)
    return {"status": "triggered", "message": "Manual market scan initiated."}

@app.post("/api/settings")
async def update_settings(payload: SettingsUpdate):
    """
    Updates strategy and engine parameters dynamically.
    """
    if payload.timeframe:
        scanner.set_timeframe(payload.timeframe)
        settings.BINANCE_TIMEFRAME = payload.timeframe
    if payload.scan_interval_seconds:
        scanner.scan_interval = payload.scan_interval_seconds
        settings.SCAN_INTERVAL_SECONDS = payload.scan_interval_seconds
    if payload.trend_filter:
        settings.TREND_FILTER = payload.trend_filter
    if payload.require_candle_color is not None:
        settings.REQUIRE_CANDLE_COLOR = payload.require_candle_color
    if payload.require_weekly_vwap is not None:
        settings.REQUIRE_WEEKLY_VWAP = payload.require_weekly_vwap
    if payload.atr_period:
        settings.ATR_PERIOD = payload.atr_period
    if payload.sl_atr_mult:
        settings.SL_ATR_MULT = payload.sl_atr_mult
    if payload.tp1_ratio:
        settings.TP1_RATIO = payload.tp1_ratio

    return {
        "status": "updated",
        "current_settings": {
            "timeframe": scanner.timeframe,
            "scan_interval": scanner.scan_interval,
            "trend_filter": settings.TREND_FILTER,
            "require_candle_color": settings.REQUIRE_CANDLE_COLOR,
            "require_weekly_vwap": settings.REQUIRE_WEEKLY_VWAP,
            "atr_period": settings.ATR_PERIOD,
            "sl_atr_mult": settings.SL_ATR_MULT,
            "tp1_ratio": settings.TP1_RATIO
        }
    }

@app.post("/api/backtest")
async def run_backtest(req: BacktestRequest):
    """
    Simulates the EMA/VWAP strategy over historical Binance candles.
    """
    candles = await scanner.fetch_klines(req.symbol, req.timeframe, limit=req.bars)
    if len(candles) < 210:
        raise HTTPException(status_code=400, detail=f"Insufficient candles for {req.symbol}. Need at least 210.")

    indicators = calculate_indicators(candles, req.atr_period)
    wins = 0
    losses = 0
    closed = 0
    tp1 = 0
    tp2 = 0
    tp3 = 0
    tp4 = 0
    streak = 0
    max_streak = 0
    last_signal_idx = -1000
    open_trade = None

    for i in range(210, len(candles)):
        c = candles[i]
        
        # Check active trade resolution
        if open_trade:
            is_call = open_trade["direction"] in ("LONG", "CALL")
            hit_sl = (c.l <= open_trade["sl"]) if is_call else (c.h >= open_trade["sl"])
            hit_tp1 = (c.h >= open_trade["tp1"]) if is_call else (c.l <= open_trade["tp1"])
            hit_tp2 = (c.h >= open_trade["tp2"]) if is_call else (c.l <= open_trade["tp2"])
            hit_tp3 = (c.h >= open_trade["tp3"]) if is_call else (c.l <= open_trade["tp3"])
            hit_tp4 = (c.h >= open_trade["tp4"]) if is_call else (c.l <= open_trade["tp4"])

            if hit_sl:
                if open_trade["t1"]:
                    wins += 1
                    streak = 0
                else:
                    losses += 1
                    streak += 1
                    max_streak = max(max_streak, streak)
                closed += 1
                open_trade = None
            else:
                if not open_trade["t1"] and hit_tp1:
                    open_trade["t1"] = True
                    tp1 += 1
                if not open_trade.get("t2") and hit_tp2:
                    open_trade["t2"] = True
                    tp2 += 1
                if not open_trade.get("t3") and hit_tp3:
                    open_trade["t3"] = True
                    tp3 += 1
                if not open_trade.get("t4") and hit_tp4:
                    open_trade["t4"] = True
                    tp4 += 1
                    wins += 1
                    closed += 1
                    streak = 0
                    open_trade = None

        # Check for new signal entry
        sig = evaluate_signal(
            candles, indicators, i,
            trend_mode=req.trend_filter,
            require_candle_color=req.require_candle_color,
            require_weekly=req.require_weekly_vwap
        )
        if sig and (i - last_signal_idx > 3) and not open_trade:
            levels = calculate_levels(c.c, sig["direction"], indicators[i]["atr"], req.sl_atr_mult, req.tp1_ratio)
            open_trade = {
                "direction": sig["direction"],
                "entry": c.c,
                "sl": levels["sl"],
                "tp1": levels["tp1"],
                "tp2": levels["tp2"],
                "tp3": levels["tp3"],
                "tp4": levels["tp4"],
                "t1": False
            }
            last_signal_idx = i

    win_rate = (wins / closed * 100) if closed > 0 else 0.0
    return {
        "symbol": req.symbol,
        "timeframe": req.timeframe,
        "bars_tested": len(candles),
        "closed_trades": closed,
        "open_trades": 1 if open_trade else 0,
        "wins": wins,
        "losses": losses,
        "win_rate": round(win_rate, 1),
        "tp1_hits": tp1,
        "tp2_hits": tp2,
        "tp3_hits": tp3,
        "tp4_hits": tp4,
        "max_loss_streak": max_streak
    }

# ----------------- On-Demand Manual Pair Analysis -----------------
async def execute_symbol_analysis(symbol: str, timeframe: str = "5m", bars: int = 120):
    clean_sym = symbol.strip().upper()
    if not clean_sym.endswith("USDT"):
        clean_sym += "USDT"

    candles = await scanner.fetch_klines(clean_sym, timeframe, limit=max(50, min(500, bars)))
    if len(candles) < 50:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient candles returned for {clean_sym} ({len(candles)} bars). Need at least 50."
        )

    indicators = calculate_indicators(candles, settings.ATR_PERIOD)
    last_idx = len(candles) - 2  # last closed bar
    current_candle = candles[-1]  # live formation bar
    last_closed = candles[last_idx]
    prev_closed = candles[last_idx - 1]
    last_ind = indicators[last_idx]
    prev_ind = indicators[last_idx - 1]

    vwap = calculate_vwap(candles, last_idx, weekly=False)

    # Directional momentum evaluation
    bull_spread = last_ind["e11"] > last_ind["e34"]
    bull_cross = prev_ind["e11"] <= prev_ind["e34"] and last_ind["e11"] > last_ind["e34"]
    bear_cross = prev_ind["e11"] >= prev_ind["e34"] and last_ind["e11"] < last_ind["e34"]

    direction = "LONG" if (bull_cross or bull_spread) else "SHORT"
    confidence = calculate_signal_strength(candles, indicators, last_idx, direction, vwap)

    levels = calculate_levels(
        current_candle.c,
        direction,
        last_ind["atr"],
        settings.SL_ATR_MULT,
        settings.TP1_RATIO
    )

    ticker = scanner.market_cache.get(clean_sym, {})
    change_24h = ticker.get("change", 0.0)

    score = confidence.get("score", 75)
    score_rating = "MODERATE CONFLUENCE"
    if score >= 85:
        score_rating = "ULTRA HIGH CONFIDENCE"
    elif score >= 70:
        score_rating = "STRONG CONFLUENCE"
    elif score < 55:
        score_rating = "LOW CONFIDENCE / CHOP"

    verdict = "CONFIRMED BULLISH CROSSOVER" if bull_cross else ("CONFIRMED BEARISH CROSSOVER" if bear_cross else ("BULLISH MOMENTUM" if bull_spread else "BEARISH MOMENTUM"))

    return {
        "symbol": clean_sym,
        "timeframe": timeframe,
        "current_price": current_candle.c,
        "direction": direction,
        "verdict": verdict,
        "confidence_score": score,
        "score_rating": score_rating,
        "breakdown": confidence.get("breakdown", {}),
        "r_vol": confidence.get("r_vol", 1.0),
        "body_ratio": confidence.get("body_ratio", 50),
        "levels": levels,
        "indicators": {
            "ema11": last_ind["e11"],
            "ema34": last_ind["e34"],
            "ema200": last_ind["e200"],
            "vwap": vwap,
            "atr": last_ind["atr"]
        },
        "change_24h": change_24h,
        "bars_analyzed": len(candles),
        "timestamp_utc": datetime.utcnow().isoformat()
    }

@app.get("/api/analyze/{symbol}")
async def analyze_pair_get(
    symbol: str,
    timeframe: str = Query("5m"),
    bars: int = Query(120, ge=50, le=500)
):
    """
    On-demand analysis endpoint for any Binance perpetual futures pair with its confidence score.
    """
    return await execute_symbol_analysis(symbol, timeframe, bars)

@app.post("/api/analyze")
async def analyze_pair_post(req: AnalyzeRequest):
    """
    POST on-demand analysis endpoint for any Binance perpetual futures pair.
    """
    return await execute_symbol_analysis(req.symbol, req.timeframe, req.bars)

# ----------------- Download ZIP for GitHub -----------------
@app.get("/api/download/zip")
async def download_project_zip():
    """
    Returns the ready-to-upload ZIP archive for the GitHub repository.
    """
    root_dir = os.path.dirname(os.path.dirname(__file__))
    zip_path = os.path.join(root_dir, "binance-scanner-247.zip")
    if not os.path.exists(zip_path):
        zip_path = os.path.join(root_dir, "binance-scanner-247-telegram.zip")
    if os.path.exists(zip_path):
        return FileResponse(
            zip_path,
            filename="binance-scanner-247.zip",
            media_type="application/zip"
        )
    raise HTTPException(status_code=404, detail="ZIP archive not found.")

# ----------------- Serve Frontend Static UI -----------------
# Check if frontend/ directory exists
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/manifest.webmanifest")
    async def serve_manifest():
        return FileResponse(os.path.join(frontend_dir, "manifest.webmanifest"), media_type="application/manifest+json")

    @app.get("/service-worker.js")
    async def serve_service_worker():
        return FileResponse(os.path.join(frontend_dir, "service-worker.js"), media_type="application/javascript")

    @app.get("/")
    async def serve_index():
        index_file = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"status": "API online. Frontend index.html not found in frontend/"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
