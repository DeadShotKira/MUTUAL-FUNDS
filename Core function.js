/****************************************************************************************
 * MUTUAL FUND NAV TRACKING, HISTORICAL BACKFILL & DAILY ALERT SYSTEM
 * 
 * ARCHITECTURE:
 * 1. DAILY UPDATER (Isolated, Fast, Single-Request AMFI NAVAll.txt parser):
 *    - getAMFINAVMap_FAST()
 *    - fetchDailyNAV_FAST()
 *    - checkNAVAlertModular() & safeCheck()
 *    - Chart generation (QuickChart, Image-Charts fallback, Sheets native charts)
 *    - Investment calculations (getAverageBuyNAV, getFundSummary, createInvestmentPieChart)
 * 
 * 2. CONSOLIDATED HISTORICAL BACKFILL ENGINE (Self-Recovering & Resilient):
 *    - Centralized 10-fund configuration: getNAVBackfillFunds_() (canonical: schemeCode, sheetName)
 *    - AMFI Historical Report Endpoint: DownloadNAVHistoryReport_Po.aspx (no mf= parameter)
 *    - Single-pass parser: parseAMFIAllSchemes_() extracts all 10 funds in one pass
 *    - 7-calendar-day inclusive chunking with auto-retry and exponential backoff
 *    - Durable Staging: hidden sheet '_NAV_BACKFILL_STAGING' with batched deduplicated writes
 *    - Safe trigger lifecycle: ensureBackfillWorkerTrigger_() avoids duplicate triggers or stalls
 *    - ScriptLock contention handling: ensures future continuation if lock is busy
 *    - Full outer error handling with stage, timestamp, and stack-trace recording
 *    - Heartbeat tracking to detect active vs idle vs stalled executions
 * 
 * 3. RESUMABLE FINAL MERGE & DESTINATION SHEET VERIFICATION:
 *    - auditNAVBackfillAndSheets(): Read-only audit comparing staging records to destination sheets
 *    - runNAVBackfillFinalMerge(dryRun): Dedicated non-destructive merge and verification engine
 *    - Independent per-fund tracking in BACKFILL_MERGED_FUNDS (resumes without re-merging)
 *    - Batch insertion preserving existing purchase records, formulas, formatting, and valid NAVs
 * 
 * 4. PRIMARY CONTROLS:
 *    - auditNAVBackfillAndSheets(): Comprehensive diagnostic report comparing staging vs fund sheets
 *    - runNAVBackfillFinalMerge(dryRun): Execute final merge and verification (dryRun=false by default)
 *    - getNAVBackfillStatus(): Full progress report, real sheet verification counts & stalled detection
 *    - resumeNAVBackfillAll(): Self-recovering resume (transitions directly to merge if chunks finished)
 *    - cancelNAVBackfillAll(): Cancel active backfill triggers and preserve staging audit
 *    - startNAVBackfillAll(forceRestart): Protected fresh start (will NOT overwrite active runs)
 ****************************************************************************************/


/* ======================================================================================
   SECTION 1: CENTRAL CONFIGURATION & CANONICAL SCHEMA
   ====================================================================================== */

/**
 * Centralized registry of the 10 mutual funds tracked by this project.
 * Canonical Schema: { schemeCode: string, sheetName: string }
 * Used by both Daily Updater and Historical Backfill engine.
 *
 * @return {Array<{schemeCode: string, sheetName: string}>}
 */
function getNAVBackfillFunds_() {
  return [
    { schemeCode: "118989", sheetName: "HDFC-M-FundData" },
    { schemeCode: "148519", sheetName: "Nippon-S-250-FundData" },
    { schemeCode: "118633", sheetName: "Nippon-Large-FundData" },
    { schemeCode: "127042", sheetName: "MO-M-FundData" },
    { schemeCode: "118666", sheetName: "Nippon-G-M-FundData" },
    { schemeCode: "119721", sheetName: "SBI-L&M-FundData" },
    { schemeCode: "120586", sheetName: "ICICI-Pru-Large-FundData" },
    { schemeCode: "119774", sheetName: "Kotak-M-FundData" },
    { schemeCode: "118835", sheetName: "Mirae-L-M-FundData" },
    { schemeCode: "118775", sheetName: "Nippon-S-FundData" }
  ];
}

/**
 * Mapping helper: schemeCode -> sheetName
 */
function getNAVBackfillFundMap_() {
  const funds = getNAVBackfillFunds_();
  const map = {};
  funds.forEach(f => {
    map[f.schemeCode] = f.sheetName;
  });
  return map;
}

/**
 * Mapping helper: sheetName -> schemeCode
 */
function getNAVBackfillSheetMap_() {
  const funds = getNAVBackfillFunds_();
  const map = {};
  funds.forEach(f => {
    map[f.sheetName] = f.schemeCode;
  });
  return map;
}

/**
 * Historical Backfill settings.
 */
function getNAVBackfillConfig_() {
  return {
    CHUNK_DAYS: 7,
    EXECUTION_TIME_BUDGET_MS: 190 * 1000, // 190 seconds (comfortably under GAS 360s limit)
    MAX_CONSECUTIVE_FAILURES: 3,
    TIMEZONE: "Asia/Kolkata",
    DEFAULT_START_DATE: "2026-04-27",
    STAGING_SHEET_NAME: "_NAV_BACKFILL_STAGING",
    HISTORICAL_ENDPOINT: "https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx"
  };
}


/* ======================================================================================
   SECTION 2: DATE HELPERS (Asia/Kolkata Timezone)
   ====================================================================================== */

/**
 * Format a Date object to AMFI's historical parameter format (dd-MMM-yyyy).
 */
function formatAMFIHistoryDate_(date) {
  return Utilities.formatDate(date, "Asia/Kolkata", "dd-MMM-yyyy");
}

/**
 * Format a Date object to ISO format (yyyy-MM-dd).
 */
function formatISODate_(date) {
  return Utilities.formatDate(date, "Asia/Kolkata", "yyyy-MM-dd");
}

/**
 * Convert a yyyy-MM-dd string into a local Date object.
 * Uses midday (12:00:00) to safely prevent UTC day-boundary shifting.
 */
function dateFromISO_(isoStr) {
  if (!isoStr || typeof isoStr !== "string") return null;
  const parts = isoStr.split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return null;
  }
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

/**
 * Add calendar days safely to a Date object.
 */
function addAMFIDays_(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Normalizes any sheet date cell value (Date object, yyyy-MM-dd, dd-MMM-yyyy) into yyyy-MM-dd.
 */
function normalizeNAVSheetDate_(value) {
  const tz = "Asia/Kolkata";
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }

  const str = String(value).trim();
  if (!str) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  try {
    const parsed = Utilities.parseDate(str, tz, "dd-MMM-yyyy");
    if (parsed && !isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, tz, "yyyy-MM-dd");
    }
  } catch (e) {}

  return null;
}


/* ======================================================================================
   SECTION 3: DAILY NAV UPDATER (PRESERVED & WORKING)
   ====================================================================================== */

/**
 * Fetch latest NAV for all requested schemes in a single HTTP request to NAVAll.txt.
 */
function getAMFINAVMap_FAST(schemeCodes) {
  const wantedCodes = new Set(
    (schemeCodes || [])
      .map(code => String(code).trim())
      .filter(Boolean)
  );

  if (wantedCodes.size === 0) {
    throw new Error("No AMFI scheme codes provided.");
  }

  const url = "https://portal.amfiindia.com/spages/NAVAll.txt";

  const response = UrlFetchApp.fetch(url, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true
  });

  const status = response.getResponseCode();
  if (status !== 200) {
    throw new Error("AMFI HTTP Error: " + status);
  }

  const content = response.getContentText("UTF-8");
  if (!content) {
    throw new Error("AMFI returned an empty response.");
  }

  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  let navIndex = -1;
  let dateIndex = -1;
  let startIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const headers = lines[i]
      .trim()
      .split(";")
      .map(x => x.trim().toLowerCase());

    if (headers[0] === "scheme code") {
      navIndex = headers.findIndex(x => x === "net asset value");
      dateIndex = headers.findIndex(x => x === "date");
      startIndex = i + 1;
      break;
    }
  }

  if (navIndex < 0 || dateIndex < 0 || startIndex < 0) {
    throw new Error("Unable to identify AMFI NAV/date columns.");
  }

  const map = {};

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const p = line.split(";");
    if (p.length <= Math.max(navIndex, dateIndex)) continue;

    const code = String(p[0]).trim();
    if (!wantedCodes.has(code)) continue;

    const nav = Number(p[navIndex].trim().replace(/,/g, ""));
    const date = p[dateIndex].trim();

    if (!Number.isFinite(nav) || nav <= 0 || !date) {
      Logger.log("Invalid AMFI record for scheme: " + code);
      continue;
    }

    map[code] = { nav: nav, date: date };

    if (Object.keys(map).length === wantedCodes.size) {
      break;
    }
  }

  const missing = [...wantedCodes].filter(code => !map[code]);
  Logger.log("AMFI schemes found: " + Object.keys(map).length + "/" + wantedCodes.size);
  if (missing.length) {
    Logger.log("Missing AMFI scheme codes: " + missing.join(", "));
  }

  if (Object.keys(map).length === 0) {
    throw new Error("No requested scheme codes found in AMFI feed.");
  }

  return map;
}

/**
 * Appends the daily NAV row for one sheet if it is newer than the last recorded date.
 */
function fetchDailyNAV_FAST(schemeCode, sheetName, amfiMap) {
  const entry = amfiMap ? amfiMap[String(schemeCode).trim()] : null;

  if (!entry) {
    Logger.log("AMFI scheme not found: " + schemeCode);
    return { updated: false, reason: "SCHEME_NOT_FOUND" };
  }

  const nav = Number(entry.nav);
  if (!Number.isFinite(nav) || nav <= 0) {
    return { updated: false, reason: "INVALID_NAV" };
  }

  const tz = "Asia/Kolkata";
  let parsedDate;

  try {
    parsedDate = Utilities.parseDate(entry.date, tz, "dd-MMM-yyyy");
  } catch (e) {
    return { updated: false, reason: "BAD_DATE" };
  }

  if (!parsedDate || isNaN(parsedDate.getTime())) {
    return { updated: false, reason: "BAD_DATE" };
  }

  const formattedDate = Utilities.formatDate(parsedDate, tz, "yyyy-MM-dd");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Sheet not found: " + sheetName);
  }

  const lastRow = sheet.getLastRow();
  let lastStoredDate = null;

  if (lastRow >= 2) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = dates.length - 1; i >= 0; i--) {
      const normalized = normalizeNAVSheetDate_(dates[i][0]);
      if (normalized) {
        lastStoredDate = normalized;
        break;
      }
    }
  }

  if (formattedDate === lastStoredDate) {
    return { updated: false, reason: "NO_NEW_NAV" };
  }

  if (lastStoredDate && formattedDate < lastStoredDate) {
    Logger.log(`${sheetName}: Older NAV rejected (${formattedDate} < ${lastStoredDate})`);
    return { updated: false, reason: "OLDER_NAV_REJECTED" };
  }

  sheet.appendRow([formattedDate, nav]);
  Logger.log(`UPDATED: ${sheetName} | Date: ${formattedDate} | NAV: ₹${nav}`);

  return { updated: true, nav: nav, date: formattedDate };
}

/**
 * Get the last stored NAV date from Column A of a sheet.
 */
function getLastStoredNAVDate(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const lastDate = sheet.getRange(sheet.getLastRow(), 1).getValue();
  return normalizeNAVSheetDate_(lastDate);
}


/* ======================================================================================
   SECTION 4: CONSOLIDATED HISTORICAL PARSER & HTTP CHUNK DOWNLOADER
   ====================================================================================== */

/**
 * Parse an AMFI historical response report for all requested scheme codes in a single pass.
 *
 * Expected Header:
 * Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date
 * Positions:
 * 0: Scheme Code
 * 6: Net Asset Value
 * 7: Date (dd-MMM-yyyy)
 *
 * @param {string} content - Raw response string from AMFI historical endpoint
 * @param {Array<{schemeCode: string, sheetName: string}>} [targetFunds] - Fund registry
 * @return {{recordsByScheme: Object, totalRecords: number, headerFound: boolean}}
 */
function parseAMFIAllSchemes_(content, targetFunds) {
  if (!content || typeof content !== "string") {
    return { recordsByScheme: {}, totalRecords: 0, headerFound: false };
  }

  const funds = targetFunds || getNAVBackfillFunds_();
  const targetSet = new Set(funds.map(f => String(f.schemeCode).trim()));
  const tz = "Asia/Kolkata";

  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  let schemeCodeIndex = 0;
  let navIndex = 6;
  let dateIndex = 7;
  let startIndex = 0;
  let headerFound = false;

  // Dynamically detect header row in the first 30 non-empty lines
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower.includes("scheme code") && lower.includes("net asset value")) {
      const parts = trimmed.split(";").map(p => p.trim().toLowerCase());
      const sIdx = parts.indexOf("scheme code");
      const nIdx = parts.indexOf("net asset value");
      const dIdx = parts.indexOf("date");
      if (sIdx !== -1 && nIdx !== -1 && dIdx !== -1) {
        schemeCodeIndex = sIdx;
        navIndex = nIdx;
        dateIndex = dIdx;
        startIndex = i + 1;
        headerFound = true;
        break;
      }
    }
  }

  const recordsByScheme = {};
  targetSet.forEach(code => {
    recordsByScheme[code] = {};
  });

  let totalRecords = 0;
  const maxRequiredIndex = Math.max(schemeCodeIndex, navIndex, dateIndex);

  // Single parsing pass across all lines
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(";");
    if (parts.length <= maxRequiredIndex) continue;

    const rawCode = String(parts[schemeCodeIndex] || "").trim();
    if (!targetSet.has(rawCode)) continue;

    const rawNav = String(parts[navIndex] || "").trim().replace(/,/g, "");
    const nav = Number(rawNav);
    if (!Number.isFinite(nav) || nav <= 0) continue;

    const rawDate = String(parts[dateIndex] || "").trim();
    if (!rawDate) continue;

    let parsedDate;
    try {
      parsedDate = Utilities.parseDate(rawDate, tz, "dd-MMM-yyyy");
    } catch (e) {
      continue;
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) continue;

    const isoDate = Utilities.formatDate(parsedDate, tz, "yyyy-MM-dd");

    if (!recordsByScheme[rawCode][isoDate]) {
      recordsByScheme[rawCode][isoDate] = {
        schemeCode: rawCode,
        dateISO: isoDate,
        dateObj: parsedDate,
        nav: nav
      };
      totalRecords++;
    }
  }

  return { recordsByScheme, totalRecords, headerFound };
}

/**
 * Downloads one historical date range report for ALL ten mutual funds in ONE HTTP request.
 * Does NOT supply an mf= parameter.
 *
 * @param {Date} fromDate - Inclusive start date
 * @param {Date} toDate - Inclusive end date
 * @return {{content: string, url: string, fromStr: string, toStr: string}}
 */
function fetchAMFIHistoricalChunkReport_(fromDate, toDate) {
  const config = getNAVBackfillConfig_();
  const fromStr = formatAMFIHistoryDate_(fromDate);
  const toStr = formatAMFIHistoryDate_(toDate);

  const url = `${config.HISTORICAL_ENDPOINT}?tp=1&frmdt=${encodeURIComponent(fromStr)}&todt=${encodeURIComponent(toStr)}`;

  Logger.log(`📡 Fetching historical AMFI chunk: ${fromStr} to ${toStr}`);

  let lastError = null;
  const retries = 3;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, {
        method: "get",
        muteHttpExceptions: true,
        followRedirects: true
      });

      const statusCode = response.getResponseCode();
      if (statusCode !== 200) {
        lastError = `HTTP ${statusCode}`;
      } else {
        const content = response.getContentText("UTF-8");
        if (content && content.trim().length > 0) {
          return {
            content: content,
            url: url,
            fromStr: fromStr,
            toStr: toStr
          };
        } else {
          lastError = "Empty response body from AMFI";
        }
      }
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
    }

    Logger.log(`⚠️ AMFI historical fetch attempt ${attempt} failed: ${lastError}`);
    if (attempt < retries) {
      Utilities.sleep(attempt * 2000);
    }
  }

  throw new Error(`Failed to fetch AMFI historical report (${fromStr} to ${toStr}) after ${retries} attempts: ${lastError}`);
}


/* ======================================================================================
   SECTION 5: DURABLE STAGING & TRIGGER WORKER INFRASTRUCTURE
   ====================================================================================== */

/**
 * Ensures the hidden staging sheet exists with proper headers.
 * Columns: Run ID | Scheme Code | NAV Date | NAV Value | Chunk Start | Chunk End
 */
function getOrCreateStagingSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getNAVBackfillConfig_();
  let sheet = ss.getSheetByName(config.STAGING_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(config.STAGING_SHEET_NAME);
    sheet.getRange("A1:F1").setValues([
      ["Run ID", "Scheme Code", "NAV Date", "NAV Value", "Chunk Start", "Chunk End"]
    ]);
    sheet.getRange("A1:F1").setFontWeight("bold");
    sheet.setFrozenRows(1);
    try {
      sheet.hideSheet();
    } catch (e) {}
  } else {
    try {
      if (!sheet.isSheetHidden()) {
        sheet.hideSheet();
      }
    } catch (e) {}
  }

  return sheet;
}

/**
 * Remove all active time-driven triggers for the backfill worker.
 * Never touches daily summary or user triggers.
 */
function deleteBackfillTriggers_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "NAVBackfillWorker") {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log("Removed backfill trigger ID: " + triggers[i].getUniqueId());
    }
  }
}

/**
 * RELIABLE TRIGGER LIFECYCLE HELPER:
 * Ensures exactly one active NAVBackfillWorker trigger is scheduled.
 * Avoids duplicate triggers, preserves future triggers, and records schedule timestamp.
 *
 * @param {number} [delaySeconds=15] - Continuation delay
 * @return {GoogleAppsScript.Script.Trigger|null}
 */
function ensureBackfillWorkerTrigger_(delaySeconds) {
  const sec = delaySeconds || 15;
  const config = getNAVBackfillConfig_();
  const props = PropertiesService.getScriptProperties();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    const workerTriggers = triggers.filter(t => t.getHandlerFunction() === "NAVBackfillWorker");

    // If exactly one trigger already exists, keep it and avoid creating duplicates
    if (workerTriggers.length === 1) {
      Logger.log(`ℹ️ Existing NAVBackfillWorker trigger active (ID: ${workerTriggers[0].getUniqueId()}).`);
      return workerTriggers[0];
    }

    // If duplicate triggers exist, remove extras and retain only the first
    if (workerTriggers.length > 1) {
      Logger.log(`⚠️ Found ${workerTriggers.length} worker triggers. Cleaning duplicates...`);
      for (let i = 1; i < workerTriggers.length; i++) {
        ScriptApp.deleteTrigger(workerTriggers[i]);
      }
      return workerTriggers[0];
    }

    // Zero triggers exist: safely create one continuation trigger
    const newTrigger = ScriptApp.newTrigger("NAVBackfillWorker")
      .timeBased()
      .after(sec * 1000)
      .create();

    const scheduledTime = new Date(Date.now() + sec * 1000);
    const scheduledTimeStr = Utilities.formatDate(scheduledTime, config.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    props.setProperty("BACKFILL_NEXT_TRIGGER_AT", scheduledTimeStr);
    props.deleteProperty("BACKFILL_LAST_TRIGGER_ERROR");

    Logger.log(`⏰ Scheduled next NAVBackfillWorker in ${sec}s (at ~${scheduledTimeStr}).`);
    return newTrigger;

  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    props.setProperty("BACKFILL_LAST_TRIGGER_ERROR", msg);
    Logger.log(`❌ Failed to ensure backfill trigger: ${msg}`);
    return null;
  }
}

/**
 * Persists chunk records to staging sheet with deduplication on (Run ID + Scheme Code + NAV Date).
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} stagingSheet
 * @param {string} runId
 * @param {Object} recordsByScheme
 * @param {string} fromISO
 * @param {string} toISO
 * @return {number} Count of new rows inserted
 */
function stageChunkRecords_(stagingSheet, runId, recordsByScheme, fromISO, toISO) {
  const existingKeys = new Set();
  const lastRow = stagingSheet.getLastRow();

  if (lastRow > 1) {
    const data = stagingSheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === runId) {
        existingKeys.add(String(data[i][1]).trim() + "_" + String(data[i][2]).trim());
      }
    }
  }

  const rowsToInsert = [];
  Object.keys(recordsByScheme).forEach(code => {
    const datesMap = recordsByScheme[code];
    Object.keys(datesMap).forEach(dISO => {
      const rec = datesMap[dISO];
      const key = rec.schemeCode + "_" + rec.dateISO;
      if (!existingKeys.has(key)) {
        rowsToInsert.push([
          runId,
          rec.schemeCode,
          rec.dateISO,
          rec.nav,
          fromISO,
          toISO
        ]);
        existingKeys.add(key);
      }
    });
  });

  if (rowsToInsert.length > 0) {
    stagingSheet.getRange(stagingSheet.getLastRow() + 1, 1, rowsToInsert.length, 6).setValues(rowsToInsert);
  }

  return rowsToInsert.length;
}


/* ======================================================================================
   SECTION 6: READ-ONLY AUDIT & VERIFICATION ENGINE (TASKS 1, 2, 3)
   ====================================================================================== */

/**
 * READ-ONLY AUDIT: Compares staging records in _NAV_BACKFILL_STAGING directly against
 * the 10 destination sheets without modifying any sheet.
 * Reconstructs the authoritative merge-completed status based on real destination sheet data.
 *
 * @param {string} [runIdFilter] - Run ID to inspect (defaults to current active run)
 * @return {Object} Detailed audit report
 */
function auditNAVBackfillAndSheets(runIdFilter) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const config = getNAVBackfillConfig_();
  const props = PropertiesService.getScriptProperties();
  const runId = runIdFilter || props.getProperty("BACKFILL_RUN_ID") || "RUN_20261120_234030";

  Logger.log(`🔍 ================= AUDITING NAV BACKFILL & DESTINATION SHEETS =================`);
  Logger.log(`Run ID: ${runId}`);

  const stagingSheet = ss.getSheetByName(config.STAGING_SHEET_NAME);
  if (!stagingSheet || stagingSheet.getLastRow() < 2) {
    Logger.log(`❌ Staging sheet '${config.STAGING_SHEET_NAME}' not found or empty.`);
    return { error: "STAGING_EMPTY", runId };
  }

  // 1. Read staging records for runId
  const stagedData = stagingSheet.getRange(2, 1, stagingSheet.getLastRow() - 1, 4).getValues();
  const stagedByScheme = {};
  const funds = getNAVBackfillFunds_();

  funds.forEach(f => {
    stagedByScheme[f.schemeCode] = {
      sheetName: f.sheetName,
      rawRows: 0,
      recordsMap: {}, // dateISO -> nav
      invalidNavCount: 0
    };
  });

  let totalStagedRowsForRun = 0;

  for (let i = 0; i < stagedData.length; i++) {
    const rowRunId = String(stagedData[i][0]).trim();
    if (rowRunId !== runId) continue;

    totalStagedRowsForRun++;
    const code = String(stagedData[i][1]).trim();
    const dateISO = normalizeNAVSheetDate_(stagedData[i][2]);
    const nav = Number(stagedData[i][3]);

    if (!stagedByScheme[code]) continue;

    stagedByScheme[code].rawRows++;

    if (!dateISO || !Number.isFinite(nav) || nav <= 0) {
      stagedByScheme[code].invalidNavCount++;
      continue;
    }

    stagedByScheme[code].recordsMap[dateISO] = nav;
  }

  // 2. Audit each destination sheet
  const auditReport = {};
  let totalUniqueStagedRecords = 0;
  let fullyMergedFundsCount = 0;
  const verifiedMergedList = [];

  funds.forEach(f => {
    const stagedInfo = stagedByScheme[f.schemeCode];
    const stagedDates = Object.keys(stagedInfo.recordsMap).sort();
    const stagedUniqueCount = stagedDates.length;
    totalUniqueStagedRecords += stagedUniqueCount;

    const stagedEarliest = stagedDates.length > 0 ? stagedDates[0] : "None";
    const stagedLatest = stagedDates.length > 0 ? stagedDates[stagedDates.length - 1] : "None";

    let sheet = ss.getSheetByName(f.sheetName);
    const destExists = (sheet !== null);
    let destRowCount = 0;
    let destDatesSet = new Set();
    let destDatesList = [];
    let destNavMap = {};
    let isDestSorted = true;
    let prevDate = null;

    if (destExists && sheet.getLastRow() >= 2) {
      const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
      destRowCount = data.length;

      for (let i = 0; i < data.length; i++) {
        const dISO = normalizeNAVSheetDate_(data[i][0]);
        if (!dISO) continue;

        if (prevDate && dISO < prevDate) {
          isDestSorted = false;
        }
        prevDate = dISO;

        destDatesSet.add(dISO);
        destDatesList.push(dISO);
        destNavMap[dISO] = Number(data[i][1]);
      }
    }

    const destEarliest = destDatesList.length > 0 ? destDatesList[0] : "None";
    const destLatest = destDatesList.length > 0 ? destDatesList[destDatesList.length - 1] : "None";

    let alreadyPresentCount = 0;
    const missingDates = [];
    const conflicts = [];

    stagedDates.forEach(sd => {
      if (destDatesSet.has(sd)) {
        alreadyPresentCount++;
        const currentNav = destNavMap[sd];
        const stagedNav = stagedInfo.recordsMap[sd];
        if (Number.isFinite(currentNav) && currentNav > 0 && Math.abs(currentNav - stagedNav) > 0.001) {
          conflicts.push({ date: sd, destNAV: currentNav, stagedNAV: stagedNav });
        }
      } else {
        missingDates.push(sd);
      }
    });

    const isFullyMerged = (missingDates.length === 0 && stagedUniqueCount > 0);
    if (isFullyMerged) {
      fullyMergedFundsCount++;
      verifiedMergedList.push(f.sheetName);
    }

    auditReport[f.schemeCode] = {
      sheetName: f.sheetName,
      schemeCode: f.schemeCode,
      destExists: destExists,
      destRowCount: destRowCount,
      destEarliest: destEarliest,
      destLatest: destLatest,
      isDestSorted: isDestSorted,
      stagedRawRows: stagedInfo.rawRows,
      stagedUniqueCount: stagedUniqueCount,
      stagedEarliest: stagedEarliest,
      stagedLatest: stagedLatest,
      alreadyPresentCount: alreadyPresentCount,
      missingCount: missingDates.length,
      missingDatesSample: missingDates.slice(0, 5),
      conflictsCount: conflicts.length,
      conflictsSample: conflicts.slice(0, 3),
      isFullyMerged: isFullyMerged,
      status: isFullyMerged ? "VERIFIED_MERGED" : "PENDING_MERGE"
    };

    Logger.log(`📊 [${f.schemeCode}] ${f.sheetName}:`);
    Logger.log(`   Staged: ${stagedUniqueCount} unique dates (${stagedEarliest} to ${stagedLatest})`);
    Logger.log(`   Destination: ${destRowCount} rows (${destEarliest} to ${destLatest}) | Sorted: ${isDestSorted}`);
    Logger.log(`   Coverage: ${alreadyPresentCount} already present | ${missingDates.length} missing | Status: ${isFullyMerged ? "✅ VERIFIED" : "⏳ PENDING"}`);
    if (conflicts.length > 0) {
      Logger.log(`   ⚠️ Conflicts: ${conflicts.length} dates have differing NAV values.`);
    }
  });

  // Reconstruct authoritative BACKFILL_MERGED_FUNDS from actual sheet data
  props.setProperty("BACKFILL_MERGED_FUNDS", JSON.stringify(verifiedMergedList));
  if (fullyMergedFundsCount === 10) {
    props.setProperty("BACKFILL_STATUS", "COMPLETED");
    props.setProperty("BACKFILL_CURRENT_STAGE", "COMPLETED");
  } else if (props.getProperty("BACKFILL_STATUS") === "COMPLETED") {
    // If status said COMPLETED but some funds were actually missing, repair to MERGING
    props.setProperty("BACKFILL_STATUS", "MERGING");
    props.setProperty("BACKFILL_CURRENT_STAGE", "MERGE_PENDING");
  }

  Logger.log(`================================================================================`);
  Logger.log(`AUDIT SUMMARY: ${fullyMergedFundsCount} / 10 Funds Verified Merged`);
  Logger.log(`Total Staged Rows: ${totalStagedRowsForRun} | Unique Records: ${totalUniqueStagedRecords}`);
  if (fullyMergedFundsCount === 10) {
    Logger.log(`🏁 All 10 destination sheets are 100% complete and verified against staged history.`);
  } else {
    Logger.log(`⚠️ ${10 - fullyMergedFundsCount} fund(s) need merge. Run runNAVBackfillFinalMerge() to complete.`);
  }
  Logger.log(`================================================================================`);

  return {
    runId: runId,
    totalStagedRows: totalStagedRowsForRun,
    totalUniqueRecords: totalUniqueStagedRecords,
    fullyMergedFundsCount: fullyMergedFundsCount,
    allFundsMerged: (fullyMergedFundsCount === 10),
    fundsAudit: auditReport
  };
}


/* ======================================================================================
   SECTION 7: DEDICATED FINAL MERGE & VERIFICATION CONTROLS (TASKS 4, 5, 7)
   ====================================================================================== */

/**
 * PRIMARY FINAL MERGE CONTROLLER:
 * Merges staged records from _NAV_BACKFILL_STAGING into destination sheets without re-downloading.
 * Safe, idempotent, preserves purchase records and formulas, and tracks per-fund verification.
 *
 * @param {boolean} [dryRun=false] - If true, evaluates what would be merged without writing changes
 * @return {Object} Merge execution summary
 */
function runNAVBackfillFinalMerge(dryRun) {
  const isDryRun = (dryRun === true);
  const startTime = Date.now();
  const config = getNAVBackfillConfig_();
  const props = PropertiesService.getScriptProperties();
  const runId = props.getProperty("BACKFILL_RUN_ID") || "RUN_20261120_234030";

  Logger.log(`🚀 Starting Final NAV Backfill Merge ${isDryRun ? "[DRY RUN]" : "[LIVE]"} for Run: ${runId}`);

  // Prevent downloading AMFI data during merge
  props.setProperty("BACKFILL_CURRENT_STAGE", isDryRun ? "MERGE_DRY_RUN" : "MERGING");
  props.setProperty("BACKFILL_WORKER_HEARTBEAT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stagingSheet = ss.getSheetByName(config.STAGING_SHEET_NAME);

  if (!stagingSheet || stagingSheet.getLastRow() < 2) {
    Logger.log(`❌ No staged records found in '${config.STAGING_SHEET_NAME}'.`);
    return { error: "NO_STAGED_RECORDS" };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("⚠️ Lock contention during merge. Ensuring continuation trigger...");
    ensureBackfillWorkerTrigger_(30);
    return { error: "LOCK_BUSY" };
  }

  try {
    // 1. Group staged records by schemeCode and dateISO (deduplicating)
    const stagedData = stagingSheet.getRange(2, 1, stagingSheet.getLastRow() - 1, 4).getValues();
    const schemeRecordsMap = {};

    for (let i = 0; i < stagedData.length; i++) {
      const rowRunId = String(stagedData[i][0]).trim();
      if (runId && rowRunId !== runId) continue;

      const code = String(stagedData[i][1]).trim();
      const dateISO = normalizeNAVSheetDate_(stagedData[i][2]);
      const nav = Number(stagedData[i][3]);

      if (!code || !dateISO || !Number.isFinite(nav) || nav <= 0) continue;

      if (!schemeRecordsMap[code]) {
        schemeRecordsMap[code] = {};
      }

      schemeRecordsMap[code][dateISO] = {
        iso: dateISO,
        date: dateFromISO_(dateISO),
        nav: nav
      };
    }

    // 2. Load existing verified merged funds
    const mergedFundsJson = props.getProperty("BACKFILL_MERGED_FUNDS") || "[]";
    let mergedFundsList = [];
    try {
      mergedFundsList = JSON.parse(mergedFundsJson);
    } catch (e) {
      mergedFundsList = [];
    }
    const mergedFundsSet = new Set(mergedFundsList);

    const funds = getNAVBackfillFunds_();
    const mergeSummary = {};

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];

      // Time budget protection during live merging
      const elapsed = Date.now() - startTime;
      if (!isDryRun && elapsed >= config.EXECUTION_TIME_BUDGET_MS) {
        Logger.log(`⏳ Execution time budget reached during merge (${Math.round(elapsed / 1000)}s). Scheduling continuation.`);
        props.setProperty("BACKFILL_STATUS", "MERGING");
        props.setProperty("BACKFILL_CURRENT_STAGE", "MERGING");
        props.setProperty("BACKFILL_MERGED_FUNDS", JSON.stringify([...mergedFundsSet]));
        ensureBackfillWorkerTrigger_(10);
        return { status: "YIELDED_ON_TIME_BUDGET", mergedCount: mergedFundsSet.size, partialSummary: mergeSummary };
      }

      let sheet = ss.getSheetByName(fund.sheetName);
      if (!sheet) {
        if (!isDryRun) {
          sheet = ss.insertSheet(fund.sheetName);
          sheet.getRange("A1:B1").setValues([["Date", "NAV"]]);
        }
      }

      const fundHistory = schemeRecordsMap[fund.schemeCode] || {};

      if (isDryRun) {
        // Dry run comparison without modifying sheet
        const audit = auditSheetVsStaging_(sheet, fundHistory);
        mergeSummary[fund.sheetName] = audit;
        Logger.log(`[DRY RUN] ${fund.sheetName}: Would insert ${audit.missingCount} rows, ${audit.alreadyPresentCount} already present.`);
      } else {
        // Live merge using idempotent insertion
        const result = insertMissingNAVHistoryRows_(sheet, fundHistory);
        mergeSummary[fund.sheetName] = result;

        mergedFundsSet.add(fund.sheetName);
        props.setProperty("BACKFILL_MERGED_FUNDS", JSON.stringify([...mergedFundsSet]));
        props.setProperty("BACKFILL_WORKER_HEARTBEAT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
        SpreadsheetApp.flush();

        Logger.log(`✅ [LIVE MERGED] ${fund.sheetName}: +${result.inserted} inserted, ${result.repaired} repaired, ${result.alreadyPresent} already present.`);
      }
    }

    if (!isDryRun && mergedFundsSet.size === 10) {
      props.setProperty("BACKFILL_STATUS", "COMPLETED");
      props.setProperty("BACKFILL_CURRENT_STAGE", "COMPLETED");
      props.setProperty("BACKFILL_COMPLETED_AT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
      deleteBackfillTriggers_();

      Logger.log("===============================================================");
      Logger.log("🏁 ALL 10 MUTUAL FUNDS SUCCESSFULLY MERGED AND VERIFIED!");
      Logger.log("===============================================================");
    }

    return {
      runId: runId,
      isDryRun: isDryRun,
      mergedCount: isDryRun ? 0 : mergedFundsSet.size,
      allFundsMerged: (mergedFundsSet.size === 10),
      summary: mergeSummary
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Internal helper to audit a sheet against staged records (dry-run helper).
 */
function auditSheetVsStaging_(sheet, stagedMap) {
  if (!sheet || sheet.getLastRow() < 2) {
    return { destRows: 0, missingCount: Object.keys(stagedMap).length, alreadyPresentCount: 0 };
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const existingDates = new Set();
  for (let i = 0; i < data.length; i++) {
    const dISO = normalizeNAVSheetDate_(data[i][0]);
    if (dISO) existingDates.add(dISO);
  }

  let alreadyPresent = 0;
  let missing = 0;

  Object.keys(stagedMap).forEach(d => {
    if (existingDates.has(d)) {
      alreadyPresent++;
    } else {
      missing++;
    }
  });

  return { destRows: data.length, missingCount: missing, alreadyPresentCount: alreadyPresent };
}

/**
 * Inserts missing historical records into a fund sheet without overwriting
 * existing NAV or shifting purchase/formula data out of alignment.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Target mutual fund sheet
 * @param {Object} historyMap - { [isoDate]: { iso: string, date: Date, nav: number } }
 */
function insertMissingNAVHistoryRows_(sheet, historyMap) {
  const records = Object.values(historyMap || {})
    .sort((a, b) => a.iso.localeCompare(b.iso));

  if (records.length === 0) {
    return { inserted: 0, repaired: 0, alreadyPresent: 0 };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    sheet.getRange("A1:B1").setValues([["Date", "NAV"]]);
  }

  const data = sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    : [];

  const existingRows = [];
  const existingDates = new Set();
  const repairs = [];

  for (let i = 0; i < data.length; i++) {
    const dateISO = normalizeNAVSheetDate_(data[i][0]);
    if (!dateISO) continue;

    const rowNumber = i + 2;
    const nav = Number(data[i][1]);

    existingRows.push({ iso: dateISO, row: rowNumber });
    existingDates.add(dateISO);

    // Repair existing date row if NAV is invalid/blank
    if (!Number.isFinite(nav) || nav <= 0) {
      const historyRecord = historyMap[dateISO];
      if (historyRecord) {
        repairs.push({ row: rowNumber, nav: historyRecord.nav });
      }
    }
  }

  // Apply invalid NAV repairs in place
  repairs.forEach(item => {
    sheet.getRange(item.row, 2).setValue(item.nav);
  });

  let alreadyPresent = 0;
  const missingRecords = records.filter(record => {
    if (existingDates.has(record.iso)) {
      alreadyPresent++;
      return false;
    }
    return true;
  });

  if (missingRecords.length === 0) {
    return { inserted: 0, repaired: repairs.length, alreadyPresent: alreadyPresent };
  }

  // Direct append if sheet had no prior records
  if (existingRows.length === 0) {
    const neededRows = missingRecords.length + 1;
    if (sheet.getMaxRows() < neededRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows());
    }
    sheet.getRange(2, 1, missingRecords.length, 2).setValues(
      missingRecords.map(r => [r.date, r.nav])
    );
    sheet.getRange(2, 1, missingRecords.length, 1).setNumberFormat("yyyy-mm-dd");
    return { inserted: missingRecords.length, repaired: repairs.length, alreadyPresent: alreadyPresent };
  }

  // Group missing records by the row before which they belong
  const insertionGroups = {};

  for (const record of missingRecords) {
    const nextRow = existingRows.find(existing => existing.iso > record.iso);
    const targetRow = nextRow
      ? nextRow.row
      : existingRows[existingRows.length - 1].row + 1;

    if (!insertionGroups[targetRow]) {
      insertionGroups[targetRow] = [];
    }
    insertionGroups[targetRow].push(record);
  }

  // Insert from bottom to top so row indexes remain intact
  const targetRows = Object.keys(insertionGroups)
    .map(Number)
    .sort((a, b) => b - a);

  for (const targetRow of targetRows) {
    const group = insertionGroups[targetRow];
    group.sort((a, b) => a.iso.localeCompare(b.iso));

    let actualRow = targetRow;

    if (targetRow > sheet.getMaxRows()) {
      const oldMaxRows = sheet.getMaxRows();
      sheet.insertRowsAfter(oldMaxRows, targetRow + group.length - oldMaxRows);
      actualRow = targetRow;
    } else {
      sheet.insertRowsBefore(targetRow, group.length);
    }

    const values = group.map(record => [record.date, record.nav]);
    sheet.getRange(actualRow, 1, values.length, 2).setValues(values);
    sheet.getRange(actualRow, 1, values.length, 1).setNumberFormat("yyyy-mm-dd");
  }

  return {
    inserted: missingRecords.length,
    repaired: repairs.length,
    alreadyPresent: alreadyPresent
  };
}


/* ======================================================================================
   SECTION 8: WORKER & PRIMARY STATUS CONTROLS (TASK 6)
   ====================================================================================== */

/**
 * PRIMARY STATUS FUNCTION:
 * Combines progress metadata, staging record counts, and REAL destination sheet verification.
 * Accurately distinguishes downloading vs merge pending vs merge verified.
 */
function getNAVBackfillStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const config = getNAVBackfillConfig_();

  const status = props.getProperty("BACKFILL_STATUS") || "NOT_STARTED";
  const runId = props.getProperty("BACKFILL_RUN_ID") || "NONE";
  const startDate = props.getProperty("BACKFILL_START_DATE") || config.DEFAULT_START_DATE;
  const endDate = props.getProperty("BACKFILL_END_DATE") || "N/A";
  const nextDate = props.getProperty("BACKFILL_NEXT_DATE") || "N/A";
  const completedChunks = parseInt(props.getProperty("BACKFILL_COMPLETED_CHUNKS") || "0", 10);
  const consecutiveFailures = parseInt(props.getProperty("BACKFILL_CONSECUTIVE_FAILURES") || "0", 10);
  const lastSuccessfulChunk = props.getProperty("BACKFILL_LAST_SUCCESSFUL_CHUNK") || "None";
  const lastSuccessfulChunkAt = props.getProperty("BACKFILL_LAST_SUCCESSFUL_CHUNK_AT") || "None";
  const lastError = props.getProperty("BACKFILL_LAST_ERROR") || "None";
  const lastErrorStack = props.getProperty("BACKFILL_LAST_ERROR_STACK") || "None";
  const lastErrorAt = props.getProperty("BACKFILL_LAST_ERROR_AT") || "None";
  const totalStagedFromProp = parseInt(props.getProperty("BACKFILL_TOTAL_STAGED") || "0", 10);
  const completedAt = props.getProperty("BACKFILL_COMPLETED_AT") || "N/A";
  const workerStartedAt = props.getProperty("BACKFILL_WORKER_STARTED_AT") || "None";
  const workerHeartbeat = props.getProperty("BACKFILL_WORKER_HEARTBEAT") || "None";
  const workerCompletedAt = props.getProperty("BACKFILL_WORKER_COMPLETED_AT") || "None";
  const nextTriggerAt = props.getProperty("BACKFILL_NEXT_TRIGGER_AT") || "None";
  const lastTriggerError = props.getProperty("BACKFILL_LAST_TRIGGER_ERROR") || "None";
  const mergedFundsJson = props.getProperty("BACKFILL_MERGED_FUNDS") || "[]";

  let mergedFundsList = [];
  try {
    mergedFundsList = JSON.parse(mergedFundsJson);
  } catch (e) {
    mergedFundsList = [];
  }
  const mergedFundsSet = new Set(mergedFundsList);

  // Check active worker triggers
  const triggers = ScriptApp.getProjectTriggers();
  const workerTriggers = triggers.filter(t => t.getHandlerFunction() === "NAVBackfillWorker").length;

  // Read actual staging data
  const stagingSheet = ss.getSheetByName(config.STAGING_SHEET_NAME);
  const funds = getNAVBackfillFunds_();
  const schemeStats = {};

  funds.forEach(f => {
    schemeStats[f.schemeCode] = {
      sheetName: f.sheetName,
      rawRows: 0,
      uniqueDates: new Set()
    };
  });

  let totalRawRowsInSheet = 0;
  let totalUniqueRecordsInSheet = 0;

  if (stagingSheet && stagingSheet.getLastRow() > 1 && runId !== "NONE") {
    const data = stagingSheet.getRange(2, 1, stagingSheet.getLastRow() - 1, 3).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === runId) {
        totalRawRowsInSheet++;
        const code = String(data[i][1]).trim();
        const dateISO = normalizeNAVSheetDate_(data[i][2]);
        if (schemeStats[code] && dateISO) {
          schemeStats[code].rawRows++;
          schemeStats[code].uniqueDates.add(dateISO);
        }
      }
    }
  }

  // Real destination sheet verification
  const recordsPerScheme = {};
  let verifiedFundsCount = 0;

  funds.forEach(f => {
    const s = schemeStats[f.schemeCode];
    const uniqueCount = s.uniqueDates.size;
    totalUniqueRecordsInSheet += uniqueCount;

    let destRowCount = 0;
    let destEarliest = "None";
    let destLatest = "None";
    let missingCount = uniqueCount;
    let alreadyPresentCount = 0;

    let destSheet = ss.getSheetByName(f.sheetName);
    if (destSheet && destSheet.getLastRow() >= 2) {
      const data = destSheet.getRange(2, 1, destSheet.getLastRow() - 1, 1).getValues();
      destRowCount = data.length;
      const destDates = new Set();
      let first = null;
      let last = null;

      for (let i = 0; i < data.length; i++) {
        const d = normalizeNAVSheetDate_(data[i][0]);
        if (d) {
          destDates.add(d);
          if (!first) first = d;
          last = d;
        }
      }
      destEarliest = first || "None";
      destLatest = last || "None";

      // Count missing
      s.uniqueDates.forEach(d => {
        if (destDates.has(d)) alreadyPresentCount++;
      });
      missingCount = uniqueCount - alreadyPresentCount;
    }

    const isVerifiedMerged = (uniqueCount > 0 && missingCount === 0);
    if (isVerifiedMerged) {
      verifiedFundsCount++;
    }

    recordsPerScheme[f.schemeCode] = {
      sheetName: f.sheetName,
      rawStagedCount: s.rawRows,
      uniqueStagedDates: uniqueCount,
      destRowCount: destRowCount,
      destEarliest: destEarliest,
      destLatest: destLatest,
      missingDatesCount: missingCount,
      alreadyPresentCount: alreadyPresentCount,
      isVerifiedMerged: isVerifiedMerged,
      status: isVerifiedMerged ? "VERIFIED_MERGED" : "PENDING_MERGE"
    };
  });

  // Calculate worker active state & stalled status
  const now = Date.now();
  let heartbeatAgeSeconds = null;
  if (workerHeartbeat && workerHeartbeat !== "None") {
    const hbDate = Utilities.parseDate(workerHeartbeat, config.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    if (hbDate && !isNaN(hbDate.getTime())) {
      heartbeatAgeSeconds = Math.round((now - hbDate.getTime()) / 1000);
    }
  }

  const isWorkerActive = (status === "RUNNING" || status === "MERGING") &&
    heartbeatAgeSeconds !== null && heartbeatAgeSeconds < 240;

  const isStalled = (status === "RUNNING" || status === "MERGING") &&
    !isWorkerActive && workerTriggers === 0;

  // Accurate stage resolution
  let resolvedStage = "UNKNOWN";
  if (totalUniqueRecordsInSheet >= 1200 && verifiedFundsCount === 10) {
    resolvedStage = "COMPLETED_AND_VERIFIED";
  } else if (totalUniqueRecordsInSheet >= 1200 && verifiedFundsCount > 0) {
    resolvedStage = `MERGE_IN_PROGRESS (${verifiedFundsCount}/10 verified)`;
  } else if (totalUniqueRecordsInSheet >= 1200 && verifiedFundsCount === 0) {
    resolvedStage = "DOWNLOAD_COMPLETE_MERGE_PENDING";
  } else if (completedChunks > 0 && completedChunks < 30) {
    resolvedStage = `DOWNLOADING_CHUNKS (${completedChunks}/30 chunks)`;
  }

  let effectiveState = resolvedStage;
  if (isStalled) {
    effectiveState = `STALLED (${resolvedStage} - No active worker & no pending trigger)`;
  } else if (isWorkerActive) {
    effectiveState = `ACTIVE (${resolvedStage} - Worker heartbeat ${heartbeatAgeSeconds}s ago)`;
  } else if (workerTriggers > 0) {
    effectiveState = `SCHEDULED (${resolvedStage} - Continuation trigger pending)`;
  }

  const result = {
    status: (verifiedFundsCount === 10) ? "COMPLETED" : (status === "COMPLETED" ? "MERGING" : status),
    effectiveState: effectiveState,
    currentStage: resolvedStage,
    isWorkerActive: isWorkerActive,
    isStalled: isStalled,
    runId: runId,
    startDate: startDate,
    endDate: endDate,
    nextDateToProcess: nextDate,
    completedChunks: completedChunks,
    consecutiveFailures: consecutiveFailures,
    lastSuccessfulChunk: lastSuccessfulChunk,
    lastSuccessfulChunkAt: lastSuccessfulChunkAt,
    lastError: lastError,
    lastErrorStack: lastErrorStack,
    lastErrorAt: lastErrorAt,
    totalStagedRows: totalRawRowsInSheet,
    totalUniqueStagedRecords: totalUniqueRecordsInSheet,
    verifiedFundsCount: verifiedFundsCount,
    allFundsMergedAndVerified: (verifiedFundsCount === 10),
    activeTriggers: workerTriggers,
    nextScheduledTriggerAt: nextTriggerAt,
    lastTriggerError: lastTriggerError,
    workerStartedAt: workerStartedAt,
    workerHeartbeat: workerHeartbeat,
    workerCompletedAt: workerCompletedAt,
    completedAt: completedAt,
    recordsPerScheme: recordsPerScheme
  };

  Logger.log("================ NAV BACKFILL STATUS REPORT ================");
  Logger.log(`Status:              ${result.status}`);
  Logger.log(`Current Stage:       ${result.currentStage}`);
  Logger.log(`Effective State:     ${result.effectiveState}`);
  Logger.log(`Run ID:              ${result.runId}`);
  Logger.log(`Date Range:          ${result.startDate} to ${result.endDate}`);
  Logger.log(`Completed Chunks:    ${result.completedChunks}`);
  Logger.log(`Total Staged:        ${result.totalStagedRows} rows (${result.totalUniqueStagedRecords} unique records)`);
  Logger.log(`Verified Merged:     ${result.verifiedFundsCount} / 10 Funds`);
  Logger.log(`Active Triggers:     ${result.activeTriggers}`);
  Logger.log("Per-Fund Verification Status:");
  funds.forEach(f => {
    const s = recordsPerScheme[f.schemeCode];
    Logger.log(`  ${f.schemeCode} (${s.sheetName}): Staged ${s.uniqueStagedDates} | Dest Rows: ${s.destRowCount} (${s.destEarliest} to ${s.destLatest}) | Missing: ${s.missingDatesCount} | Status: ${s.status}`);
  });
  if (result.verifiedFundsCount === 10) {
    Logger.log("🏁 All 10 destination sheets are 100% complete, merged, and verified.");
  } else {
    Logger.log("ℹ️ To merge missing records safely, run: runNAVBackfillFinalMerge() or resumeNAVBackfillAll()");
  }
  Logger.log("============================================================");

  return result;
}

/**
 * RESUME ENTRY POINT:
 * Intelligently routes to final merge if all 30 chunks are downloaded.
 * Never redownloads AMFI data when staging has 1,272 records.
 */
function resumeNAVBackfillAll() {
  const props = PropertiesService.getScriptProperties();
  const runId = props.getProperty("BACKFILL_RUN_ID") || "RUN_20261120_234030";
  const completedChunks = parseInt(props.getProperty("BACKFILL_COMPLETED_CHUNKS") || "0", 10);
  const nextDate = props.getProperty("BACKFILL_NEXT_DATE") || "N/A";
  const endDate = props.getProperty("BACKFILL_END_DATE") || "2026-11-20";

  Logger.log(`🔄 resumeNAVBackfillAll() invoked for Run: ${runId}`);

  // Check if downloading is already complete (30 chunks completed or nextDate past endDate)
  if (completedChunks >= 30 || (nextDate !== "N/A" && nextDate > endDate)) {
    Logger.log("ℹ️ All historical date chunks are already downloaded. Proceeding directly to final destination merge...");
    runNAVBackfillFinalMerge(false);
    return getNAVBackfillStatus();
  }

  // Otherwise, resume chunk downloading worker
  props.setProperty("BACKFILL_CONSECUTIVE_FAILURES", "0");
  props.setProperty("BACKFILL_LAST_ERROR", "");
  props.setProperty("BACKFILL_STATUS", "RUNNING");
  ensureBackfillWorkerTrigger_(10);
  NAVBackfillWorker();

  return getNAVBackfillStatus();
}

/**
 * Protected start function (will NOT overwrite active runs).
 */
function startNAVBackfillAll(forceRestart) {
  const props = PropertiesService.getScriptProperties();
  const currentStatus = props.getProperty("BACKFILL_STATUS");

  if (!forceRestart && (currentStatus === "RUNNING" || currentStatus === "MERGING" || currentStatus === "PAUSED" || currentStatus === "COMPLETED")) {
    const statusObj = getNAVBackfillStatus();
    Logger.log(`⚠️ An existing backfill run (${statusObj.runId}) already exists in status '${currentStatus}'.`);
    Logger.log("To resume or complete the merge safely without data loss, call runNAVBackfillFinalMerge() or resumeNAVBackfillAll().");
    Logger.log("To audit sheets read-only, call auditNAVBackfillAndSheets().");
    Logger.log("To force reset from scratch, explicitly call startNAVBackfillAll(true).");
    return statusObj;
  }

  const config = getNAVBackfillConfig_();
  const runId = "RUN_" + Utilities.formatDate(new Date(), config.TIMEZONE, "yyyyMMdd_HHmmss");
  const startDateStr = config.DEFAULT_START_DATE; // 2026-04-27
  const endDateStr = Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd");

  Logger.log(`🚀 Initializing fresh NAV historical backfill: ${startDateStr} to ${endDateStr} (Run ID: ${runId})`);

  getOrCreateStagingSheet_();
  deleteBackfillTriggers_();

  props.setProperties({
    "BACKFILL_STATUS": "RUNNING",
    "BACKFILL_RUN_ID": runId,
    "BACKFILL_START_DATE": startDateStr,
    "BACKFILL_END_DATE": endDateStr,
    "BACKFILL_NEXT_DATE": startDateStr,
    "BACKFILL_COMPLETED_CHUNKS": "0",
    "BACKFILL_CONSECUTIVE_FAILURES": "0",
    "BACKFILL_LAST_ERROR": "",
    "BACKFILL_LAST_ERROR_STACK": "",
    "BACKFILL_LAST_ERROR_AT": "",
    "BACKFILL_TOTAL_STAGED": "0",
    "BACKFILL_CURRENT_STAGE": "INITIALIZED",
    "BACKFILL_MERGED_FUNDS": "[]"
  });

  Logger.log("Starting first worker execution...");
  NAVBackfillWorker();

  return getNAVBackfillStatus();
}

/**
 * Cancel function preserving staging data.
 */
function cancelNAVBackfillAll() {
  deleteBackfillTriggers_();
  const props = PropertiesService.getScriptProperties();
  props.setProperty("BACKFILL_STATUS", "CANCELLED");
  props.setProperty("BACKFILL_CURRENT_STAGE", "CANCELLED");
  Logger.log("🛑 NAV historical backfill has been CANCELLED.");
  Logger.log("Staging data and progress markers have been preserved.");
  return getNAVBackfillStatus();
}

/**
 * Worker managing chunk downloading.
 */
function NAVBackfillWorker() {
  const startTime = Date.now();
  const config = getNAVBackfillConfig_();
  const props = PropertiesService.getScriptProperties();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log("⚠️ Lock contention: Another worker is currently active.");
    props.setProperty("BACKFILL_LAST_LOCK_CONTENTION_AT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
    ensureBackfillWorkerTrigger_(45);
    return;
  }

  try {
    const status = props.getProperty("BACKFILL_STATUS") || "NOT_STARTED";

    if (status !== "RUNNING" && status !== "MERGING") {
      Logger.log(`ℹ️ NAVBackfillWorker stopped because BACKFILL_STATUS is '${status}'.`);
      if (status === "COMPLETED" || status === "CANCELLED") {
        deleteBackfillTriggers_();
      }
      return;
    }

    const runId = props.getProperty("BACKFILL_RUN_ID");
    const startDateStr = props.getProperty("BACKFILL_START_DATE");
    const endDateStr = props.getProperty("BACKFILL_END_DATE");
    const nextDateStr = props.getProperty("BACKFILL_NEXT_DATE") || startDateStr;

    if (!endDateStr || !nextDateStr || !runId) {
      Logger.log("❌ Missing backfill progress properties. Call resumeNAVBackfillAll() to repair.");
      props.setProperty("BACKFILL_STATUS", "PAUSED");
      props.setProperty("BACKFILL_LAST_ERROR", "Missing progress properties");
      return;
    }

    const nowStr = Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    props.setProperty("BACKFILL_WORKER_STARTED_AT", nowStr);
    props.setProperty("BACKFILL_WORKER_HEARTBEAT", nowStr);

    const endDate = dateFromISO_(endDateStr);
    let cursorDate = dateFromISO_(nextDateStr);

    // If chunks are finished, execute final merge
    if (status === "MERGING" || (cursorDate && endDate && cursorDate > endDate)) {
      runNAVBackfillFinalMerge(false);
      return;
    }

    executeChunkDownloadStage_(startTime, config, props, runId, cursorDate, endDate);

  } catch (fatalErr) {
    const errMsg = fatalErr && fatalErr.message ? fatalErr.message : String(fatalErr);
    const errStack = fatalErr && fatalErr.stack ? fatalErr.stack : "";
    const nowStr = Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    Logger.log(`❌ Fatal worker error at stage '${props.getProperty("BACKFILL_CURRENT_STAGE")}': ${errMsg}`);

    props.setProperty("BACKFILL_LAST_ERROR", errMsg);
    props.setProperty("BACKFILL_LAST_ERROR_STACK", errStack);
    props.setProperty("BACKFILL_LAST_ERROR_AT", nowStr);

    let consecutiveFailures = parseInt(props.getProperty("BACKFILL_CONSECUTIVE_FAILURES") || "0", 10) + 1;
    props.setProperty("BACKFILL_CONSECUTIVE_FAILURES", String(consecutiveFailures));

    if (consecutiveFailures >= config.MAX_CONSECUTIVE_FAILURES) {
      props.setProperty("BACKFILL_STATUS", "PAUSED");
      Logger.log(`🛑 Backfill PAUSED after ${consecutiveFailures} failures. Run resumeNAVBackfillAll() to resume.`);
      deleteBackfillTriggers_();
    } else {
      ensureBackfillWorkerTrigger_(35);
    }

  } finally {
    props.setProperty("BACKFILL_WORKER_COMPLETED_AT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
    lock.releaseLock();
  }
}

/**
 * Downloads chunks loop.
 */
function executeChunkDownloadStage_(startTime, config, props, runId, initialCursorDate, endDate) {
  props.setProperty("BACKFILL_CURRENT_STAGE", "DOWNLOADING_CHUNKS");

  const stagingSheet = getOrCreateStagingSheet_();
  const targetFunds = getNAVBackfillFunds_();

  let cursorDate = new Date(initialCursorDate.getTime());
  let completedChunks = parseInt(props.getProperty("BACKFILL_COMPLETED_CHUNKS") || "0", 10);
  let totalStaged = parseInt(props.getProperty("BACKFILL_TOTAL_STAGED") || "0", 10);

  Logger.log(`🚀 NAVBackfillWorker active | Run: ${runId} | Next: ${formatISODate_(cursorDate)} | End: ${formatISODate_(endDate)}`);

  while (cursorDate <= endDate) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= config.EXECUTION_TIME_BUDGET_MS) {
      Logger.log(`⏳ Execution time budget reached (${Math.round(elapsed / 1000)}s). Scheduling continuation.`);
      props.setProperty("BACKFILL_NEXT_DATE", formatISODate_(cursorDate));
      props.setProperty("BACKFILL_WORKER_HEARTBEAT", Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss"));
      ensureBackfillWorkerTrigger_(10);
      return;
    }

    const proposedEnd = addAMFIDays_(cursorDate, config.CHUNK_DAYS - 1);
    const chunkEnd = proposedEnd > endDate ? new Date(endDate.getTime()) : proposedEnd;

    const fromISO = formatISODate_(cursorDate);
    const toISO = formatISODate_(chunkEnd);

    let fetchResult;
    try {
      fetchResult = fetchAMFIHistoricalChunkReport_(cursorDate, chunkEnd);
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err);
      Logger.log(`❌ Chunk fetch failed (${fromISO} to ${toISO}): ${errMsg}`);
      throw err;
    }

    const parsed = parseAMFIAllSchemes_(fetchResult.content, targetFunds);
    const newRowsCount = stageChunkRecords_(stagingSheet, runId, parsed.recordsByScheme, fromISO, toISO);
    SpreadsheetApp.flush();

    cursorDate = addAMFIDays_(chunkEnd, 1);
    completedChunks++;
    totalStaged += newRowsCount;

    const nowStr = Utilities.formatDate(new Date(), config.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    props.setProperty("BACKFILL_NEXT_DATE", formatISODate_(cursorDate));
    props.setProperty("BACKFILL_COMPLETED_CHUNKS", String(completedChunks));
    props.setProperty("BACKFILL_TOTAL_STAGED", String(totalStaged));
    props.setProperty("BACKFILL_LAST_SUCCESSFUL_CHUNK", `${fromISO} to ${toISO}`);
    props.setProperty("BACKFILL_LAST_SUCCESSFUL_CHUNK_AT", nowStr);
    props.setProperty("BACKFILL_WORKER_HEARTBEAT", nowStr);
    props.setProperty("BACKFILL_CONSECUTIVE_FAILURES", "0");
    props.setProperty("BACKFILL_LAST_ERROR", "");

    Logger.log(`✅ Chunk ${completedChunks} saved (${fromISO} to ${toISO}): +${newRowsCount} records staged across 10 funds.`);
  }

  // Chunks complete! Proceed directly to final merge
  runNAVBackfillFinalMerge(false);
}

/**
 * Consolidated wrapper for backward compatibility.
 */
function fetchLast1YearNAVFromHistoryModular(schemeCode, mfCode, sheetName) {
  Logger.log("ℹ️ fetchLast1YearNAVFromHistoryModular() is superseded by the consolidated multi-scheme backfill.");
  Logger.log("Please use runNAVBackfillFinalMerge() or resumeNAVBackfillAll().");
  return getNAVBackfillStatus();
}


/* ======================================================================================
   SECTION 9: INVESTMENT ALERTS, SUMMARY & CHARTS (PRESERVED & WORKING)
   ====================================================================================== */

/**
 * Robust check function — returns a structured object (never a raw string).
 * Percent diff is computed w.r.t 10-day high (when down) or yesterday (when up).
 */
function checkNAVAlertModular(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return { sheetName: sheetName, error: `Sheet '${sheetName}' not found.` };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 11) {
    return {
      sheetName: sheetName,
      error: "Not enough data (need 10 days)."
    };
  }

  const lastNAV = sheet.getRange(lastRow, 2).getValue();
  const prevNAV = sheet.getRange(lastRow - 1, 2).getValue();

  const recentNAVs = sheet.getRange(lastRow - 9, 2, 10, 1).getValues().flat();
  const high10 = Math.max(...recentNAVs);
  const low10 = Math.min(...recentNAVs);

  let percent;
  let tag = "";
  let status = "";

  if (lastNAV > prevNAV) {
    percent = ((lastNAV - prevNAV) / prevNAV) * 100;
  } else {
    percent = ((lastNAV - high10) / high10) * 100;
  }

  if (!percent || isNaN(percent)) {
    percent = 0;
  }

  const absPct = Math.abs(percent);

  if (percent < 0) {
    if (absPct < 1) {
      tag = "🟧 WATCH";
      status = "Slight down movement";
    } else if (absPct < 2) {
      tag = "🟠 FALLING";
      status = "Medium down movement";
    } else {
      tag = "🔴 BUY";
      status = "Good buying opportunity";
    }
  } else {
    if (percent < 1) {
      tag = "🟩 STABLE";
      status = "Normal rise";
    } else if (percent < 2) {
      tag = "🟢 STRONG";
      status = "Strong rise";
    } else {
      tag = "🟢📈 VERY STRONG";
      status = "Momentum rising fast";
    }
  }

  const avgInfo = getAverageBuyNAV(sheetName);
  let avgDiffPct = null;
  if (avgInfo && avgInfo.avgBuyNAV) {
    avgDiffPct = ((lastNAV - avgInfo.avgBuyNAV) / avgInfo.avgBuyNAV) * 100;
  }

  return {
    sheetName,
    lastNAV,
    high10,
    low10,
    percentValue: percent,
    percentDisplay: `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`,
    tag,
    status,
    severity: (percent < 0 && Math.abs(percent) > 2)
      ? "alert"
      : (percent < 0)
        ? "warning"
        : "ok",
    includeChart: (
      tag === "🔴 BUY" ||
      tag === "🟢📈 VERY STRONG" ||
      tag === "🟢 STRONG"
    ),
    avgBuyNAV: avgInfo ? avgInfo.avgBuyNAV : null,
    avgDiffPct: avgDiffPct
  };
}

/**
 * Safe wrapper so FinalCallDaily_HTML never receives undefined and exceptions are caught.
 */
function safeCheck(sheetName) {
  try {
    const res = checkNAVAlertModular(sheetName);
    if (!res) return { sheetName, error: "Unknown error (null result)" };
    return res;
  } catch (e) {
    return { sheetName, error: "Exception: " + (e && e.toString ? e.toString() : e) };
  }
}

/**
 * Sheet-embedded line chart for last 30 NAV points.
 */
function createNAVChart(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Sheet '${sheetName}' not found!`);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("❌ Not enough data to plot chart.");
    return;
  }

  const chartDataCount = 30;
  const availableDataRows = lastRow - 1;
  const dataPoints = Math.min(chartDataCount, availableDataRows);
  const startRow = lastRow - dataPoints + 1;

  const navValues = sheet.getRange(startRow, 2, dataPoints, 1).getValues().flat();
  const minNAV = Math.min(...navValues);
  const maxNAV = Math.max(...navValues);

  const yMin = (minNAV * 0.99).toFixed(2);
  const yMax = (maxNAV * 1.01).toFixed(2);

  const charts = sheet.getCharts();
  for (let chart of charts) {
    sheet.removeChart(chart);
  }

  const chartRange = sheet.getRange(startRow, 1, dataPoints + 1, 2);

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(chartRange)
    .setPosition(1, 7, 0, 0)
    .setOption('title', 'NAV Over Time (Last 30)')
    .setOption('hAxis.title', 'Date')
    .setOption('vAxis.title', 'NAV (₹)')
    .setOption('curveType', 'function')
    .setOption('pointSize', 5)
    .setOption('width', 700)
    .setOption('height', 400)
    .setOption('vAxis.viewWindowMode', 'explicit')
    .setOption('vAxis.viewWindow', { min: parseFloat(yMin), max: parseFloat(yMax) })
    .build();

  sheet.insertChart(chart);
  Logger.log(`📊 Chart created with Y-axis ₹${yMin} to ₹${yMax}`);
}

/**
 * Sheet-embedded pie chart for invested amount vs profit/loss.
 */
function createInvestmentPieChart(sheetName, position) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Sheet '${sheetName}' not found!`);
    return;
  }

  const summary = getFundSummary(sheetName);
  if (!summary) return;

  const { totalInvested, currentValue, profitLoss } = summary;

  const result = [
    ["Label", "Amount", { role: "annotation" }],
    ["Total Invested", totalInvested, `₹${totalInvested.toFixed(2)}`],
    [profitLoss >= 0 ? "Profit" : "Loss", Math.abs(profitLoss), `₹${Math.abs(profitLoss).toFixed(2)}`]
  ];

  const chartRange = sheet.getRange("J1:L3");
  chartRange.clearContent();
  chartRange.setValues(result);

  const charts = sheet.getCharts();
  charts.forEach(chart => {
    const ranges = chart.getRanges();
    const usesJ2L3 = ranges.some(r => r.getA1Notation() === "J2:L3");
    if (usesJ2L3) {
      sheet.removeChart(chart);
      Logger.log("🗑️ Old investment pie chart deleted.");
    }
  });

  const sliceColors = {
    0: { color: '#4285F4' },
    1: { color: profitLoss >= 0 ? '#34A853' : '#EA4335' }
  };

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sheet.getRange("J2:L3"))
    .setPosition(position, 7, 0, 0)
    .setOption('title', '💸 Investment Pie: Invested vs Profit/Loss')
    .setOption('pieSliceText', 'value')
    .setOption('legend.position', 'right')
    .setOption('slices', sliceColors)
    .setOption('pieSliceTextStyle', { fontSize: 12, bold: true, color: '#000' })
    .setOption('tooltip.textStyle', { fontSize: 12 })
    .setOption('pieStartAngle', 100)
    .build();

  sheet.insertChart(chart);
  Logger.log(`📊 Pie chart created. Invested: ₹${totalInvested}, P/L: ₹${profitLoss}`);
}

/**
 * Calculate total investment, current valuation, and profit/loss.
 */
function getFundSummary(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`❌ Sheet '${sheetName}' not found.`);
    return null;
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log(`❌ Not enough data in sheet '${sheetName}'.`);
    return null;
  }

  const header = data[0];
  const navCol = header.indexOf("NAV") + 1;
  const amtCol = header.indexOf("Buying Amount") + 1;

  if (navCol === 0 || amtCol === 0) {
    Logger.log(`❌ Required columns missing in '${sheetName}'.`);
    return null;
  }

  const latestNAV = data[data.length - 1][navCol - 1];
  if (!latestNAV) {
    Logger.log(`❌ Latest NAV is missing in '${sheetName}'.`);
    return null;
  }

  let totalInvested = 0;
  let totalUnits = 0;

  for (let i = 1; i < data.length; i++) {
    const nav = data[i][navCol - 1];
    const invested = data[i][amtCol - 1];
    if (invested && nav) {
      totalInvested += invested;
      totalUnits += invested / nav;
    }
  }

  const currentValue = totalUnits * latestNAV;
  return {
    sheetName,
    totalInvested: parseFloat(totalInvested.toFixed(2)),
    currentValue: parseFloat(currentValue.toFixed(2)),
    profitLoss: parseFloat((currentValue - totalInvested).toFixed(2))
  };
}

/**
 * Generate combined portfolio summary sheet and pie chart.
 */
function generateCombinedPieChart(sheetNames) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheetName = "Combined Summary";

  let summarySheet = ss.getSheetByName(targetSheetName);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(targetSheetName);
  } else {
    summarySheet.clear();
  }

  const charts = summarySheet.getCharts();
  charts.forEach(chart => {
    const ranges = chart.getRanges();
    const usesSummaryData = ranges.some(range =>
      range.getA1Notation().startsWith("A1") || range.getA1Notation().startsWith("A")
    );
    if (usesSummaryData) {
      summarySheet.removeChart(chart);
    }
  });

  summarySheet.getRange("A1:D1").setValues([["Fund Name", "Invested Amount", "Current Value", "Profit / Loss"]]);

  const summaryData = [];
  let totalInvested = 0;
  let totalCurrentValue = 0;

  for (let name of sheetNames) {
    const summary = getFundSummary(name);
    if (summary) {
      summaryData.push([summary.sheetName, summary.totalInvested, summary.currentValue, summary.profitLoss]);
      totalInvested += summary.totalInvested;
      totalCurrentValue += summary.currentValue;
    }
  }

  const totalProfitLoss = totalCurrentValue - totalInvested;

  if (summaryData.length > 0) {
    const rowCount = summaryData.length + 1;
    summarySheet.getRange(2, 1, summaryData.length, 4).setValues(summaryData);

    const valueChartRange = summarySheet.getRange(`A1:C${rowCount}`);
    const chart1 = summarySheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(valueChartRange)
      .setPosition(1, 1, 0, 0)
      .setOption('title', 'Current Value Distribution')
      .build();
    summarySheet.insertChart(chart1);

    const isProfit = totalProfitLoss >= 0;
    const profitLossLabel = isProfit ? "Profit" : "Loss";
    const profitLossValue = parseFloat(Math.abs(totalProfitLoss).toFixed(2));
    const totalInvestedValue = parseFloat(totalInvested.toFixed(2));

    const summaryChartData = [
      ["Label", "Amount", { role: "annotation" }],
      ["Total Invested", totalInvestedValue, `₹${totalInvestedValue}`],
      [profitLossLabel, profitLossValue, `₹${profitLossValue}`]
    ];

    const chartDataRange = summarySheet.getRange("E1:G3");
    chartDataRange.setValues(summaryChartData);
    const plRow = summarySheet.getRange("E3:F3");
    plRow.setFontColor(isProfit ? "#0F9D58" : "#D93025");
  }

  Logger.log("📊 Combined Summary and Invested vs P/L chart created.");
}

/**
 * Create QuickChart URL for the given sheetName using up to last 30 NAV points.
 */
function createEmailNAVChartURL(sheetName) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    const maxPoints = 30;
    const available = lastRow - 1;
    const count = Math.min(maxPoints, available);
    const startRow = lastRow - count + 1;

    const range = sheet.getRange(startRow, 1, count, 2).getValues();

    const labels = [];
    const data = [];

    for (let i = 0; i < range.length; i++) {
      const dateVal = range[i][0];
      const navVal = range[i][1];

      if (navVal === "" || navVal === null || isNaN(Number(navVal))) {
        continue;
      }

      let labelStr = (dateVal instanceof Date)
        ? Utilities.formatDate(dateVal, "Asia/Kolkata", "yyyy-MM-dd")
        : String(dateVal);

      labels.push(labelStr);
      data.push(Number(navVal));
    }

    if (labels.length === 0 || data.length === 0) return null;

    const minNAV = Math.min(...data);
    const maxNAV = Math.max(...data);

    const config = {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "NAV",
          data: data,
          borderWidth: 2,
          fill: false
        }]
      },
      options: {
        title: { display: true, text: "NAV Over Time (" + labels.length + ")", fontSize: 14 },
        legend: { display: false },
        scales: {
          yAxes: [{
            ticks: { suggestedMin: minNAV * 0.99, suggestedMax: maxNAV * 1.01 }
          }]
        }
      }
    };

    const encoded = encodeURIComponent(JSON.stringify(config));
    return `https://quickchart.io/chart?width=700&height=380&format=png&c=${encoded}`;

  } catch (e) {
    Logger.log("createEmailNAVChartURL ERROR (" + sheetName + "): " + e);
    return null;
  }
}

/**
 * Fetch chart PNG for sheetName and return base64 string suitable for inline email embedding.
 * Uses QuickChart with fallback to Image-Charts.
 */
function createEmailNAVChartBase64(sheetName) {
  function isValidPngBytes_(bytes) {
    if (!bytes || bytes.length < 8) return false;
    return (
      (bytes[0] & 0xFF) === 0x89 &&
      (bytes[1] & 0xFF) === 0x50 &&
      (bytes[2] & 0xFF) === 0x4E &&
      (bytes[3] & 0xFF) === 0x47
    );
  }

  function encodeSmallPng_(bytes, name) {
    if (!isValidPngBytes_(bytes)) {
      Logger.log("Invalid PNG image: " + name);
      return null;
    }

    const base64 = Utilities.base64Encode(bytes).replace(/\r?\n/g, "");
    if (base64.length > 35 * 1024) {
      Logger.log("Chart too large for email: " + name);
      return null;
    }

    return base64;
  }

  try {
    const url = createEmailNAVChartURL(sheetName);
    if (!url) return null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const resp = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      const bytes = resp.getContent();
      if (resp.getResponseCode() === 200) {
        const base64 = encodeSmallPng_(bytes, sheetName);
        if (base64) {
          Logger.log("Valid QuickChart PNG: " + sheetName);
          return base64;
        }
      }

      Logger.log(`QuickChart attempt ${attempt} failed for ${sheetName}`);
    }

    Logger.log("Using fallback chart: " + sheetName);
    const fallbackBytes = createGoogleChartsImage(sheetName);
    const fallbackBase64 = encodeSmallPng_(fallbackBytes, sheetName);
    if (fallbackBase64) {
      return fallbackBase64;
    }

    Logger.log("Both chart providers failed: " + sheetName);
    return null;

  } catch (e) {
    Logger.log("ChartBase64 ERROR for " + sheetName + ": " + e);
    return null;
  }
}

/**
 * Fallback chart generator using Image-Charts.
 */
function createGoogleChartsImage(sheetName) {
  try {
    const points = getLast30DaysNAV(sheetName);
    if (!points || points.length === 0) {
      Logger.log("createGoogleChartsImage: No points for " + sheetName);
      return null;
    }

    const data = points.map(p => p.nav);
    const labels = points.map(p => p.date);

    const chd = "t:" + data.join(",");
    const chl = labels.join("|");

    const params = {
      cht: "lc",
      chs: "600x300",
      chd: chd,
      chl: chl,
      chco: "0000FF"
    };

    const query = Object.keys(params)
      .map(k => k + "=" + encodeURIComponent(params[k]))
      .join("&");

    const url = "https://image-charts.com/chart?" + query;

    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
    });

    if (resp.getResponseCode() !== 200) {
      Logger.log("createGoogleChartsImage: Image-Charts failed code " + resp.getResponseCode());
      return null;
    }

    return resp.getContent();
  } catch (e) {
    Logger.log("createGoogleChartsImage ERROR for " + sheetName + ": " + e);
    return null;
  }
}

/**
 * Returns last up to 30 NAV points from the sheet as [{ date: "yyyy-MM-dd", nav: number }].
 */
function getLast30DaysNAV(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("getLast30DaysNAV: sheet not found " + sheetName);
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("getLast30DaysNAV: no NAV data for " + sheetName);
    return [];
  }

  const maxPoints = 30;
  const available = lastRow - 1;
  const count = Math.min(maxPoints, available);
  const startRow = lastRow - count + 1;

  const rows = sheet.getRange(startRow, 1, count, 2).getValues();
  const out = [];

  for (let i = 0; i < rows.length; i++) {
    const dateVal = rows[i][0];
    const navVal = rows[i][1];

    if (navVal === "" || navVal === null || isNaN(Number(navVal))) continue;

    const dateStr = (dateVal instanceof Date)
      ? Utilities.formatDate(dateVal, "Asia/Kolkata", "yyyy-MM-dd")
      : String(dateVal);

    out.push({
      date: dateStr,
      nav: Number(navVal)
    });
  }

  return out;
}

/**
 * Validate chart data arrays.
 */
function validateChartData(labels, data, sheetName) {
  if (!labels || !data) return false;
  if (labels.length !== data.length) return false;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === "" || data[i] === null || isNaN(data[i])) return false;
  }
  return true;
}

/**
 * Calculate average purchase NAV from sheet's "NAV" and "Buying Amount" columns.
 */
function getAverageBuyNAV(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  const header = data[0];
  const navCol = header.indexOf("NAV");
  const amtCol = header.indexOf("Buying Amount");

  if (navCol === -1 || amtCol === -1) return null;

  let totalInvested = 0;
  let totalUnits = 0;

  for (let i = 1; i < data.length; i++) {
    const nav = data[i][navCol];
    const amt = data[i][amtCol];

    if (nav && amt && !isNaN(nav) && !isNaN(amt)) {
      totalInvested += amt;
      totalUnits += amt / nav;
    }
  }

  if (totalUnits === 0) return null;

  return {
    avgBuyNAV: totalInvested / totalUnits,
    totalInvested,
    totalUnits
  };
}


/* ======================================================================================
   SECTION 10: NON-DESTRUCTIVE DIAGNOSTIC / TEST HELPERS
   ====================================================================================== */

/**
 * Non-destructive Test: Verify historical parser on confirmed HDFC sample record.
 */
function testNAVBackfillParser() {
  const sampleHeader = "Scheme Code;NAV Name;Plan;Option;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Date";
  const sampleData = "118989;HDFC Mid Cap Fund - Growth Option - Direct Plan;Direct Plan;Growth Option;INF179K01XQ0;;220.638;27-Apr-2026";
  const content = sampleHeader + "\n" + sampleData;

  const parsed = parseAMFIAllSchemes_(content);
  const hdfc = parsed.recordsByScheme["118989"] ? parsed.recordsByScheme["118989"]["2026-04-27"] : null;

  Logger.log("PARSER TEST RESULT:");
  Logger.log("Header Found: " + parsed.headerFound);
  Logger.log("Total Records: " + parsed.totalRecords);
  Logger.log("HDFC 2026-04-27: " + JSON.stringify(hdfc));

  if (hdfc && hdfc.nav === 220.638 && hdfc.dateISO === "2026-04-27") {
    Logger.log("✅ PARSER TEST PASSED");
  } else {
    Logger.log("❌ PARSER TEST FAILED");
  }
}

/**
 * Non-destructive Test: Test a single 7-day chunk live fetch without modifying fund sheets.
 */
function testNAVBackfillSingleChunk() {
  const fromDate = new Date(2026, 3, 27); // 27-Apr-2026
  const toDate = new Date(2026, 4, 3);    // 03-May-2026

  Logger.log("Testing 7-day AMFI fetch (27-Apr-2026 to 03-May-2026)...");
  const report = fetchAMFIHistoricalChunkReport_(fromDate, toDate);
  const parsed = parseAMFIAllSchemes_(report.content);

  Logger.log("Fetch Status: OK | Size: " + report.content.length);
  Logger.log("Total Records Extracted across 10 funds: " + parsed.totalRecords);

  const funds = getNAVBackfillFunds_();
  funds.forEach(f => {
    const count = Object.keys(parsed.recordsByScheme[f.schemeCode] || {}).length;
    Logger.log(`  ${f.schemeCode} (${f.sheetName}): ${count} records`);
  });

  Logger.log("✅ 7-DAY SINGLE CHUNK TEST COMPLETE (Fund sheets were not modified)");
}
