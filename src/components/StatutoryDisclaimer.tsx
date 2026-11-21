import React from 'react';
import { AlertCircle, Shield, Server, Heart } from 'lucide-react';

export const StatutoryDisclaimer: React.FC = () => {
  return (
    <footer className="mt-12 border-t border-slate-800/80 pt-8 pb-12 text-slate-400 font-mono text-[11px] leading-relaxed">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Risk warning */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-300">
              STATUTORY DISCLOSURE & RISK WARNING:
            </p>
            <p>
              Mutual fund investments are subject to market risks, read all scheme related documents carefully. Past performance does not guarantee future results. NAV figures and market fluctuations are based on published AMFI daily updates and moving average calculations.
            </p>
            <p className="text-slate-500">
              This dashboard is a private, read-only portfolio intelligence tool and does not execute financial transactions or constitute registered investment advisory services.
            </p>
          </div>
        </div>

        {/* Zero Cost Hosting Architecture note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 pt-2 border-t border-slate-900 text-[10px]">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Zero-Cost Serverless Hosting • Netlify Free Plan (Strictly $0 / Month)</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Powered by Google Sheets & Apps Script Read-Only Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
