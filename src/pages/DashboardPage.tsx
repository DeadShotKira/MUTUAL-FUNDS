import React, { useState, useEffect, useMemo } from 'react';
import { DashboardData, MutualFund } from '../types/portfolio';
import { fetchPortfolioDashboard } from '../services/api';
import { Navbar } from '../components/Navbar';
import { PortfolioSummaryCards } from '../components/PortfolioSummaryCards';
import { InvestmentUniverse3D } from '../components/InvestmentUniverse3D';
import { BestPerformerCard } from '../components/BestPerformerCard';
import { BuyOnDipAlerts } from '../components/BuyOnDipAlerts';
import { FundCard } from '../components/FundCard';
import { FundDrawer } from '../components/FundDrawer';
import { StatutoryDisclaimer } from '../components/StatutoryDisclaimer';
import { Search, Filter, ArrowUpDown, RefreshCw, AlertTriangle, Layers } from 'lucide-react';

interface Props {
  initialData?: DashboardData | null;
}

export const DashboardPage: React.FC<Props> = ({ initialData }) => {
  const [data, setData] = useState<DashboardData | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search, filter & sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'valuation' | 'profit' | 'nav' | 'name'>('valuation');

  // Selected fund for drawer
  const [selectedSchemeCode, setSelectedSchemeCode] = useState<string | null>(null);

  const loadData = async (force: boolean = false) => {
    try {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const dashboard = await fetchPortfolioDashboard(force);
      setData(dashboard);
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      loadData();
    }
  }, []);

  // Filtered & sorted funds
  const processedFunds = useMemo(() => {
    if (!data?.funds) return [];

    let list = [...data.funds];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.schemeCode.includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.sheetName.toLowerCase().includes(q)
      );
    }

    // Category / Tag filter
    if (selectedCategory !== 'ALL') {
      if (selectedCategory === 'BUY_DIP') {
        list = list.filter(f => f.alert?.tag?.includes('BUY'));
      } else {
        list = list.filter(f => f.category.toLowerCase().includes(selectedCategory.toLowerCase()));
      }
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'valuation') {
        return b.currentValue - a.currentValue;
      }
      if (sortBy === 'profit') {
        return b.returnPct - a.returnPct;
      }
      if (sortBy === 'nav') {
        return b.latestNAV - a.latestNAV;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return list;
  }, [data?.funds, searchQuery, selectedCategory, sortBy]);

  // Selected Fund Object for Drawer
  const activeFund = useMemo(() => {
    if (!selectedSchemeCode || !data?.funds) return null;
    return data.funds.find(f => f.schemeCode === selectedSchemeCode) || null;
  }, [selectedSchemeCode, data?.funds]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-fintech-dark flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shadow-glow-cyan">
          <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-slate-400">
          Loading Mutual Fund Universe...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fintech-dark text-slate-100 flex flex-col justify-between">
      <div>
        {/* Top Navigation */}
        <Navbar
          onRefresh={() => loadData(true)}
          isRefreshing={refreshing}
          lastUpdated={data?.lastUpdated || ''}
          isDemo={data?._isDemo}
        />

        {/* Demo Mode Notice */}
        {data?._isDemo && (
          <div className="bg-amber-950/40 border-b border-amber-800/40 py-2 px-4 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              Preview Mode Active • Real Google Sheets API will be queried once deployed to Netlify with valid environment variables.
            </span>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* 1. Portfolio Totals & Signals */}
          {data?.portfolioSummary && (
            <PortfolioSummaryCards summary={data.portfolioSummary} />
          )}

          {/* 2. 3D Investment Universe Canvas */}
          {data?.funds && (
            <InvestmentUniverse3D
              funds={data.funds}
              onSelectFund={(code) => setSelectedSchemeCode(code)}
              selectedSchemeCode={selectedSchemeCode}
            />
          )}

          {/* 3. Top Performer & Buy On Dip Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data?.bestPerformers && (
              <BestPerformerCard
                bestPerformers={data.bestPerformers}
                onSelectFund={(code) => setSelectedSchemeCode(code)}
              />
            )}

            {data?.buyOnDipFunds && (
              <BuyOnDipAlerts
                buyFunds={data.buyOnDipFunds}
                onSelectFund={(code) => setSelectedSchemeCode(code)}
              />
            )}
          </div>

          {/* 4. Complete 10 Mutual Funds Catalog */}
          <section className="space-y-4 pt-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wider">
                    Mutual Fund Holdings
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 font-bold border border-slate-700">
                    {processedFunds.length} Funds
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Full portfolio breakdown with live AMFI alerts and valuation
                </p>
              </div>

              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search fund or scheme..."
                    className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-44 sm:w-56"
                  />
                </div>

                {/* Category Filters */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                  {[
                    { key: 'ALL', label: 'All' },
                    { key: 'Mid Cap', label: 'Mid' },
                    { key: 'Small', label: 'Small' },
                    { key: 'Large', label: 'Large' },
                    { key: 'BUY_DIP', label: '🔴 Dip' }
                  ].map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`px-2.5 py-1 rounded-lg transition-colors font-medium ${
                        selectedCategory === cat.key
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="valuation" className="bg-slate-900">Highest Valuation</option>
                    <option value="profit" className="bg-slate-900">Highest Return %</option>
                    <option value="nav" className="bg-slate-900">Highest NAV</option>
                    <option value="name" className="bg-slate-900">Fund Name (A-Z)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fund Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {processedFunds.map(fund => (
                <FundCard
                  key={fund.schemeCode}
                  fund={fund}
                  onSelect={(code) => setSelectedSchemeCode(code)}
                />
              ))}
            </div>

            {processedFunds.length === 0 && (
              <div className="py-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
                <p className="text-xs font-mono text-slate-400">
                  No mutual funds matched your search or filter criteria.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Slide-over Fund Analytics Drawer */}
      <FundDrawer
        fund={activeFund}
        onClose={() => setSelectedSchemeCode(null)}
      />

      {/* Statutory Footer */}
      <StatutoryDisclaimer />
    </div>
  );
};
