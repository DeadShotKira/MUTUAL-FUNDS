export interface NAVHistoryPoint {
  date: string;
  nav: number;
}

export interface FundAlert {
  tag: string;
  status: string;
  severity: 'alert' | 'warning' | 'ok' | 'info';
  percentValue: number;
  percentDisplay: string;
  high10: number;
  low10: number;
  avgBuyNAV: number | null;
  avgDiffPct: number | null;
}

export interface FundPerformance {
  "1M": number;
  "3M": number;
  "6M": number;
  "1Y": number;
  "ALL": number;
}

export interface MutualFund {
  schemeCode: string;
  sheetName: string;
  name: string;
  shortName: string;
  category: string;
  benchmark: string;
  color: string;
  latestNAV: number;
  latestNAVDate: string;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  returnPct: number;
  totalUnits: number;
  performance: FundPerformance;
  alert: FundAlert;
  navHistory: NAVHistoryPoint[];
  error?: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalProfitLoss: number;
  overallReturnPct: number;
  totalFunds: number;
  buyCount: number;
  fallingCount: number;
  stableCount: number;
}

export interface BestPerformer {
  schemeCode: string;
  name: string;
  shortName: string;
  category: string;
  color: string;
  returnPct: number;
  latestNAV: number;
  latestNAVDate: string;
}

export interface BuyOnDipFund {
  schemeCode: string;
  name: string;
  shortName: string;
  sheetName: string;
  latestNAV: number;
  percentValue: number;
  tag: string;
  severity: 'alert' | 'warning' | 'ok' | 'info';
  high10: number;
  low10: number;
  avgBuyNAV: number | null;
  avgDiffPct: number | null;
}

export interface DashboardData {
  lastUpdated: string;
  portfolioSummary: PortfolioSummary;
  bestPerformers: Record<'1M' | '3M' | '6M' | '1Y' | 'ALL', BestPerformer>;
  buyOnDipFunds: BuyOnDipFund[];
  funds: MutualFund[];
  _fromCache?: boolean;
  _cachedAt?: string;
  _isDemo?: boolean;
}
