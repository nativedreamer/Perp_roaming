"""Deterministic paper/compound simulation helpers.

The engine is deliberately side-effect free so the API, browser backtest, and
unit tests can share the same risk calculations.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class SimulationConfig:
    starting_equity: float = 10_000.0
    base_trade_size: float = 100.0
    compound_allocation_pct: float = 10.0
    signal_score_threshold: float = 80.0
    risk_per_trade_pct: float = 1.0
    min_leverage: float = 5.0
    max_leverage: float = 10.0
    tp_mode: str = "rr"  # rr | percentage
    tp_rr: float = 1.5
    tp_percentage: float = 5.0
    sl_atr_mult: float = 2.5


def dynamic_leverage(score: float, minimum: float = 5.0, maximum: float = 10.0) -> float:
    """Linearly scale leverage from 5x at score 60 to 10x at score 90+."""
    bounded = max(60.0, min(90.0, float(score)))
    ratio = (bounded - 60.0) / 30.0
    return round(minimum + ratio * (maximum - minimum), 2)


def build_trade_levels(
    entry_price: float,
    direction: str,
    atr: float,
    signal_score: float,
    equity: float,
    config: SimulationConfig,
) -> Dict[str, float]:
    """Calculate leverage, margin, position size, SL and TP from current equity."""
    leverage = dynamic_leverage(signal_score, config.min_leverage, config.max_leverage)
    is_compound = signal_score > config.signal_score_threshold
    margin = equity * (config.compound_allocation_pct / 100.0) if is_compound else config.base_trade_size
    margin = max(0.0, min(margin, equity))
    position_size = margin * leverage

    # User-specified dynamic stop formula expressed as a percentage of entry.
    risk_fraction = max(0.0, config.risk_per_trade_pct / 100.0)
    sl_distance_pct = (equity * risk_fraction) / max(position_size * leverage, 1e-9)
    atr_distance_pct = (max(atr, entry_price * 0.0001) * config.sl_atr_mult) / max(entry_price, 1e-9)
    sl_distance_pct = min(max(sl_distance_pct, 0.0001), max(atr_distance_pct, 0.0001))

    if config.tp_mode == "percentage":
        tp_distance_pct = max(0.0001, config.tp_percentage / 100.0)
    else:
        tp_distance_pct = sl_distance_pct * max(0.1, config.tp_rr)

    is_long = direction in ("LONG", "CALL")
    sl = entry_price * (1 - sl_distance_pct if is_long else 1 + sl_distance_pct)
    tp1 = entry_price * (1 + tp_distance_pct if is_long else 1 - tp_distance_pct)
    tp2 = entry_price * (1 + tp_distance_pct * 2 if is_long else 1 - tp_distance_pct * 2)
    return {
        "leverage": leverage,
        "margin": round(margin, 8),
        "position_size": round(position_size, 8),
        "sl_distance_pct": round(sl_distance_pct * 100, 6),
        "tp_distance_pct": round(tp_distance_pct * 100, 6),
        "sl": round(sl, 8),
        "tp1": round(tp1, 8),
        "tp2": round(tp2, 8),
        "compound": is_compound,
    }


def funding_pnl(position_size: float, direction: str, funding_rate: float, hours: float) -> float:
    """Return funding PnL; positive means a credit to equity."""
    periods = max(0.0, hours) / 8.0
    fee = position_size * funding_rate * periods
    return round(-fee if direction in ("LONG", "CALL") else fee, 8)


def settle_trade(
    trade: Dict[str, Any],
    exit_price: float,
    exit_time_ms: int,
    funding_rate: float = 0.0,
) -> Dict[str, Any]:
    """Calculate leveraged price PnL plus accrued funding for a closed trade."""
    direction = trade["direction"]
    move = (exit_price - trade["entry"]) / trade["entry"]
    if direction not in ("LONG", "CALL"):
        move = -move
    gross_pnl = trade["position_size"] * move
    hours = max(0.0, exit_time_ms - trade["entry_time_ms"]) / 3_600_000.0
    funding = funding_pnl(trade["position_size"], direction, funding_rate, hours)
    return {
        "gross_pnl": round(gross_pnl, 8),
        "funding_pnl": funding,
        "net_pnl": round(gross_pnl + funding, 8),
        "funding_rate": funding_rate,
        "hours_held": round(hours, 4),
    }
