import React from 'react';
import { MutualFund } from '../types/portfolio';
import { formatINR, formatPercent, getAlertBadgeStyle } from '../utils/formatters';
import { TrendingUp, TrendingDown, ArrowRight, ExternalLink, BarChart2 } from 'lucide-react';

interface Props {
  fund: MutualFund;
  onSelect: (schemeCode: string) => void;
}

export const FundCard: React.FC<Props> = ({ fund, onSelect }) => {
  const isProfit = fund.profitLoss >= 0;
  const alertStyle = getAlertBadgeStyle(fund.alert?.tag || '');
  const isBuyAlert = fund.alert?.tag?.includes('BUY');

  return (
    <div
      onClick={() => onSelect(fund.schemeCode)}
      className={`relative overflow-hidden rounded-2xl bg-slate-900/90 border p-5 shadow-card-elevated backdrop-blur-md cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl group ${
        isBuyAlert
          ? 'border-rose-500/40 hover:border-rose-500 shadow-glow-rose'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
        style={{ backgroundColor: fund.color || '#3b82f6' }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
              {fund.category}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              #{fund.schemeCode}
            </span>
          </div>
          <h4 className="mt-2 text-base font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
            {fund.name}
          </h4>
        </div>

        {/* Alert Pill */}
        <div
          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${alertStyle.bg} ${alertStyle.text} ${alertStyle.border}`}
        >
          {fund.alert?.tag || '🟩 STABLE'}
        </div>
      </div>

      {/* NAV & Movement */}
      <div className="mt-4 pb-4 border-b border-slate-800/80 flex items-baseline justify-between font-mono">
        <div>
          <span className="text-xs text-slate-400">Latest NAV</span>
          <div className="text-xl font-extrabold text-white">
            ₹{fund.latestNAV.toFixed(2)}
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400">10D Deviation</span>
          <div className={`text-sm font-bold ${fund.alert?.percentValue < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {fund.alert?.percentDisplay || '0.00%'}
          </div>
        </div>
      </div>

      {/* Valuation & Profit Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block">Invested</span>
          <span className="text-sm font-bold text-slate-200 block mt-0.5">
            {formatINR(fund.totalInvested)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <span className="text-[10px] uppercase text-slate-400 block">Current Value</span>
          <span className="text-sm font-bold text-cyan-300 block mt-0.5">
            {formatINR(fund.currentValue)}
          </span>
        </div>
      </div>

      {/* P/L & Return Footer */}
      <div className="mt-3 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">P/L:</span>
          <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatINR(fund.profitLoss)}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            isProfit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            {formatPercent(fund.returnPct)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400 group-hover:text-cyan-400 text-[11px] font-sans font-medium transition-colors">
          <span>Inspect</span>
          <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
};
