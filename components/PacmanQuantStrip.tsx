import React, { useState } from 'react';
import { MarketDirection } from '../lib/types';
import { ChevronDown, ChevronUp, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface PacmanQuantStripProps {
  lastDirection: MarketDirection | null;
  activePairsCount: number;
  openPositionsCount: number;
}

export const PacmanQuantStrip: React.FC<PacmanQuantStripProps> = ({
  lastDirection = 'LONG',
  activePairsCount,
  openPositionsCount
}) => {
  const [minimized, setMinimized] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);

  const isBullish = lastDirection === 'LONG';

  return (
    <div className="w-full bg-[#060a14] border border-cyan-500/20 rounded-xl overflow-hidden shadow-lg transition-all duration-300">
      {/* Top micro bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0f1d] border-b border-cyan-500/10 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-mono text-[11px] font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
            ARCADE QUANT LABYRINTH
            <span className="text-[10px] text-slate-500 font-normal">· v6.4 CHOMP ENGINE</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="hidden sm:inline font-mono">
            SENTIMENT: <strong className={isBullish ? 'text-emerald-400' : 'text-rose-400'}>{isBullish ? 'BULL RUN (ENERGIZED)' : 'BEAR SQUEEZE'}</strong>
          </span>
          <span className="hidden md:inline font-mono text-slate-500">·</span>
          <span className="hidden md:inline font-mono text-cyan-300">{openPositionsCount} LIVE FILLS</span>
          <button
            onClick={() => setMinimized(!minimized)}
            className="text-slate-400 hover:text-white transition-colors p-0.5"
            title={minimized ? "Expand arcade" : "Minimize arcade"}
          >
            {minimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 2D Arcade Canvas */}
      {!minimized && (
        <div className="relative h-16 sm:h-20 bg-[#03060f] overflow-hidden flex items-center px-4">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

          {/* Glowing Quant Pips / Dots Strip */}
          <div className="absolute inset-x-0 flex items-center justify-around px-6 pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i % 4 === 0
                    ? 'w-2.5 h-2.5 bg-cyan-400 shadow-[0_0_8px_#00f0ff] dot-pulse'
                    : 'bg-amber-300/60 shadow-[0_0_4px_#f59e0b]'
                }`}
              />
            ))}
          </div>

          {/* Animated 2D Pacman + Ghosts Moving Across Screen */}
          <div className="pacman-runner flex items-center gap-6 z-10">
            {/* Pacman Character */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-8 h-8 drop-shadow-[0_0_8px_rgba(250,204,21,0.7)]">
                {/* Yellow body with chomping mouth */}
                <path
                  d="M 50,50 L 95,25 A 45,45 0 1 0 95,75 Z"
                  fill="#facc15"
                  className="pacman-upper"
                />
                <circle cx="50" cy="25" r="4.5" fill="#000" />
              </svg>
              {/* Quant Alpha Bubble */}
              <span className="absolute -top-3.5 -right-3 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-500/30 whitespace-nowrap">
                +ALPHA
              </span>
            </div>

            {/* Ghost 1: Blinky (Red) */}
            <div className="ghost-bob relative w-7 h-7">
              <svg viewBox="0 0 100 100" className="w-7 h-7 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]">
                <path
                  d="M 15,90 L 15,45 A 35,35 0 0 1 85,45 L 85,90 L 73,80 L 61,90 L 50,80 L 39,90 L 27,80 Z"
                  fill={isBullish ? "#3b82f6" : "#f43f5e"}
                />
                <circle cx="36" cy="42" r="7" fill="#ffffff" />
                <circle cx="38" cy="42" r="3.5" fill="#1e293b" />
                <circle cx="64" cy="42" r="7" fill="#ffffff" />
                <circle cx="66" cy="42" r="3.5" fill="#1e293b" />
              </svg>
            </div>

            {/* Ghost 2: Pinky (Pink) */}
            <div className="ghost-bob relative w-7 h-7" style={{ animationDelay: '0.15s' }}>
              <svg viewBox="0 0 100 100" className="w-7 h-7 drop-shadow-[0_0_6px_rgba(236,72,153,0.6)]">
                <path
                  d="M 15,90 L 15,45 A 35,35 0 0 1 85,45 L 85,90 L 73,80 L 61,90 L 50,80 L 39,90 L 27,80 Z"
                  fill={isBullish ? "#60a5fa" : "#ec4899"}
                />
                <circle cx="36" cy="42" r="7" fill="#ffffff" />
                <circle cx="38" cy="42" r="3.5" fill="#1e293b" />
                <circle cx="64" cy="42" r="7" fill="#ffffff" />
                <circle cx="66" cy="42" r="3.5" fill="#1e293b" />
              </svg>
            </div>

            {/* Ghost 3: Inky (Cyan) */}
            <div className="ghost-bob relative w-7 h-7" style={{ animationDelay: '0.3s' }}>
              <svg viewBox="0 0 100 100" className="w-7 h-7 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]">
                <path
                  d="M 15,90 L 15,45 A 35,35 0 0 1 85,45 L 85,90 L 73,80 L 61,90 L 50,80 L 39,90 L 27,80 Z"
                  fill={isBullish ? "#93c5fd" : "#06b6d4"}
                />
                <circle cx="36" cy="42" r="7" fill="#ffffff" />
                <circle cx="38" cy="42" r="3.5" fill="#1e293b" />
                <circle cx="64" cy="42" r="7" fill="#ffffff" />
                <circle cx="66" cy="42" r="3.5" fill="#1e293b" />
              </svg>
            </div>

            {/* Ghost 4: Clyde (Orange) */}
            <div className="ghost-bob relative w-7 h-7" style={{ animationDelay: '0.45s' }}>
              <svg viewBox="0 0 100 100" className="w-7 h-7 drop-shadow-[0_0_6px_rgba(249,115,22,0.6)]">
                <path
                  d="M 15,90 L 15,45 A 35,35 0 0 1 85,45 L 85,90 L 73,80 L 61,90 L 50,80 L 39,90 L 27,80 Z"
                  fill={isBullish ? "#bfdbfe" : "#f97316"}
                />
                <circle cx="36" cy="42" r="7" fill="#ffffff" />
                <circle cx="38" cy="42" r="3.5" fill="#1e293b" />
                <circle cx="64" cy="42" r="7" fill="#ffffff" />
                <circle cx="66" cy="42" r="3.5" fill="#1e293b" />
              </svg>
            </div>
          </div>

          {/* Right side live status ticker */}
          <div className="ml-auto z-20 flex items-center gap-3 bg-[#0a0f1d]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/20 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <div className="flex flex-col text-right">
              <span className="font-mono text-[10px] text-slate-400">ORDER BLOCKS RADAR</span>
              <span className="font-mono text-xs font-bold text-emerald-400">SWEEPING 24/7 PERPS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
