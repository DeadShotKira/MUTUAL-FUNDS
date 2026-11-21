import React from 'react';
import { BuyOnDipFund } from '../types/portfolio';
import { formatINR } from '../utils/formatters';
import { ShoppingCart, TrendingDown, AlertTriangle, ArrowDownRight, Info } from 'lucide-react';

interface Props {
  buyFunds: BuyOnDipFund[];
  onSelectFund?: (schemeCode: string) => void;
}

export const BuyOnDipAlerts: React.FC<Props> = ({ buyFunds, onSelectFund }) => {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-950 border border-rose-500/30 p-5 shadow-card-elevated flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-glow-rose">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Buy on Dip Opportunities
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold">
                  {buyFunds.length} TRIGGERED
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Funds trading below 10-day highs (≥ 2.0% dip)</p>
            </div>
          </div>
        </div>

        {/* Candidate List */}
        <div className="mt-4 space-y-2.5">
          {buyFunds.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-center">
              <p className="text-xs text-slate-400 font-mono">
                No funds currently trigger the 🔴 BUY threshold. Markets are trading stably or ascending.
              </p>
            </div>
          ) : (
            buyFunds.map(fund => {
              const diffFromHigh = fund.high10 > 0 ? (((fund.latestNAV - fund.high10) / fund.high10) * 100) : 0;
              return (
                <div
                  key={fund.schemeCode}
                  onClick={() => onSelectFund && onSelectFund(fund.schemeCode)}
                  className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/20 hover:border-rose-500/50 transition-all cursor-pointer group flex items-center justify-between gap-3"
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {fund.tag}
                      </span>
                      <h5 className="text-sm font-semibold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">
                        {fund.name}
                      </h5>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span>NAV: <strong className="text-slate-200">₹{fund.latestNAV.toFixed(2)}</strong></span>
                      <span>10D High: ₹{fund.high10.toFixed(2)}</span>
                      {fund.avgBuyNAV && (
                        <span>Avg Buy: ₹{fund.avgBuyNAV.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <div className="flex items-center gap-1 text-rose-400 font-bold font-mono text-sm">
                      <ArrowDownRight className="w-4 h-4" />
                      <span>{fund.percentValue.toFixed(2)}%</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">from 10D Peak</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Statutory Disclaimer Note */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-start gap-2 text-[10px] text-slate-400 font-mono leading-tight">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Algorithmic alerts represent mathematical deviations from recent 10-day peaks. Not SEBI-registered investment advice or buy/sell recommendations.
        </span>
      </div>
    </div>
  );
};
