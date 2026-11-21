import React, { useState, useMemo } from 'react';
import { MutualFund } from '../types/portfolio';
import { formatINR, formatPercent, getAlertBadgeStyle } from '../utils/formatters';
import { X, TrendingUp, TrendingDown, Calendar, Layers, ShieldCheck, ArrowDownRight, Compass } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface Props {
  fund: MutualFund | null;
  onClose: () => void;
}

export const FundDrawer: React.FC<Props> = ({ fund, onClose }) => {
  const [activeRange, setActiveRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');

  if (!fund) return null;

  // Filter history based on range
  const filteredHistory = useMemo(() => {
    const history = fund.navHistory || [];
    if (history.length === 0) return [];

    if (activeRange === 'ALL') return history;

    const daysMap = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365
    };
    const days = daysMap[activeRange] || 365;

    const latest = new Date(history[history.length - 1].date);
    const cutoff = new Date(latest.getTime() - days * 24 * 60 * 60 * 1000);

    const sliced = history.filter(h => new Date(h.date) >= cutoff);
    return sliced.length > 0 ? sliced : history;
  }, [fund.navHistory, activeRange]);

  const minNAV = useMemo(() => {
    if (filteredHistory.length === 0) return 0;
    return Math.floor(Math.min(...filteredHistory.map(h => h.nav)) * 0.98);
  }, [filteredHistory]);

  const maxNAV = useMemo(() => {
    if (filteredHistory.length === 0) return 100;
    return Math.ceil(Math.max(...filteredHistory.map(h => h.nav)) * 1.02);
  }, [filteredHistory]);

  const periodReturn = useMemo(() => {
    if (filteredHistory.length < 2) return 0;
    const first = filteredHistory[0].nav;
    const last = filteredHistory[filteredHistory.length - 1].nav;
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [filteredHistory]);

  const alertStyle = getAlertBadgeStyle(fund.alert?.tag || '');
  const isProfit = fund.profitLoss >= 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 h-full overflow-y-auto shadow-2xl flex flex-col justify-between">
        <div className="p-6">
          {/* Top Bar */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-bold border border-slate-700">
                  {fund.category}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Scheme #{fund.schemeCode}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Sheet: {fund.sheetName}
                </span>
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {fund.name}
              </h2>
              {fund.benchmark && (
                <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-slate-500" />
                  <span>Benchmark: {fund.benchmark}</span>
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alert Status Banner */}
          <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-full text-xs font-mono font-bold border ${alertStyle.bg} ${alertStyle.text} ${alertStyle.border}`}>
                {fund.alert?.tag || '🟩 STABLE'}
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-200">{fund.alert?.status || 'Active Signal'}</p>
                <p className="text-[11px] text-slate-400 font-mono">
                  10-Day Range: ₹{fund.alert?.low10?.toFixed(2)} — ₹{fund.alert?.high10?.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-400 uppercase">10D Deviation</span>
              <div className={`text-base font-bold ${fund.alert?.percentValue < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {fund.alert?.percentDisplay || '0.00%'}
              </div>
            </div>
          </div>

          {/* NAV Chart Section */}
          <div className="mt-6 rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase">Historical NAV Trend</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-extrabold text-white font-mono">
                    ₹{fund.latestNAV.toFixed(2)}
                  </span>
                  <span className={`text-xs font-mono font-bold ${periodReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatPercent(periodReturn)} in selected range
                  </span>
                </div>
              </div>

              {/* Range Filters */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setActiveRange(range)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                      activeRange === range
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="mt-4 h-64 w-full">
              {filteredHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredHistory}>
                    <defs>
                      <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fund.color || '#06b6d4'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={fund.color || '#06b6d4'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      minTickGap={25}
                    />
                    <YAxis
                      domain={[minNAV, maxNAV]}
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#1e293b',
                        borderRadius: '0.75rem',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                      formatter={(val: any) => [`₹${Number(val).toFixed(2)}`, 'NAV']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="nav"
                      stroke={fund.color || '#06b6d4'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#navGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                  No historical NAV records available
                </div>
              )}
            </div>
          </div>

          {/* Financial Breakdown Grid */}
          <div className="mt-6">
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Investment Position & Breakdown
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Total Invested</span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {formatINR(fund.totalInvested)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Current Value</span>
                <span className="text-sm font-bold text-cyan-300 mt-1 block">
                  {formatINR(fund.currentValue)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Profit / Loss</span>
                <span className={`text-sm font-bold mt-1 block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatINR(fund.profitLoss)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Return %</span>
                <span className={`text-sm font-bold mt-1 block ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPercent(fund.returnPct)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Total Units</span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {fund.totalUnits > 0 ? fund.totalUnits.toFixed(3) : 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Avg Buy NAV</span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {fund.alert?.avgBuyNAV ? `₹${fund.alert.avgBuyNAV.toFixed(2)}` : 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">10D High</span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  ₹{fund.alert?.high10 ? fund.alert.high10.toFixed(2) : fund.latestNAV.toFixed(2)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">10D Low</span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  ₹{fund.alert?.low10 ? fund.alert.low10.toFixed(2) : fund.latestNAV.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs font-mono text-slate-400">
          <span>AMFI Scheme Code: {fund.schemeCode}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
};
