import React from 'react';
import { PortfolioSummary } from '../types/portfolio';
import { formatINR, formatPercent } from '../utils/formatters';
import { Wallet, TrendingUp, TrendingDown, Layers, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Props {
  summary: PortfolioSummary;
}

export const PortfolioSummaryCards: React.FC<Props> = ({ summary }) => {
  const isProfit = summary.totalProfitLoss >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Invested */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-card-elevated backdrop-blur-md transition-all hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Invested</span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight font-mono">
            {formatINR(summary.totalInvested)}
          </h3>
          <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5 font-mono">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Across {summary.totalFunds} Tracked Funds</span>
          </p>
        </div>
      </div>

      {/* 2. Current Valuation */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-cyan-950/30 to-slate-900/90 border border-cyan-500/30 p-5 shadow-card-elevated backdrop-blur-md transition-all hover:border-cyan-500/60 shadow-glow-cyan">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-300">Current Valuation</span>
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl lg:text-3xl font-extrabold text-cyan-100 tracking-tight font-mono">
            {formatINR(summary.currentValue)}
          </h3>
          <p className="mt-1 text-xs text-cyan-400/80 font-mono">
            Live Net Asset Valuation
          </p>
        </div>
      </div>

      {/* 3. Total Profit / Loss */}
      <div className={`relative overflow-hidden rounded-2xl bg-slate-900/90 border p-5 shadow-card-elevated backdrop-blur-md transition-all ${
        isProfit ? 'border-emerald-500/30 hover:border-emerald-500/50 shadow-glow-emerald' : 'border-rose-500/30 hover:border-rose-500/50 shadow-glow-rose'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Total Profit / Loss</span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isProfit ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}>
            {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <h3 className={`text-2xl lg:text-3xl font-extrabold tracking-tight font-mono ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatINR(summary.totalProfitLoss)}
            </h3>
            <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-full ${
              isProfit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {formatPercent(summary.overallReturnPct)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 font-mono">
            Overall Unrealized Portfolio Return
          </p>
        </div>
      </div>

      {/* 4. Signal Spectrum */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 border border-slate-800 p-5 shadow-card-elevated backdrop-blur-md transition-all hover:border-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Alert Distribution</span>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-center">
              <span className="block text-base font-extrabold text-rose-400 font-mono">{summary.buyCount}</span>
              <span className="text-[10px] text-rose-300/80 uppercase font-mono">Buy Dip</span>
            </div>
            <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
              <span className="block text-base font-extrabold text-amber-400 font-mono">{summary.fallingCount}</span>
              <span className="text-[10px] text-amber-300/80 uppercase font-mono">Watch</span>
            </div>
            <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
              <span className="block text-base font-extrabold text-emerald-400 font-mono">{summary.stableCount}</span>
              <span className="text-[10px] text-emerald-300/80 uppercase font-mono">Stable</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 font-mono flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-cyan-400" />
            <span>Active AMFI Alert Matrix</span>
          </p>
        </div>
      </div>
    </div>
  );
};
