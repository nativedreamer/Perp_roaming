import math
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional, Tuple

APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "Africa/Lagos"))

class Candle:
    __slots__ = ('t', 'o', 'h', 'l', 'c', 'v')
    def __init__(self, t: int, o: float, h: float, l: float, c: float, v: float):
        self.t = t  # timestamp in ms
        self.o = o
        self.h = h
        self.l = l
        self.c = c
        self.v = v

    def to_dict(self) -> Dict[str, Any]:
        return {
            "t": self.t, "o": self.o, "h": self.h, "l": self.l, "c": self.c, "v": self.v
        }

def calculate_ema(prev_ema: Optional[float], price: float, period: int) -> float:
    if prev_ema is None:
        return price
    k = 2.0 / (period + 1.0)
    return price * k + prev_ema * (1.0 - k)

def calculate_indicators(candles: List[Candle], atr_period: int = 14) -> List[Dict[str, float]]:
    """
    Computes EMA 11, EMA 34, EMA 200, and ATR across all candles.
    """
    e11 = None
    e34 = None
    e200 = None
    atr = None
    prev_close = None
    
    results = []
    tr_list = []
    
    for c in candles:
        e11 = calculate_ema(e11, c.c, 11)
        e34 = calculate_ema(e34, c.c, 34)
        e200 = calculate_ema(e200, c.c, 200)
        
        # True Range calculation
        if prev_close is None:
            tr = c.h - c.l
        else:
            tr = max(c.h - c.l, abs(c.h - prev_close), abs(c.l - prev_close))
        tr_list.append(tr)
        prev_close = c.c
        
        results.append({
            "e11": e11,
            "e34": e34,
            "e200": e200,
            "atr": 0.0
        })

    # ATR calculation via smoothing of True Range
    curr_atr = None
    for i, tr_val in enumerate(tr_list):
        curr_atr = calculate_ema(curr_atr, tr_val, atr_period)
        results[i]["atr"] = curr_atr

    return results

def calculate_vwap(candles: List[Candle], index: int, weekly: bool = False) -> float:
    """
    Computes session-anchored VWAP up to candle at index.
    Daily resets at Africa/Lagos midnight; weekly resets at Africa/Lagos week start.
    """
    if index < 0 or index >= len(candles):
        return 0.0

    target_dt = datetime.fromtimestamp(candles[index].t / 1000.0, tz=APP_TIMEZONE)
    if weekly:
        target_key = f"{target_dt.year}-W{target_dt.isocalendar()[1]}"
    else:
        target_key = target_dt.strftime("%Y-%m-%d")

    pv = 0.0
    vol = 0.0

    # Walk backwards until session boundary
    for j in range(index, -1, -1):
        dt = datetime.fromtimestamp(candles[j].t / 1000.0, tz=APP_TIMEZONE)
        if weekly:
            k = f"{dt.year}-W{dt.isocalendar()[1]}"
        else:
            k = dt.strftime("%Y-%m-%d")
        
        if k != target_key:
            break
        
        typical_price = (candles[j].h + candles[j].l + candles[j].c) / 3.0
        c_vol = candles[j].v if candles[j].v > 0 else 1.0
        pv += typical_price * c_vol
        vol += c_vol

    return pv / vol if vol > 0 else candles[index].c

def get_trend_state(
    candles: List[Candle],
    indicators: List[Dict[str, float]],
    index: int,
    trend_mode: str = "zone",
    require_weekly: bool = False
) -> Dict[str, Any]:
    """
    Determines if market structure is Bullish (up) or Bearish (dn).
    Modes:
      - 'zone': VWAP > EMA 200 (bull zone) vs VWAP < EMA 200 (bear zone)
      - 'price': Price > VWAP and Price > EMA 200 vs Price < VWAP and Price < EMA 200
      - 'none': Unfiltered
    """
    if index < 1 or index >= len(indicators):
        return {"up": False, "dn": False, "vwap": 0.0, "weekly_vwap": 0.0, "zone_bull": False}

    c = candles[index]
    ind = indicators[index]
    vw = calculate_vwap(candles, index, weekly=False)
    wv = calculate_vwap(candles, index, weekly=True) if require_weekly else 0.0
    
    zone_bull = vw > ind["e200"]
    price_up = (c.c > vw) and (c.c > ind["e200"])
    price_dn = (c.c < vw) and (c.c < ind["e200"])

    if trend_mode == "none":
        up, dn = True, True
    elif trend_mode == "zone":
        up, dn = zone_bull, not zone_bull
    elif trend_mode == "price":
        up, dn = price_up, price_dn
    else:
        up, dn = zone_bull, not zone_bull

    if require_weekly:
        up = up and (c.c > wv)
        dn = dn and (c.c < wv)

    return {
        "up": up,
        "dn": dn,
        "vwap": vw,
        "weekly_vwap": wv,
        "zone_bull": zone_bull
    }

def calculate_signal_strength(
    candles: List[Candle],
    indicators: List[Dict[str, float]],
    index: int,
    direction: str,
    vwap: float
) -> Dict[str, Any]:
    """
    Computes a deterministic quantitative Signal Strength Score (0 to 100) based on:
      1. Momentum & EMA Spread Velocity (max 25 pts)
      2. VWAP Structural Alignment & Proximity (max 20 pts)
      3. Macro Trend Alignment with EMA 200 (max 20 pts)
      4. Relative Volume Expansion (R-Vol) (max 20 pts)
      5. Candle Conviction & Body-to-Range Ratio (max 15 pts)
    """
    c = candles[index]
    curr_ind = indicators[index]
    prev_ind = indicators[index - 1] if index > 0 else curr_ind
    atr = curr_ind.get("atr") or (c.c * 0.01)
    price = c.c
    is_long = direction in ("LONG", "CALL")

    # 1. Momentum & EMA Spread Velocity (max 25)
    ema_spread = abs(curr_ind["e11"] - curr_ind["e34"])
    spread_ratio = ema_spread / max(atr, 1e-8)
    mom_score = min(18, int(round(spread_ratio * 16)))
    prev_spread = abs(prev_ind["e11"] - prev_ind["e34"])
    if ema_spread > prev_spread:
        mom_score += 7
    else:
        mom_score += 3
    mom_score = max(5, min(25, mom_score))

    # 2. VWAP Alignment & Breakout Proximity (max 20)
    vwap_score = 0
    if is_long:
        if price > vwap:
            dist_atr = (price - vwap) / max(atr, 1e-8)
            if 0.2 <= dist_atr <= 2.5:
                vwap_score = 20
            elif 2.5 < dist_atr <= 4.0:
                vwap_score = 14
            elif dist_atr < 0.2:
                vwap_score = 12
            else:
                vwap_score = 8
        else:
            vwap_score = 2
    else:
        if price < vwap:
            dist_atr = (vwap - price) / max(atr, 1e-8)
            if 0.2 <= dist_atr <= 2.5:
                vwap_score = 20
            elif 2.5 < dist_atr <= 4.0:
                vwap_score = 14
            elif dist_atr < 0.2:
                vwap_score = 12
            else:
                vwap_score = 8
        else:
            vwap_score = 2

    # 3. Macro Trend Alignment (EMA 200) (max 20)
    trend_score = 0
    e200 = curr_ind["e200"]
    if is_long:
        if price > e200: trend_score += 8
        if curr_ind["e11"] > e200: trend_score += 6
        if curr_ind["e34"] > e200: trend_score += 6
    else:
        if price < e200: trend_score += 8
        if curr_ind["e11"] < e200: trend_score += 6
        if curr_ind["e34"] < e200: trend_score += 6

    # 4. Relative Volume Expansion (max 20)
    vol_lookback = min(20, index)
    if vol_lookback > 0:
        avg_vol = sum(candles[k].v for k in range(index - vol_lookback, index)) / vol_lookback
    else:
        avg_vol = c.v
    r_vol = c.v / max(avg_vol, 1e-8) if avg_vol > 0 else 1.0

    if r_vol >= 2.0:
        vol_score = 20
    elif r_vol >= 1.5:
        vol_score = 16
    elif r_vol >= 1.1:
        vol_score = 13
    elif r_vol >= 0.8:
        vol_score = 10
    else:
        vol_score = 5

    # 5. Candle Conviction (max 15)
    c_range = c.h - c.l
    c_body = abs(c.c - c.o)
    body_ratio = c_body / max(c_range, 1e-8) if c_range > 0 else 0.5
    direction_aligned = (c.c > c.o) if is_long else (c.c < c.o)

    if direction_aligned:
        if body_ratio >= 0.70:
            candle_score = 15
        elif body_ratio >= 0.50:
            candle_score = 12
        elif body_ratio >= 0.35:
            candle_score = 9
        else:
            candle_score = 6
    else:
        candle_score = 3

    total_score = min(100, max(15, mom_score + vwap_score + trend_score + vol_score + candle_score))

    return {
        "score": total_score,
        "breakdown": {
            "momentum": mom_score,
            "vwap": vwap_score,
            "trend": trend_score,
            "volume": vol_score,
            "conviction": candle_score
        },
        "r_vol": round(r_vol, 2),
        "body_ratio": int(round(body_ratio * 100))
    }

def evaluate_signal(
    candles: List[Candle],
    indicators: List[Dict[str, float]],
    index: int,
    trend_mode: str = "zone",
    require_candle_color: bool = True,
    require_weekly: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Evaluates candle at `index` for EMA 11/34 crossover + Trend filter confirmation.
    Returns signal dict if triggered, otherwise None.
    """
    if index < 2 or index >= len(candles):
        return None

    curr_c = candles[index]
    curr_ind = indicators[index]
    prev_ind = indicators[index - 1]

    trend = get_trend_state(candles, indicators, index, trend_mode, require_weekly)
    
    is_green = curr_c.c > curr_c.o
    is_red = curr_c.c < curr_c.o

    # Bullish Crossover: EMA 11 crosses above EMA 34
    bull_cross = (prev_ind["e11"] <= prev_ind["e34"]) and (curr_ind["e11"] > curr_ind["e34"])
    # Bearish Crossover: EMA 11 crosses below EMA 34
    bear_cross = (prev_ind["e11"] >= prev_ind["e34"]) and (curr_ind["e11"] < curr_ind["e34"])

    # Confirmation
    long_valid = bull_cross and trend["up"] and (not require_candle_color or is_green)
    short_valid = bear_cross and trend["dn"] and (not require_candle_color or is_red)

    if long_valid:
        strength = calculate_signal_strength(candles, indicators, index, "LONG", trend["vwap"])
        return {
            "direction": "LONG",
            "strategy": "EMA/VWAP",
            "vwap": trend["vwap"],
            "ema200": curr_ind["e200"],
            "atr": curr_ind["atr"],
            "signal_strength": strength["score"],
            "strength_breakdown": strength["breakdown"],
            "r_vol": strength["r_vol"],
            "body_ratio": strength["body_ratio"]
        }
    elif short_valid:
        strength = calculate_signal_strength(candles, indicators, index, "SHORT", trend["vwap"])
        return {
            "direction": "SHORT",
            "strategy": "EMA/VWAP",
            "vwap": trend["vwap"],
            "ema200": curr_ind["e200"],
            "atr": curr_ind["atr"],
            "signal_strength": strength["score"],
            "strength_breakdown": strength["breakdown"],
            "r_vol": strength["r_vol"],
            "body_ratio": strength["body_ratio"]
        }

    return None

def calculate_levels(
    entry_price: float,
    direction: str,
    atr: float,
    sl_atr_mult: float = 2.5,
    tp1_ratio: float = 1.5
) -> Dict[str, float]:
    """
    Calculates dynamic Stop-Loss and multi-tier Take-Profit targets based on ATR.
    """
    risk_dist = atr * sl_atr_mult
    tp_unit = risk_dist * tp1_ratio

    if direction in ("LONG", "CALL"):
        sl = entry_price - risk_dist
        tp1 = entry_price + tp_unit
        tp2 = entry_price + (tp_unit * 2.0)
        tp3 = entry_price + (tp_unit * 3.0)
        tp4 = entry_price + (tp_unit * 4.0)
    else:
        sl = entry_price + risk_dist
        tp1 = entry_price - tp_unit
        tp2 = entry_price - (tp_unit * 2.0)
        tp3 = entry_price - (tp_unit * 3.0)
        tp4 = entry_price - (tp_unit * 4.0)

    return {
        "sl": round(sl, 8),
        "tp1": round(tp1, 8),
        "tp2": round(tp2, 8),
        "tp3": round(tp3, 8),
        "tp4": round(tp4, 8),
        "risk_reward_ratio": round(tp1_ratio, 2)
    }
