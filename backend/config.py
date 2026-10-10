import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App Settings (runs zero-config out of the box)
    APP_NAME: str = "EMA VWAP Binance Futures 24/7 Scanner"
    APP_VERSION: str = "2.1.0"
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    APP_TIMEZONE: str = os.getenv("APP_TIMEZONE", "Africa/Lagos")

    # Binance Perpetuals Settings
    BINANCE_FUTURES_BASE_URL: str = "https://fapi.binance.com"
    BINANCE_TIMEFRAME: str = os.getenv("BINANCE_TIMEFRAME", "5m") # 1m, 3m, 5m, 15m, 30m, 1h, 4h, 1d
    SCAN_INTERVAL_SECONDS: int = int(os.getenv("SCAN_INTERVAL_SECONDS", "30"))
    MAX_CONCURRENT_REQUESTS: int = int(os.getenv("MAX_CONCURRENT_REQUESTS", "8"))
    REQUEST_DELAY_SECONDS: float = float(os.getenv("REQUEST_DELAY_SECONDS", "0.05"))

    # Strategy Parameters
    EMA_FAST: int = int(os.getenv("EMA_FAST", "11"))
    EMA_SLOW: int = int(os.getenv("EMA_SLOW", "34"))
    EMA_TREND: int = int(os.getenv("EMA_TREND", "200"))
    ATR_PERIOD: int = int(os.getenv("ATR_PERIOD", "14"))
    SL_ATR_MULT: float = float(os.getenv("SL_ATR_MULT", "2.5"))
    TP1_RATIO: float = float(os.getenv("TP1_RATIO", "1.5")) # TP1 = SL * 1.5
    TREND_FILTER: str = os.getenv("TREND_FILTER", "zone") # "zone", "price", "none"
    REQUIRE_CANDLE_COLOR: bool = os.getenv("REQUIRE_CANDLE_COLOR", "true").lower() == "true"
    REQUIRE_WEEKLY_VWAP: bool = os.getenv("REQUIRE_WEEKLY_VWAP", "false").lower() == "true"
    BAR_COOLDOWN: int = int(os.getenv("BAR_COOLDOWN", "3"))

    # Database Path
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "signals.db")

    # Target Symbols fallback
    WATCHLIST: List[str] = [
        "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", 
        "XRPUSDT", "ADAUSDT", "DOGEUSDT", "AVAXUSDT"
    ]

    class Config:
        extra = "ignore"

settings = Settings()
