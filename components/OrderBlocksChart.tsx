import React, { useState, useMemo } from 'react';
import { Candle, OrderBlockInfo, QuantSignal } from '../lib/types';
import { formatPrice } from '../lib/indicators';
import { calcEMA } from '../lib/indicators';
import { Layers, Crosshair, BarChart2, Maximize2 } from 'lucide-react';

interface OrderBlocksChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  orderBlocks?: OrderBlockInfo[];
  signal?: QuantSignal | null;
  fastMA?: number;
  slowMA?: number;
  onSelectTimeframe?: (tf: string) => void;
}

export const OrderBlocksChart: React.FC<OrderBlocksChartProps> = ({
  candles,
  symbol,
  timeframe,
  orderBlocks = [],
  signal = null,
  fastMA = 10,
  slowMA = 30,
  onSelectTimeframe
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

  // Compute Fast and Slow EMA arrays
  const closes = useMemo(() => candles.map(c => c.c), [candles]);
  const emaFast = useMemo(() => calcEMA(closes, fastMA), [closes, fastMA]);
  const emaSlow = useMemo(() => calcEMA(closes, slowMA), [closes, slowMA]);

  // Chart dimensions and price scaling
  const visibleCandles = useMemo(() => candles.slice(-60), [candles]);
  const visibleEmaFast = useMemo(() => emaFast.slice(-60), [emaFast]);
  const visibleEmaSlow = useMemo(() => emaSlow.slice(-60), [emaSlow]);

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const c of visibleCandles) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
    }
    // Include signal TP/SL in range if present
    if (signal) {
      if (signal.tp3Price > max) max = signal.tp3Price;
      if (signal.tp3Price < min) min = signal.tp3Price;
      if (signal.slPrice > max) max = signal.slPrice;
      if (signal.slPrice < min) min = signal.slPrice;
    }
    const padding = (max - min) * 0.08 || 1;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      priceRange: (max + padding) - (min - padding) || 1
    };
  }, [visibleCandles, signal]);

  const height = 280;
  const width = 680;

  const getY = (val: number) => {
    return height - ((val - minPrice) / priceRange) * height;
  };

  const activeCandle = hoveredIndex !== null && visibleCandles[hoveredIndex]
    ? visibleCandles[hoveredIndex]
    : visibleCandles[visibleCandles.length - 1];

  return (
    <div className="bg-[#080d1a] border border-cyan-500/20 rounded-xl p-3 sm:p-4 shadow-xl flex flex-col gap-2">
      {/* Top Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{symbol}</span>
            {onSelectTimeframe ? (
              <div className="flex items-center bg-[#040712] rounded-lg p-0.5 border border-slate-800">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => onSelectTimeframe(tf)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                      timeframe === tf
                        ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                {timeframe}
              </span>
            )}
          </div>

          {activeCandle && (
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
              <span>O: <strong className="text-white">${formatPrice(activeCandle.o)}</strong></span>
              <span>H: <strong className="text-emerald-400">${formatPrice(activeCandle.h)}</strong></span>
              <span>L: <strong className="text-rose-400">${formatPrice(activeCandle.l)}</strong></span>
              <span>C: <strong className="text-cyan-300">${formatPrice(activeCandle.c)}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> EMA {fastMA}
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> EMA {slowMA}
          </span>
          <span className="flex items-center gap-1 text-cyan-400">
            <span className="w-2 h-2 bg-cyan-400/30 border border-cyan-400 inline-block" /> Order Block
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[280px] bg-[#040712] rounded-lg overflow-hidden border border-slate-800/80">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-b border-cyan-500/30 w-full" />
          <div className="border-b border-cyan-500/30 w-full" />
          <div className="border-b border-cyan-500/30 w-full" />
          <div className="border-b border-cyan-500/30 w-full" />
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* 1. Volumetric Order Blocks Shaded Zones */}
          {orderBlocks.map((ob) => {
            const yTop = getY(ob.top);
            const yBottom = getY(ob.bottom);
            const blockHeight = Math.max(2, Math.abs(yBottom - yTop));
            const isBull = ob.obType === 'Bull';

            return (
              <g key={ob.id}>
                <rect
                  x={0}
                  y={Math.min(yTop, yBottom)}
                  width={width}
                  height={blockHeight}
                  fill={isBull ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)'}
                  stroke={isBull ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}
                  strokeDasharray="4 2"
                  strokeWidth="1"
                />
                <text
                  x={width - 120}
                  y={Math.min(yTop, yBottom) + 12}
                  fill={isBull ? '#10b981' : '#f43f5e'}
                  fontSize="9"
                  fontFamily="monospace"
                  opacity="0.8"
                >
                  {ob.obType.toUpperCase()} OB [{formatPrice(ob.bottom)} - {formatPrice(ob.top)}]
                </text>
              </g>
            );
          })}

          {/* 2. Plotted Take-Profit & Stop-Loss Levels (Pine Script Signal Levels) */}
          {signal && (
            <g>
              {/* Stop Loss Line */}
              <line
                x1={0}
                y1={getY(signal.slPrice)}
                x2={width}
                y2={getY(signal.slPrice)}
                stroke="#f43f5e"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <text x={8} y={getY(signal.slPrice) - 3} fill="#f43f5e" fontSize="9" fontFamily="monospace">
                SL: ${formatPrice(signal.slPrice)}
              </text>

              {/* TP1 Line */}
              <line
                x1={0}
                y1={getY(signal.tp1Price)}
                x2={width}
                y2={getY(signal.tp1Price)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={8} y={getY(signal.tp1Price) - 3} fill="#10b981" fontSize="9" fontFamily="monospace">
                TP1 (33%): ${formatPrice(signal.tp1Price)}
              </text>

              {/* TP2 Line */}
              <line
                x1={0}
                y1={getY(signal.tp2Price)}
                x2={width}
                y2={getY(signal.tp2Price)}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <text x={8} y={getY(signal.tp2Price) - 3} fill="#10b981" fontSize="9" fontFamily="monospace">
                TP2 (33%): ${formatPrice(signal.tp2Price)}
              </text>

              {/* TP3 Line */}
              <line
                x1={0}
                y1={getY(signal.tp3Price)}
                x2={width}
                y2={getY(signal.tp3Price)}
                stroke="#00f0ff"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <text x={8} y={getY(signal.tp3Price) - 3} fill="#00f0ff" fontSize="9" fontFamily="monospace">
                TP3 FINAL (34%): ${formatPrice(signal.tp3Price)}
              </text>
            </g>
          )}

          {/* 3. Candlesticks */}
          {visibleCandles.map((c, i) => {
            const isGreen = c.c >= c.o;
            const x = i * candleWidth + candleWidth * 0.15;
            const bodyWidth = Math.max(1, candleWidth * 0.7);

            const yHigh = getY(c.h);
            const yLow = getY(c.l);
            const yOpen = getY(c.o);
            const yClose = getY(c.c);

            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));

            return (
              <g
                key={c.t}
                onMouseEnter={() => setHoveredIndex(i)}
                className="transition-opacity"
              >
                {/* Wick */}
                <line
                  x1={x + bodyWidth / 2}
                  y1={yHigh}
                  x2={x + bodyWidth / 2}
                  y2={yLow}
                  stroke={isGreen ? '#10b981' : '#f43f5e'}
                  strokeWidth="1"
                />
                {/* Body */}
                <rect
                  x={x}
                  y={bodyTop}
                  width={bodyWidth}
                  height={bodyHeight}
                  fill={isGreen ? '#10b981' : '#f43f5e'}
                  rx="0.5"
                />
              </g>
            );
          })}

          {/* 4. Fast EMA Line (Emerald) */}
          {visibleEmaFast.length > 1 && (
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              points={visibleEmaFast
                .map((val, i) => `${i * candleWidth + candleWidth / 2},${getY(val)}`)
                .join(' ')}
            />
          )}

          {/* 5. Slow EMA Line (Crimson) */}
          {visibleEmaSlow.length > 1 && (
            <polyline
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.5"
              points={visibleEmaSlow
                .map((val, i) => `${i * candleWidth + candleWidth / 2},${getY(val)}`)
                .join(' ')}
            />
          )}

          {/* Crosshair indicator if hovering */}
          {hoveredIndex !== null && (
            <line
              x1={hoveredIndex * candleWidth + candleWidth / 2}
              y1={0}
              x2={hoveredIndex * candleWidth + candleWidth / 2}
              y2={height}
              stroke="rgba(0, 240, 255, 0.4)"
              strokeDasharray="2 2"
            />
          )}
        </svg>

        {/* Price scale right side */}
        <div className="absolute right-1 top-2 bottom-2 flex flex-col justify-between font-mono text-[9px] text-slate-500 pointer-events-none text-right">
          <span>${formatPrice(maxPrice)}</span>
          <span>${formatPrice((maxPrice + minPrice) / 2)}</span>
          <span>${formatPrice(minPrice)}</span>
        </div>
      </div>
    </div>
  );
};
