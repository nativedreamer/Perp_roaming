export const config = { runtime: 'nodejs' };
const ALLOWED_INTERVALS = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']);
const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function normalizeSymbol(value: unknown): string {
  const symbol = String(value || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error('Invalid symbol');
  return symbol;
}

function parseCandles(value: unknown): any[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((c: any) => ({
    t: Number(c.t ?? c[0]), o: Number(c.o ?? c[1]), h: Number(c.h ?? c[2]),
    l: Number(c.l ?? c[3]), c: Number(c.c ?? c[4]), v: Number(c.v ?? c[5])
  })).filter(c => [c.t, c.o, c.h, c.l, c.c, c.v].every(Number.isFinite));
}

async function fetchFuturesCandles(symbol: string, interval: string, limit: number): Promise<any[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Binance returned ${response.status}`);
    const candles = parseCandles(await response.json());
    if (!candles || candles.length === 0) throw new Error('No futures candles returned');
    return candles;
  } finally {
    clearTimeout(timeout);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  try {
    const url = new URL(request.url);
    const query = url.searchParams;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) as any : {};
    const symbol = normalizeSymbol(body.symbol || query.get('symbol'));
    const timeframe = String(body.timeframe || query.get('timeframe') || '5m');
    if (!ALLOWED_INTERVALS.has(timeframe)) throw new Error('Unsupported timeframe');
    const limit = Math.min(1500, Math.max(260, Number(body.limit || query.get('limit') || 500)));
    const suppliedCandles = parseCandles(body.candles);
    const candles = suppliedCandles || await fetchFuturesCandles(symbol, timeframe, limit);
    const { evaluateLeo21Strategy } = await import('../../lib/strategies/leo21Strategy');
    const snapshot = evaluateLeo21Strategy(candles, symbol, timeframe, {
      sensitivity: Number(body.sensitivity || query.get('sensitivity') || 5),
      atrLength: Number(body.atrLength || query.get('atrLength') || 14),
      atrBandMultiplier: Number(body.atrBandMultiplier || query.get('atrBandMultiplier') || 2.2),
      targetR: Number(body.targetR || query.get('targetR') || 2),
      riskPct: Number(body.riskPct || query.get('riskPct') || 1),
      maxLeverage: Number(body.maxLeverage || query.get('maxLeverage') || 1),
      commissionRatePct: Number(body.commissionRatePct || query.get('commissionRatePct') || 0.05),
      slippageTicks: Number(body.slippageTicks || query.get('slippageTicks') || 1)
    }, Number(body.equity || query.get('equity') || 10000));
    return json({ ok: true, strategy: 'LEO_2_1', source: suppliedCandles ? 'request' : 'binance-futures', symbol, timeframe, candleCount: candles.length, confirmedCandleTime: candles[candles.length - 2]?.t ?? null, ...snapshot });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'Unable to evaluate strategy' }, 400);
  }
}
