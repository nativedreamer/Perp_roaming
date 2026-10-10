from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

import aiohttp

from backend.config import settings


class FundingRateCache:
    """Small in-memory TTL cache for current Binance Futures funding rates."""

    def __init__(self, ttl_seconds: int = 28_800):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()
        self._last_request = 0.0

    async def get(self, symbol: str) -> Dict[str, Any]:
        symbol = symbol.strip().upper()
        now = time.monotonic()
        cached = self._cache.get(symbol)
        if cached and now - cached[0] < self.ttl_seconds:
            return cached[1]

        async with self._lock:
            cached = self._cache.get(symbol)
            now = time.monotonic()
            if cached and now - cached[0] < self.ttl_seconds:
                return cached[1]
            # Keep calls serialized and spaced even when several symbols expire together.
            await asyncio.sleep(max(0.0, 0.2 - (now - self._last_request)))
            self._last_request = time.monotonic()
            result = await self._fetch(symbol)
            self._cache[symbol] = (time.monotonic(), result)
            return result

    async def _fetch(self, symbol: str) -> Dict[str, Any]:
        url = f"{settings.BINANCE_FUTURES_BASE_URL}/fapi/v1/fundingRate"
        params = {"symbol": symbol, "limit": 1}
        delay = 0.5
        for attempt in range(4):
            try:
                timeout = aiohttp.ClientTimeout(total=8)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(url, params=params) as response:
                        if response.status == 429 or response.status == 418:
                            if attempt == 3:
                                break
                            await asyncio.sleep(delay)
                            delay = min(delay * 2, 8.0)
                            continue
                        if response.status != 200:
                            break
                        payload = await response.json()
                        row = payload[-1] if isinstance(payload, list) and payload else {}
                        return {
                            "symbol": symbol,
                            "funding_rate": float(row.get("fundingRate", 0.0)),
                            "funding_time": int(row.get("fundingTime", 0)),
                            "source": "binance-futures",
                            "cached_at": time.time(),
                        }
            except (aiohttp.ClientError, asyncio.TimeoutError):
                if attempt == 3:
                    break
                await asyncio.sleep(delay)
                delay = min(delay * 2, 8.0)
        return {"symbol": symbol, "funding_rate": 0.0, "funding_time": 0, "source": "unavailable"}


funding_rates = FundingRateCache()
