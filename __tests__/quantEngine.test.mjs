import { test, describe } from 'node:test';
import assert from 'node:assert';
import { calcEMA, calcATR, calcRSI, calcSMA, formatPrice } from '../lib/indicators.ts';

describe('Technical Indicators & Math', () => {
  test('calcEMA generates exponential smoothed series', () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const ema = calcEMA(prices, 5);
    assert.strictEqual(ema.length, prices.length);
    assert.ok(ema[4] > 0);
    assert.ok(ema[10] > ema[5]);
  });

  test('calcATR produces positive true range values', () => {
    const candles = Array.from({ length: 25 }, (_, i) => ({
      t: i * 60000,
      o: 100 + i,
      h: 105 + i,
      l: 95 + i,
      c: 102 + i,
      v: 1000
    }));
    const atr = calcATR(candles, 14);
    assert.strictEqual(atr.length, candles.length);
    assert.ok(atr[14] > 0);
  });

  test('formatPrice formats crypto numbers cleanly', () => {
    assert.strictEqual(formatPrice(68420.5), '68,420.50');
    assert.strictEqual(formatPrice(1.2345), '1.2345');
    assert.strictEqual(formatPrice(0.000456), '0.00045600');
  });
});
