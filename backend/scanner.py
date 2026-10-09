import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set
import aiohttp

from backend.config import settings
from backend.database import SignalDatabase
from backend.strategy import (
    Candle, calculate_indicators, evaluate_signal, calculate_levels, get_trend_state
)
from backend.telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)

class BinanceFuturesScanner:
    def __init__(self, db: SignalDatabase, notifier: TelegramNotifier):
        self.db = db
        self.notifier = notifier
        self.session: Optional[aiohttp.ClientSession] = None
        
        # State
        self.is_running = False
        self.start_time = datetime.utcnow()
        self.timeframe = settings.BINANCE_TIMEFRAME
        self.scan_interval = settings.SCAN_INTERVAL_SECONDS
        self.semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_REQUESTS)

        # In-memory caches
        self.valid_symbols: List[str] = []
        self.market_cache: Dict[str, Dict[str, Any]] = {}
        self.trending_pairs: List[str] = []
        self.last_signal_bars: Dict[str, int] = {}
        self.last_scan_time: Optional[datetime] = None
        self.scan_progress: str = "Idle"
        self.is_scanning = False
        self.worker_task: Optional[asyncio.Task] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=15)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session

    def get_uptime(self) -> str:
        delta = datetime.utcnow() - self.start_time
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        days, hours = divmod(hours, 24)
        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        return f"{hours}h {minutes}m {seconds}s"

    async def fetch_exchange_symbols(self) -> List[str]:
        """
        Retrieves all actively trading USDT Perpetual Futures symbols from Binance.
        """
        url = f"{settings.BINANCE_FUTURES_BASE_URL}/fapi/v1/exchangeInfo"
        session = await self.get_session()
        try:
            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    symbols = [
                        s["symbol"] for s in data.get("symbols", [])
                        if s.get("status") == "TRADING" 
                        and s.get("contractType") == "PERPETUAL"
                        and s.get("quoteAsset") == "USDT"
                    ]
                    logger.info("Found %d active USDT perpetual symbols on Binance", len(symbols))
                    return sorted(symbols)
                else:
                    logger.error("Failed to fetch exchangeInfo: HTTP %s", resp.status)
                    return settings.WATCHLIST
        except Exception as e:
            logger.error("Error fetching Binance symbols: %s", e)
            return settings.WATCHLIST

    async def fetch_klines(self, symbol: str, interval: str, limit: int = 250) -> List[Candle]:
        """
        Fetches historical klines for symbol adhering to rate limits.
        """
        # Handle custom 2m aggregation if specified
        fetch_interval = "1m" if interval == "2m" else interval
        url = f"{settings.BINANCE_FUTURES_BASE_URL}/fapi/v1/klines"
        params = {"symbol": symbol, "interval": fetch_interval, "limit": limit}
        
        session = await self.get_session()
        async with self.semaphore:
            try:
                await asyncio.sleep(settings.REQUEST_DELAY_SECONDS)
                async with session.get(url, params=params) as resp:
                    if resp.status == 200:
                        raw = await resp.json()
                        candles = [
                            Candle(
                                t=int(k[0]),
                                o=float(k[1]),
                                h=float(k[2]),
                                l=float(k[3]),
                                c=float(k[4]),
                                v=float(k[5])
                            ) for k in raw
                        ]
                        
                        # Aggregate to 2m if needed
                        if interval == "2m" and len(candles) >= 2:
                            agg = []
                            for i in range(0, len(candles), 2):
                                c1 = candles[i]
                                c2 = candles[i+1] if i+1 < len(candles) else c1
                                agg.append(Candle(
                                    t=c1.t,
                                    o=c1.o,
                                    h=max(c1.h, c2.h),
                                    l=min(c1.l, c2.l),
                                    c=c2.c,
                                    v=c1.v + c2.v
                                ))
                            candles = agg

                        return candles
                    elif resp.status in (429, 418):
                        logger.warning("Binance rate limit hit (HTTP %s)! Backing off...", resp.status)
                        await asyncio.sleep(2.0)
                        return []
                    else:
                        logger.debug("Failed klines for %s (HTTP %s)", symbol, resp.status)
                        return []
            except Exception as e:
                logger.debug("Network error fetching klines for %s: %s", symbol, e)
                return []

    async def analyze_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetches candles, computes indicators, trend state, and checks for EMA/VWAP signal.
        """
        candles = await self.fetch_klines(symbol, self.timeframe, limit=250)
        if len(candles) < 210:
            return None

        indicators = calculate_indicators(candles, settings.ATR_PERIOD)
        last_closed_idx = len(candles) - 2  # Evaluate confirmed closed bar
        last_candle = candles[-1]
        eval_candle = candles[last_closed_idx]
        eval_ind = indicators[last_closed_idx]

        # Calculate 24h change & cache ticker
        first_c = candles[0].c
        current_c = last_candle.c
        pct_change = ((current_c - first_c) / first_c) * 100.0 if first_c else 0.0

        trend = get_trend_state(
            candles, indicators, last_closed_idx,
            trend_mode=settings.TREND_FILTER,
            require_weekly=settings.REQUIRE_WEEKLY_VWAP
        )

        trend_dir = "UP" if trend["up"] else ("DOWN" if trend["dn"] else "NEUTRAL")
        if trend_dir in ("UP", "DOWN"):
            self.trending_pairs.append(f"{symbol} {trend_dir}")

        self.market_cache[symbol] = {
            "symbol": symbol,
            "price": current_c,
            "change_pct": round(pct_change, 3),
            "trend": trend_dir,
            "vwap": round(trend["vwap"], 6),
            "ema200": round(eval_ind["e200"], 6),
            "atr": round(eval_ind["atr"], 6),
            "updated_at": datetime.utcnow().isoformat()
        }

        # Signal check
        sig_result = evaluate_signal(
            candles, indicators, last_closed_idx,
            trend_mode=settings.TREND_FILTER,
            require_candle_color=settings.REQUIRE_CANDLE_COLOR,
            require_weekly=settings.REQUIRE_WEEKLY_VWAP
        )

        if sig_result:
            # Check bar cooldown
            bar_id = int(eval_candle.t / 1000)
            last_bar = self.last_signal_bars.get(symbol, 0)
            # Minimum cooldown in seconds (e.g. 3 bars)
            bar_interval_sec = 300 if self.timeframe == "5m" else 60
            if (bar_id - last_bar) > (settings.BAR_COOLDOWN * bar_interval_sec):
                self.last_signal_bars[symbol] = bar_id
                
                entry_price = eval_candle.c
                levels = calculate_levels(
                    entry_price, sig_result["direction"],
                    eval_ind["atr"], settings.SL_ATR_MULT, settings.TP1_RATIO
                )

                signal_dict = {
                    "symbol": symbol,
                    "direction": sig_result["direction"],
                    "strategy": "EMA/VWAP",
                    "timeframe": self.timeframe,
                    "entry_price": entry_price,
                    "sl_price": levels["sl"],
                    "tp1_price": levels["tp1"],
                    "tp2_price": levels["tp2"],
                    "tp3_price": levels["tp3"],
                    "tp4_price": levels["tp4"],
                    "risk_reward_ratio": levels["risk_reward_ratio"],
                    "atr": eval_ind["atr"],
                    "status": "OPEN",
                    "metadata": {
                        "vwap": trend["vwap"],
                        "ema200": eval_ind["e200"],
                        "bar_time": eval_candle.t
                    }
                }
                return signal_dict

        return None

    async def settle_open_signals(self):
        """
        Monitors open trades against recent candle price action to log TP/SL hits.
        """
        open_signals = self.db.get_open_signals()
        if not open_signals:
            return

        for sig in open_signals:
            sym = sig["symbol"]
            cached = self.market_cache.get(sym)
            if not cached:
                continue

            # Fetch fresh 5 candles to evaluate
            candles = await self.fetch_klines(sym, self.timeframe, limit=5)
            if not candles:
                continue

            last_c = candles[-1]
            is_long = sig["direction"] in ("LONG", "CALL")
            sl = sig["sl_price"]
            tp1 = sig["tp1_price"]
            tp2 = sig["tp2_price"]
            tp3 = sig["tp3_price"]
            tp4 = sig["tp4_price"]
            t1_hit = bool(sig.get("t1_hit", 0))
            t2_hit = bool(sig.get("t2_hit", 0))
            t3_hit = bool(sig.get("t3_hit", 0))

            # Hit checks
            sl_hit = (last_c.l <= sl) if is_long else (last_c.h >= sl)
            tp1_test = (last_c.h >= tp1) if is_long else (last_c.l <= tp1)
            tp2_test = (last_c.h >= tp2) if is_long else (last_c.l <= tp2)
            tp3_test = (last_c.h >= tp3) if is_long else (last_c.l <= tp3)
            tp4_test = (last_c.h >= tp4) if is_long else (last_c.l <= tp4)

            if sl_hit:
                final_status = "TP1 THEN SL" if t1_hit else "SL HIT"
                self.db.update_signal_status(sig["id"], final_status)
                logger.info("Signal #%d (%s) resolved: %s", sig["id"], sym, final_status)
                continue

            if not t1_hit and tp1_test:
                self.db.update_signal_status(sig["id"], "TP1 HIT", t1=True)
                logger.info("Signal #%d (%s) reached TP1!", sig["id"], sym)
            elif not t2_hit and tp2_test:
                self.db.update_signal_status(sig["id"], "TP2 HIT", t2=True)
                logger.info("Signal #%d (%s) reached TP2!", sig["id"], sym)
            elif not t3_hit and tp3_test:
                self.db.update_signal_status(sig["id"], "TP3 HIT", t3=True)
            elif tp4_test:
                self.db.update_signal_status(sig["id"], "TP4 HIT", t4=True)
                logger.info("Signal #%d (%s) reached TP4 Max Target!", sig["id"], sym)

    async def scan_once(self) -> List[Dict[str, Any]]:
        """
        Executes a single complete scan pass across all active perpetual symbols.
        """
        if self.is_scanning:
            logger.info("Scan already in progress. Skipping overlapping trigger.")
            return []

        self.is_scanning = True
        start_time = time.time()
        self.trending_pairs = []
        triggered_signals = []

        try:
            if not self.valid_symbols:
                self.valid_symbols = await self.fetch_exchange_symbols()

            total_count = len(self.valid_symbols)
            self.scan_progress = f"Scanning 0/{total_count} symbols on {self.timeframe}..."

            # Scan in controlled concurrent batches
            batch_size = 10
            for i in range(0, total_count, batch_size):
                if not self.is_running and not self.is_scanning:
                    break

                batch = self.valid_symbols[i:i + batch_size]
                tasks = [self.analyze_symbol(sym) for sym in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for res in results:
                    if isinstance(res, dict):
                        # Signal triggered!
                        sig_id = self.db.insert_signal(res)
                        res["id"] = sig_id
                        triggered_signals.append(res)
                        
                        logger.info("🔥 SIGNAL TRIGGERED: %s %s @ %s", res["symbol"], res["direction"], res["entry_price"])
                        # Send instant Telegram notification
                        asyncio.create_task(self.notifier.notify_signal(res))

                scanned_so_far = min(i + batch_size, total_count)
                self.scan_progress = f"Scanned {scanned_so_far}/{total_count} symbols ({len(self.trending_pairs)} trending, {len(triggered_signals)} signals)"

            # Settle open trades
            await self.settle_open_signals()

            elapsed = round(time.time() - start_time, 2)
            self.last_scan_time = datetime.utcnow()
            self.scan_progress = f"Completed scan of {total_count} symbols in {elapsed}s"
            self.db.log_scan(total_count, len(self.trending_pairs), len(triggered_signals), elapsed)
            logger.info("Scan completed: %d symbols, %d trending, %d new signals in %ss", total_count, len(self.trending_pairs), len(triggered_signals), elapsed)

        except Exception as e:
            logger.error("Error during scan cycle: %s", e)
            self.scan_progress = f"Error during scan: {str(e)}"
        finally:
            self.is_scanning = False

        return triggered_signals

    async def start(self):
        """
        Starts the continuous 24/7 background scanning loop.
        """
        self.is_running = True
        logger.info("Starting 24/7 Binance Futures Scanner loop (Interval: %ss, TF: %s)...", self.scan_interval, self.timeframe)
        
        while self.is_running:
            try:
                await self.scan_once()
                # Wait for next scheduled scan interval
                await asyncio.sleep(self.scan_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Exception in scanner loop: %s", e)
                await asyncio.sleep(5)

    def stop(self):
        self.is_running = False
        self.scan_progress = "Scanner paused."
        logger.info("Scanner stopped by user.")

    def set_timeframe(self, tf: str):
        self.timeframe = tf
        logger.info("Timeframe updated to %s", tf)

    def set_parameters(self, params: Dict[str, Any]):
        if "timeframe" in params:
            self.timeframe = str(params["timeframe"])
        if "scan_interval" in params:
            self.scan_interval = int(params["scan_interval"])
        logger.info("Scanner parameters updated: %s", params)
