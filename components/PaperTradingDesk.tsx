import React, { useState } from 'react';
import { PaperAccount, PaperOrder, PaperPosition, StrategyConfig } from '../lib/types';
import { paperEngine } from '../lib/paperEngine';
import { playOrderFillSound } from '../lib/audio';
import { formatPrice } from '../lib/indicators';
import {
  TrendingUp,
  TrendingDown,
  Download,
  RotateCcw,
  ShieldAlert,
  Zap,
  CheckCircle2,
  DollarSign,
  Percent,
  Sliders,
  Play,
  Pause,
  ExternalLink,
  Clock
} from 'lucide-react';

interface PaperTradingDeskProps {
  account: PaperAccount;
  positions: PaperPosition[];
  orders: PaperOrder[];
  config: StrategyConfig;
  onUpdateConfig: (newConfig: Partial<StrategyConfig>) => void;
  selectedSymbol: string;
  currentPrice: number;
  currentAtr: number;
  timeframe?: string;
  onSelectTimeframe?: (tf: string) => void;
  onOpenManualAnalysis?: (symbol: string) => void;
}

export const PaperTradingDesk: React.FC<PaperTradingDeskProps> = ({
  account,
  positions,
  orders,
  config,
  onUpdateConfig,
  selectedSymbol,
  currentPrice,
  currentAtr,
  timeframe = '5m',
  onSelectTimeframe,
  onOpenManualAnalysis
}) => {
  const [tradeDirection, setTradeDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [tradeMargin, setTradeMargin] = useState<number>(100);
  const [tradeLeverage, setTradeLeverage] = useState<number>(10);
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'LEDGER' | 'EXECUTE'>('POSITIONS');

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

  // Instant Manual Paper Trade Submission
  const handleInstantTrade = (direction: 'LONG' | 'SHORT') => {
    if (!currentPrice || currentPrice <= 0) return;

    const atr = currentAtr || (currentPrice * 0.01);
    const slMult = config.atrMultiplierSL || 1.5;
    const tp1Mult = config.tp1Multiplier || 0.5;
    const tp2Mult = config.tp2Multiplier || 1.0;
    const tp3Mult = config.tp3Multiplier || 1.5;

    const isLong = direction === 'LONG';
    const slPrice = isLong ? currentPrice - atr * slMult : currentPrice + atr * slMult;
    const tp1Price = isLong ? currentPrice + atr * tp1Mult : currentPrice - atr * tp1Mult;
    const tp2Price = isLong ? currentPrice + atr * tp2Mult : currentPrice - atr * tp2Mult;
    const tp3Price = isLong ? currentPrice + atr * tp3Mult : currentPrice - atr * tp3Mult;

    const order = paperEngine.openPosition(
      selectedSymbol,
      direction,
      currentPrice,
      tradeMargin,
      tradeLeverage,
      slPrice,
      tp1Price,
      tp2Price,
      tp3Price,
      'MANUAL_DESK'
    );

    if (order) {
      if (config.soundEnabled) playOrderFillSound();
    }
  };

  const handleExportCsv = () => {
    const csvContent = paperEngine.exportCsvLedger();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `perp-roaming-paper-fills-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [confirmReset, setConfirmReset] = useState(false);

  const handleReset = () => {
    if (confirmReset) {
      paperEngine.resetAccount();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
    }
  };

  return (
    <div className="bg-[#080d1a] border border-cyan-500/20 rounded-xl p-3 sm:p-5 shadow-2xl flex flex-col gap-4">
      {/* Top Cockpit Telemetry Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h2 className="font-mono text-sm font-bold text-white tracking-wide flex items-center gap-2 flex-wrap">
              PAPER EXECUTION COCKPIT
              <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                LIVE ORDER FILLS VERIFIED
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> TF: {timeframe}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Non-custodial simulation · Accurate fills, slippage, ATR scale-outs & funding fees
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Timeframe Switcher in Desk */}
          {onSelectTimeframe && (
            <div className="flex items-center bg-[#050811] p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-slate-500 px-1.5 uppercase font-bold hidden sm:inline">Execution TF:</span>
              {TIMEFRAMES.slice(0, 5).map((tf) => (
                <button
                  key={tf}
                  onClick={() => onSelectTimeframe(tf)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    timeframe === tf
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}

          {/* Auto Trade Switch */}
          <button
            onClick={() => onUpdateConfig({ autoTradeEnabled: !config.autoTradeEnabled })}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
              config.autoTradeEnabled
                ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {config.autoTradeEnabled ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5" />}
            AUTO-FILL: {config.autoTradeEnabled ? 'ACTIVE' : 'PAUSED'}
          </button>

          {/* Quick Manual Analysis Button */}
          {onOpenManualAnalysis && (
            <button
              onClick={() => onOpenManualAnalysis(selectedSymbol)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 flex items-center gap-1.5 transition-all shadow-[0_0_8px_rgba(0,240,255,0.2)]"
              title={`Run deep manual quant analysis for ${selectedSymbol}`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Analyze {selectedSymbol.replace('USDT', '')}
            </button>
          )}

          {/* Mode Selector */}
          <div className="flex items-center bg-[#050811] p-0.5 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => paperEngine.setMode('FLAT')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                account.mode === 'FLAT' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              FLAT SIZE
            </button>
            <button
              onClick={() => paperEngine.setMode('COMPOUND')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                account.mode === 'COMPOUND' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              COMPOUND
            </button>
          </div>

          <button
            onClick={handleExportCsv}
            className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Download CSV Ledger"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleReset}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 ${
              confirmReset
                ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
                : 'bg-slate-800/80 border-slate-700 text-rose-400 hover:text-rose-300'
            }`}
            title="Reset Paper Account"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {confirmReset ? 'Confirm Reset?' : 'Reset'}
          </button>
        </div>
      </div>

      {/* Account KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono">
        {/* Equity */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Paper Equity</span>
          <span className="text-base font-bold text-white tracking-tight">
            ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Initial: ${account.initialEquity.toLocaleString()}
          </span>
        </div>

        {/* Realized PnL */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Realized PnL</span>
          <span className={`text-base font-bold ${account.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {account.realizedPnl >= 0 ? '+' : ''}${account.realizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {((account.realizedPnl / account.initialEquity) * 100).toFixed(2)}% net
          </span>
        </div>

        {/* Unrealized PnL */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Unrealized PnL</span>
          <span className={`text-base font-bold ${account.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {account.unrealizedPnl >= 0 ? '+' : ''}${account.unrealizedPnl.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {positions.length} active position{positions.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Available Margin */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Free Margin</span>
          <span className="text-base font-bold text-cyan-300">
            ${account.freeMargin.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Used: ${account.usedMargin.toFixed(2)}
          </span>
        </div>

        {/* Win Rate */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Win Rate</span>
          <span className="text-base font-bold text-amber-400">
            {account.winRate.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {account.wins}W · {account.losses}L ({account.totalTrades} fills)
          </span>
        </div>

        {/* Profit Factor */}
        <div className="bg-[#050811] border border-slate-800/90 rounded-lg p-2.5">
          <span className="text-[10px] text-slate-400 block uppercase">Profit Factor</span>
          <span className="text-base font-bold text-emerald-400">
            {account.profitFactor.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            Slippage: {config.slippageBps} bps
          </span>
        </div>
      </div>

      {/* Tabs Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 pt-1 font-mono text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('POSITIONS')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'POSITIONS'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ACTIVE POSITIONS ({positions.length})
          </button>

          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'LEDGER'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            ORDER FILL LEDGER ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab('EXECUTE')}
            className={`px-3 py-2 border-b-2 font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'EXECUTE'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            QUICK EXECUTION DESK
          </button>
        </div>
      </div>

      {/* Tab 1: ACTIVE POSITIONS */}
      {activeTab === 'POSITIONS' && (
        <div>
          {positions.length === 0 ? (
            <div className="p-8 text-center bg-[#050811] rounded-lg border border-slate-800/60 font-mono text-xs text-slate-500">
              <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              No open paper positions currently running.
              <p className="text-[11px] text-slate-600 mt-1">
                Enable Auto-Trade or click Instant Buy/Sell on any pair to fill a paper position.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {positions.map(pos => {
                const isLong = pos.direction === 'LONG';
                return (
                  <div
                    key={pos.id}
                    className="p-3 bg-[#050811] border border-slate-800 rounded-lg flex flex-col gap-2 font-mono hover:border-cyan-500/30 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{pos.symbol}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isLong
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pos.direction} {pos.leverage}X
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-bold block ${
                            pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ROE: {pos.roePct >= 0 ? '+' : ''}{pos.roePct.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Price telemetry */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] bg-[#0a0f1d] p-2 rounded border border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Entry Fill</span>
                        <span className="text-slate-200">${formatPrice(pos.entryPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Mark Price</span>
                        <span className="text-cyan-300 font-semibold">${formatPrice(pos.currentPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Liq Price</span>
                        <span className="text-rose-400">${formatPrice(pos.liquidationPrice)}</span>
                      </div>
                    </div>

                    {/* Take Profit & Stop Loss Scale Targets */}
                    <div className="text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center justify-between">
                        <span>TP1 (33%): ${formatPrice(pos.tp1Price)}</span>
                        <span className={pos.tp1Hit ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {pos.tp1Hit ? '✓ FILLED (STOP @ BE)' : 'PENDING'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>TP2 (33%): ${formatPrice(pos.tp2Price)}</span>
                        <span className={pos.tp2Hit ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {pos.tp2Hit ? '✓ FILLED' : 'PENDING'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>TP3 (34%): ${formatPrice(pos.tp3Price)}</span>
                        <span className="text-slate-600">FINAL TARGET</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Stop Loss: ${formatPrice(pos.slPrice)}</span>
                        <span className="text-rose-500/80 font-mono">PROTECTION</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => paperEngine.manualClose(pos.id, pos.currentPrice)}
                        className="flex-1 py-1.5 px-3 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold hover:bg-rose-900/60 transition-colors"
                      >
                        Market Close Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: ORDER FILL LEDGER */}
      {activeTab === 'LEDGER' && (
        <div className="overflow-x-auto">
          {orders.length === 0 ? (
            <div className="p-8 text-center bg-[#050811] rounded-lg border border-slate-800/60 font-mono text-xs text-slate-500">
              No orders have been filled yet.
            </div>
          ) : (
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                  <th className="py-2 px-2.5">Order ID</th>
                  <th className="py-2 px-2.5">Time</th>
                  <th className="py-2 px-2.5">Pair</th>
                  <th className="py-2 px-2.5">Action</th>
                  <th className="py-2 px-2.5">Fill Price</th>
                  <th className="py-2 px-2.5">Size (USDT)</th>
                  <th className="py-2 px-2.5">Net PnL</th>
                  <th className="py-2 px-2.5">Status</th>
                  <th className="py-2 px-2.5">Execution Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {orders.map(order => {
                  const isPositive = order.netPnl > 0;
                  return (
                    <tr key={order.id} className="hover:bg-[#0a0f1d] transition-colors">
                      <td className="py-2 px-2.5 text-slate-400 font-mono text-[11px]">
                        #{order.id.slice(-6)}
                      </td>
                      <td className="py-2 px-2.5 text-slate-400 text-[11px]">
                        {new Date(order.executionTime).toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-2.5 font-bold text-white">
                        {order.symbol}
                      </td>
                      <td className="py-2 px-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.direction === 'LONG'
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {order.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-slate-200">
                        ${formatPrice(order.fillPrice)}
                      </td>
                      <td className="py-2 px-2.5 text-slate-300">
                        ${order.size.toFixed(2)} ({order.leverage}x)
                      </td>
                      <td
                        className={`py-2 px-2.5 font-bold ${
                          order.netPnl !== 0
                            ? isPositive
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {order.netPnl !== 0 ? (isPositive ? `+$${order.netPnl.toFixed(2)}` : `-$${Math.abs(order.netPnl).toFixed(2)}`) : '--'}
                      </td>
                      <td className="py-2 px-2.5">
                        <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-slate-400 text-[11px] truncate max-w-[200px]" title={order.notes}>
                        {order.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: QUICK EXECUTION DESK */}
      {activeTab === 'EXECUTE' && (
        <div className="bg-[#050811] p-4 rounded-lg border border-slate-800 font-mono flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">
              Instant Fill Router for <span className="text-cyan-400">{selectedSymbol}</span>
            </span>
            <span className="text-xs text-slate-400">
              Live Price: <strong className="text-white">${formatPrice(currentPrice)}</strong>
            </span>
          </div>

          {/* Sizing & Leverage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 uppercase">Collateral Margin (USDT)</label>
              <div className="flex items-center gap-1.5">
                {[50, 100, 250, 500].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTradeMargin(amt)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      tradeMargin === amt
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-bold'
                        : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
                <input
                  type="number"
                  value={tradeMargin}
                  onChange={e => setTradeMargin(Math.max(10, Number(e.target.value)))}
                  className="w-20 px-2 py-1 bg-[#0a0f1d] border border-slate-800 rounded text-xs text-white text-right focus:border-cyan-400 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 uppercase">
                <span>Leverage</span>
                <span className="text-cyan-400 font-bold">{tradeLeverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={tradeLeverage}
                onChange={e => setTradeLeverage(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
                <span>1x</span>
                <span>10x</span>
                <span>25x</span>
                <span>50x</span>
              </div>
            </div>
          </div>

          {/* Execute buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => handleInstantTrade('LONG')}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm tracking-wide shadow-[0_0_16px_rgba(16,185,129,0.35)] flex items-center justify-center gap-2 transition-all"
            >
              <TrendingUp className="w-4 h-4" />
              BUY / LONG {selectedSymbol}
            </button>

            <button
              onClick={() => handleInstantTrade('SHORT')}
              className="py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-sm tracking-wide shadow-[0_0_16px_rgba(244,63,94,0.35)] flex items-center justify-center gap-2 transition-all"
            >
              <TrendingDown className="w-4 h-4" />
              SELL / SHORT {selectedSymbol}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
