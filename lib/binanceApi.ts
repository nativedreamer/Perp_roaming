import { Candle } from './types';

// Curated list of 120+ major liquid Perpetual / USDT pairs
export const INITIAL_POPULAR_PAIRS: string[] = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'SUIUSDT',
  'PEPEUSDT',
  'NEARUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'ADAUSDT',
  'SHIBUSDT',
  'TIAUSDT',
  'INJUSDT',
  'APTUSDT',
  'ARBUSDT',
  'OPUSDT',
  'DOTUSDT',
  'ATOMUSDT',
  'RENDERUSDT',
  'ICPUSDT',
  'KASUSDT',
  'FETUSDT',
  'WIFUSDT',
  'FLOKIUSDT',
  'BONKUSDT',
  'TONUSDT',
  'TAOUSDT',
  'SEIUSDT',
  'JUPUSDT',
  'PYTHUSDT',
  'STRKUSDT',
  'STXUSDT',
  'AAVEUSDT',
  'MKRUSDT',
  'UNIUSDT',
  'LTCUSDT',
  'BCHUSDT',
  'ETCUSDT',
  'FILUSDT',
  'LDOUSDT',
  'PENDLEUSDT',
  'ONDOUSDT',
  'CRVUSDT',
  'DYDXUSDT',
  'RUNEUSDT',
  'GALAUSDT',
  'SANDUSDT',
  'MANAUSDT',
  'AXSUSDT',
  'BLURUSDT',
  'ENSUSDT',
  'BEAMUSDT',
  'IMXUSDT',
  'CHZUSDT',
  'APEUSDT',
  'WLDUSDT',
  'BOMEUSDT',
  'MEWUSDT',
  'POPCATUSDT',
  'NEIROUSDT',
  'TURBOUSDT',
  'ORDIUSDT',
  'MEMEUSDT',
  'JASMYUSDT',
  'BIGTIMEUSDT',
  'NOTUSDT',
  'SUPERUSDT',
  'GMXUSDT',
  'SNXUSDT',
  'WOOUSDT',
  'KAVAUSDT',
  'FLOWUSDT',
  'MINAUSDT',
  'CFXUSDT',
  'THETAUSDT',
  'ALGOUSDT',
  'EGLDUSDT',
  'EOSUSDT',
  'XTZUSDT',
  'ZILUSDT',
  'IOTAUSDT',
  'ROSEUSDT',
  'GMTUSDT',
  'MASKUSDT',
  'QNTUSDT',
  'WAVESUSDT',
  'FXSUSDT',
  'KSMUSDT',
  'FTTUSDT',
  '1INCHUSDT',
  'ACHUSDT',
  'AGLDUSDT',
  'AKROUSDT',
  'ALICEUSDT',
  'ALPHAUSDT',
  'AMBUSDT',
  'ANKRUSDT',
  'ANTUSDT',
  'APEUSDT',
  'API3USDT',
  'ARUSDT',
  'ARKMUSDT',
  'ASTRUSDT',
  'AUDIOUSDT',
  'BAKEUSDT',
  'BALUSDT',
  'BANDUSDT',
  'BATUSDT',
  'BICOUSDT',
  'BLZUSDT',
  'BNTXUSDT',
  'CELOUSDT',
  'CKBUSDT',
  'COMPUSDT',
  'COTIUSDT',
  'CTKUSDT',
  'DARUSDT',
  'DENTUSDT',
  'DGBUSDT',
  'DUSKUSDT',
  'DYMUSDT'
];

export const POPULAR_PERP_PAIRS = INITIAL_POPULAR_PAIRS;

// Base fallback prices for reference
const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 84200,
  ETHUSDT: 2560,
  SOLUSDT: 182.5,
  BNBUSDT: 590.2,
  XRPUSDT: 0.548,
  DOGEUSDT: 0.128,
  SUIUSDT: 2.15,
  PEPEUSDT: 0.00000418,
  NEARUSDT: 4.85,
  AVAXUSDT: 28.4,
  LINKUSDT: 11.6,
  ADAUSDT: 0.355,
  SHIBUSDT: 0.0000185,
  TIAUSDT: 5.4,
  INJUSDT: 22.8,
  APTUSDT: 9.3,
  ARBUSDT: 0.58,
  OPUSDT: 1.62,
  DOTUSDT: 4.35,
  ATOMUSDT: 4.75,
  RENDERUSDT: 6.2,
  ICPUSDT: 8.4,
  FETUSDT: 1.45,
  WIFUSDT: 2.65,
  FLOKIUSDT: 0.000155,
  BONKUSDT: 0.0000225,
  TONUSDT: 5.25,
  TAOUSDT: 585.0,
  SEIUSDT: 0.44,
  JUPUSDT: 0.88,
  PYTHUSDT: 0.36,
  STRKUSDT: 0.42,
  STXUSDT: 1.78,
  AAVEUSDT: 162.0,
  MKRUSDT: 1540.0,
  UNIUSDT: 7.9,
  LTCUSDT: 68.5,
  BCHUSDT: 345.0,
  ETCUSDT: 19.8,
  FILUSDT: 3.8,
  LDOUSDT: 1.25,
  PENDLEUSDT: 4.65,
  ONDOUSDT: 0.78,
  CRVUSDT: 0.28,
  DYDXUSDT: 1.05,
  RUNEUSDT: 5.2
};

// Interval string to milliseconds helper
export function intervalToMs(interval: string): number {
  switch (interval) {
    case '1m': return 60 * 1000;
    case '3m': return 3 * 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '30m': return 30 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 5 * 60 * 1000;
  }
}

// Simulated candle generator for offline/fallback mode
export function generateSyntheticCandles(symbol: string, interval: string = '5m', count: number = 100): Candle[] {
  let base = BASE_PRICES[symbol];
  if (!base) {
    // Generate deterministic baseline price based on symbol chars
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
    const modulo = (hash % 1000) + 1;
    base = symbol.includes('PEPE') || symbol.includes('SHIB') || symbol.includes('BONK')
      ? 0.00001 + (modulo / 10000000)
      : modulo > 800
      ? 20 + modulo
      : modulo > 400
      ? 5 + (modulo / 50)
      : 0.5 + (modulo / 200);
  }

  const now = Date.now();
  const intervalMs = intervalToMs(interval);
  const candles: Candle[] = [];

  let currentPrice = base;
  const volatility = base > 1000 ? 0.003 : base < 0.01 ? 0.008 : 0.005;

  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * intervalMs;
    const drift = (Math.random() - 0.49) * volatility;
    const o = currentPrice;
    const c = +(o * (1 + drift)).toFixed(base < 0.01 ? 8 : base < 1 ? 4 : 2);
    const spread = Math.abs(c - o) + (o * volatility * 0.5);
    const h = +(Math.max(o, c) + Math.random() * spread).toFixed(base < 0.01 ? 8 : base < 1 ? 4 : 2);
    const l = +(Math.min(o, c) - Math.random() * spread).toFixed(base < 0.01 ? 8 : base < 1 ? 4 : 2);
    const v = +(Math.random() * 8000 + 800).toFixed(2);

    candles.push({ t, o, h, l, c, v });
    currentPrice = c;
  }

  return candles;
}

// Endpoints list: Binance Spot public API allows universal CORS across web environments
const SPOT_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com'
];

let activeEndpointIndex = 0;

function getEndpoint(): string {
  return SPOT_ENDPOINTS[activeEndpointIndex % SPOT_ENDPOINTS.length];
}

function rotateEndpoint(): void {
  activeEndpointIndex = (activeEndpointIndex + 1) % SPOT_ENDPOINTS.length;
}

// Normalize symbols (e.g. 1000PEPEUSDT -> PEPEUSDT)
export function normalizeSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.startsWith('1000PEPE')) return 'PEPEUSDT';
  if (s.startsWith('1000BONK')) return 'BONKUSDT';
  if (s.startsWith('1000SATS')) return 'SATSUSDT';
  if (s.startsWith('1000FLOKI')) return 'FLOKIUSDT';
  return s;
}

/**
 * Dynamically queries Binance for ALL available USDT perpetual/spot trading pairs.
 * Filters out stablecoins and leveraged tokens, sorted by quote trading volume.
 * Does NOT limit the count.
 */
export async function fetchAllAvailablePerpPairs(): Promise<string[]> {
  for (let attempt = 0; attempt < SPOT_ENDPOINTS.length; attempt++) {
    const base = getEndpoint();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`${base}/api/v3/ticker/24hr`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const STABLE_EXCLUSIONS = new Set([
            'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'BUSDUSDT', 'EURUSDT', 'GBPUSDT', 'DAIUSDT', 'AEURUSDT', 'USD1USDT'
          ]);

          const filtered = data
            .filter((t: any) => {
              const sym: string = t.symbol;
              if (!sym.endsWith('USDT')) return false;
              if (STABLE_EXCLUSIONS.has(sym)) return false;
              // Ignore leveraged token products
              if (sym.includes('UPUSDT') || sym.includes('DOWNUSDT') || sym.includes('BULLUSDT') || sym.includes('BEARUSDT')) {
                return false;
              }
              const vol = parseFloat(t.quoteVolume || '0');
              return vol > 50000; // Has active trading volume
            })
            .sort((a: any, b: any) => parseFloat(b.quoteVolume || '0') - parseFloat(a.quoteVolume || '0'))
            .map((t: any) => t.symbol);

          if (filtered.length >= 30) {
            return filtered;
          }
        }
      } else {
        rotateEndpoint();
      }
    } catch {
      rotateEndpoint();
    }
  }

  return INITIAL_POPULAR_PAIRS;
}

/**
 * Fetches klines with fallback to synthetic data
 */
export async function fetchKlines(
  symbol: string,
  interval: string = '5m',
  limit: number = 200
): Promise<Candle[]> {
  const normSym = normalizeSymbol(symbol);

  // Try Binance Spot endpoints with automatic rotation
  for (let attempt = 0; attempt < SPOT_ENDPOINTS.length; attempt++) {
    const base = getEndpoint();
    const url = `${base}/api/v3/klines?symbol=${normSym}&interval=${interval}&limit=${limit}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);

      if (res.ok) {
        const raw = await res.json();
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.map((k: any) => ({
            t: Number(k[0]),
            o: Number(k[1]),
            h: Number(k[2]),
            l: Number(k[3]),
            c: Number(k[4]),
            v: Number(k[5])
          }));
        }
      } else {
        rotateEndpoint();
      }
    } catch {
      rotateEndpoint();
    }
  }

  // Graceful fallback to synthetic candles so chart, strategy scanner, and paper execution never break
  return generateSyntheticCandles(normSym, interval, limit);
}

export async function fetchFundingRate(symbol: string): Promise<number> {
  const normSym = normalizeSymbol(symbol);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${normSym}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return Number(data.lastFundingRate || 0.0001);
    }
  } catch {
    // Browser CORS or network block on fapi
  }
  return 0.0001;
}

export async function fetch24hTickers(): Promise<Record<string, { price: number; change24h: number; high: number; low: number; volume: number }>> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const base = getEndpoint();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${base}/api/v3/ticker/24hr`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        const map: Record<string, any> = {};
        for (const item of data) {
          if (item.symbol.endsWith('USDT')) {
            map[item.symbol] = {
              price: Number(item.lastPrice),
              change24h: Number(item.priceChangePercent),
              high: Number(item.highPrice),
              low: Number(item.lowPrice),
              volume: Number(item.quoteVolume)
            };
          }
        }
        return map;
      }
    } catch {
      rotateEndpoint();
    }
  }

  // Fallback map from BASE_PRICES
  const fallbackMap: Record<string, any> = {};
  for (const [sym, price] of Object.entries(BASE_PRICES)) {
    fallbackMap[sym] = {
      price,
      change24h: +(Math.random() * 4 - 1.5).toFixed(2),
      high: +(price * 1.025).toFixed(2),
      low: +(price * 0.98).toFixed(2),
      volume: 12500000
    };
  }
  return fallbackMap;
}
