/* --------------------------------------------------------------------------------------
   EMAIL BUILDERS (Text + HTML)
   Accept array of structured objects from checkNAVAlertModular
   -------------------------------------------------------------------------------------- */

function buildNAVEmailText(results) {
  const lines = [];
  lines.push("Mutual Fund NAV Daily Report");
  lines.push("Generated: " + Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm"));
  lines.push("");

  results.forEach(r => {
    if (!r) return;
    if (r.error) {
      lines.push(`${r.sheetName}: ERROR - ${r.error}`);
      lines.push("");
      return;
    }
    const lastNAV = (typeof r.lastNAV === "number") ? `₹${r.lastNAV.toFixed(2)}` : "₹-";
    const high10 = (typeof r.high10 === "number") ? `₹${r.high10.toFixed(2)}` : "₹-";
    const low10 = (typeof r.low10 === "number") ? `₹${r.low10.toFixed(2)}` : "₹-";
    const pct = r.percentDisplay || "-";
    let avgTxt = "";
    if (r.avgBuyNAV) {
      avgTxt = ` | Avg Buy: ₹${r.avgBuyNAV.toFixed(2)} (${r.avgDiffPct >= 0 ? "+" : ""}${r.avgDiffPct.toFixed(2)}%)`;
    }

    lines.push(`${r.tag} ${pct} — ${r.sheetName}`);
    lines.push(`NAV Today: ${lastNAV} | 10-day High: ${high10} | 10-day Low: ${low10}${avgTxt}`);
    lines.push(`Status: ${r.status || "-"}`);
    lines.push("");
  });

  lines.push("Powered by Google Apps Script");
  return lines.join("\n");
}

function buildNAVEmailHTML(results, generatedAt) {
  generatedAt = generatedAt || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd HH:mm");

  const style = `
    <style>
      body { margin:0; padding:0; font-family: Roboto, Arial, sans-serif; background:#f4f6f8; color:#111; }
      .container { max-width:680px; margin:12px auto; padding:12px; }
      .card { background:#fff; border-radius:10px; margin-bottom:12px; padding:14px; box-shadow:0 2px 5px rgba(0,0,0,0.08); }
      .fund-name { font-weight:700; font-size:16px; }
      .muted { color:#666; font-size:12px; margin-top:2px; }
      .status-badge { font-size:12px; padding:6px 8px; border-radius:6px; font-weight:700; margin-left:6px; display:inline-block; }
      .status-alert { background:#d93025; color:white; }
      .status-warning { background:#fb8c00; color:white; }
      .status-ok { background:#0f9d58; color:white; }
      .status-info { background:#e0e0e0; color:#333; }

      .diff-pill { font-size:13px; padding:6px 12px; border-radius:20px; font-weight:800; margin-left:8px; display:inline-block; }
      .diff-negative-deep { background:#b00020; color:white; }
      .diff-negative-mid { background:#d93025; color:white; }
      .diff-negative-small { background:#fb8c00; color:white; }
      .diff-positive-small { background:#8bc34a; color:white; }
      .diff-positive-mid { background:#2e7d32; color:white; }
      .diff-positive-big { background:#0f9d58; color:white; }

      .avg-pill {
        font-size:13px;
        padding:6px 12px;
        border-radius:20px;
        font-weight:800;
        margin-left:8px;
        display:inline-block;
      }
      .avg-negative-deep { background:#b00020; color:white; }
      .avg-negative-mid  { background:#d93025; color:white; }
      .avg-negative-small{ background:#fb8c00; color:white; }
      .avg-positive-small{ background:#8bc34a; color:white; }
      .avg-positive-mid  { background:#2e7d32; color:white; }
      .avg-positive-big  { background:#0f9d58; color:white; }

      .small { font-size:13px; color:#444; margin-top:8px; }
      .meta-line { font-size:13px; color:#555; margin-top:6px; }

      @media screen and (max-width:420px) {
        .container { padding:8px; }
        .fund-name { font-size:15px; }
      }
    </style>
  `;

  function statusClass(sev) {
    if (sev === "alert") return "status-badge status-alert";
    if (sev === "warning") return "status-badge status-warning";
    if (sev === "ok") return "status-badge status-ok";
    return "status-badge status-info";
  }

  function diffClass(r) {
    const v = r.percentValue;
    if (v <= -2) return "diff-pill diff-negative-deep";
    if (v < -1) return "diff-pill diff-negative-mid";
    if (v < 0) return "diff-pill diff-negative-small";
    if (v < 1) return "diff-pill diff-positive-small";
    if (v < 2) return "diff-pill diff-positive-mid";
    return "diff-pill diff-positive-big";
  }

  function avgDiffClass(pct) {
    if (pct <= -5) return "avg-pill avg-negative-deep";
    if (pct < -2) return "avg-pill avg-negative-mid";
    if (pct < 0) return "avg-pill avg-negative-small";
    if (pct < 2) return "avg-pill avg-positive-small";
    if (pct < 5) return "avg-pill avg-positive-mid";
    return "avg-pill avg-positive-big";
  }

  const cardsHtml = results.map(r => {
    if (!r) return "";
    if (r.error) {
      return `<div class="card"><div class="fund-name">${escapeHtml(r.sheetName)}</div><div class="muted">ERROR: ${escapeHtml(r.error)}</div></div>`;
    }

    const tagHtml = `<span class="${statusClass(r.severity)}">${escapeHtml(r.tag)}</span>`;
    const diffHtml = `<span class="${diffClass(r)}">${escapeHtml(r.percentDisplay)}</span>`;

    let avgPillHtml = "";
    if (typeof r.avgDiffPct === "number" && r.avgBuyNAV) {
      avgPillHtml = `
        <span class="${avgDiffClass(r.avgDiffPct)}">
          Avg Buy ${r.avgDiffPct >= 0 ? "+" : ""}${r.avgDiffPct.toFixed(2)}%
        </span>
      `;
    }

    const meta = `NAV: ₹${r.lastNAV.toFixed(2)} • 10-day High: ₹${r.high10.toFixed(2)} • 10-day Low: ₹${r.low10.toFixed(2)}`;

    return `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="flex:1; min-width:0;">
            <div class="fund-name">${escapeHtml(r.sheetName)}</div>
            <div class="muted">${escapeHtml(r.status)}</div>
          </div>
          <div style="white-space:nowrap; text-align:right;">
            ${tagHtml}
            ${diffHtml}
            ${avgPillHtml}
          </div>
        </div>

        <div class="meta-line">${escapeHtml(meta)}</div>

        ${r.chartBase64
          ? `<img src="data:image/png;base64,${r.chartBase64}" alt="Image" style="width:100%;max-width:100%;border-radius:8px;margin-top:10px;">`
          : (r.chartUrl
            ? `<div style="margin-top:10px;font-size:13px;color:#666;">
                 Chart not embedded (email client limits). <a href="${escapeHtml(r.chartUrl)}" target="_blank" style="color:#1a73e8;text-decoration:none;">Open chart in browser</a>
               </div>`
            : `<div style="margin-top:10px;font-size:13px;color:#999;">No chart available</div>`
          )
        }
      </div>
    `;
  }).join("");

  const html = `
    <!doctype html>
    <html>
      <head>${style}</head>
      <body>
        <div class="container">
          <div style="margin-bottom:12px;">
            <div style="font-size:20px; font-weight:700;">📊 Mutual Fund NAV Daily Report</div>
            <div style="font-size:12px; color:#666;">Generated: ${escapeHtml(generatedAt)}</div>
          </div>

          ${cardsHtml}

          <div style="text-align:center; font-size:12px; color:#888; margin-top:18px;">Powered by Google Apps Script</div>
        </div>
      </body>
    </html>
  `;
  return html;
}

function escapeHtml(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/* --------------------------------------------------------------------------------------
   MASTER DAILY TRIGGER FUNCTION:
   - Gathers all 10 mutual funds from getNAVBackfillFunds_()
   - Fetches today's NAV via single HTTP request to AMFI NAVAll.txt
   - Updates NAV rows (fetchDailyNAV_FAST)
   - Evaluates alerts (safeCheck)
   - Attaches chart URLs / inline Base64 images
   - Sends HTML summary email
   - Updates investment charts & combined portfolio summary
   -------------------------------------------------------------------------------------- */

function FinalCallDaily_HTML() {
  // Centralized fund mapping from getNAVBackfillFunds_()
  const funds = getNAVBackfillFunds_();
  const schemeCodes = {};
  funds.forEach(f => {
    schemeCodes[f.sheetName] = f.schemeCode;
  });

  const sheetNames = Object.keys(schemeCodes);
  const seen = new Set();
  const results = [];

  // Fetch latest AMFI daily feed ONCE for all requested schemes
  let amfiMap;
  try {
    amfiMap = getAMFINAVMap_FAST(Object.values(schemeCodes));
  } catch (e) {
    Logger.log("❌ AMFI FETCH/PARSING FAILED: " + (e && e.stack ? e.stack : e));
    amfiMap = null;
  }

  for (const name of sheetNames) {
    if (!name || seen.has(name)) continue;
    seen.add(name);

    const schemeCode = schemeCodes[name];

    // 1. FAST NAV update (only if AMFI data available)
    if (schemeCode && amfiMap) {
      try {
        fetchDailyNAV_FAST(schemeCode, name, amfiMap);
      } catch (e) {
        Logger.log(`fetchDailyNAV_FAST error for ${name}: ${e}`);
      }
    }

    // 2. ALWAYS run alert checks
    const res = safeCheck(name);
    results.push(res);
  }

  // Filter out empty/uninitialized entries
  const finalResults = results.filter(
    r => r && !(r.error && r.error.indexOf("Not enough data") === 0 && !r.lastNAV)
  );

  // Attach chart URLs and controlled Base64 inline images
  const MAX_INLINE_CHARTS = 2;
  let inlineChartCount = 0;

  finalResults.forEach(r => {
    try {
      r.chartUrl = createEmailNAVChartURL(r.sheetName);
      r.chartBase64 = null;

      if (r.includeChart && inlineChartCount < MAX_INLINE_CHARTS) {
        const base64 = createEmailNAVChartBase64(r.sheetName);
        if (base64) {
          r.chartBase64 = base64;
          inlineChartCount++;
        }
      }
    } catch (e) {
      r.chartBase64 = null;
      Logger.log("Chart generation failed for " + r.sheetName + ": " + e);
    }
  });

  // Build and send email
  const textBody = buildNAVEmailText(finalResults);
  const htmlBody = buildNAVEmailHTML(finalResults);

  MailApp.sendEmail({
    to: "atharvades003@gmail.com",
    cc: "rmdeshmukh09@gmail.com,omdeshmukh07@gmail.com",
    subject: "📊 Mutual Fund NAV Daily Summary",
    htmlBody: htmlBody,
    body: textBody
  });

  Logger.log("📧 Final HTML summary email sent.");

  // Post-email chart creation
  try {
    for (let i in sheetNames) {
      createInvestmentPieChart(sheetNames[i], 21);
    }
    generateCombinedPieChart(sheetNames);
  } catch (e) {
    Logger.log("generateCombinedPieChart error: " + e);
  }
}


/* --------------------------------------------------------------------------------------
   DIAGNOSTIC & TEST FUNCTIONS
   -------------------------------------------------------------------------------------- */

function testSendChartOnly() {
  const config = {
    type: "line",
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      datasets: [{
        label: "Sales",
        data: [10, 20, 15, 25, 30],
        borderWidth: 2,
        fill: false
      }]
    },
    options: {
      title: { display: true, text: "Weekly Sales", fontSize: 16 },
      legend: { display: false }
    }
  };

  const chartUrl = "https://quickchart.io/chart?width=600&height=300&format=png&c=" +
    encodeURIComponent(JSON.stringify(config));

  const response = UrlFetchApp.fetch(chartUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error("QuickChart error: " + response.getContentText());
  }

  const bytes = response.getContent();
  const base64 = Utilities.base64Encode(bytes);

  const html = `
    <div style="text-align:center;">
      <img src="data:image/png;base64,${base64}" style="max-width:100%;width:600px;border:1px solid #ccc;border-radius:8px;">
    </div>
  `;

  GmailApp.sendEmail(
    "atharvades003@gmail.com",
    "Chart Test",
    "Your email client does not support HTML.",
    { htmlBody: html }
  );
}

function testAMFINAVFeed() {
  const codes = getNAVBackfillFunds_().map(f => f.schemeCode);
  const map = getAMFINAVMap_FAST(codes);

  codes.forEach(code => {
    const item = map[code];
    Logger.log(
      code + " => " +
      (item ? item.date + " | NAV: ₹" + item.nav : "NOT FOUND")
    );
  });
}

function testUpdateAllNAVSheets() {
  const funds = getNAVBackfillFunds_();
  const schemeCodes = {};
  funds.forEach(f => {
    schemeCodes[f.sheetName] = f.schemeCode;
  });

  const amfiMap = getAMFINAVMap_FAST(Object.values(schemeCodes));

  for (const [name, code] of Object.entries(schemeCodes)) {
    try {
      const result = fetchDailyNAV_FAST(code, name, amfiMap);
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
      const lastRow = sheet ? sheet.getLastRow() : 0;
      const latest = (sheet && lastRow >= 2)
        ? sheet.getRange(lastRow, 1, 1, 2).getValues()[0]
        : ["No data", "No data"];

      Logger.log(
        name +
        " | Result: " + JSON.stringify(result) +
        " | Latest row: " + latest.join(" / ")
      );
    } catch (e) {
      Logger.log("FAILED: " + name + " | " + e);
    }
  }

  Logger.log("NAV UPDATE TEST COMPLETED");
}
