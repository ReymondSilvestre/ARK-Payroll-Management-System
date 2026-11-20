/* ============================================================
   REPORTS tab.
   File: js/pages/reports.js
   ============================================================ */

/* ---------- Reports ---------- */
function rep() {
  V(`<div class="card"><h3>Reports</h3><div class="row"><div><label>Payroll run</label><select id="sr">${ST.runs.slice().reverse().map((r) => `<option value="${r.id}">${esc(r.period)}</option>`).join("")}</select></div><button class="btn p" id="ld">Show</button><button class="btn" id="xl">Download Excel</button></div></div><div class="card" id="rb"><p class="muted">Pick a run.</p></div>${backupCard()}${sheetsCard()}`);
  sheetsInit(); backupInit(); let L = [];
  $("#ld").onclick = async () => { const id = $("#sr").value; if (!id) return; L = await api("getRun", { id }); const k = ["basic", "allow", "ot", "gross", "sssEe", "phicEe", "hdmfEe", "tax", "totalDed", "net"], t = {}; k.forEach((x) => t[x] = L.reduce((n, s) => n + s.calc[x], 0));
    $("#rb").innerHTML = `<div class="tw"><table><tr><th>Employee</th>${k.map((x) => `<th class="n">${x}</th>`).join("")}</tr>${L.map((s) => `<tr><td>${esc(s.name)}</td>${k.map((x) => `<td class="n">${money(s.calc[x])}</td>`).join("")}</tr>`).join("")}<tr class="tot"><td>TOTAL</td>${k.map((x) => `<td class="n">${money(t[x])}</td>`).join("")}</tr></table></div>`; };
  $("#xl").onclick = () => { if (!L.length) return toast("Show a run first.", true); const ws = XLSX.utils.json_to_sheet(L.map((s) => ({ "Employee No": s.no, Name: s.name, Position: s.position, Basic: s.calc.basic, Allowances: s.calc.allow, Overtime: s.calc.ot, Gross: s.calc.gross, SSS: s.calc.sssEe, PhilHealth: s.calc.phicEe, "Pag-IBIG": s.calc.hdmfEe, Tax: s.calc.tax, "Total deductions": s.calc.totalDed, "Net pay": s.calc.net }))), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Payroll"); XLSX.writeFile(wb, "payroll-report.xlsx"); };
}

