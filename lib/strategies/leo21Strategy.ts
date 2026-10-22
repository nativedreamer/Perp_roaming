import { Candle, QuantSignal, SignalMetrics } from '../types';
import { calcATR, calcEMA, calcRSI, calcSMA } from '../indicators';

export interface Leo21Config {
  sensitivity?: number;
  atrLength?: number;
  atrBandMultiplier?: number;
  targetR?: number;
  riskPct?: number;
  maxLeverage?: number;
  commissionRatePct?: number;
  slippageTicks?: number;
}

export interface Leo21Snapshot {
  signal: QuantSignal | null;
  trend: 'BULL' | 'BEAR' | 'RANGE';
  atr: number;
  macd: number;
  ema150: number;
  ema250: number;
  hma55: number;
  dchannel: number;
  stop: number | null;
  target: number | null;
  suggestedQuantity: number;
  suggestedNotional: number;
  riskAmount: number;
}

const DEFAULTS: Required<Leo21Config> = {
  sensitivity: 5,
  atrLength: 14,
  atrBandMultiplier: 2.2,
  targetR: 2,
  riskPct: 1,
  maxLeverage: 1,
  commissionRatePct: 0.05,
  slippageTicks: 1
};

function sma(values: number[], period: number, idx: number): number {
  if (idx < period - 1) return values[idx] ?? 0;
  let sum = 0;
  for (let i = idx - period + 1; i <= idx; i++) sum += values[i];
  return sum / period;
}

function wma(values: number[], period: number, idx: number): number {
  if (idx < period - 1) return values[idx] ?? 0;
  let weighted = 0;
  let denominator = 0;
  for (let i = 0; i < period; i++) {
    const weight = i + 1;
    weighted += values[idx - period + 1 + i] * weight;
    denominator += weight;
  }
  return weighted / denominator;
}

function hma(values: number[], period: number, idx: number): number {
  const half = Math.max(2, Math.floor(period / 2));
  const sqrt = Math.max(2, Math.floor(Math.sqrt(period)));
  const series: number[] = [];
  for (let i = 0; i <= idx; i++) series.push(2 * wma(values, half, i) - wma(values, period, i));
  return wma(series, sqrt, idx);
}

function macd(values: number[], idx: number): { value: number; previous: number } {
  const fast = calcEMA(values, 12);
  const slow = calcEMA(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  return { value: line[idx] || 0, previous: line[idx - 1] || 0 };
}

function highest(values: number[], period: number, idx: number): number {
  const start = Math.max(0, idx - period + 1);
  return Math.max(...values.slice(start, idx + 1));
}

function lowest(values: number[], period: number, idx: number): number {
  const start = Math.max(0, idx - period + 1);
  return Math.min(...values.slice(start, idx + 1));
}

/**
 * Port of the supplied Pine strategy's executable signal path.
 * Signals are evaluated on the last confirmed candle (the penultimate input bar).
 */
export function evaluateLeo21Strategy(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  config: Leo21Config = {},
  equity = 10000
): Leo21Snapshot {
  const cfg = { ...DEFAULTS, ...config };
  const empty: Leo21Snapshot = {
    signal: null,
    trend: 'RANGE',
    atr: 0,
    macd: 0,
    ema150: 0,
    ema250: 0,
    hma55: 0,
    dchannel: 0,
    stop: null,
    target: null,
    suggestedQuantity: 0,
    suggestedNotional: 0,
    riskAmount: equity * cfg.riskPct / 100
  };
  if (candles.length < 260) return empty;

  const idx = candles.length - 2;
  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v);
  const atrArray = calcATR(candles, cfg.atrLength);
  const ema150Arr = calcEMA(closes, 150);
  const ema250Arr = calcEMA(closes, 250);
  const rsiArr = calcRSI(closes, 14);
  const volSma = calcSMA(volumes, 20);
  const atr = atrArray[idx] || closes[idx] * 0.01;
  const ema150 = ema150Arr[idx] || closes[idx];
  const ema250 = ema250Arr[idx] || closes[idx];
  const hma55 = hma(closes, 55, idx);
  const hma55Prev2 = hma(closes, 55, idx - 2);
  const macdNow = macd(closes, idx);
  const priorHigh = highest(highs, 30, idx - 1);
  const priorLow = lowest(lows, 30, idx - 1);
  const maintrend = closes[idx] > priorHigh ? 1 : closes[idx] < priorLow ? -1 : 0;
  const prevMaintrend = closes[idx - 1] > highest(highs, 30, idx - 2) ? 1 : closes[idx - 1] < lowest(lows, 30, idx - 2) ? -1 : 0;

  // The supplied script uses an ATR supertrend and confirms with MACD, EMA150/250,
  // HMA55 slope, and the 30-bar Donchian direction.
  const upper = closes[idx] + cfg.sensitivity * atr;
  const lower = closes[idx] - cfg.sensitivity * atr;
  const prevUpper = closes[idx - 1] + cfg.sensitivity * (atrArray[idx - 1] || atr);
  const prevLower = closes[idx - 1] - cfg.sensitivity * (atrArray[idx - 1] || atr);
  const supertrendBull = closes[idx] > prevUpper || (closes[idx - 1] > prevUpper && closes[idx] > lower);
  const supertrendBear = closes[idx] < prevLower || (closes[idx - 1] < prevLower && closes[idx] < upper);
  const crossedUp = supertrendBull && !supertrendBear && closes[idx - 1] <= prevUpper;
  const crossedDown = supertrendBear && !supertrendBull && closes[idx - 1] >= prevLower;
  const bull = (crossedUp || (crossedUp && prevMaintrend < 0)) && macdNow.value > 0 && macdNow.value > macdNow.previous && ema150 > ema250 && hma55 > hma55Prev2 && maintrend > 0;
  const bear = (crossedDown || (crossedDown && prevMaintrend > 0)) && macdNow.value < 0 && macdNow.value < macdNow.previous && ema150 < ema250 && hma55 < hma55Prev2 && maintrend < 0;
  const trend = bull || (ema150 > ema250 && hma55 > hma55Prev2) ? 'BULL' : bear || (ema150 < ema250 && hma55 < hma55Prev2) ? 'BEAR' : 'RANGE';
  if (!bull && !bear) return { ...empty, trend, atr, macd: macdNow.value, ema150, ema250, hma55, dchannel: maintrend };

  const curr = candles[idx];
  const direction = bull ? 'LONG' : 'SHORT';
  const entryPrice = curr.c;
  const atrStop = bull ? curr.l - atr * cfg.atrBandMultiplier : curr.h + atr * cfg.atrBandMultiplier;
  const riskPerUnit = Math.abs(entryPrice - atrStop);
  const target = bull ? entryPrice + riskPerUnit * cfg.targetR : entryPrice - riskPerUnit * cfg.targetR;
  const tick = Math.max(Number.EPSILON, Math.abs(curr.h - curr.l) / Math.max(1, Math.round(Math.abs(curr.h - curr.l) / Math.max(curr.c * 1e-6, Number.EPSILON))));
  const slippedEntry = bull ? entryPrice + tick * cfg.slippageTicks : entryPrice - tick * cfg.slippageTicks;
  const riskAmount = Math.max(0, equity) * cfg.riskPct / 100;
  const riskQuantity = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  const leverageCapQuantity = slippedEntry > 0 ? Math.max(0, equity) * cfg.maxLeverage / slippedEntry : 0;
  const suggestedQuantity = Math.min(riskQuantity, leverageCapQuantity);
  const suggestedNotional = suggestedQuantity * slippedEntry;
  const rsi = rsiArr[idx] || 50;
  const relVol = volSma[idx] > 0 ? curr.v / volSma[idx] * 100 : 100;
  const score = Math.min(99, 70 + (relVol > 100 ? 10 : 0) + (bull && rsi > 50 || bear && rsi < 50 ? 10 : 0));
  const metrics: SignalMetrics = {
    buyerStrength: bull ? curr.v : 0,
    sellerStrength: bear ? curr.v : 0,
    rsiBuyersStrength: rsi >= 50 ? 'Strong' : 'Weak',
    rsiSellersStrength: rsi <= 50 ? 'Strong' : 'Weak',
    relVolumePct: Number(relVol.toFixed(1)),
    volumeStatus: relVol > 100 ? 'High Volume' : 'Normal / Low',
    orderBlockNearby: false,
    atrValue: atr
  };
  const signal: QuantSignal = {
    id: `sig-leo21-${symbol}-${curr.t}`,
    symbol,
    direction,
    timeframe,
    entryPrice: slippedEntry,
    currentPrice: candles[candles.length - 1].c,
    slPrice: atrStop,
    tp1Price: bull ? entryPrice + riskPerUnit : entryPrice - riskPerUnit,
    tp2Price: target,
    tp3Price: bull ? entryPrice + riskPerUnit * 3 : entryPrice - riskPerUnit * 3,
    strengthScore: score,
    strategyName: 'LEO_2_1',
    timestamp: curr.t,
    metrics
  };
  return { signal, trend, atr, macd: macdNow.value, ema150, ema250, hma55, dchannel: maintrend, stop: atrStop, target, suggestedQuantity, suggestedNotional, riskAmount };
}

export const LEO21_DEFAULTS = DEFAULTS;
