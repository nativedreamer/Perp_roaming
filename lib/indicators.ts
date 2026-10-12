import { Candle } from './types';

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calcEMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  if (values.length < period) return result;

  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEMA = sum / period;
  result[period - 1] = prevEMA;

  for (let i = period; i < values.length; i++) {
    const ema = values[i] * k + prevEMA * (1 - k);
    result[i] = ema;
    prevEMA = ema;
  }
  return result;
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calcSMA(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(0);
  if (values.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }
  return result;
}

/**
 * Calculates Average True Range (ATR)
 */
export function calcATR(candles: Candle[], period: number = 14): number[] {
  const tr: number[] = new Array(candles.length).fill(0);
  if (candles.length < 2) return tr;

  tr[0] = candles[0].h - candles[0].l;
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].h - candles[i].l;
    const hpc = Math.abs(candles[i].h - candles[i - 1].c);
    const lpc = Math.abs(candles[i].l - candles[i - 1].c);
    tr[i] = Math.max(hl, hpc, lpc);
  }

  // RMA / Wilder's Smoothing for ATR
  const atr: number[] = new Array(candles.length).fill(0);
  if (candles.length < period) return atr;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  let prevATR = sum / period;
  atr[period - 1] = prevATR;

  for (let i = period; i < candles.length; i++) {
    prevATR = (prevATR * (period - 1) + tr[i]) / period;
    atr[i] = prevATR;
  }
  return atr;
}

/**
 * Calculates Relative Strength Index (RSI) using Wilder's Smoothing
 */
export function calcRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss += Math.abs(diff);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - 100 / (1 + rs);
    }
  }

  return rsi;
}

/**
 * Calculates Volume Weighted Average Price (VWAP) anchored per session
 */
export function calcVWAP(candles: Candle[]): number[] {
  const result: number[] = new Array(candles.length).fill(0);
  let cumVol = 0;
  let cumTypicalVol = 0;
  let currentDay = '';

  for (let i = 0; i < candles.length; i++) {
    const d = new Date(candles[i].t).toISOString().slice(0, 10);
    if (d !== currentDay) {
      currentDay = d;
      cumVol = 0;
      cumTypicalVol = 0;
    }
    const typical = (candles[i].h + candles[i].l + candles[i].c) / 3;
    const vol = candles[i].v > 0 ? candles[i].v : 1;
    cumTypicalVol += typical * vol;
    cumVol += vol;

    result[i] = cumVol > 0 ? cumTypicalVol / cumVol : candles[i].c;
  }
  return result;
}

/**
 * Format cryptocurrency prices according to magnitude
 */
export function formatPrice(price?: number | null): string {
  if (price === null || price === undefined || typeof price !== 'number' || isNaN(price) || !isFinite(price)) {
    return '0.00';
  }
  if (price === 0) return '0.00';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.001) return price.toFixed(6);
  return price.toFixed(8);
}
