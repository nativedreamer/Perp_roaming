import { Candle, QuantSignal, SignalMetrics, StrategyConfig } from '../types';
import { calcATR, calcEMA, calcRSI, calcSMA, calcVWAP } from '../indicators';

/**
 * Classic Perp Roaming strategy:
 * EMA 9/21 cross, 200 EMA trend zone, Session VWAP
 */
export function evaluateVwapEmaStrategy(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  config: StrategyConfig,
  targetIdx?: number
): QuantSignal | null {
  if (candles.length < 50) return null;

  const idx = targetIdx !== undefined ? targetIdx : candles.length - 2;
  if (idx < 2 || idx >= candles.length) return null;

  const closes = candles.map(c => c.c);
  const volumes = candles.map(c => c.v);

  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema200 = calcEMA(closes, 200);
  const vwapArray = calcVWAP(candles);
  const atrArray = calcATR(candles, 14);
  const rsiArray = calcRSI(closes, 14);
  const volSma = calcSMA(volumes, 20);

  const curr = candles[idx];
  const prev = candles[idx - 1];

  const e9Curr = ema9[idx];
  const e9Prev = ema9[idx - 1];
  const e21Curr = ema21[idx];
  const e21Prev = ema21[idx - 1];
  const e200Curr = ema200[idx] || curr.c;
  const vwapCurr = vwapArray[idx] || curr.c;

  const atrVal = atrArray[idx] || (curr.c * 0.01);
  const rsiVal = rsiArray[idx] || 50;
  const relVol = volSma[idx] > 0 ? (curr.v / volSma[idx]) * 100 : 100;

  const isBullCross = e9Prev <= e21Prev && e9Curr > e21Curr;
  const isBearCross = e9Prev >= e21Prev && e9Curr < e21Curr;

  if (!isBullCross && !isBearCross) return null;

  // Trend zone filters
  const bullZone = curr.c > vwapCurr && curr.c > e200Curr;
  const bearZone = curr.c < vwapCurr && curr.c < e200Curr;

  let direction: 'LONG' | 'SHORT' | null = null;
  if (isBullCross && bullZone) direction = 'LONG';
  else if (isBearCross && bearZone) direction = 'SHORT';

  if (!direction) return null;

  const isLong = direction === 'LONG';
  const entryPrice = curr.c;

  const slDist = atrVal * (config.atrMultiplierSL || 2.0);
  const tpDist = slDist * 1.5;

  const slPrice = isLong ? entryPrice - slDist : entryPrice + slDist;
  const tp1Price = isLong ? entryPrice + tpDist : entryPrice - tpDist;
  const tp2Price = isLong ? entryPrice + tpDist * 2 : entryPrice - tpDist * 2;
  const tp3Price = isLong ? entryPrice + tpDist * 3 : entryPrice - tpDist * 3;

  let score = 70;
  if (relVol > 120) score += 10;
  if (isLong && rsiVal > 55) score += 10;
  if (!isLong && rsiVal < 45) score += 10;
  score = Math.min(99, Math.max(40, score));

  const metrics: SignalMetrics = {
    buyerStrength: curr.c > curr.o ? curr.v : 0,
    sellerStrength: curr.c < curr.o ? curr.v : 0,
    rsiBuyersStrength: rsiVal >= 50 ? 'Strong' : 'Weak',
    rsiSellersStrength: rsiVal <= 50 ? 'Strong' : 'Weak',
    relVolumePct: Number(relVol.toFixed(1)),
    volumeStatus: relVol > 100 ? 'High Volume' : 'Normal / Low',
    orderBlockNearby: false,
    atrValue: atrVal
  };

  return {
    id: `sig-vwap-${symbol}-${curr.t}`,
    symbol,
    direction,
    timeframe,
    entryPrice,
    currentPrice: candles[candles.length - 1].c,
    slPrice,
    tp1Price,
    tp2Price,
    tp3Price,
    strengthScore: score,
    strategyName: 'VWAP_EMA',
    timestamp: curr.t,
    metrics
  };
}
