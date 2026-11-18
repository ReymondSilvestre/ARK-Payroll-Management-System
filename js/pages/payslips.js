/* ============================================================
   PAYSLIPS tab - saved runs and the printable payslip.
   File: js/pages/payslips.js
   ============================================================ */

/* ---------- Payslips ---------- */
async function slips() {
  const runs = ST.runs.slice().reverse(), byP = {}; runs.forEach((r) => (byP[r.period] ||= []).push(r));
  if (!runs.some((r) => r.id === ST.slipRun)) ST.slipRun = runs.length ? runs[0].id : "";
  const lab = (r) => `${(SECS.find((x) => x[0] === r.group) || [0, "All"])[1]}${r.status === "Draft" ? " [DRAFT]" : ""} (${r.id})`;
  V(`<div class="card noprint"><div class="row"><div><label>Payroll run (per cut-off)</label><select id="sr">${Object.entries(byP).map(([p, L]) => `<optgroup label="${esc(p)}">${L.map((r) => `<option value="${esc(r.id)}" ${r.id === ST.slipRun ? "selected" : ""}>${esc(lab(r))}</option>`).join("")}</optgroup>`).join("") || '<option value="">No payroll saved yet</option>'}</select></div><button class="btn" id="pr">Print</button><button class="btn" id="sm">${ST.slipMode === "sum" ? "Show payslips" : "Summary sheet"}</button><button class="btn" id="sx">Summary (Excel)</button><button class="btn d" id="dr">Delete run</button></div><p class="muted">Choose a payroll run: its payslips are shown automatically below, one cut-off at a time.</p></div><div id="ps"></div>`);
  const show = async () => {
    const id = $("#sr").value; ST.slipRun = id; if (!id) { $("#ps").innerHTML = ""; return; }
    const run = ST.runs.find((r) => r.id === id), L = await api("getRun", { id }), sg = ST.settings.signatories || [];
    if ($("#sr").value !== id) return;   // another run was chosen while loading
    ST._slipL = L; ST._slipRunObj = run;
    if (ST.slipMode === "sum") { $("#ps").innerHTML = sumHTML(L, run, sg); return; }
    $("#ps").innerHTML = (run.status === "Draft" ? '<div class="card noprint"><b style="color:#8a5a00">DRAFT</b> - this payroll is not final yet. Open the Payroll tab, press <b>Load saved draft</b> and then <b>Finalize</b>.</div>' : "") + L.map((s) => `<div class="slipset">${slipHTML(s, run, sg, "EMPLOYEE COPY")}<div class="cut">- - - - - - - - cut here - - - - - - - -</div>${slipHTML(s, run, sg, "FINANCE COPY")}</div>`).join("");
  };
  $("#sr").onchange = show;
  $("#sm").onclick = () => { ST.slipMode = ST.slipMode === "sum" ? "slips" : "sum"; $("#sm").textContent = ST.slipMode === "sum" ? "Show payslips" : "Summary sheet"; show(); };
  $("#sx").onclick = async () => { const id = $("#sr").value; if (!id) return toast("Choose a payroll run first.", true); const run = ST.runs.find((r) => r.id === id), L = ST._slipRunObj && ST._slipRunObj.id === id && ST._slipL ? ST._slipL : await api("getRun", { id }), R = sumRows(L); xlsxBook([{ name: "Payslip Summary", header: ["No.", "Employee No", "Employee name", "Salary (net pay)", "Signature"], rows: [...R.rows, ["", "", "TOTAL", R.total, ""]], text: [1] }], `Payslip-Summary-${String(run.period).replace(/[^\w-]+/g, "_")}-${run.group || "all"}.xlsx`); };
  $("#pr").onclick = () => print();
  $("#dr").onclick = async () => { const id = $("#sr").value; if (id && confirm("Delete this payroll run?")) { await api("deleteRun", { id }); ST.runs = ST.runs.filter((r) => r.id !== id); ST.slipRun = ""; slips(); } };
  if (ST.slipRun) show();
}

function slipHTML(s, run, sg, copy) {
  const c = s.calc, e = (ST.employees || []).find((x) => String(x.no) === String(s.no)) || {}, P = (n) => "\u20B1" + money(n), dash = (v) => (v === undefined || v === null || v === "" ? "-" : esc(v));
  const hpd = +(ST.settings && ST.settings.hoursPerDay) || 8, rate = c.perHour ? c.rate : (c.dailyRate ? c.dailyRate / hpd : 0);
  let pd = run.payDate || ""; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(pd)); pd = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(pd); pd = isNaN(pd) ? esc(run.payDate || "-") : pd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const E = [[c.perHour ? `Teaching pay (${fmtHMc(Math.round(c.hours * 60))} hrs x ${P(c.rate)})` : "Basic pay", c.basic]];
  if ((c.allowList || []).length) c.allowList.forEach((a) => a.amount && E.push([(a.label || "Allowance") + (a.count !== undefined ? ` (${a.count} day${a.count === 1 ? "" : "s"} x ${P(a.daily)})` : ""), a.amount])); else if (c.allow) E.push(["Allowances", c.allow]);
  if (c.ot) E.push(["Overtime", c.ot]); if (c.otherEarn) E.push(["Other earnings", c.otherEarn]); if (c.holPay) E.push([c.holFixed ? "Holiday pay (fixed)" : "Holiday pay", c.holPay]); if (c.wfhPay) E.push([c.perHour ? (c.wfhFixed ? "WFH / Async class pay (fixed per day)" : "WFH / Async class pay (per hour)") : "WFH / Async class pay (per day)", c.wfhPay]);
  const D = []; if (c.absent) D.push(["Absences", c.absent]); if (c.late) D.push(["Late" + (c.lateMin ? " (" + fmtHM(c.lateMin) + ")" : ""), c.late]); if (c.holDed) D.push(["Holiday deduction", c.holDed]); if (c.wfhDed) D.push(["WFH / Async deduction", c.wfhDed]);
  D.push(["SSS", c.sssEe], ["PhilHealth", c.phicEe], ["Pag-IBIG", c.hdmfEe], ["Withholding tax", c.tax]); if (c.other) D.push(["Loans / other", c.other]); if (c.caDed) D.push(["Cash advance", c.caDed]);
  const n = Math.max(E.length, D.length, 6); let body = "";
  for (let i = 0; i < n; i++) { const a = E[i], b = D[i]; body += `<tr><td colspan="4">${a ? esc(a[0]) : "&nbsp;"}</td><td colspan="2" class="n">${a ? P(a[1]) : ""}</td><td colspan="4">${b ? esc(b[0]) : ""}</td><td colspan="2" class="n">${b ? P(b[1]) : ""}</td></tr>`; }
  const RL = c.perHour ? ["Rate per hour", "Hours taught (H:MM)", "Days present", "Days absent", "No. of holidays", "Overtime"] : ["Rate per day", "Paid days", "Days present", "Days absent", "No. of holidays", "Overtime"];
  const pres = c.presentDays === null || c.presentDays === undefined ? "-" : c.presentDays;
  const RV = c.perHour ? [P(c.rate), fmtHMc(Math.round(c.hours * 60)), pres, "-", c.holidays || 0, fmtHMd(c.otHours * 60)] : [P(c.dailyRate), c.paidDays, pres, c.absentDays, c.holidays || 0, fmtHMd(c.otHours * 60)];
  const cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}${ST.settings.tax && ST.settings.tax.employerTin ? `<br>Employer TIN: ${esc(ST.settings.tax.employerTin)}` : ""}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">${copy || "EMPLOYEE COPY"}</b></small></div></div>
  <h2>PAYSLIP</h2>
  <table><tr>${cell("Employee", esc(s.name), 5)}${cell("Employee No.", esc(s.no), 4)}${cell("Pay period", esc(run.period), 3)}</tr>
  <tr>${cell("Position", dash(s.position || e.position), 5)}${cell("Department", dash(e.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr>${cell("SSS No.", dash(e.sssNo), 3)}${cell("PhilHealth No.", dash(e.philhealthNo), 3)}${cell("Pag-IBIG No.", dash(e.pagibigNo), 3)}${cell("TIN", dash(e.tin), 3)}</tr>
  <tr>${RL.map((x) => `<th colspan="2">${x}</th>`).join("")}</tr>
  <tr>${RV.map((x) => `<td colspan="2" class="c">${x}</td>`).join("")}</tr>
  <tr><th colspan="4">EARNINGS</th><th colspan="2">Amount</th><th colspan="4">DEDUCTIONS</th><th colspan="2">Amount</th></tr>${body}
  <tr class="tot"><td colspan="4">GROSS PAY</td><td colspan="2" class="n">${P(c.gross)}</td><td colspan="4">TOTAL DEDUCTIONS</td><td colspan="2" class="n">${P(c.totalDed)}</td></tr></table>
  ${(c.caBal > 0 || c.caDed > 0) ? `<table class="ca"><tr><th colspan="12">CASH ADVANCE BALANCE</th></tr><tr>${cell("Balance before this pay", P(c.caBal), 4)}${cell("Deducted this pay", P(c.caDed), 4)}${cell("Remaining balance", P(c.caAfter), 4)}</tr></table>` : ""}
  <div class="net">NET PAY: ${P(c.net)}</div>
  <div class="sg"><div>Received by<i>Employee</i></div>${sg.map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div>
  <div class="dr">${run.status === "Draft" ? "DRAFT - not final. " : ""}Generated ${new Date().toLocaleString("en-US")}</div></div>`;
}


/* ---------- Payslip summary (sign sheet): employee name, salary (net pay) and a Signature column, one page per payroll run ---------- */
function sumRows(L) {
  const rows = L.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((s, i) => [i + 1, s.no, s.name, r2(s.calc.net), ""]);
  return { rows, total: r2(rows.reduce((n, r) => n + r[3], 0)) };
}

function sumHTML(L, run, sg) {
  const grp = (SECS.find((x) => x[0] === run.group) || [0, "All employees"])[1], R = sumRows(L), pd = String(run.payDate || "").slice(0, 10);
  return `<div class="card sumsheet"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}</small></div></div>
  <h2>PAYSLIP SUMMARY</h2><p class="sper">${esc(grp)} &middot; ${esc(run.period)}${pd ? " &middot; Pay date " + esc(pd) : ""}${run.status === "Draft" ? " &middot; <b>DRAFT</b>" : ""}</p>
  <div class="tw"><table class="sumt"><tr><th style="width:3.2rem">No.</th><th>Employee name</th><th class="n" style="width:10rem">Salary (net pay)</th><th style="width:16rem">Signature</th></tr>${R.rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[2])}<br><small class="muted">${esc(r[1])}</small></td><td class="n">&#8369;${money(r[3])}</td><td class="sigc">&nbsp;</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No payslips in this run.</td></tr>'}<tr class="tot"><td colspan="2">TOTAL (${R.rows.length} employee${R.rows.length === 1 ? "" : "s"})</td><td class="n">&#8369;${money(R.total)}</td><td></td></tr></table></div>
  <div class="sg">${(sg || []).map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div></div>`;
}
