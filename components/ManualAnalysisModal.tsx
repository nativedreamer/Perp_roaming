import React, { useState, useEffect } from 'react';
import { Candle, QuantSignal, StrategyConfig } from '../lib/types';
import { fetchKlines, normalizeSymbol, INITIAL_POPULAR_PAIRS } from '../lib/binanceApi';
import { evaluateOrderBlocksEmaStrategy } from '../lib/strategies/orderBlocksEmaStrategy';
import { evaluateVwapEmaStrategy } from '../lib/strategies/vwapEmaStrategy';
import { calcATR, calcEMA, calcRSI, calcVWAP, calcSMA, formatPrice } from '../lib/indicators';
import { paperEngine } from '../lib/paperEngine';
import { playOrderFillSound } from '../lib/audio';
import {
  X,
  Search,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Sliders,
  Clock,
  Crosshair,
  ShieldAlert,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink
} from 'lucide-react';

interface ManualAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StrategyConfig;
  allAvailablePairs: string[];
  initialSymbol?: string;
  onSelectPairForChart: (symbol: string) => void;
}

export const ManualAnalysisModal: React.FC<ManualAnalysisModalProps> = ({
  isOpen,
  onClose,
  config,
  allAvailablePairs,
  initialSymbol = 'BTCUSDT',
  onSelectPairForChart
}) => {
  const [symbolInput, setSymbolInput] = useState<string>(initialSymbol);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [strategyMode, setStrategyMode] = useState<'ORDER_BLOCKS_EMA' | 'VWAP_EMA'>('ORDER_BLOCKS_EMA');

  // Custom sandbox parameters
  const [customFastMA, setCustomFastMA] = useState<number>(config.fastMA || 10);
  const [customSlowMA, setCustomSlowMA] = useState<number>(config.slowMA || 30);
  const [customAtrMultiplier, setCustomAtrMultiplier] = useState<number>(config.atrMultiplierSL || 1.5);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analyzedSignal, setAnalyzedSignal] = useState<QuantSignal | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [tradeExecuted, setTradeExecuted] = useState<boolean>(false);

  // Sync symbol when initialSymbol prop changes
  useEffect(() => {
    if (initialSymbol) {
      setSymbolInput(initialSymbol);
    }
  }, [initialSymbol]);

  // Run analysis function
  const runAnalysis = async (targetSymbol: string, tf: string) => {
    const cleanSym = normalizeSymbol(targetSymbol);
    setIsLoading(true);
    setTradeExecuted(false);

    try {
      const fetchedCandles = await fetchKlines(cleanSym, tf, 160);
      setCandles(fetchedCandles);

      if (fetchedCandles.length >= 35) {
        const tempConfig: StrategyConfig = {
          ...config,
          fastMA: customFastMA,
          slowMA: customSlowMA,
          atrMultiplierSL: customAtrMultiplier
        };

        let sig: QuantSignal | null = null;
        if (strategyMode === 'ORDER_BLOCKS_EMA') {
          sig = evaluateOrderBlocksEmaStrategy(fetchedCandles, cleanSym, tf, tempConfig);
        } else {
          sig = evaluateVwapEmaStrategy(fetchedCandles, cleanSym, tf, tempConfig);
        }

        // If no strict directional crossover signal, synthesize full quantitative diagnostic
        if (!sig) {
          const closes = fetchedCandles.map(c => c.c);
          const lastCandle = fetchedCandles[fetchedCandles.length - 1];
          const emaFastArr = calcEMA(closes, customFastMA);
          const emaSlowArr = calcEMA(closes, customSlowMA);
          const atrArr = calcATR(fetchedCandles, 14);
          const rsiArr = calcRSI(closes, 14);
          const vwapArr = calcVWAP(fetchedCandles);
          const volSma = calcSMA(fetchedCandles.map(c => c.v), 20);

          const lastIdx = fetchedCandles.length - 1;
          const fastVal = emaFastArr[lastIdx] || lastCandle.c;
          const slowVal = emaSlowArr[lastIdx] || lastCandle.c;
          const atrVal = atrArr[lastIdx] || lastCandle.c * 0.01;
          const rsiVal = rsiArr[lastIdx] || 50;
          const vwapVal = vwapArr[lastIdx] || lastCandle.c;
          const relVol = volSma[lastIdx] > 0 ? (lastCandle.v / volSma[lastIdx]) * 100 : 100;

          const isFastAboveSlow = fastVal >= slowVal;
          const direction = isFastAboveSlow ? 'LONG' : 'SHORT';
          const isLong = direction === 'LONG';

          // Pine Script score computation
          let score = 50;
          if (isLong && lastCandle.c > vwapVal) score += 15;
          if (!isLong && lastCandle.c < vwapVal) score += 15;
          if (relVol > 120) score += 15;
          if (isLong && rsiVal > 50 && rsiVal < 70) score += 12;
          if (!isLong && rsiVal < 50 && rsiVal > 30) score += 12;

          const slPrice = isLong ? lastCandle.c - atrVal * customAtrMultiplier : lastCandle.c + atrVal * customAtrMultiplier;
          const tp1Price = isLong ? lastCandle.c + atrVal * 0.75 : lastCandle.c - atrVal * 0.75;
          const tp2Price = isLong ? lastCandle.c + atrVal * 1.5 : lastCandle.c - atrVal * 1.5;
          const tp3Price = isLong ? lastCandle.c + atrVal * 2.5 : lastCandle.c - atrVal * 2.5;

          sig = {
            id: `manual_${cleanSym}_${Date.now()}`,
            symbol: cleanSym,
            direction,
            timeframe: tf,
            entryPrice: lastCandle.c,
            currentPrice: lastCandle.c,
            slPrice,
            tp1Price,
            tp2Price,
            tp3Price,
            strengthScore: Math.min(score, 94),
            strategyName: strategyMode,
            timestamp: Date.now(),
            metrics: {
              buyerStrength: isLong ? 72 : 28,
              sellerStrength: isLong ? 28 : 72,
              rsiBuyersStrength: rsiVal >= 50 ? 'Strong' : 'Weak',
              rsiSellersStrength: rsiVal < 50 ? 'Strong' : 'Weak',
              relVolumePct: Math.round(relVol),
              volumeStatus: relVol > 120 ? 'High Volume' : 'Normal / Low',
              orderBlockNearby: Math.abs(lastCandle.c - fastVal) < atrVal * 0.5,
              atrValue: atrVal
            }
          };
        }

        setAnalyzedSignal(sig);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on initial open
  useEffect(() => {
    if (isOpen) {
      runAnalysis(symbolInput, selectedTimeframe);
    }
  }, [isOpen, selectedTimeframe, strategyMode]);

  if (!isOpen) return null;

  const currentPrice = analyzedSignal?.currentPrice || (candles.length > 0 ? candles[candles.length - 1].c : 0);
  const isLong = analyzedSignal?.direction === 'LONG';

  // Risk Reward calculations
  const risk = analyzedSignal ? Math.abs(analyzedSignal.entryPrice - analyzedSignal.slPrice) : 1;
  const rewardTp2 = analyzedSignal ? Math.abs(analyzedSignal.tp2Price - analyzedSignal.entryPrice) : 2;
  const rrRatio = risk > 0 ? (rewardTp2 / risk).toFixed(2) : '2.00';

  const handleExecutePaperOrder = () => {
    if (!analyzedSignal) return;
    paperEngine.openPosition(
      analyzedSignal.symbol,
      analyzedSignal.direction,
      analyzedSignal.entryPrice,
      config.defaultMargin,
      config.defaultLeverage,
      analyzedSignal.slPrice,
      analyzedSignal.tp1Price,
      analyzedSignal.tp2Price,
      analyzedSignal.tp3Price,
      'MANUAL_ANALYSIS_MODAL'
    );
    playOrderFillSound();
    setTradeExecuted(true);
    setTimeout(() => setTradeExecuted(false), 4000);
  };

  const handleCopySignal = () => {
    if (!analyzedSignal) return;
    const text = `🎯 [PERP ROAMING QUANT SIGNAL]\nPair: ${analyzedSignal.symbol}\nTimeframe: ${analyzedSignal.timeframe}\nDirection: ${analyzedSignal.direction}\nQuant Score: ${analyzedSignal.strengthScore}/100\nEntry: $${analyzedSignal.entryPrice}\nSL: $${analyzedSignal.slPrice} (ATR ${customAtrMultiplier}x)\nTP1: $${analyzedSignal.tp1Price}\nTP2: $${analyzedSignal.tp2Price}\nTP3: $${analyzedSignal.tp3Price}\nRisk/Reward: 1:${rrRatio}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const popularQuickPicks = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'SUIUSDT', 'PEPEUSDT', 'NEARUSDT', 'DOGEUSDT', 'RENDERUSDT'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#080d1a] border border-cyan-500/30 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cyan-500/20 bg-[#050811]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Crosshair className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                MANUAL QUANT ANALYSIS STUDIO
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  DEEP DIAGNOSTICS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                On-demand multi-factor Pine Script order blocks, ATR volatility & execution blueprint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* Controls: Symbol Input, Timeframe, Strategy Mode */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-[#050811] p-4 rounded-xl border border-slate-850">
            {/* Symbol Input */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Select or Enter Perpetual Pair:
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && runAnalysis(symbolInput, selectedTimeframe)}
                  placeholder="e.g. BTCUSDT, SUIUSDT, SOLUSDT..."
                  className="w-full bg-[#080d1a] border border-cyan-500/30 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:border-cyan-400 outline-none"
                />
              </div>

              {/* Quick Picks */}
              <div className="flex flex-wrap gap-1 mt-1">
                {popularQuickPicks.map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setSymbolInput(p);
                      runAnalysis(p, selectedTimeframe);
                    }}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                      symbolInput === p
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {p.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Analysis Timeframe:
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['1m', '5m', '15m', '1h'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      setSelectedTimeframe(tf);
                      runAnalysis(symbolInput, tf);
                    }}
                    className={`py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                      selectedTimeframe === tf
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-[#080d1a] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(['3m', '30m', '4h', '1d'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      setSelectedTimeframe(tf);
                      runAnalysis(symbolInput, tf);
                    }}
                    className={`py-1.5 text-xs font-mono font-medium rounded transition-colors ${
                      selectedTimeframe === tf
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                        : 'bg-[#080d1a] text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Run Analysis CTA */}
            <div className="md:col-span-3 flex flex-col justify-end">
              <button
                onClick={() => runAnalysis(symbolInput, selectedTimeframe)}
                disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    ANALYZING...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    RUN DEEP ANALYSIS
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Parameters Tweaker Drawer */}
          <div className="bg-[#050811]/60 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>TUNER SANDBOX:</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Fast EMA:</span>
                <input
                  type="number"
                  min={3}
                  max={50}
                  value={customFastMA}
                  onChange={e => setCustomFastMA(Number(e.target.value))}
                  className="w-14 bg-[#080d1a] border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Slow EMA:</span>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={customSlowMA}
                  onChange={e => setCustomSlowMA(Number(e.target.value))}
                  className="w-14 bg-[#080d1a] border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">ATR SL Mult:</span>
                <input
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={4}
                  value={customAtrMultiplier}
                  onChange={e => setCustomAtrMultiplier(Number(e.target.value))}
                  className="w-14 bg-[#080d1a] border border-slate-700 rounded px-1.5 py-0.5 text-center text-white"
                />
              </div>

              <button
                onClick={() => runAnalysis(symbolInput, selectedTimeframe)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] border border-slate-700"
              >
                Apply Tweaks
              </button>
            </div>
          </div>

          {/* Analysis Results Display */}
          {analyzedSignal && (
            <div className="flex flex-col gap-4">
              {/* Top Scorecard & Market Regime Banner */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isLong
                  ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                  : 'bg-rose-950/20 border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.1)]'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isLong ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    {isLong ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-mono font-extrabold text-white">
                        {analyzedSignal.symbol}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        isLong ? 'bg-emerald-500/30 text-emerald-300' : 'bg-rose-500/30 text-rose-300'
                      }`}>
                        {analyzedSignal.direction} BIAS
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        ({selectedTimeframe})
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-mono mt-0.5">
                      Current Price: <strong className="text-white">${formatPrice(currentPrice)}</strong> · Risk/Reward: <strong className="text-cyan-300">1:{rrRatio}</strong>
                    </div>
                  </div>
                </div>

                {/* Confluence Quant Score Gauge */}
                <div className="flex items-center gap-3 bg-[#050811] px-4 py-2 rounded-xl border border-slate-800">
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block uppercase">QUANT SCORE</span>
                    <span className={`text-xl font-bold ${
                      analyzedSignal.strengthScore >= 80 ? 'text-emerald-400' : analyzedSignal.strengthScore >= 65 ? 'text-cyan-400' : 'text-amber-400'
                    }`}>
                      {analyzedSignal.strengthScore} / 100
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-full border-4 flex items-center justify-center font-mono font-bold text-xs" style={{
                    borderColor: analyzedSignal.strengthScore >= 80 ? '#10b981' : analyzedSignal.strengthScore >= 65 ? '#06b6d4' : '#f59e0b'
                  }}>
                    {analyzedSignal.strengthScore}%
                  </div>
                </div>
              </div>

              {/* Execution Blueprint Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-[#050811] p-3 rounded-xl border border-slate-800 flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase">SUGGESTED ENTRY</span>
                  <span className="text-base font-bold text-white mt-0.5">
                    ${formatPrice(analyzedSignal.entryPrice)}
                  </span>
                  <span className="text-[10px] text-slate-500">Market / Limit Zone</span>
                </div>

                <div className="bg-[#050811] p-3 rounded-xl border border-rose-500/20 flex flex-col">
                  <span className="text-[10px] text-rose-400 uppercase flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> STOP LOSS
                  </span>
                  <span className="text-base font-bold text-rose-400 mt-0.5">
                    ${formatPrice(analyzedSignal.slPrice)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ATR {customAtrMultiplier}x (${formatPrice(Math.abs(analyzedSignal.entryPrice - analyzedSignal.slPrice))})
                  </span>
                </div>

                <div className="bg-[#050811] p-3 rounded-xl border border-emerald-500/20 flex flex-col">
                  <span className="text-[10px] text-emerald-400 uppercase">TAKE PROFIT 1 (33%)</span>
                  <span className="text-base font-bold text-emerald-400 mt-0.5">
                    ${formatPrice(analyzedSignal.tp1Price)}
                  </span>
                  <span className="text-[10px] text-slate-500">Target Scaling Out</span>
                </div>

                <div className="bg-[#050811] p-3 rounded-xl border border-emerald-500/30 flex flex-col">
                  <span className="text-[10px] text-emerald-400 uppercase">TAKE PROFIT 2 & 3</span>
                  <span className="text-base font-bold text-emerald-300 mt-0.5">
                    ${formatPrice(analyzedSignal.tp2Price)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    TP3 Runner: ${formatPrice(analyzedSignal.tp3Price)}
                  </span>
                </div>
              </div>

              {/* Quant Metrics Grid */}
              <div className="bg-[#050811] rounded-xl border border-slate-800 p-4 font-mono text-xs">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  TECHNICAL CONFLUENCE BREAKDOWN
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Relative Volume:</span>
                    <strong className={analyzedSignal.metrics.relVolumePct > 120 ? 'text-emerald-400' : 'text-slate-200'}>
                      {analyzedSignal.metrics.relVolumePct}% of 20 SMA
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">RSI Buyer Bias:</span>
                    <strong className={analyzedSignal.metrics.rsiBuyersStrength === 'Strong' ? 'text-emerald-400' : 'text-slate-300'}>
                      {analyzedSignal.metrics.rsiBuyersStrength}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Order Block Proximity:</span>
                    <strong className={analyzedSignal.metrics.orderBlockNearby ? 'text-cyan-400' : 'text-slate-400'}>
                      {analyzedSignal.metrics.orderBlockNearby ? 'Confluent Demand/Supply' : 'Neutral Range'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">14-Period ATR:</span>
                    <strong className="text-slate-200">
                      ${formatPrice(analyzedSignal.metrics.atrValue)} ({((analyzedSignal.metrics.atrValue / currentPrice) * 100).toFixed(2)}%)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Execute Paper Order, Load into Chart, Copy Plan */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      onSelectPairForChart(analyzedSignal.symbol);
                      onClose();
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                    Load into Main Chart
                  </button>

                  <button
                    onClick={handleCopySignal}
                    className="px-4 py-2.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    {copied ? 'Copied!' : 'Copy Plan'}
                  </button>
                </div>

                <button
                  onClick={handleExecutePaperOrder}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                    tradeExecuted
                      ? 'bg-emerald-500 text-black shadow-emerald-500/30'
                      : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-500/20'
                  }`}
                >
                  <Zap className="w-4 h-4 fill-current" />
                  {tradeExecuted ? '⚡ ORDER FILLED IN SIMULATION!' : `SIMULATE ${analyzedSignal.direction} EXECUTION ($${config.defaultMargin})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
