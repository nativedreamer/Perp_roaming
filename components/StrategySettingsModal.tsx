import React from 'react';
import { StrategyConfig } from '../lib/types';
import { X, Sliders, Check, Sparkles, Shield, Cpu } from 'lucide-react';

interface StrategySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StrategyConfig;
  onUpdateConfig: (newConfig: Partial<StrategyConfig>) => void;
}

export const StrategySettingsModal: React.FC<StrategySettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#080d1a] border border-cyan-500/30 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="font-mono text-sm font-bold text-white">
              QUANT STRATEGY & RISK PARAMETERS
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 font-mono text-xs">
          {/* Strategy Selection */}
          <div>
            <label className="text-[11px] text-cyan-300 font-bold block mb-2 uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> Core Quantitative Engine
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => onUpdateConfig({ activeStrategy: 'ORDER_BLOCKS_EMA' })}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  config.activeStrategy === 'ORDER_BLOCKS_EMA'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold text-[11px] text-cyan-400 flex items-center gap-1">
                  Pine Script v6
                  {config.activeStrategy === 'ORDER_BLOCKS_EMA' && <Check className="w-3 h-3 text-cyan-400" />}
                </span>
                <span className="text-[10px] text-slate-300">EMA 10/30 + Volumetric Order Blocks</span>
              </button>

              <button
                onClick={() => onUpdateConfig({ activeStrategy: 'VWAP_EMA' })}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  config.activeStrategy === 'VWAP_EMA'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold text-[11px] text-cyan-400 flex items-center gap-1">
                  Perp Roaming Classic
                  {config.activeStrategy === 'VWAP_EMA' && <Check className="w-3 h-3 text-cyan-400" />}
                </span>
                <span className="text-[10px] text-slate-300">EMA 9/21 + 200 EMA + Session VWAP</span>
              </button>

              <button
                onClick={() => onUpdateConfig({ activeStrategy: 'HYBRID_CONFLUENCE' })}
                className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                  config.activeStrategy === 'HYBRID_CONFLUENCE'
                    ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                    : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="font-bold text-[11px] text-purple-400 flex items-center gap-1">
                  Hybrid Confluence
                  {config.activeStrategy === 'HYBRID_CONFLUENCE' && <Check className="w-3 h-3 text-purple-400" />}
                </span>
                <span className="text-[10px] text-slate-300">Dual Engine Confluence Radar</span>
              </button>
            </div>
          </div>

          {/* Strategy Inputs */}
          <div className="bg-[#050811] p-3.5 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-[11px] text-slate-300 font-bold uppercase flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Signal & Indicator Inputs
            </h4>

            {/* Timeframe option */}
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Default Screener & Execution Timeframe</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => onUpdateConfig({ scannerTimeframe: tf })}
                    className={`py-1 rounded text-center text-xs font-bold border transition-colors ${
                      (config.scannerTimeframe || '5m') === tf
                        ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                        : 'bg-[#0a0f1d] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Fast EMA</label>
                <input
                  type="number"
                  value={config.fastMA}
                  onChange={e => onUpdateConfig({ fastMA: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Slow EMA</label>
                <input
                  type="number"
                  value={config.slowMA}
                  onChange={e => onUpdateConfig({ slowMA: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ATR Length</label>
                <input
                  type="number"
                  value={config.atrLength}
                  onChange={e => onUpdateConfig({ atrLength: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">SL Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.atrMultiplierSL}
                  onChange={e => onUpdateConfig({ atrMultiplierSL: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TP1 (33%) x ATR</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.tp1Multiplier}
                  onChange={e => onUpdateConfig({ tp1Multiplier: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TP2 (33%) x ATR</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.tp2Multiplier}
                  onChange={e => onUpdateConfig({ tp2Multiplier: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">TP3 (34%) x ATR</label>
                <input
                  type="number"
                  step="0.1"
                  value={config.tp3Multiplier}
                  onChange={e => onUpdateConfig({ tp3Multiplier: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Filters Confluence */}
          <div className="bg-[#050811] p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <h4 className="text-[11px] text-slate-300 font-bold uppercase flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Algorithmic Filters
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useOB}
                  onChange={e => onUpdateConfig({ useOB: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span className="text-slate-300">Require Order Block Confluence</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useRSI}
                  onChange={e => onUpdateConfig({ useRSI: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span className="text-slate-300">Enable RSI Filter (≥50 / ≤50)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useVol}
                  onChange={e => onUpdateConfig({ useVol: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span className="text-slate-300">Require Volume Spike (&gt;100%)</span>
              </label>
            </div>
          </div>

          {/* Paper Auto-Trading Rule */}
          <div className="bg-[#050811] p-3.5 rounded-xl border border-slate-800 space-y-2.5">
            <h4 className="text-[11px] text-slate-300 font-bold uppercase flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Paper Order Fill Automation
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Min Score to Auto-Fill (0-100)</label>
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={config.minScoreToExecute}
                  onChange={e => onUpdateConfig({ minScoreToExecute: Number(e.target.value) })}
                  className="w-full bg-[#0a0f1d] border border-slate-800 rounded p-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Sound Synthesizer Audio</label>
                <button
                  onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
                  className={`w-full p-1.5 rounded border text-xs font-semibold ${
                    config.soundEnabled
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {config.soundEnabled ? 'Synthesizer Audio ON' : 'Audio MUTED'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-1.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,240,255,0.25)]"
          >
            Apply Parameters
          </button>
        </div>
      </div>
    </div>
  );
};
