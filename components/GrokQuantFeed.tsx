import React, { useState, useEffect, useRef } from 'react';
import { Bot, Terminal, ShieldAlert, Zap, Radio, CheckCircle2 } from 'lucide-react';
import { PaperOrder, QuantSignal } from '../lib/types';

interface GrokLogEntry {
  id: string;
  timestamp: string;
  type: 'ANALYSIS' | 'ORDER_FILL' | 'STRATEGY' | 'RISK';
  symbol?: string;
  message: string;
  score?: number;
}

interface GrokQuantFeedProps {
  latestSignal: QuantSignal | null;
  latestFill: PaperOrder | null;
  strategyName: string;
}

export const GrokQuantFeed: React.FC<GrokQuantFeedProps> = ({
  latestSignal,
  latestFill,
  strategyName
}) => {
  const [logs, setLogs] = useState<GrokLogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'STRATEGY',
      message: 'Grok Quant Engine initialized. Model: High-Frequency Volumetric Order Blocks + EMA 10/30 (Pine Script v6).'
    },
    {
      id: 'log-2',
      timestamp: new Date().toLocaleTimeString(),
      type: 'RISK',
      message: 'Paper Execution Engine synced: $10,000 initial equity ready. Multi-tier exits armed (TP1 33%, TP2 33%, TP3 34%).'
    },
    {
      id: 'log-3',
      timestamp: new Date().toLocaleTimeString(),
      type: 'ANALYSIS',
      symbol: 'BTCUSDT',
      score: 84,
      message: 'Sweeping Binance Perpetual order books. Order Block confluence threshold: 0.5x ATR. Monitoring liquidity sweeps.'
    }
  ]);

  const feedRef = useRef<HTMLDivElement>(null);

  // When a new signal arrives, log Grok's quant observation
  useEffect(() => {
    if (!latestSignal) return;
    const time = new Date(latestSignal.timestamp).toLocaleTimeString();
    const isOB = latestSignal.metrics.orderBlockNearby;
    const obText = isOB ? 'inside active Volumetric Order Block zone' : 'trend momentum expansion';

    const newEntry: GrokLogEntry = {
      id: `sig-${Date.now()}-${latestSignal.symbol}`,
      timestamp: time,
      type: 'ANALYSIS',
      symbol: latestSignal.symbol,
      score: latestSignal.strengthScore,
      message: `${latestSignal.direction} signal detected on ${latestSignal.timeframe} (${obText}). Score: ${latestSignal.strengthScore}/100. SL: $${latestSignal.slPrice.toFixed(2)} | TP1: $${latestSignal.tp1Price.toFixed(2)}`
    };

    setLogs(prev => [newEntry, ...prev.slice(0, 40)]);
  }, [latestSignal]);

  // When a paper order is filled, log execution confirmation
  useEffect(() => {
    if (!latestFill) return;
    const time = new Date(latestFill.executionTime).toLocaleTimeString();
    const newEntry: GrokLogEntry = {
      id: `fill-${latestFill.id}`,
      timestamp: time,
      type: 'ORDER_FILL',
      symbol: latestFill.symbol,
      message: `FILL CONFIRMED: ${latestFill.type} ${latestFill.direction} ${latestFill.symbol} @ $${latestFill.fillPrice.toFixed(4)} (Margin: $${latestFill.margin.toFixed(2)} | ${latestFill.leverage}x). Order ID: #${latestFill.id.slice(-6)}`
    };

    setLogs(prev => [newEntry, ...prev.slice(0, 40)]);
  }, [latestFill]);

  return (
    <div className="bg-[#080d1a] border border-cyan-500/20 rounded-xl p-3 sm:p-4 shadow-xl flex flex-col h-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <span className="font-mono text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              GROK QUANT BOT TELEMETRY
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <p className="text-[10px] text-slate-400 font-mono">Real-time algorithmic stream · Execution routing</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
            STRATEGY: {strategyName === 'ORDER_BLOCKS_EMA' ? 'OB + EMA v6' : strategyName}
          </span>
        </div>
      </div>

      {/* Log Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px] leading-relaxed"
      >
        {logs.map((log) => {
          let badgeColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
          let icon = <Terminal className="w-3 h-3 text-cyan-400 shrink-0" />;

          if (log.type === 'ORDER_FILL') {
            badgeColor = 'text-emerald-400 border-emerald-500/40 bg-emerald-950/50';
            icon = <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />;
          } else if (log.type === 'RISK') {
            badgeColor = 'text-amber-400 border-amber-500/30 bg-amber-950/40';
            icon = <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />;
          }

          return (
            <div
              key={log.id}
              className="p-1.5 rounded bg-[#0a1122] border border-slate-800/80 flex items-start gap-2 hover:border-cyan-500/30 transition-colors"
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                  {log.symbol && (
                    <span className="font-bold text-white text-[11px]">{log.symbol}</span>
                  )}
                  {log.score !== undefined && (
                    <span className={`text-[9px] px-1 rounded border ${log.score >= 80 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40' : 'text-amber-400 border-amber-500/30 bg-amber-950/40'}`}>
                      {log.score}/100
                    </span>
                  )}
                  <span className={`text-[9px] px-1 rounded border uppercase font-medium ${badgeColor}`}>
                    {log.type}
                  </span>
                </div>
                <p className="text-slate-300 break-words">{log.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
