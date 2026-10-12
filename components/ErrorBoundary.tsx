import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PERP_ROAMING Uncaught Error Caught by Boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleRecover = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleHardReset = () => {
    try {
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center p-4 font-mono">
          <div className="max-w-lg w-full bg-[#080d1a] border border-rose-500/40 rounded-2xl p-6 shadow-2xl shadow-rose-950/40">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white">System Error Intercepted</h2>
                <p className="text-xs text-rose-400/80">UI engine recovered automatically · No capital lost</p>
              </div>
            </div>

            <div className="bg-[#03050a] p-3.5 rounded-xl border border-slate-800 text-xs mb-5 overflow-auto max-h-40">
              <p className="text-rose-300 font-semibold mb-1 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-rose-400" />
                {this.state.error?.name || 'Runtime Exception'}:
              </p>
              <p className="text-slate-400 break-words">{this.state.error?.message || 'An unexpected rendering error occurred'}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,240,255,0.3)]"
              >
                <RefreshCw className="w-4 h-4" />
                Resume Quant Radar
              </button>
              <button
                onClick={this.handleHardReset}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700 transition-all"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
