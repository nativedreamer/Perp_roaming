import React, { useState } from 'react';
import { QuantSignal } from '../lib/types';
import { formatPrice } from '../lib/indicators';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Zap,
  Filter,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

interface SignalRadarTableProps {
  signals: QuantSignal[];
  onSelectPair: (symbol: string) => void;
  onInstantTrade: (signal: QuantSignal) => void;
  onOpenManualAnalysis?: (symbol: string) => void;
  selectedSymbol: string;
  isScanning: boolean;
  scanProgress: number;
  totalMonitoredPairs?: number;
  currentScanningSymbol?: string;
  timeframe?: string;
  onSelectTimeframe?: (tf: string) => void;
}

export const SignalRadarTable: React.FC<SignalRadarTableProps> = ({
  signals,
  onSelectPair,
  onInstantTrade,
  onOpenManualAnalysis,
  selectedSymbol,
  isScanning,
  scanProgress,
  totalMonitoredPairs = 120,
  currentScanningSymbol,
  timeframe = '5m',
  onSelectTimeframe
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'LONG' | 'SHORT' | 'OB' | 'HIGH_SCORE'>('ALL');

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

  const filteredSignals = signals.filter(sig => {
    if (searchQuery && !sig.symbol.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterType === 'LONG' && sig.direction !== 'LONG') return false;
    if (filterType === 'SHORT' && sig.direction !== 'SHORT') return false;
    if (filterType === 'OB' && !sig.metrics.orderBlockNearby) return false;
    if (filterType === 'HIGH_SCORE' && sig.strengthScore < 80) return false;
    return true;
  });

  return (
    <div className="bg-[#080d1a] border border-cyan-500/20 rounded-xl p-3 sm:p-5 shadow-xl flex flex-col gap-3">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search perpetual pair (e.g. BTC, SOL)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#050811] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:border-cyan-400 outline-none w-full sm:w-56"
            />
          </div>

          {/* Timeframe Selector Pill in Scanner Table */}
          {onSelectTimeframe && (
            <div className="flex items-center bg-[#050811] rounded-lg p-0.5 border border-slate-800 font-mono text-xs">
              <span className="text-[10px] text-slate-500 px-1.5 uppercase font-bold hidden sm:inline">Scanner TF:</span>
              <div className="flex items-center gap-0.5">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => onSelectTimeframe(tf)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold transition-all ${
                      timeframe === tf
                        ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.35)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Continuous Sweep Progress & Status */}
          <div className="hidden xl:flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>
              24/7 SCREENER ({timeframe}): <strong className="text-white">{signals.length}</strong> ACTIVE / <strong className="text-cyan-300">{totalMonitoredPairs}</strong> PERP PAIRS
              {currentScanningSymbol && <span className="text-slate-500"> (Sweeping: {currentScanningSymbol})</span>}
            </span>
            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.max(scanProgress, 10)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter buttons & Manual Analysis CTA */}
        <div className="flex items-center gap-1.5 font-mono text-xs overflow-x-auto pb-1 lg:pb-0">
          {onOpenManualAnalysis && (
            <button
              onClick={() => onOpenManualAnalysis(selectedSymbol)}
              className="px-2.5 py-1 rounded text-[11px] font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30 flex items-center gap-1 transition-colors whitespace-nowrap shadow-[0_0_10px_rgba(0,240,255,0.2)]"
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              Manual Analyses
            </button>
          )}
          {(['ALL', 'LONG', 'SHORT', 'OB', 'HIGH_SCORE'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors ${
                filterType === f
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white bg-[#050811] border border-slate-850'
              }`}
            >
              {f === 'ALL' && 'All Pairs'}
              {f === 'LONG' && 'Longs Only'}
              {f === 'SHORT' && 'Shorts Only'}
              {f === 'OB' && 'OB Confluence'}
              {f === 'HIGH_SCORE' && 'Score ≥ 80'}
            </button>
          ))}
        </div>
      </div>

      {/* Signals Table */}
      <div className="overflow-x-auto">
        {filteredSignals.length === 0 ? (
          <div className="p-8 text-center bg-[#050811] rounded-lg border border-slate-800/60 font-mono text-xs text-slate-500">
            {isScanning ? 'Radar is actively sweeping Binance Perpetual order books...' : 'No active pairs matching this filter.'}
          </div>
        ) : (
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                <th className="py-2 px-2.5">Pair</th>
                <th className="py-2 px-2.5">Signal</th>
                <th className="py-2 px-2.5">Entry Price</th>
                <th className="py-2 px-2.5">Strength Score</th>
                <th className="py-2 px-2.5">OB Confluence</th>
                <th className="py-2 px-2.5">Rel Vol</th>
                <th className="py-2 px-2.5">TP1 Target</th>
                <th className="py-2 px-2.5">Stop Loss</th>
                <th className="py-2 px-2.5 text-right">Instant Fill Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredSignals.map(sig => {
                const isSelected = sig.symbol === selectedSymbol;
                const isLong = sig.direction === 'LONG';
                return (
                  <tr
                    key={sig.id}
                    onClick={() => onSelectPair(sig.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-950/30' : 'hover:bg-[#0a0f1d]'
                    }`}
                  >
                    {/* Symbol */}
                    <td className="py-2.5 px-2.5 font-bold text-white flex items-center gap-1.5">
                      <span className="text-cyan-400">{sig.symbol}</span>
                      <span className="text-[10px] text-slate-500 font-normal">PERP</span>
                    </td>

                    {/* Direction */}
                    <td className="py-2.5 px-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isLong
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {sig.direction}
                      </span>
                    </td>

                    {/* Entry */}
                    <td className="py-2.5 px-2.5 text-slate-200">
                      ${formatPrice(sig.entryPrice)}
                    </td>

                    {/* Strength Score with visual bar */}
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${sig.strengthScore >= 80 ? 'text-emerald-400' : sig.strengthScore >= 65 ? 'text-cyan-300' : 'text-amber-400'}`}>
                          {sig.strengthScore}%
                        </span>
                        <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${sig.strengthScore >= 80 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                            style={{ width: `${sig.strengthScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Order Block Confluence */}
                    <td className="py-2.5 px-2.5">
                      {sig.metrics.orderBlockNearby ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                          <Layers className="w-3 h-3 text-emerald-400" />
                          INSIDE OB
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">
                          None
                        </span>
                      )}
                    </td>

                    {/* Rel Vol */}
                    <td className="py-2.5 px-2.5 text-slate-300">
                      {sig.metrics.relVolumePct}%
                    </td>

                    {/* TP1 */}
                    <td className="py-2.5 px-2.5 text-emerald-400 font-medium">
                      ${formatPrice(sig.tp1Price)}
                    </td>

                    {/* SL */}
                    <td className="py-2.5 px-2.5 text-rose-400 font-medium">
                      ${formatPrice(sig.slPrice)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onOpenManualAnalysis && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenManualAnalysis(sig.symbol);
                            }}
                            className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-all"
                            title="Open Manual Deep Quant Analysis"
                          >
                            Analyze
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInstantTrade(sig);
                          }}
                          className="py-1 px-2.5 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 shadow-[0_0_8px_rgba(0,240,255,0.2)] transition-all whitespace-nowrap"
                        >
                          <Zap className="w-3 h-3 text-cyan-400" />
                          1-Click Fill
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
