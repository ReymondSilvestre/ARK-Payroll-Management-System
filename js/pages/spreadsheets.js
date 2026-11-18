/* ============================================================
   SPREADSHEET EXPORTS - attendance logs, summary, cash advances, cash loans, allowances.
   File: js/pages/spreadsheets.js
   ============================================================ */

/* ===================== Spreadsheet sheets: attendance logs, summary, cash advances, cash loans ===================== */
const SHEET_H = {
  logs: ["Date", "Day", "Employee No", "Name", "Department", "Group", "Time in", "Time out", "Hours worked", "Late (min)", "Early in (min)", "Early out (min)", "Overtime (min)", "Status", "Remarks"],
  sum: ["Employee No", "Name", "Department", "Group", "From", "To", "Schedule", "Days present", "Days absent", "Half days", "Late (days)", "Late (min)", "Early in (days)", "Early in (min)", "Early out (days)", "Overtime (hrs)", "Hours worked", "Overtime allowed"],
  adv: ["Employee No", "Name", "Department", "Group", "Outstanding balance", "Deduct each pay", "As of"],
  loan: ["Employee No", "Name", "Department", "Group", "Loan type", "Description", "Per month", "Balance", "Status", "As of"],
  alw: ["Employee No", "Name", "Department", "Group", "Allowance", "Amount", "Per", "Monthly amount", "Taxable", "As of"],
};

const groupName = (e) => (CATEGORIES.find((c) => c.key === categoryOf(e)) || {}).short || "";

function sheetRange() { const D = ST.dtr || {}, dates = Object.keys(D.days || {}).flatMap((i) => Object.keys(D.days[i])).sort(); return { from: D.from || dates[0] || "", to: D.to || dates[dates.length - 1] || "" }; }

function allSheets(from, to) {
  const logs = [], sum = [], adv = [], loan = [], alw = [], today = new Date().toISOString().slice(0, 10);
  if (from && to) {
    phEnsure(+from.slice(0, 4)); phEnsure(+to.slice(0, 4));
    ST.employees.forEach((e) => {
      if (!daysOf(e)) return; const c = dtrCalc(e, from, to), sc = schedOf(e);
      c.rows.forEach((r) => {
        const has = r.inn !== null || r.out !== null; if (!has && !r.wd && !r.isH) return;
        const st = r.st === "absent" ? "Absent" : r.st === "half" ? "Half day" : r.leave ? "Leave" : r.isH && !has ? "Holiday" : r.isW && !has ? "WFH / Async" : r.late ? "Late" : has ? "Present" : "";
        logs.push([r.d, new Date(r.d + "T12:00").toLocaleDateString("en-US", { weekday: "short" }), e.no, nameOf(e), e.dept || "", groupName(e), hm(r.inn), hm(r.out), Math.round(r.hrs * 100) / 100, r.late || 0, r.early || 0, r.earlyOut || 0, r.ot || 0, st, r.note || ""]);
      });
      sum.push([e.no, nameOf(e), e.dept || "", groupName(e), from, to, ([...c.scheds].join(" / ") || hm(sc.S0) + " - " + hm(sc.E0)), c.present, c.absent, c.half, c.lateDays, c.late, c.earlyDays, c.early, c.earlyOutDays, Math.round(c.ot * 100) / 100, c.hrs, otAllowed(e) ? "Yes" : "No"]);
    });
  }
  ST.employees.forEach((e) => {
    const ca = e.ca || {}; if (+ca.balance > 0 || +ca.perPay > 0) adv.push([e.no, nameOf(e), e.dept || "", groupName(e), +ca.balance || 0, +ca.perPay || 0, today]);
    (e.deductions || []).forEach((d) => { const tr = d.balance !== undefined && d.balance !== "" && d.balance !== null, b = tr ? +d.balance || 0 : ""; loan.push([e.no, nameOf(e), e.dept || "", groupName(e), d.type || "", d.label || "", +d.amount || 0, b, tr ? (b > 0 ? "Active" : "Paid") : "No balance tracked", today]); });
    (e.allowances || []).forEach((a) => { const amt = +a.amount || 0; alw.push([e.no, nameOf(e), e.dept || "", groupName(e), a.label || "", amt, a.perDay ? "Per day" : "Per month", allowMonthly(a, ST.settings), a.taxable === false ? "No" : "Yes", today]); });
  });
  return [{ name: "Daily Attendance Logs", header: SHEET_H.logs, rows: logs, text: [0, 2, 6, 7] }, { name: "Summary of Attendance", header: SHEET_H.sum, rows: sum, text: [0, 4, 5, 6] },
    { name: "Cash Advances", header: SHEET_H.adv, rows: adv, text: [0, 6] }, { name: "Cash Loans", header: SHEET_H.loan, rows: loan, text: [0, 9] }, { name: "Allowances", header: SHEET_H.alw, rows: alw, text: [0, 9] }];
}

function xlsxBook(sheets, file) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sh) => { const ws = XLSX.utils.aoa_to_sheet([sh.header, ...sh.rows]); ws["!cols"] = sh.header.map((h, i) => ({ wch: Math.min(38, Math.max(String(h).length + 2, ...sh.rows.slice(0, 300).map((r) => String(r[i] ?? "").length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31)); });
  XLSX.writeFile(wb, file);
}

const sendSheets = async (sheets) => { await api("saveSheets", { sheets }); toast("Google Sheet updated: " + sheets.map((x) => x.name).join(", ") + "."); };

function sheetsCard() {
  const R = sheetRange();
  return `<div class="card noprint"><h3>Attendance, cash advances, cash loans and allowances (separate sheets)</h3><p class="muted">Five sheets: Daily Attendance Logs, Summary of Attendance, Cash Advances, Cash Loans and Allowances. The attendance sheets are read from the uploaded biometrics for the dates below.</p>
  <div class="row"><div><label>From</label><input type="date" id="sh_f" value="${R.from}"></div><div><label>To</label><input type="date" id="sh_t" value="${R.to}"></div><button class="btn p" id="sh_x">Download Excel (5 sheets)</button><button class="btn" id="sh_g">Update Google Sheet</button></div></div>`;
}

function sheetsInit() {
  const get = () => { const f = $("#sh_f").value, t = $("#sh_t").value; if (!f || !t || f > t) { toast("Choose the From and To dates.", true); return null; } return allSheets(f, t); };
  $("#sh_x").onclick = () => { const x = get(); if (x) xlsxBook(x, `ARK-Attendance-Cash-${$("#sh_f").value}_to_${$("#sh_t").value}.xlsx`); };
  $("#sh_g").onclick = async () => { const x = get(); if (x) try { await sendSheets(x); } catch (e) { } };
}

