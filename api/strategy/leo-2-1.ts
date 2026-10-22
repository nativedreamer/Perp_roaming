import { evaluateLeo21Strategy } from '../../lib/strategies/leo21Strategy';
import type { Candle } from '../../lib/types';

export const config = {
  runtime: 'nodejs20.x'
};

const ALLOWED_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']);

function normalizeSymbol(value: unknown): string {
  const symbol = String(value || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error('Invalid symbol');
  return symbol;
}

function parseCandles(value: unknown): Candle[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((c: any) => ({
    t: Number(c.t ?? c[0]),
    o: Number(c.o ?? c[1]),
    h: Number(c.h ?? c[2]),
    l: Number(c.l ?? c[3]),
    c: Number(c.c ?? c[4]),
    v: Number(c.v ?? c[5])
  })).filter(c => [c.t, c.o, c.h, c.l, c.c, c.v].every(Number.isFinite));
}

async function fetchFuturesCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Binance returned ${response.status}`);
  const rows = await response.json() as unknown;
  const candles = parseCandles(rows);
  if (!candles || candles.length === 0) throw new Error('No futures candles returned');
  return candles;
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {})) : {};
    const query = req.query || {};
    const symbol = normalizeSymbol(body.symbol || query.symbol);
    const timeframe = String(body.timeframe || query.timeframe || '5m');
    if (!ALLOWED_INTERVALS.has(timeframe)) throw new Error('Unsupported timeframe');
    const limit = Math.min(1500, Math.max(260, Number(body.limit || query.limit || 500)));
    const candles = parseCandles(body.candles) || await fetchFuturesCandles(symbol, timeframe, limit);
    const snapshot = evaluateLeo21Strategy(candles, symbol, timeframe, {
      sensitivity: Number(body.sensitivity || query.sensitivity || 5),
      atrLength: Number(body.atrLength || query.atrLength || 14),
      atrBandMultiplier: Number(body.atrBandMultiplier || query.atrBandMultiplier || 2.2),
      targetR: Number(body.targetR || query.targetR || 2),
      riskPct: Number(body.riskPct || query.riskPct || 1),
      maxLeverage: Number(body.maxLeverage || query.maxLeverage || 1),
      commissionRatePct: Number(body.commissionRatePct || query.commissionRatePct || 0.05),
      slippageTicks: Number(body.slippageTicks || query.slippageTicks || 1)
    }, Number(body.equity || query.equity || 10000));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true,
      strategy: 'LEO_2_1',
      source: body.candles ? 'request' : 'binance-futures',
      symbol,
      timeframe,
      candleCount: candles.length,
      confirmedCandleTime: candles[candles.length - 2]?.t ?? null,
      ...snapshot
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || 'Unable to evaluate strategy' });
  }
}
