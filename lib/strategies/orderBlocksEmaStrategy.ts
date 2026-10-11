import { Candle, Indicators, OrderBlockInfo, QuantSignal, SignalMetrics, StrategyConfig } from '../types';
import { calcATR, calcEMA, calcRSI, calcSMA } from '../indicators';

export interface OrderBlockResult {
  bullishBlocks: OrderBlockInfo[];
  bearishBlocks: OrderBlockInfo[];
}

/**
 * Computes Volumetric Order Blocks based on the Pine Script v6 algorithm
 */
export function computeOrderBlocks(
  candles: Candle[],
  atrArray: number[],
  swingLength: number = 10,
  maxLookbackBars: number = 500,
  maxBlocks: number = 20,
  maxATRMult: number = 3.5
): OrderBlockResult {
  const bullishBlocks: OrderBlockInfo[] = [];
  const bearishBlocks: OrderBlockInfo[] = [];

  const startIdx = Math.max(swingLength * 2, candles.length - maxLookbackBars);

  for (let i = startIdx; i < candles.length; i++) {
    const atr = atrArray[i] || candles[i].c * 0.01;

    // Check swings at window i - swingLength
    const evalIdx = i - swingLength;
    if (evalIdx < swingLength) continue;

    // Find highest and lowest in swing window
    let highest = -Infinity;
    let lowest = Infinity;
    for (let k = evalIdx - swingLength; k < evalIdx; k++) {
      if (candles[k].h > highest) highest = candles[k].h;
      if (candles[k].l < lowest) lowest = candles[k].l;
    }

    const isTopSwing = candles[evalIdx].h > highest;
    const isBottomSwing = candles[evalIdx].l < lowest;

    // Invalidate existing bullish blocks if low wicks below bottom
    for (const ob of bullishBlocks) {
      if (!ob.breaker && candles[i].l < ob.bottom) {
        ob.breaker = true;
        ob.breakTime = candles[i].t;
      }
    }

    // Invalidate existing bearish blocks if high wicks above top
    for (const ob of bearishBlocks) {
      if (!ob.breaker && candles[i].h > ob.top) {
        ob.breaker = true;
        ob.breakTime = candles[i].t;
      }
    }

    // Check break of top swing -> Bullish Order Block creation
    if (isTopSwing && candles[i].c > candles[evalIdx].h) {
      // Find base candle right before the impulse
      const prev = candles[i - 1];
      const boxBtm = Math.min(prev.o, prev.c, prev.l);
      const boxTop = Math.max(prev.o, prev.c);
      const obVol = (candles[i].v || 1) + (candles[i - 1]?.v || 1) + (candles[i - 2]?.v || 1);
      const size = Math.abs(boxTop - boxBtm);

      if (size <= atr * maxATRMult && boxTop > boxBtm) {
        bullishBlocks.unshift({
          id: `bull-ob-${candles[i].t}`,
          top: boxTop,
          bottom: boxBtm,
          obVolume: obVol,
          obHighVolume: obVol * 0.65,
          obLowVolume: obVol * 0.35,
          obType: 'Bull',
          startTime: candles[i].t,
          breaker: false
        });
        if (bullishBlocks.length > maxBlocks) bullishBlocks.pop();
      }
    }

    // Check break of bottom swing -> Bearish Order Block creation
    if (isBottomSwing && candles[i].c < candles[evalIdx].l) {
      const prev = candles[i - 1];
      const boxTop = Math.max(prev.o, prev.c, prev.h);
      const boxBtm = Math.min(prev.o, prev.c);
      const obVol = (candles[i].v || 1) + (candles[i - 1]?.v || 1) + (candles[i - 2]?.v || 1);
      const size = Math.abs(boxTop - boxBtm);

      if (size <= atr * maxATRMult && boxTop > boxBtm) {
        bearishBlocks.unshift({
          id: `bear-ob-${candles[i].t}`,
          top: boxTop,
          bottom: boxBtm,
          obVolume: obVol,
          obHighVolume: obVol * 0.35,
          obLowVolume: obVol * 0.65,
          obType: 'Bear',
          startTime: candles[i].t,
          breaker: false
        });
        if (bearishBlocks.length > maxBlocks) bearishBlocks.pop();
      }
    }
  }

  return { bullishBlocks, bearishBlocks };
}

/**
 * Checks if price is near/inside an unbroken order block
 */
export function isNearOrderBlock(
  price: number,
  blocks: OrderBlockInfo[],
  type: 'Bull' | 'Bear',
  atr: number,
  toleranceMult: number = 0.5
): boolean {
  const tol = atr * toleranceMult;
  for (const ob of blocks) {
    if (ob.breaker) continue;
    if (type === 'Bull') {
      if (price >= ob.bottom && price <= ob.top + tol) {
        return true;
      }
    } else {
      if (price <= ob.top && price >= ob.bottom - tol) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Evaluates the upgraded Pine Script v6 Strategy:
 * EMA 10/30 Cross + Order Blocks Confluence + ATR Scaling Exits
 */
export function evaluateOrderBlocksEmaStrategy(
  candles: Candle[],
  symbol: string,
  timeframe: string,
  config: StrategyConfig,
  targetIdx?: number
): QuantSignal | null {
  if (candles.length < Math.max(config.slowMA + 10, 40)) return null;

  const idx = targetIdx !== undefined ? targetIdx : candles.length - 2;
  if (idx < 2 || idx >= candles.length) return null;

  const closes = candles.map(c => c.c);
  const volumes = candles.map(c => c.v);

  const emaFast = calcEMA(closes, config.fastMA);
  const emaSlow = calcEMA(closes, config.slowMA);
  const atrArray = calcATR(candles, config.atrLength);
  const rsiArray = calcRSI(closes, config.rsiLength);
  const volSma = calcSMA(volumes, 20);

  const curr = candles[idx];
  const prev = candles[idx - 1];

  const fastCurr = emaFast[idx];
  const fastPrev = emaFast[idx - 1];
  const slowCurr = emaSlow[idx];
  const slowPrev = emaSlow[idx - 1];

  const atrVal = atrArray[idx] || (curr.c * 0.01);
  const rsiVal = rsiArray[idx] || 50;
  const currVol = curr.v || 1;
  const avgVol = volSma[idx] || currVol;
  const relVol = avgVol > 0 ? (currVol / avgVol) * 100 : 100;

  // EMA Crossovers
  const isCrossover = fastPrev <= slowPrev && fastCurr > slowCurr;
  const isCrossunder = fastPrev >= slowPrev && fastCurr < slowCurr;

  if (!isCrossover && !isCrossunder) return null;

  // Order block calculation
  const obResult = computeOrderBlocks(candles.slice(0, idx + 1), atrArray, config.swingLength);
  const nearBullOB = isNearOrderBlock(curr.c, obResult.bullishBlocks, 'Bull', atrVal, config.obTolerance);
  const nearBearOB = isNearOrderBlock(curr.c, obResult.bearishBlocks, 'Bear', atrVal, config.obTolerance);

  const volOK = !config.useVol || relVol > 100;

  let direction: 'LONG' | 'SHORT' | null = null;

  if (isCrossover) {
    const rsiOK = !config.useRSI || rsiVal >= config.thresholdBuy;
    const obOK = !config.useOB || nearBullOB;
    if (volOK && rsiOK && obOK) {
      direction = 'LONG';
    }
  } else if (isCrossunder) {
    const rsiOK = !config.useRSI || rsiVal <= config.thresholdSell;
    const obOK = !config.useOB || nearBearOB;
    if (volOK && rsiOK && obOK) {
      direction = 'SHORT';
    }
  }

  if (!direction) return null;

  // Calculate Levels using ATR Multipliers from Pine Script
  const entryPrice = curr.c;
  const isLong = direction === 'LONG';

  const slPrice = isLong
    ? entryPrice - atrVal * config.atrMultiplierSL
    : entryPrice + atrVal * config.atrMultiplierSL;

  const tp1Price = isLong
    ? entryPrice + atrVal * config.tp1Multiplier
    : entryPrice - atrVal * config.tp1Multiplier;

  const tp2Price = isLong
    ? entryPrice + atrVal * config.tp2Multiplier
    : entryPrice - atrVal * config.tp2Multiplier;

  const tp3Price = isLong
    ? entryPrice + atrVal * config.tp3Multiplier
    : entryPrice - atrVal * config.tp3Multiplier;

  // Calculate 0-100 Algorithmic Strength Score
  let score = 65; // Base valid cross
  if (isLong && nearBullOB) score += 15;
  if (!isLong && nearBearOB) score += 15;
  if (relVol > 130) score += 10;
  else if (relVol > 100) score += 5;

  if (isLong && rsiVal >= 55) score += 10;
  if (!isLong && rsiVal <= 45) score += 10;

  // Candle body conviction
  const body = Math.abs(curr.c - curr.o);
  const range = curr.h - curr.l;
  if (range > 0 && body / range > 0.6) score += 5;

  score = Math.min(99, Math.max(30, score));

  const buyerStrength = curr.c > curr.o ? curr.v : 0;
  const sellerStrength = curr.c < curr.o ? curr.v : 0;

  const metrics: SignalMetrics = {
    buyerStrength,
    sellerStrength,
    rsiBuyersStrength: rsiVal >= config.thresholdBuy ? 'Strong' : 'Weak',
    rsiSellersStrength: rsiVal <= config.thresholdSell ? 'Strong' : 'Weak',
    relVolumePct: Number(relVol.toFixed(1)),
    volumeStatus: relVol > 100 ? 'High Volume' : 'Normal / Low',
    orderBlockNearby: isLong ? nearBullOB : nearBearOB,
    atrValue: atrVal
  };

  const relevantOBs = isLong ? obResult.bullishBlocks : obResult.bearishBlocks;

  return {
    id: `sig-${symbol}-${curr.t}`,
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
    strategyName: 'ORDER_BLOCKS_EMA',
    timestamp: curr.t,
    metrics,
    orderBlocks: relevantOBs.slice(0, 5)
  };
}
