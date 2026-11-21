import React, { useState } from 'react';
import { BestPerformer } from '../types/portfolio';
import { formatPercent } from '../utils/formatters';
import { Trophy, Flame, ChevronRight, Award } from 'lucide-react';

interface Props {
  bestPerformers: Record<'1M' | '3M' | '6M' | '1Y' | 'ALL', BestPerformer>;
  onSelectFund?: (schemeCode: string) => void;
}

export const BestPerformerCard: React.FC<Props> = ({ bestPerformers, onSelectFund }) => {
  const [activePeriod, setActivePeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1M');

  const current = bestPerformers[activePeriod] || {
    name: 'N/A',
    shortName: 'N/A',
    category: '',
    color: '#3b82f6',
    returnPct: 0,
    latestNAV: 0,
    latestNAVDate: '',
    schemeCode: ''
  };

  const periods: Array<{ key: '1M' | '3M' | '6M' | '1Y' | 'ALL'; label: string }> = [
    { key: '1M', label: '1 Month' },
    { key: '3M', label: '3 Months' },
    { key: '6M', label: '6 Months' },
    { key: '1Y', label: '1 Year' },
    { key: 'ALL', label: 'All Time' }
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 p-5 shadow-card-elevated flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-glow-gold">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Top Performing Fund
              </h4>
              <p className="text-[11px] text-slate-400">Calculated over historical NAV trajectories</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {periods.map(p => (
              <button
                key={p.key}
                onClick={() => setActivePeriod(p.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
                  activePeriod === p.key
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {p.key}
              </button>
            ))}
          </div>
        </div>

        {/* Fund Detail Showcase */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: current.color || '#3b82f6' }}
              />
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                {current.category || 'Equity Fund'}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Scheme: {current.schemeCode}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {current.name}
            </h3>
            <div className="text-xs text-slate-400 font-mono">
              Latest NAV: <span className="text-slate-200 font-semibold">₹{current.latestNAV?.toFixed(2)}</span>
              {current.latestNAVDate && ` (${current.latestNAVDate})`}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
            <div className="text-xs font-mono text-slate-400 uppercase">
              {periods.find(p => p.key === activePeriod)?.label} Return
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-2xl font-extrabold text-amber-400 font-mono">
                {formatPercent(current.returnPct)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {current.schemeCode && onSelectFund && (
        <button
          onClick={() => onSelectFund(current.schemeCode)}
          className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
        >
          <span>Inspect Historical Performance & Strategy</span>
          <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
        </button>
      )}
    </div>
  );
};
