import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, LogOut, ShieldCheck, Activity, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  lastUpdated: string;
  isDemo?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefresh, isRefreshing, lastUpdated, isDemo }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-fintech-dark/80 border-b border-fintech-border transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-glow-cyan flex items-center justify-center">
            <div className="w-full h-full bg-fintech-dark rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
                AURA
              </span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
                PRO 3D
              </span>
              {isDemo && (
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800/50 text-amber-400">
                  PREVIEW MODE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight hidden sm:block">
              MUTUAL FUND INTELLIGENCE SYSTEM
            </p>
          </div>
        </div>

        {/* Center / Status */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>SYNC: {lastUpdated ? lastUpdated : 'LIVE'}</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Portfolio Data"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-200 hover:text-cyan-400 text-xs font-medium transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all text-xs"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || 'User'}
                  className="w-6 h-6 rounded-full border border-cyan-500/50 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-600 flex items-center justify-center text-cyan-400 font-bold text-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                </div>
              )}
              <span className="max-w-[100px] truncate text-slate-200 hidden sm:inline font-medium">
                {user?.name || user?.email?.split('@')[0] || 'Investor'}
              </span>
            </button>

            {/* Profile Menu Dropdown */}
            {showProfileMenu && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-card-elevated p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                onMouseLeave={() => setShowProfileMenu(false)}
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-cyan-900 text-cyan-300 flex items-center justify-center font-bold">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-slate-100 truncate">{user?.name || 'Investor'}</p>
                    <p className="text-xs text-slate-400 truncate font-mono">{user?.email || 'Authorized Account'}</p>
                  </div>
                </div>

                <div className="py-2 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Private Session</span>
                  </div>
                  <div className="text-slate-500">Netlify Free Tier (Zero-Cost Hosting)</div>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
