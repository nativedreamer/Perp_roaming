import React, { useState, useEffect, useRef } from 'react';
import { Candle, PaperAccount, PaperOrder, PaperPosition, QuantSignal, StrategyConfig } from '../lib/types';
import { paperEngine } from '../lib/paperEngine';
import {
  fetchFundingRate,
  fetchKlines,
  INITIAL_POPULAR_PAIRS,
  fetchAllAvailablePerpPairs
} from '../lib/binanceApi';
import { evaluateOrderBlocksEmaStrategy } from '../lib/strategies/orderBlocksEmaStrategy';
import { evaluateVwapEmaStrategy } from '../lib/strategies/vwapEmaStrategy';
import { evaluateLeo21Strategy } from '../lib/strategies/leo21Strategy';
import { calcATR, calcEMA, calcRSI, calcVWAP, calcSMA } from '../lib/indicators';
import { playOrderFillSound, playSignalChime, playTakeProfitSound } from '../lib/audio';

import { Header } from '../components/Header';
import { PacmanQuantStrip } from '../components/PacmanQuantStrip';
import { GrokQuantFeed } from '../components/GrokQuantFeed';
import { PaperTradingDesk } from '../components/PaperTradingDesk';
import { OrderBlocksChart } from '../components/OrderBlocksChart';
import { SignalRadarTable } from '../components/SignalRadarTable';
import { BacktestModal } from '../components/BacktestModal';
import { StrategySettingsModal } from '../components/StrategySettingsModal';
import { ManualAnalysisModal } from '../components/ManualAnalysisModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatPrice } from '../lib/indicators';

const DEFAULT_CONFIG: StrategyConfig = {
  activeStrategy: 'ORDER_BLOCKS_EMA',
  fastMA: 10,
  slowMA: 30,
  atrLength: 14,
  atrMultiplierSL: 1.5,
  tp1Multiplier: 0.5,
  tp2Multiplier: 1.0,
  tp3Multiplier: 1.5,
  tp1Pct: 33,
  tp2Pct: 33,
  useRSI: false,
  rsiLength: 14,
  thresholdBuy: 50,
  thresholdSell: 50,
  useVol: false,
  useOB: false,
  obTolerance: 0.5,
  swingLength: 10,
  autoTradeEnabled: true,
  minScoreToExecute: 75,
  defaultMargin: 100,
  defaultLeverage: 10,
  riskPerTradePct: 1,
  slippageBps: 2,
  commissionRatePct: 0.02,
  scannerTimeframe: '5m',
  soundEnabled: true
};

export default function DashboardPage() {
  const [config, setConfig] = useState<StrategyConfig>(() => {
    try {
      const stored = localStorage.getItem('perp_strategy_config_v3');
      if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_CONFIG;
  });

  const [account, setAccount] = useState<PaperAccount>(paperEngine.getAccount());
  const [positions, setPositions] = useState<PaperPosition[]>(paperEngine.getPositions());
  const [orders, setOrders] = useState<PaperOrder[]>(paperEngine.getOrders());

  // Unlimited perpetual pairs registry
  const [availablePairs, setAvailablePairs] = useState<string[]>(INITIAL_POPULAR_PAIRS);
  const [signals, setSignals] = useState<QuantSignal[]>([]);
  const signalsMapRef = useRef<Map<string, QuantSignal>>(new Map());

  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [activeCandles, setActiveCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(84200);
  const [currentAtr, setCurrentAtr] = useState<number>(350);

  // Screener status
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanningSymbol, setCurrentScanningSymbol] = useState<string>('BTCUSDT');

  const [latestFill, setLatestFill] = useState<PaperOrder | null>(null);
  const [latestSignal, setLatestSignal] = useState<QuantSignal | null>(null);

  const [fillToast, setFillToast] = useState<PaperOrder | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBacktestOpen, setIsBacktestOpen] = useState<boolean>(false);
  const [isManualAnalysisOpen, setIsManualAnalysisOpen] = useState<boolean>(false);
  const [manualAnalysisSymbol, setManualAnalysisSymbol] = useState<string>('BTCUSDT');

  // Discover ALL available perpetual pairs dynamically on mount (no fixed ceiling)
  useEffect(() => {
    let isMounted = true;
    fetchAllAvailablePerpPairs()
      .then((pairs) => {
        if (isMounted && pairs && pairs.length > 0) {
          // Merge unique pairs
          const set = new Set([...INITIAL_POPULAR_PAIRS, ...pairs]);
          const merged = Array.from(set);
          setAvailablePairs(merged);
        }
      })
      .catch((err) => {
        console.error('Error discovering perpetual pairs:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to Paper Engine Updates
  useEffect(() => {
    const unsubscribeEngine = paperEngine.subscribe(() => {
      setAccount(paperEngine.getAccount());
      setPositions(paperEngine.getPositions());
      setOrders(paperEngine.getOrders());
    });

    const unsubscribeFills = paperEngine.onOrderFill((order) => {
      setLatestFill(order);
      setFillToast(order);
      if (config.soundEnabled) {
        if (order.type.includes('TP')) playTakeProfitSound();
        else playOrderFillSound();
      }
      setTimeout(() => setFillToast(null), 5000);
    });

    return () => {
      unsubscribeEngine();
      unsubscribeFills();
    };
  }, [config.soundEnabled]);

  const currentTf = config.scannerTimeframe || '5m';

  const updateConfig = (newConfig: Partial<StrategyConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try {
      localStorage.setItem('perp_strategy_config_v3', JSON.stringify(updated));
    } catch {}
  };

  const handleSelectTimeframe = (newTf: string) => {
    if (newTf === currentTf) return;
    // Clear signals radar cache so new timeframe calculations populate fresh
    signalsMapRef.current.clear();
    setSignals([]);
    updateConfig({ scannerTimeframe: newTf });
    loadPairData(selectedSymbol, newTf);
  };

  // Fetch candles for the actively selected pair
  const loadPairData = async (symbol: string, tf: string = currentTf) => {
    try {
      const candles = await fetchKlines(symbol, tf, 120);
      if (candles.length > 0) {
        setActiveCandles(candles);
        const latest = candles[candles.length - 1];
        setCurrentPrice(latest.c);
        setCurrentAtr(latest.h - latest.l || latest.c * 0.01);

        // Update positions with live price tick
        paperEngine.updatePositionsWithTick(symbol, latest.c, latest.h, latest.l);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPairData(selectedSymbol, currentTf);
  }, [selectedSymbol, currentTf]);

  const selectedSymbolRef = useRef(selectedSymbol);
  selectedSymbolRef.current = selectedSymbol;

  const configRef = useRef(config);
  configRef.current = config;

  // Main 24/7 Unlimited Perpetual Pairs Scanner Loop
  useEffect(() => {
    let isCancelled = false;

    const runScannerLoop = async () => {
      let currentIndex = 0;
      let lastTableRenderTime = 0;

      while (!isCancelled) {
        setIsScanning(true);
        const pairsToScan = availablePairs.length > 0 ? availablePairs : INITIAL_POPULAR_PAIRS;

        if (currentIndex >= pairsToScan.length) {
          currentIndex = 0;
          // Refresh table fully at end of cycle
          const sorted = Array.from(signalsMapRef.current.values()).sort(
            (a, b) => b.strengthScore - a.strengthScore
          );
          if (!isCancelled) setSignals(sorted);
          // Short pause before next continuous sweep cycle
          await new Promise((r) => setTimeout(r, 2000));
        }

        const sym = pairsToScan[currentIndex];
        if (!isCancelled) {
          setCurrentScanningSymbol(sym);
          setScanProgress(Math.round(((currentIndex + 1) / pairsToScan.length) * 100));
        }

        try {
          const candles = await fetchKlines(sym, currentTf, configRef.current.activeStrategy === 'LEO_2_1' ? 320 : 80);
          if (!isCancelled && candles.length >= 35) {
            const latestCandle = candles[candles.length - 1];
            const currentCfg = configRef.current;
            const currentActiveSym = selectedSymbolRef.current;

            // Update open positions ticks in paper engine
            paperEngine.updatePositionsWithTick(sym, latestCandle.c, latestCandle.h, latestCandle.l);

            if (sym === currentActiveSym) {
              setActiveCandles(candles);
              setCurrentPrice(latestCandle.c);
            }

            // Evaluate strategy
            let sig: QuantSignal | null = null;
            if (currentCfg.activeStrategy === 'ORDER_BLOCKS_EMA') {
              sig = evaluateOrderBlocksEmaStrategy(candles, sym, currentTf, currentCfg);
            } else if (currentCfg.activeStrategy === 'VWAP_EMA') {
              sig = evaluateVwapEmaStrategy(candles, sym, currentTf, currentCfg);
            } else if (currentCfg.activeStrategy === 'LEO_2_1') {
              sig = evaluateLeo21Strategy(candles, sym, currentTf, {
                sensitivity: 5,
                atrLength: 14,
                atrBandMultiplier: 2.2,
                targetR: 2,
                riskPct: currentCfg.riskPerTradePct,
                maxLeverage: currentCfg.defaultLeverage
              }).signal;
            } else {
              sig = evaluateOrderBlocksEmaStrategy(candles, sym, currentTf, currentCfg) ||
                    evaluateVwapEmaStrategy(candles, sym, currentTf, currentCfg);
            }

            // If no immediate strict cross, create ambient radar baseline reading so all pairs are scored
            if (!sig) {
              const closes = candles.map((c) => c.c);
              const emaFastArr = calcEMA(closes, currentCfg.fastMA);
              const emaSlowArr = calcEMA(closes, currentCfg.slowMA);
              const atrArr = calcATR(candles, 14);
              const rsiArr = calcRSI(closes, 14);
              const vwapArr = calcVWAP(candles);
              const volSma = calcSMA(candles.map((c) => c.v), 20);

              const lastIdx = candles.length - 1;
              const fastVal = emaFastArr[lastIdx] || latestCandle.c;
              const slowVal = emaSlowArr[lastIdx] || latestCandle.c;
              const atrVal = atrArr[lastIdx] || latestCandle.c * 0.01;
              const rsiVal = rsiArr[lastIdx] || 50;
              const vwapVal = vwapArr[lastIdx] || latestCandle.c;
              const relVol = volSma[lastIdx] > 0 ? (latestCandle.v / volSma[lastIdx]) * 100 : 100;

              const isBull = fastVal >= slowVal;
              const direction = isBull ? 'LONG' : 'SHORT';
              let baseScore = 55;
              if (isBull && latestCandle.c > vwapVal) baseScore += 15;
              if (!isBull && latestCandle.c < vwapVal) baseScore += 15;
              if (relVol > 110) baseScore += 10;
              if (isBull && rsiVal > 52) baseScore += 8;
              if (!isBull && rsiVal < 48) baseScore += 8;

              const slPrice = isBull ? latestCandle.c - atrVal * currentCfg.atrMultiplierSL : latestCandle.c + atrVal * currentCfg.atrMultiplierSL;
              const tp1Price = isBull ? latestCandle.c + atrVal * currentCfg.tp1Multiplier : latestCandle.c - atrVal * currentCfg.tp1Multiplier;
              const tp2Price = isBull ? latestCandle.c + atrVal * currentCfg.tp2Multiplier : latestCandle.c - atrVal * currentCfg.tp2Multiplier;
              const tp3Price = isBull ? latestCandle.c + atrVal * currentCfg.tp3Multiplier : latestCandle.c - atrVal * currentCfg.tp3Multiplier;

              sig = {
                id: `scan_${sym}_${Date.now()}`,
                symbol: sym,
                direction,
                timeframe: currentTf,
                entryPrice: latestCandle.c,
                currentPrice: latestCandle.c,
                slPrice,
                tp1Price,
                tp2Price,
                tp3Price,
                strengthScore: Math.min(baseScore, 92),
                strategyName: currentCfg.activeStrategy,
                timestamp: Date.now(),
                metrics: {
                  buyerStrength: isBull ? 68 : 32,
                  sellerStrength: isBull ? 32 : 68,
                  rsiBuyersStrength: rsiVal >= 50 ? 'Strong' : 'Weak',
                  rsiSellersStrength: rsiVal < 50 ? 'Strong' : 'Weak',
                  relVolumePct: Math.round(relVol),
                  volumeStatus: relVol > 115 ? 'High Volume' : 'Normal / Low',
                  orderBlockNearby: Math.abs(latestCandle.c - fastVal) < atrVal * 0.7,
                  atrValue: atrVal
                }
              };
            }

            if (sig && !isCancelled) {
              signalsMapRef.current.set(sym, sig);

              if (sym === currentActiveSym || sig.strengthScore >= 80) {
                setLatestSignal(sig);
              }

              // Throttle table updates to at most once every 1200ms to preserve UI responsiveness & avoid tab crashes
              const now = Date.now();
              if (now - lastTableRenderTime > 1200) {
                lastTableRenderTime = now;
                const sorted = Array.from(signalsMapRef.current.values()).sort(
                  (a, b) => b.strengthScore - a.strengthScore
                );
                setSignals(sorted);
              }

              // Auto-fill order if auto-trade enabled and score matches threshold
              if (currentCfg.autoTradeEnabled && sig.strengthScore >= currentCfg.minScoreToExecute) {
                const didFill = paperEngine.handleSignalAutoTrade(sig, currentCfg);
                if (didFill && currentCfg.soundEnabled) {
                  playSignalChime(sig.direction);
                }
              }
            }
          }
        } catch (err) {
          console.error(err);
        }

        currentIndex++;

        // Polite pacing for rate limits (allows 24/7 scanning of hundreds of pairs)
        await new Promise((r) => setTimeout(r, 260));
      }
    };

    runScannerLoop();

    return () => {
      isCancelled = true;
    };
  }, [availablePairs, currentTf]);

  const selectedSignal = signalsMapRef.current.get(selectedSymbol) || signals.find((s) => s.symbol === selectedSymbol) || null;

  const handleOpenManualAnalysis = (symbolToAnalyze?: string) => {
    setManualAnalysisSymbol(symbolToAnalyze || selectedSymbol);
    setIsManualAnalysisOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans pb-12 selection:bg-cyan-500/30">
      {/* 3-Zone Top Header */}
      <Header
        account={account}
        config={config}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenBacktest={() => setIsBacktestOpen(true)}
        onOpenManualAnalysis={() => handleOpenManualAnalysis(selectedSymbol)}
        onToggleSound={() => updateConfig({ soundEnabled: !config.soundEnabled })}
        onSelectTimeframe={handleSelectTimeframe}
        activeScanCount={availablePairs.length}
      />

      {/* Floating Order Fill Toast Confirmation */}
      {fillToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#080d1a] border border-emerald-500/50 rounded-xl p-3.5 shadow-2xl glow-emerald flex items-start gap-3 animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0 animate-ping" />
          <div className="font-mono text-xs">
            <span className="font-bold text-white block">
              ⚡ LIVE SIMULATION ORDER FILLED: #{fillToast.id?.slice(-6) || 'FILLED'}
            </span>
            <p className="text-emerald-300 mt-0.5">
              {fillToast.type} {fillToast.direction} {fillToast.symbol} @ ${formatPrice(fillToast.fillPrice)}
            </p>
            <span className="text-[10px] text-slate-400 block mt-1">
              Margin: ${(fillToast.margin || 0).toFixed(2)} · {fillToast.leverage}x Lev · Slippage: 0.02%
            </span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-[1720px] w-full mx-auto px-3 sm:px-5 py-4 flex flex-col gap-4">
        {/* 2D Pacman Flare Strip */}
        <ErrorBoundary>
          <PacmanQuantStrip
            lastDirection={latestSignal?.direction || 'LONG'}
            activePairsCount={availablePairs.length}
            openPositionsCount={positions.length}
          />
        </ErrorBoundary>

        {/* Top Split: Grok Quant Telemetry Feed & Order Blocks Visualizer Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Grok Quant Stream (5 cols on desktop) */}
          <div className="lg:col-span-5">
            <ErrorBoundary>
              <GrokQuantFeed
                latestSignal={latestSignal}
                latestFill={latestFill}
                strategyName={config.activeStrategy}
              />
            </ErrorBoundary>
          </div>

          {/* Candlestick & Volumetric Order Blocks Chart (7 cols on desktop) */}
          <div className="lg:col-span-7">
            <ErrorBoundary>
              <OrderBlocksChart
                candles={activeCandles}
                symbol={selectedSymbol}
                timeframe={currentTf}
                orderBlocks={selectedSignal?.orderBlocks || []}
                signal={selectedSignal}
                fastMA={config.fastMA}
                slowMA={config.slowMA}
                onSelectTimeframe={handleSelectTimeframe}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Center: Paper Execution Cockpit (Proves Orders Actually Fill!) */}
        <ErrorBoundary>
          <PaperTradingDesk
            account={account}
            positions={positions}
            orders={orders}
            config={config}
            onUpdateConfig={updateConfig}
            selectedSymbol={selectedSymbol}
            currentPrice={currentPrice}
            currentAtr={currentAtr}
            timeframe={currentTf}
            onSelectTimeframe={handleSelectTimeframe}
            onOpenManualAnalysis={handleOpenManualAnalysis}
          />
        </ErrorBoundary>

        {/* Bottom: 24/7 Binance Futures Signal Radar Table (Scanning all available pairs) */}
        <ErrorBoundary>
          <SignalRadarTable
            signals={signals}
            onSelectPair={(sym) => {
              setSelectedSymbol(sym);
              loadPairData(sym, currentTf);
            }}
            onInstantTrade={(sig) => {
              setSelectedSymbol(sig.symbol);
              paperEngine.openPosition(
                sig.symbol,
                sig.direction,
                sig.entryPrice,
                config.defaultMargin,
                config.defaultLeverage,
                sig.slPrice,
                sig.tp1Price,
                sig.tp2Price,
                sig.tp3Price,
                'RADAR_1CLICK'
              );
            }}
            onOpenManualAnalysis={handleOpenManualAnalysis}
            selectedSymbol={selectedSymbol}
            isScanning={isScanning}
            scanProgress={scanProgress}
            totalMonitoredPairs={availablePairs.length}
            currentScanningSymbol={currentScanningSymbol}
            timeframe={currentTf}
            onSelectTimeframe={handleSelectTimeframe}
          />
        </ErrorBoundary>
      </main>

      {/* Modals */}
      <ManualAnalysisModal
        isOpen={isManualAnalysisOpen}
        onClose={() => setIsManualAnalysisOpen(false)}
        config={config}
        allAvailablePairs={availablePairs}
        initialSymbol={manualAnalysisSymbol}
        onSelectPairForChart={(sym) => {
          setSelectedSymbol(sym);
          loadPairData(sym);
        }}
      />

      <BacktestModal
        isOpen={isBacktestOpen}
        onClose={() => setIsBacktestOpen(false)}
        config={config}
      />

      <StrategySettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={updateConfig}
      />
    </div>
  );
}
