import React, { useState, useEffect } from 'react';
import { PaperAccount, StrategyConfig } from '../lib/types';
import { Sliders, BarChart2, Radio, Volume2, VolumeX, ShieldCheck, Zap } from 'lucide-react';

interface HeaderProps {
  account: PaperAccount;
  config: StrategyConfig;
  onOpenSettings: () => void;
  onOpenBacktest: () => void;
  onOpenManualAnalysis: () => void;
  onToggleSound: () => void;
  activeScanCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  config,
  onOpenSettings,
  onOpenBacktest,
  onOpenManualAnalysis,
  onToggleSound,
  activeScanCount
}) => {
  const [lagosTime, setLagosTime] = useState('');
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLagosTime(
        new Intl.DateTimeFormat('en-NG', {
          timeZone: 'Africa/Lagos',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(now)
      );
      setUtcTime(now.toISOString().slice(11, 19));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-3 bg-[#080d1a]/95 backdrop-blur-md border-b border-cyan-500/20 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-sm shadow-[0_0_12px_rgba(0,240,255,0.25)]">
          PR
        </div>
        <a href="/" className="text-base font-extrabold tracking-tight text-white whitespace-nowrap font-mono">
          PERP ROAMING <span className="text-cyan-400 text-xs font-normal">· v6.5 QUANT</span>
        </a>
      </div>

      {/* Zone 2: Clean single-line quant telemetry & links */}
      <nav className="hidden lg:flex items-center gap-4 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-2 text-slate-400 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>RADAR: <strong className="text-white">{activeScanCount} PAIRS SWEEPING</strong></span>
        </div>

        <span className="text-slate-700" aria-hidden="true">/</span>

        <button
          onClick={onOpenManualAnalysis}
          className="hover:text-cyan-300 text-cyan-400 flex items-center gap-1.5 transition-colors whitespace-nowrap px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30"
        >
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          Manual Analyses
        </button>

        <span className="text-slate-700" aria-hidden="true">/</span>

        <button
          onClick={onOpenBacktest}
          className="hover:text-cyan-300 text-slate-300 flex items-center gap-1 transition-colors whitespace-nowrap"
        >
          <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
          Pine Backtest
        </button>

        <span className="text-slate-700" aria-hidden="true">/</span>

        <div className="flex items-center gap-2 text-slate-400 whitespace-nowrap">
          <span>LAGOS: <strong className="text-slate-200">{lagosTime}</strong></span>
          <span className="text-slate-600">·</span>
          <span>UTC: <strong className="text-slate-200">{utcTime}</strong></span>
        </div>
      </nav>

      {/* Zone 3: Primary action & Paper Equity */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Quick Manual Analysis Button on Mobile/Tablet */}
        <button
          onClick={onOpenManualAnalysis}
          className="lg:hidden flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
        >
          <Zap className="w-3.5 h-3.5" />
          Analyze
        </button>

        {/* Paper Equity Pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[#050811] border border-cyan-500/30 rounded-lg font-mono text-xs">
          <span className="text-[10px] text-slate-400 uppercase">EQUITY:</span>
          <span className="font-bold text-emerald-400">
            ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Sound toggle */}
        <button
          onClick={onToggleSound}
          className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title={config.soundEnabled ? "Mute audio synthesizer" : "Enable audio synthesizer"}
        >
          {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="px-3.5 py-1.5 text-xs font-mono font-bold text-white bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg transition-all shadow-[0_0_12px_rgba(0,240,255,0.25)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Sliders className="w-3.5 h-3.5" />
          Config
        </button>
      </div>
    </header>
  );
};
