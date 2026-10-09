import math
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

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
    Daily resets at UTC midnight; weekly resets at UTC week start.
    """
    if index < 0 or index >= len(candles):
        return 0.0

    target_dt = datetime.fromtimestamp(candles[index].t / 1000.0, tz=timezone.utc)
    if weekly:
        target_key = f"{target_dt.year}-W{target_dt.isocalendar()[1]}"
    else:
        target_key = target_dt.strftime("%Y-%m-%d")

    pv = 0.0
    vol = 0.0

    # Walk backwards until session boundary
    for j in range(index, -1, -1):
        dt = datetime.fromtimestamp(candles[j].t / 1000.0, tz=timezone.utc)
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
        return {
            "direction": "LONG",
            "strategy": "EMA/VWAP",
            "vwap": trend["vwap"],
            "ema200": curr_ind["e200"],
            "atr": curr_ind["atr"]
        }
    elif short_valid:
        return {
            "direction": "SHORT",
            "strategy": "EMA/VWAP",
            "vwap": trend["vwap"],
            "ema200": curr_ind["e200"],
            "atr": curr_ind["atr"]
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
