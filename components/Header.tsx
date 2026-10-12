import React, { useState, useEffect } from 'react';
import { PaperAccount, StrategyConfig } from '../lib/types';
import { Sliders, BarChart2, Volume2, VolumeX, Zap, Menu, X, Clock } from 'lucide-react';

interface HeaderProps {
  account: PaperAccount;
  config: StrategyConfig;
  onOpenSettings: () => void;
  onOpenBacktest: () => void;
  onOpenManualAnalysis: () => void;
  onToggleSound: () => void;
  onSelectTimeframe: (tf: string) => void;
  activeScanCount: number;
}

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

export const Header: React.FC<HeaderProps> = ({
  account,
  config,
  onOpenSettings,
  onOpenBacktest,
  onOpenManualAnalysis,
  onToggleSound,
  onSelectTimeframe,
  activeScanCount
}) => {
  const [lagosTime, setLagosTime] = useState('');
  const [utcTime, setUtcTime] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const currentTf = config.scannerTimeframe || '5m';

  return (
    <header className="bg-[#080d1a]/95 backdrop-blur-md border-b border-cyan-500/20 sticky top-0 z-40">
      <div className="max-w-[1720px] mx-auto px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Wordmark & Timeframe Badge */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono font-bold text-xs sm:text-sm shadow-[0_0_12px_rgba(0,240,255,0.25)]">
            PR
          </div>
          <div className="flex flex-col">
            <a href="/" className="text-sm sm:text-base font-extrabold tracking-tight text-white whitespace-nowrap font-mono flex items-center gap-1.5">
              PERP ROAMING
              <span className="hidden sm:inline text-cyan-400 text-xs font-normal">· v6.5 QUANT</span>
            </a>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>RADAR: <strong className="text-cyan-300">{activeScanCount} PAIRS</strong></span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400 font-bold">{currentTf}</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Timeframe Quick Selector Pills (Responsive desktop/tablet) */}
        <div className="hidden xl:flex items-center bg-[#040712] p-1 rounded-xl border border-slate-800 font-mono text-xs">
          <div className="flex items-center gap-1 px-2 text-slate-400 text-[11px]">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span className="uppercase text-[10px] font-bold text-slate-400">Timeframe:</span>
          </div>
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => onSelectTimeframe(tf)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  currentTf === tf
                    ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Zone 3: Navigation buttons & clock on lg screens */}
        <nav className="hidden lg:flex items-center gap-3 font-mono text-xs text-slate-300">
          <button
            onClick={onOpenManualAnalysis}
            className="hover:text-cyan-200 text-cyan-300 flex items-center gap-1.5 transition-colors whitespace-nowrap px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 shadow-[0_0_8px_rgba(0,240,255,0.15)]"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Manual Analyses
          </button>

          <button
            onClick={onOpenBacktest}
            className="hover:text-white text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60"
          >
            <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
            Pine Backtest
          </button>

          <div className="hidden 2xl:flex items-center gap-2 text-[11px] text-slate-400 border-l border-slate-800 pl-3">
            <span>LAGOS: <strong className="text-slate-200">{lagosTime}</strong></span>
            <span className="text-slate-600">·</span>
            <span>UTC: <strong className="text-slate-200">{utcTime}</strong></span>
          </div>
        </nav>

        {/* Zone 4: Equity, Sound & Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile/Tablet Timeframe Dropdown Select */}
          <div className="xl:hidden flex items-center bg-[#050811] border border-cyan-500/30 rounded-lg px-2 py-1 font-mono text-xs">
            <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">TF:</span>
            <select
              value={currentTf}
              onChange={(e) => onSelectTimeframe(e.target.value)}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {TIMEFRAMES.map((tf) => (
                <option key={tf} value={tf} className="bg-[#080d1a] text-white">
                  {tf}
                </option>
              ))}
            </select>
          </div>

          {/* Paper Equity Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 bg-[#050811] border border-cyan-500/30 rounded-lg font-mono text-xs">
            <span className="text-[10px] text-slate-400 uppercase hidden sm:inline">EQUITY:</span>
            <span className="font-bold text-emerald-400">
              ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>

          {/* Sound toggle */}
          <button
            onClick={onToggleSound}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title={config.soundEnabled ? "Mute audio synthesizer" : "Enable audio synthesizer"}
          >
            {config.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          {/* Settings button */}
          <button
            onClick={onOpenSettings}
            className="px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-bold text-white bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-lg transition-all shadow-[0_0_12px_rgba(0,240,255,0.25)] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Config</span>
          </button>

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-cyan-400" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Collapsible Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-[#050811] px-4 py-3 font-mono text-xs space-y-3 animate-in slide-in-from-top duration-200">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase block font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" /> Scanner & Paper Timeframe
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    onSelectTimeframe(tf);
                    setMobileMenuOpen(false);
                  }}
                  className={`py-1 rounded text-center font-bold text-xs border ${
                    currentTf === tf
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <button
              onClick={() => {
                onOpenManualAnalysis();
                setMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center gap-1.5 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Manual Analyses
            </button>

            <button
              onClick={() => {
                onOpenBacktest();
                setMobileMenuOpen(false);
              }}
              className="py-2 px-3 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5"
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
              Pine Backtest
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
            <span>Lagos: <strong className="text-slate-200">{lagosTime}</strong></span>
            <span>UTC: <strong className="text-slate-200">{utcTime}</strong></span>
          </div>
        </div>
      )}
    </header>
  );
};
