import { DashboardData, MutualFund } from '../types/portfolio';

// Generates 1-year realistic historical NAV data points for testing / demo
function generateHistory(baseNAV: number, volatility: number, trend: number, days: number = 365) {
  const points = [];
  let current = baseNAV;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Skip weekends
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const dateStr = d.toISOString().split('T')[0];
    const dailyChange = (Math.random() - 0.48) * volatility + (trend / days);
    current = Math.max(10, current * (1 + dailyChange));
    points.push({
      date: dateStr,
      nav: parseFloat(current.toFixed(4))
    });
  }
  return points;
}

const hdfcHistory = generateHistory(160, 0.012, 0.28);
const nippon250History = generateHistory(42, 0.018, 0.35);
const nipponLargeHistory = generateHistory(85, 0.009, 0.18);
const moMidcapHistory = generateHistory(92, 0.014, 0.32);
const nipponGrowthHistory = generateHistory(3400, 0.013, 0.26);
const sbiLMHistory = generateHistory(520, 0.011, 0.22);
const iciciBluechipHistory = generateHistory(115, 0.008, 0.16);
const kotakEmergingHistory = generateHistory(128, 0.013, 0.24);
const miraeLMHistory = generateHistory(145, 0.010, 0.20);
const nipponSmallHistory = generateHistory(170, 0.019, 0.38);

export const MOCK_DASHBOARD_DATA: DashboardData = {
  lastUpdated: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  _isDemo: true,
  portfolioSummary: {
    totalInvested: 1450000,
    currentValue: 1872450,
    totalProfitLoss: 422450,
    overallReturnPct: 29.13,
    totalFunds: 10,
    buyCount: 2,
    fallingCount: 3,
    stableCount: 5
  },
  bestPerformers: {
    "1M": {
      schemeCode: "118775",
      name: "Nippon India Small Cap Fund",
      shortName: "Nippon Small Cap",
      category: "Small Cap Fund",
      color: "#f43f5e",
      returnPct: 6.42,
      latestNAV: nipponSmallHistory[nipponSmallHistory.length - 1].nav,
      latestNAVDate: nipponSmallHistory[nipponSmallHistory.length - 1].date
    },
    "3M": {
      schemeCode: "148519",
      name: "Nippon India Nifty Smallcap 250 Index Fund",
      shortName: "Nippon Small 250 Index",
      category: "Small Cap Index",
      color: "#06b6d4",
      returnPct: 14.18,
      latestNAV: nippon250History[nippon250History.length - 1].nav,
      latestNAVDate: nippon250History[nippon250History.length - 1].date
    },
    "6M": {
      schemeCode: "127042",
      name: "Motilal Oswal Midcap Fund",
      shortName: "Motilal Oswal Midcap",
      category: "Mid Cap Fund",
      color: "#8b5cf6",
      returnPct: 21.84,
      latestNAV: moMidcapHistory[moMidcapHistory.length - 1].nav,
      latestNAVDate: moMidcapHistory[moMidcapHistory.length - 1].date
    },
    "1Y": {
      schemeCode: "118775",
      name: "Nippon India Small Cap Fund",
      shortName: "Nippon Small Cap",
      category: "Small Cap Fund",
      color: "#f43f5e",
      returnPct: 41.25,
      latestNAV: nipponSmallHistory[nipponSmallHistory.length - 1].nav,
      latestNAVDate: nipponSmallHistory[nipponSmallHistory.length - 1].date
    },
    "ALL": {
      schemeCode: "118989",
      name: "HDFC Mid-Cap Opportunities Fund",
      shortName: "HDFC Mid-Cap",
      category: "Mid Cap Fund",
      color: "#2563eb",
      returnPct: 48.60,
      latestNAV: hdfcHistory[hdfcHistory.length - 1].nav,
      latestNAVDate: hdfcHistory[hdfcHistory.length - 1].date
    }
  },
  buyOnDipFunds: [
    {
      schemeCode: "127042",
      name: "Motilal Oswal Midcap Fund",
      shortName: "Motilal Oswal Midcap",
      sheetName: "MO-M-FundData",
      latestNAV: 112.45,
      percentValue: -2.35,
      tag: "🔴 BUY",
      severity: "alert",
      high10: 115.15,
      low10: 112.45,
      avgBuyNAV: 98.20,
      avgDiffPct: 14.51
    },
    {
      schemeCode: "119774",
      name: "Kotak Emerging Equity Fund",
      shortName: "Kotak Emerging Midcap",
      sheetName: "Kotak-M-FundData",
      latestNAV: 148.90,
      percentValue: -2.10,
      tag: "🔴 BUY",
      severity: "alert",
      high10: 152.10,
      low10: 148.90,
      avgBuyNAV: 135.40,
      avgDiffPct: 9.97
    }
  ],
  funds: [
    {
      schemeCode: "118989",
      sheetName: "HDFC-M-FundData",
      name: "HDFC Mid-Cap Opportunities Fund",
      shortName: "HDFC Mid-Cap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#2563eb",
      latestNAV: hdfcHistory[hdfcHistory.length - 1].nav,
      latestNAVDate: hdfcHistory[hdfcHistory.length - 1].date,
      totalInvested: 200000,
      currentValue: 268400,
      profitLoss: 68400,
      returnPct: 34.20,
      totalUnits: 1312.45,
      performance: { "1M": 3.2, "3M": 8.7, "6M": 18.2, "1Y": 32.5, "ALL": 48.6 },
      alert: {
        tag: "🟢 STRONG",
        status: "Strong rise",
        severity: "ok",
        percentValue: 1.45,
        percentDisplay: "+1.45%",
        high10: 206.50,
        low10: 198.20,
        avgBuyNAV: 152.38,
        avgDiffPct: 34.20
      },
      navHistory: hdfcHistory
    },
    {
      schemeCode: "148519",
      sheetName: "Nippon-S-250-FundData",
      name: "Nippon India Nifty Smallcap 250 Index Fund",
      shortName: "Nippon Small 250 Index",
      category: "Small Cap Index",
      benchmark: "NIFTY Smallcap 250 TRI",
      color: "#06b6d4",
      latestNAV: nippon250History[nippon250History.length - 1].nav,
      latestNAVDate: nippon250History[nippon250History.length - 1].date,
      totalInvested: 150000,
      currentValue: 198500,
      profitLoss: 48500,
      returnPct: 32.33,
      totalUnits: 3624.12,
      performance: { "1M": 4.8, "3M": 14.18, "6M": 20.4, "1Y": 36.8, "ALL": 42.1 },
      alert: {
        tag: "🟩 STABLE",
        status: "Normal rise",
        severity: "ok",
        percentValue: 0.65,
        percentDisplay: "+0.65%",
        high10: 55.40,
        low10: 53.80,
        avgBuyNAV: 41.39,
        avgDiffPct: 32.33
      },
      navHistory: nippon250History
    },
    {
      schemeCode: "118633",
      sheetName: "Nippon-Large-FundData",
      name: "Nippon India Large Cap Fund",
      shortName: "Nippon Large Cap",
      category: "Large Cap Fund",
      benchmark: "BSE 100 TRI",
      color: "#3b82f6",
      latestNAV: nipponLargeHistory[nipponLargeHistory.length - 1].nav,
      latestNAVDate: nipponLargeHistory[nipponLargeHistory.length - 1].date,
      totalInvested: 180000,
      currentValue: 221400,
      profitLoss: 41400,
      returnPct: 23.00,
      totalUnits: 2185.60,
      performance: { "1M": 1.8, "3M": 5.4, "6M": 11.2, "1Y": 21.4, "ALL": 28.5 },
      alert: {
        tag: "🟩 STABLE",
        status: "Normal rise",
        severity: "ok",
        percentValue: 0.40,
        percentDisplay: "+0.40%",
        high10: 102.50,
        low10: 99.80,
        avgBuyNAV: 82.35,
        avgDiffPct: 23.00
      },
      navHistory: nipponLargeHistory
    },
    {
      schemeCode: "127042",
      sheetName: "MO-M-FundData",
      name: "Motilal Oswal Midcap Fund",
      shortName: "Motilal Oswal Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#8b5cf6",
      latestNAV: moMidcapHistory[moMidcapHistory.length - 1].nav,
      latestNAVDate: moMidcapHistory[moMidcapHistory.length - 1].date,
      totalInvested: 160000,
      currentValue: 214500,
      profitLoss: 54500,
      returnPct: 34.06,
      totalUnits: 1907.51,
      performance: { "1M": -1.2, "3M": 12.4, "6M": 21.84, "1Y": 35.1, "ALL": 44.2 },
      alert: {
        tag: "🔴 BUY",
        status: "Good buying opportunity",
        severity: "alert",
        percentValue: -2.35,
        percentDisplay: "-2.35%",
        high10: 115.15,
        low10: 112.45,
        avgBuyNAV: 83.88,
        avgDiffPct: 34.06
      },
      navHistory: moMidcapHistory
    },
    {
      schemeCode: "118666",
      sheetName: "Nippon-G-M-FundData",
      name: "Nippon India Growth Fund",
      shortName: "Nippon Growth Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#10b981",
      latestNAV: nipponGrowthHistory[nipponGrowthHistory.length - 1].nav,
      latestNAVDate: nipponGrowthHistory[nipponGrowthHistory.length - 1].date,
      totalInvested: 140000,
      currentValue: 184800,
      profitLoss: 44800,
      returnPct: 32.00,
      totalUnits: 42.80,
      performance: { "1M": 2.5, "3M": 9.1, "6M": 17.5, "1Y": 30.2, "ALL": 39.8 },
      alert: {
        tag: "🟩 STABLE",
        status: "Normal rise",
        severity: "ok",
        percentValue: 0.85,
        percentDisplay: "+0.85%",
        high10: 4350.00,
        low10: 4220.00,
        avgBuyNAV: 3271.03,
        avgDiffPct: 32.00
      },
      navHistory: nipponGrowthHistory
    },
    {
      schemeCode: "119721",
      sheetName: "SBI-L&M-FundData",
      name: "SBI Large & Midcap Fund",
      shortName: "SBI Large & Midcap",
      category: "Large & Mid Cap",
      benchmark: "NIFTY LargeMidcap 250 TRI",
      color: "#14b8a6",
      latestNAV: sbiLMHistory[sbiLMHistory.length - 1].nav,
      latestNAVDate: sbiLMHistory[sbiLMHistory.length - 1].date,
      totalInvested: 130000,
      currentValue: 163800,
      profitLoss: 33800,
      returnPct: 26.00,
      totalUnits: 256.40,
      performance: { "1M": 1.9, "3M": 6.8, "6M": 14.1, "1Y": 24.5, "ALL": 31.4 },
      alert: {
        tag: "🟧 WATCH",
        status: "Slight down movement",
        severity: "warning",
        percentValue: -0.65,
        percentDisplay: "-0.65%",
        high10: 645.20,
        low10: 632.10,
        avgBuyNAV: 507.02,
        avgDiffPct: 26.00
      },
      navHistory: sbiLMHistory
    },
    {
      schemeCode: "120586",
      sheetName: "ICICI-Pru-Large-FundData",
      name: "ICICI Prudential Bluechip Fund",
      shortName: "ICICI Pru Large Cap",
      category: "Large Cap Fund",
      benchmark: "NIFTY 100 TRI",
      color: "#f59e0b",
      latestNAV: iciciBluechipHistory[iciciBluechipHistory.length - 1].nav,
      latestNAVDate: iciciBluechipHistory[iciciBluechipHistory.length - 1].date,
      totalInvested: 120000,
      currentValue: 144000,
      profitLoss: 24000,
      returnPct: 20.00,
      totalUnits: 1060.20,
      performance: { "1M": 1.2, "3M": 4.9, "6M": 10.3, "1Y": 18.2, "ALL": 25.1 },
      alert: {
        tag: "🟩 STABLE",
        status: "Normal rise",
        severity: "ok",
        percentValue: 0.30,
        percentDisplay: "+0.30%",
        high10: 136.50,
        low10: 133.80,
        avgBuyNAV: 113.19,
        avgDiffPct: 20.00
      },
      navHistory: iciciBluechipHistory
    },
    {
      schemeCode: "119774",
      sheetName: "Kotak-M-FundData",
      name: "Kotak Emerging Equity Fund",
      shortName: "Kotak Emerging Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#ec4899",
      latestNAV: kotakEmergingHistory[kotakEmergingHistory.length - 1].nav,
      latestNAVDate: kotakEmergingHistory[kotakEmergingHistory.length - 1].date,
      totalInvested: 110000,
      currentValue: 140800,
      profitLoss: 30800,
      returnPct: 28.00,
      totalUnits: 945.60,
      performance: { "1M": -0.8, "3M": 7.4, "6M": 16.2, "1Y": 27.1, "ALL": 36.4 },
      alert: {
        tag: "🔴 BUY",
        status: "Good buying opportunity",
        severity: "alert",
        percentValue: -2.10,
        percentDisplay: "-2.10%",
        high10: 152.10,
        low10: 148.90,
        avgBuyNAV: 116.33,
        avgDiffPct: 28.00
      },
      navHistory: kotakEmergingHistory
    },
    {
      schemeCode: "118835",
      sheetName: "Mirae-L-M-FundData",
      name: "Mirae Asset Large & Midcap Fund",
      shortName: "Mirae Large & Midcap",
      category: "Large & Mid Cap",
      benchmark: "NIFTY LargeMidcap 250 TRI",
      color: "#6366f1",
      latestNAV: miraeLMHistory[miraeLMHistory.length - 1].nav,
      latestNAVDate: miraeLMHistory[miraeLMHistory.length - 1].date,
      totalInvested: 110000,
      currentValue: 137500,
      profitLoss: 27500,
      returnPct: 25.00,
      totalUnits: 785.40,
      performance: { "1M": 1.5, "3M": 6.1, "6M": 13.5, "1Y": 22.8, "ALL": 30.1 },
      alert: {
        tag: "🟠 FALLING",
        status: "Medium down movement",
        severity: "warning",
        percentValue: -1.25,
        percentDisplay: "-1.25%",
        high10: 177.50,
        low10: 173.20,
        avgBuyNAV: 140.06,
        avgDiffPct: 25.00
      },
      navHistory: miraeLMHistory
    },
    {
      schemeCode: "118775",
      sheetName: "Nippon-S-FundData",
      name: "Nippon India Small Cap Fund",
      shortName: "Nippon Small Cap",
      category: "Small Cap Fund",
      benchmark: "NIFTY Smallcap 250 TRI",
      color: "#f43f5e",
      latestNAV: nipponSmallHistory[nipponSmallHistory.length - 1].nav,
      latestNAVDate: nipponSmallHistory[nipponSmallHistory.length - 1].date,
      totalInvested: 150000,
      currentValue: 208850,
      profitLoss: 58850,
      returnPct: 39.23,
      totalUnits: 890.30,
      performance: { "1M": 6.42, "3M": 13.5, "6M": 21.0, "1Y": 41.25, "ALL": 46.5 },
      alert: {
        tag: "🟢📈 VERY STRONG",
        status: "Momentum rising fast",
        severity: "ok",
        percentValue: 2.40,
        percentDisplay: "+2.40%",
        high10: 236.40,
        low10: 224.10,
        avgBuyNAV: 168.48,
        avgDiffPct: 39.23
      },
      navHistory: nipponSmallHistory
    }
  ]
};
