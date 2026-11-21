/****************************************************************************************
 * DASHBOARD API ADAPTER (READ-ONLY)
 *
 * Exposes portfolio valuation, daily alert status, historical NAV charts,
 * best performers, and buy-on-dip funds for the Netlify 3D Mutual Fund Web App.
 *
 * SECURITY & CONSTRAINTS:
 * 1. STRICTLY READ-ONLY: Never writes, inserts, clears, or modifies any sheet.
 * 2. PROTECTED ENDPOINT: Requires shared secret 'DASHBOARD_API_SHARED_SECRET'.
 * 3. ISOLATED: Does not interfere with daily triggers, AMFI updates, or email builders.
 ****************************************************************************************/

/**
 * Handle HTTP POST requests from the Netlify serverless backend.
 *
 * @param {Object} e - Event object containing postData or parameter.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doPost(e) {
  return handleDashboardApiRequest_(e);
}

/**
 * Handle HTTP GET requests (for testing or direct inspection).
 *
 * @param {Object} e - Event object containing parameter.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function doGet(e) {
  return handleDashboardApiRequest_(e);
}

/**
 * Core request processor with authentication check and error trapping.
 *
 * @param {Object} e - Event object.
 * @return {GoogleAppsScript.Content.TextOutput} JSON response.
 */
function handleDashboardApiRequest_(e) {
  try {
    let secret = "";
    let action = "getPortfolioDashboard";

    // 1. Extract secret and action from POST body or GET query params
    if (e && e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        secret = body.secret || "";
        action = body.action || action;
      } catch (err) {
        // Fallback to URL-encoded or raw parameter
        if (e.parameter) {
          secret = e.parameter.secret || "";
          action = e.parameter.action || action;
        }
      }
    } else if (e && e.parameter) {
      secret = e.parameter.secret || "";
      action = e.parameter.action || action;
    }

    // 2. Authenticate using Script Properties
    const configuredSecret = PropertiesService.getScriptProperties().getProperty("DASHBOARD_API_SHARED_SECRET");
    
    if (!configuredSecret) {
      return buildJsonResponse_({
        success: false,
        error: "DASHBOARD_API_SHARED_SECRET is not configured in Script Properties. Call setDashboardApiSecret('YOUR_SECRET') in Apps Script to initialize."
      }, 500);
    }

    if (!secret || secret !== configuredSecret) {
      return buildJsonResponse_({
        success: false,
        error: "Unauthorized: Invalid or missing API secret."
      }, 401);
    }

    // 3. Dispatch action
    if (action === "getPortfolioDashboard") {
      const data = generatePortfolioDashboardPayload_();
      return buildJsonResponse_({
        success: true,
        data: data
      }, 200);
    } else if (action === "ping") {
      return buildJsonResponse_({
        success: true,
        message: "Mutual Fund Dashboard API is online (Read-Only)",
        timestamp: new Date().toISOString()
      }, 200);
    } else {
      return buildJsonResponse_({
        success: false,
        error: `Unknown action: '${action}'`
      }, 400);
    }

  } catch (error) {
    return buildJsonResponse_({
      success: false,
      error: error.message || String(error),
      stack: error.stack || ""
    }, 500);
  }
}

/**
 * Utility to format JSON TextOutput.
 */
function buildJsonResponse_(obj, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Master catalog of 10 tracked funds with friendly metadata.
 */
function getDashboardFundMetadata_() {
  return [
    {
      schemeCode: "118989",
      sheetName: "HDFC-M-FundData",
      name: "HDFC Mid-Cap Opportunities Fund",
      shortName: "HDFC Mid-Cap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#2563eb"
    },
    {
      schemeCode: "148519",
      sheetName: "Nippon-S-250-FundData",
      name: "Nippon India Nifty Smallcap 250 Index Fund",
      shortName: "Nippon Small 250 Index",
      category: "Small Cap Index",
      benchmark: "NIFTY Smallcap 250 TRI",
      color: "#06b6d4"
    },
    {
      schemeCode: "118633",
      sheetName: "Nippon-Large-FundData",
      name: "Nippon India Large Cap Fund",
      shortName: "Nippon Large Cap",
      category: "Large Cap Fund",
      benchmark: "BSE 100 TRI",
      color: "#3b82f6"
    },
    {
      schemeCode: "127042",
      sheetName: "MO-M-FundData",
      name: "Motilal Oswal Midcap Fund",
      shortName: "Motilal Oswal Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#8b5cf6"
    },
    {
      schemeCode: "118666",
      sheetName: "Nippon-G-M-FundData",
      name: "Nippon India Growth Fund",
      shortName: "Nippon Growth Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#10b981"
    },
    {
      schemeCode: "119721",
      sheetName: "SBI-L&M-FundData",
      name: "SBI Large & Midcap Fund",
      shortName: "SBI Large & Midcap",
      category: "Large & Mid Cap",
      benchmark: "NIFTY LargeMidcap 250 TRI",
      color: "#14b8a6"
    },
    {
      schemeCode: "120586",
      sheetName: "ICICI-Pru-Large-FundData",
      name: "ICICI Prudential Bluechip Fund",
      shortName: "ICICI Pru Large Cap",
      category: "Large Cap Fund",
      benchmark: "NIFTY 100 TRI",
      color: "#f59e0b"
    },
    {
      schemeCode: "119774",
      sheetName: "Kotak-M-FundData",
      name: "Kotak Emerging Equity Fund",
      shortName: "Kotak Emerging Midcap",
      category: "Mid Cap Fund",
      benchmark: "NIFTY Midcap 150 TRI",
      color: "#ec4899"
    },
    {
      schemeCode: "118835",
      sheetName: "Mirae-L-M-FundData",
      name: "Mirae Asset Large & Midcap Fund",
      shortName: "Mirae Large & Midcap",
      category: "Large & Mid Cap",
      benchmark: "NIFTY LargeMidcap 250 TRI",
      color: "#6366f1"
    },
    {
      schemeCode: "118775",
      sheetName: "Nippon-S-FundData",
      name: "Nippon India Small Cap Fund",
      shortName: "Nippon Small Cap",
      category: "Small Cap Fund",
      benchmark: "NIFTY Smallcap 250 TRI",
      color: "#f43f5e"
    }
  ];
}

/**
 * Builds the comprehensive dashboard data payload by reading active Google Sheets.
 * Strictly read-only operations.
 */
function generatePortfolioDashboardPayload_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const catalog = getDashboardFundMetadata_();

  const fundResults = [];
  let totalInvestedAll = 0;
  let totalCurrentValueAll = 0;
  let buyCount = 0;
  let fallingCount = 0;
  let stableCount = 0;

  const now = new Date();
  const lastUpdatedStr = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd HH:mm:ss");

  for (let i = 0; i < catalog.length; i++) {
    const meta = catalog[i];
    const sheet = ss.getSheetByName(meta.sheetName);

    if (!sheet) {
      fundResults.push({
        ...meta,
        error: `Sheet '${meta.sheetName}' not found`,
        totalInvested: 0,
        currentValue: 0,
        profitLoss: 0,
        returnPct: 0,
        latestNAV: 0,
        latestNAVDate: "",
        navHistory: [],
        performance: { "1M": 0, "3M": 0, "6M": 0, "1Y": 0, "ALL": 0 },
        alert: { tag: "UNKNOWN", severity: "info", status: "Sheet missing", percentValue: 0 }
      });
      continue;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      fundResults.push({
        ...meta,
        error: `No data rows in '${meta.sheetName}'`,
        totalInvested: 0,
        currentValue: 0,
        profitLoss: 0,
        returnPct: 0,
        latestNAV: 0,
        latestNAVDate: "",
        navHistory: [],
        performance: { "1M": 0, "3M": 0, "6M": 0, "1Y": 0, "ALL": 0 },
        alert: { tag: "UNKNOWN", severity: "info", status: "No data", percentValue: 0 }
      });
      continue;
    }

    // 1. Read existing alert calculation
    let alertInfo = null;
    try {
      if (typeof checkNAVAlertModular === "function") {
        alertInfo = checkNAVAlertModular(meta.sheetName);
      }
    } catch (e) {
      Logger.log("checkNAVAlertModular error: " + e);
    }

    // 2. Read fund summary (investment totals)
    let fundSummary = null;
    try {
      if (typeof getFundSummary === "function") {
        fundSummary = getFundSummary(meta.sheetName);
      }
    } catch (e) {
      Logger.log("getFundSummary error: " + e);
    }

    // 3. Read full historical NAV series from Sheet (Col A = Date, Col B = NAV, Col C = Buying Amount)
    const rawData = sheet.getRange(2, 1, lastRow - 1, Math.min(3, sheet.getLastColumn())).getValues();
    const navHistory = [];
    let calculatedInvested = 0;
    let calculatedUnits = 0;

    for (let r = 0; r < rawData.length; r++) {
      const row = rawData[r];
      const rawDate = row[0];
      const rawNav = row[1];
      const rawAmt = row[2];

      if (rawNav === "" || rawNav === null || isNaN(Number(rawNav))) continue;

      const navVal = Number(rawNav);
      let dateStr = "";
      if (rawDate instanceof Date) {
        dateStr = Utilities.formatDate(rawDate, "Asia/Kolkata", "yyyy-MM-dd");
      } else if (rawDate) {
        const s = String(rawDate).trim();
        // Handle yyyy-MM-dd or dd-MMM-yyyy or dd/MM/yyyy
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          dateStr = s.substring(0, 10);
        } else {
          try {
            const parsed = new Date(s);
            if (!isNaN(parsed.getTime())) {
              dateStr = Utilities.formatDate(parsed, "Asia/Kolkata", "yyyy-MM-dd");
            } else {
              dateStr = s;
            }
          } catch (_) {
            dateStr = s;
          }
        }
      }

      if (dateStr && navVal > 0) {
        navHistory.push({
          date: dateStr,
          nav: parseFloat(navVal.toFixed(4))
        });
      }

      // Track investment purchases if present in column C
      if (rawAmt !== "" && rawAmt !== null && !isNaN(Number(rawAmt))) {
        const amt = Number(rawAmt);
        if (amt > 0 && navVal > 0) {
          calculatedInvested += amt;
          calculatedUnits += (amt / navVal);
        }
      }
    }

    // Sort chronologically ascending
    navHistory.sort((a, b) => a.date.localeCompare(b.date));

    // Deduplicate dates if needed (keep latest)
    const dedupedHistory = [];
    const dateMap = {};
    for (let h = 0; h < navHistory.length; h++) {
      dateMap[navHistory[h].date] = navHistory[h].nav;
    }
    const sortedDates = Object.keys(dateMap).sort();
    for (let d = 0; d < sortedDates.length; d++) {
      dedupedHistory.push({
        date: sortedDates[d],
        nav: dateMap[sortedDates[d]]
      });
    }

    // Latest NAV & date
    const historyCount = dedupedHistory.length;
    const latestRecord = historyCount > 0 ? dedupedHistory[historyCount - 1] : { date: "", nav: 0 };
    const latestNAV = latestRecord.nav;
    const latestNAVDate = latestRecord.date;

    // Investment metrics fallback if getFundSummary returned null
    let totalInvested = fundSummary && typeof fundSummary.totalInvested === "number" ? fundSummary.totalInvested : calculatedInvested;
    let currentValue = fundSummary && typeof fundSummary.currentValue === "number" ? fundSummary.currentValue : (calculatedUnits * latestNAV);
    let profitLoss = fundSummary && typeof fundSummary.profitLoss === "number" ? fundSummary.profitLoss : (currentValue - totalInvested);

    totalInvested = parseFloat(Number(totalInvested || 0).toFixed(2));
    currentValue = parseFloat(Number(currentValue || 0).toFixed(2));
    profitLoss = parseFloat(Number(profitLoss || 0).toFixed(2));
    const returnPct = totalInvested > 0 ? parseFloat(((profitLoss / totalInvested) * 100).toFixed(2)) : 0;

    totalInvestedAll += totalInvested;
    totalCurrentValueAll += currentValue;

    // Compute period returns (1M, 3M, 6M, 1Y, ALL)
    const performance = computePerformanceReturns_(dedupedHistory);

    // Standardize alert
    let alertNormalized = {
      tag: "🟩 STABLE",
      status: "Normal",
      severity: "ok",
      percentValue: 0,
      percentDisplay: "0.00%",
      high10: latestNAV,
      low10: latestNAV,
      avgBuyNAV: null,
      avgDiffPct: null
    };

    if (alertInfo && !alertInfo.error) {
      alertNormalized = {
        tag: alertInfo.tag || "🟩 STABLE",
        status: alertInfo.status || "",
        severity: alertInfo.severity || "ok",
        percentValue: typeof alertInfo.percentValue === "number" ? parseFloat(alertInfo.percentValue.toFixed(2)) : 0,
        percentDisplay: alertInfo.percentDisplay || "0.00%",
        high10: typeof alertInfo.high10 === "number" ? parseFloat(alertInfo.high10.toFixed(2)) : latestNAV,
        low10: typeof alertInfo.low10 === "number" ? parseFloat(alertInfo.low10.toFixed(2)) : latestNAV,
        avgBuyNAV: typeof alertInfo.avgBuyNAV === "number" ? parseFloat(alertInfo.avgBuyNAV.toFixed(2)) : null,
        avgDiffPct: typeof alertInfo.avgDiffPct === "number" ? parseFloat(alertInfo.avgDiffPct.toFixed(2)) : null
      };
    }

    if (alertNormalized.tag === "🔴 BUY") {
      buyCount++;
    } else if (alertNormalized.tag.includes("FALLING") || alertNormalized.tag.includes("WATCH")) {
      fallingCount++;
    } else {
      stableCount++;
    }

    fundResults.push({
      ...meta,
      totalInvested: totalInvested,
      currentValue: currentValue,
      profitLoss: profitLoss,
      returnPct: returnPct,
      latestNAV: latestNAV,
      latestNAVDate: latestNAVDate,
      totalUnits: calculatedUnits > 0 ? parseFloat(calculatedUnits.toFixed(4)) : (latestNAV > 0 && totalInvested > 0 ? parseFloat((totalInvested / latestNAV).toFixed(4)) : 0),
      performance: performance,
      alert: alertNormalized,
      navHistory: dedupedHistory
    });
  }

  // Portfolio aggregates
  const totalProfitLossAll = parseFloat((totalCurrentValueAll - totalInvestedAll).toFixed(2));
  const overallReturnPctAll = totalInvestedAll > 0 ? parseFloat(((totalProfitLossAll / totalInvestedAll) * 100).toFixed(2)) : 0;

  // Best Performers over periods
  const bestPerformers = {
    "1M": findTopPerformerForPeriod_(fundResults, "1M"),
    "3M": findTopPerformerForPeriod_(fundResults, "3M"),
    "6M": findTopPerformerForPeriod_(fundResults, "6M"),
    "1Y": findTopPerformerForPeriod_(fundResults, "1Y"),
    "ALL": findTopPerformerForPeriod_(fundResults, "ALL")
  };

  // Buy on Dip candidates: Strictly where Apps Script checkNAVAlertModular returned exact "🔴 BUY" tag
  const buyOnDipFunds = fundResults.filter(f => {
    return f.alert && f.alert.tag === "🔴 BUY";
  }).map(f => ({
    schemeCode: f.schemeCode,
    name: f.name,
    shortName: f.shortName,
    sheetName: f.sheetName,
    latestNAV: f.latestNAV,
    percentValue: f.alert.percentValue,
    percentDisplay: f.alert.percentDisplay,
    tag: f.alert.tag,
    status: f.alert.status,
    severity: f.alert.severity,
    high10: f.alert.high10,
    low10: f.alert.low10,
    avgBuyNAV: f.alert.avgBuyNAV,
    avgDiffPct: f.alert.avgDiffPct
  }));

  return {
    lastUpdated: lastUpdatedStr,
    portfolioSummary: {
      totalInvested: parseFloat(totalInvestedAll.toFixed(2)),
      currentValue: parseFloat(totalCurrentValueAll.toFixed(2)),
      totalProfitLoss: totalProfitLossAll,
      overallReturnPct: overallReturnPctAll,
      totalFunds: fundResults.length,
      buyCount: buyCount,
      fallingCount: fallingCount,
      stableCount: stableCount
    },
    bestPerformers: bestPerformers,
    buyOnDipFunds: buyOnDipFunds,
    funds: fundResults
  };
}

/**
 * Calculates percentage return for time horizons given chronological history.
 */
function computePerformanceReturns_(history) {
  const result = { "1M": 0, "3M": 0, "6M": 0, "1Y": 0, "ALL": 0 };
  if (!history || history.length < 2) return result;

  const latest = history[history.length - 1];
  const latestDate = new Date(latest.date);
  const latestNAV = latest.nav;

  if (latestNAV <= 0) return result;

  // ALL return (first record to latest)
  const firstNAV = history[0].nav;
  if (firstNAV > 0) {
    result["ALL"] = parseFloat((((latestNAV - firstNAV) / firstNAV) * 100).toFixed(2));
  }

  // Helper to find NAV closest to days back
  function getNAVApproxDaysBack(days) {
    const targetTime = latestDate.getTime() - (days * 24 * 60 * 60 * 1000);
    let closestRecord = null;
    let minDiff = Infinity;

    for (let i = 0; i < history.length - 1; i++) {
      const recDate = new Date(history[i].date);
      const diff = Math.abs(recDate.getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestRecord = history[i];
      }
    }

    // Only accept if within reasonable boundary (15 days tolerance)
    if (closestRecord && minDiff <= 15 * 24 * 60 * 60 * 1000) {
      return closestRecord.nav;
    }
    return null;
  }

  const nav1M = getNAVApproxDaysBack(30);
  if (nav1M && nav1M > 0) {
    result["1M"] = parseFloat((((latestNAV - nav1M) / nav1M) * 100).toFixed(2));
  }

  const nav3M = getNAVApproxDaysBack(90);
  if (nav3M && nav3M > 0) {
    result["3M"] = parseFloat((((latestNAV - nav3M) / nav3M) * 100).toFixed(2));
  }

  const nav6M = getNAVApproxDaysBack(180);
  if (nav6M && nav6M > 0) {
    result["6M"] = parseFloat((((latestNAV - nav6M) / nav6M) * 100).toFixed(2));
  }

  const nav1Y = getNAVApproxDaysBack(365);
  if (nav1Y && nav1Y > 0) {
    result["1Y"] = parseFloat((((latestNAV - nav1Y) / nav1Y) * 100).toFixed(2));
  }

  return result;
}

/**
 * Finds top performing fund for a specific duration.
 */
function findTopPerformerForPeriod_(funds, periodKey) {
  let topFund = null;
  let maxReturn = -Infinity;

  for (let i = 0; i < funds.length; i++) {
    const fund = funds[i];
    if (fund.performance && typeof fund.performance[periodKey] === "number") {
      const ret = fund.performance[periodKey];
      if (ret > maxReturn) {
        maxReturn = ret;
        topFund = {
          schemeCode: fund.schemeCode,
          name: fund.name,
          shortName: fund.shortName,
          category: fund.category,
          color: fund.color,
          returnPct: ret,
          latestNAV: fund.latestNAV,
          latestNAVDate: fund.latestNAVDate
        };
      }
    }
  }

  return topFund || {
    schemeCode: "",
    name: "N/A",
    shortName: "N/A",
    category: "",
    color: "#6b7280",
    returnPct: 0,
    latestNAV: 0,
    latestNAVDate: ""
  };
}

/* ======================================================================================
   ADMIN & SETUP HELPERS
   ====================================================================================== */

/**
 * One-click setup function to initialize or view DASHBOARD_API_SHARED_SECRET.
 * Select 'setupDashboardApiSecret' in the Apps Script function dropdown and click 'Run'.
 * Requires no arguments and prints the exact key and value to copy into Netlify.
 */
function setupDashboardApiSecret() {
  const existing = PropertiesService.getScriptProperties().getProperty("DASHBOARD_API_SHARED_SECRET");
  if (existing) {
    Logger.log("==================================================================");
    Logger.log("ℹ️ DASHBOARD_API_SHARED_SECRET is already configured!");
    Logger.log("KEY NAME: DASHBOARD_API_SHARED_SECRET");
    Logger.log("SECRET VALUE: " + existing);
    Logger.log("Configure this in your Netlify Environment Variables as:");
    Logger.log("DASHBOARD_API_SHARED_SECRET=" + existing);
    Logger.log("==================================================================");
    return existing;
  }
  return setDashboardApiSecret();
}

/**
 * Run this function once in the Apps Script editor to set your shared secret.
 *
 * Example:
 * setDashboardApiSecret("MY_ULTRA_SECURE_SECRET_KEY_12345");
 *
 * @param {string} [secret] - The secret token to set.
 */
function setDashboardApiSecret(secret) {
  const secretKey = secret || "MUTUAL_FUND_SECURE_TOKEN_" + Utilities.getUuid().replace(/-/g, "").substring(0, 24);
  PropertiesService.getScriptProperties().setProperty("DASHBOARD_API_SHARED_SECRET", secretKey);
  Logger.log("==================================================================");
  Logger.log("✅ DASHBOARD_API_SHARED_SECRET successfully configured!");
  Logger.log("KEY NAME: DASHBOARD_API_SHARED_SECRET");
  Logger.log("SECRET VALUE: " + secretKey);
  Logger.log("Save this secret value in your Netlify dashboard environment variable:");
  Logger.log("DASHBOARD_API_SHARED_SECRET=" + secretKey);
  Logger.log("==================================================================");
  return secretKey;
}

/**
 * Test function to verify payload generation directly in the Apps Script debugger.
 */
function testDashboardApi() {
  Logger.log("🧪 Testing generatePortfolioDashboardPayload_()...");
  const result = generatePortfolioDashboardPayload_();
  Logger.log("Total Funds: " + result.portfolioSummary.totalFunds);
  Logger.log("Total Invested: ₹" + result.portfolioSummary.totalInvested);
  Logger.log("Current Value: ₹" + result.portfolioSummary.currentValue);
  Logger.log("Total Profit/Loss: ₹" + result.portfolioSummary.totalProfitLoss);
  Logger.log("Overall Return: " + result.portfolioSummary.overallReturnPct + "%");
  Logger.log("Buy on Dip Funds: " + result.buyOnDipFunds.length);
  Logger.log("Best 1M Performer: " + JSON.stringify(result.bestPerformers["1M"]));
  Logger.log("✅ API payload generated successfully!");
}
