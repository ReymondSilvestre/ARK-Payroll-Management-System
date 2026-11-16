/* ============================================================
   13TH MONTH PAY tab.
   File: js/pages/month13.js
   ============================================================ */

/* ===================== 13th month pay ===================== */
const MONN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], M13_EXEMPT = 90000;

const runYM = (r) => { const t = String(r.period || ""), ys = t.match(/\b(20\d\d)\b/g), ms = [...t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi)]; return { y: ys ? +ys[ys.length - 1] : 0, m: ms.length ? MONN.findIndex((n) => n.slice(0, 3).toLowerCase() === ms[ms.length - 1][1].toLowerCase()) : -1 }; };

/** Share of a month (0-1) an employee was employed, for an employee hired in that year or later. */
function monthShare(y, i, e) {
  const dim = new Date(y, i + 1, 0).getDate(), h = e && e.hired ? new Date(e.hired + "T12:00") : null; if (!h || isNaN(h) || h.getFullYear() < y) return 1; if (h.getFullYear() > y) return 0;
  const hm_ = h.getMonth(); return i < hm_ ? 0 : i > hm_ ? 1 : (dim - h.getDate() + 1) / dim;
}

/** Final numbers of one row: the automatic calculation, replaced by whatever was typed in by hand (ST.m13.edits[employee no]). */
function m13Fin(x) {
  const ed = ((ST.m13.edits || {})[String(x.no)]) || {}, has = (k) => ed[k] !== undefined && ed[k] !== null && ed[k] !== "";
  x.basic = has("basic") ? r2(+ed.basic) : x.autoBasic; x.ded = has("ded") ? r2(+ed.ded) : x.autoDed;
  x.net = Math.max(0, r2(x.basic - x.ded)); x.auto = r2(x.net / 12); x.pay = has("pay") ? r2(+ed.pay) : x.auto;
  x.taxable = Math.max(0, r2(x.pay - M13_EXEMPT)); x.edited = has("basic") || has("ded") || has("pay");
}

const m13Saved = (y) => JSON.parse(JSON.stringify(((ST.settings && ST.settings.m13Edits) || {})[y] || {}));

async function m13Compute() {
  const M = ST.m13, y = +M.year, S = ST.settings, by = {}, keep = new Map(), find = (no) => ST.employees.find((x) => String(x.no) === String(no));
  const row = (no, name, pos) => (by[no] ||= { no, name, position: pos, e: find(no), m: Array(12).fill(0), ded: 0 });
  ST.runs.forEach((r) => { if (runYM(r).y === y && r.status !== "Draft") keep.set((r.group || "") + "|" + r.period, r); });   // the same period saved twice counts once
  const hourly = ST.employees.some((e) => isHourly(e));
  if (M.basis === "runs" || hourly) {
    ST._rc = {};
    for (const r of keep.values()) {
      const L = (ST._rc[r.id] ||= await api("getRun", { id: r.id })), q = runYM(r);
      L.forEach((s) => { const c = s.calc || {}, x = row(s.no, s.name, s.position); if (q.m >= 0) x.m[q.m] += +c.basic || 0; x.ded += r2((+c.absent || 0) + (+c.late || 0)); });
    }
  }
  if (M.basis === "salary") ST.employees.filter((e) => !e.status || /^active$/i.test(e.status)).forEach((e) => { if (isHourly(e)) return; const mb = monthlyBasicOf(e, S), x = row(e.no, nameOf(e), e.position); x.m = MONN.map((_, i) => r2(mb * monthShare(y, i, e))); x.ded = 0; });
  M.rows = Object.values(by).map((x) => { x.autoBasic = r2(x.m.reduce((n, v) => n + v, 0)); x.autoDed = x.ded; x.dept = x.e ? x.e.dept || "" : ""; x.grp = x.e ? groupName(x.e) : ""; x.cat = x.e ? categoryOf(x.e) : ""; x.monthly = x.e && !isHourly(x.e) ? monthlyBasicOf(x.e, S) : null; m13Fin(x); return x; })
    .filter((x) => x.autoBasic > 0).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
}

const m13Rows = () => (ST.m13.rows || []).filter((x) => ST.m13.group === "all" || x.cat === ST.m13.group);

function m13Sheet() {
  const R = m13Rows(), M = ST.m13;
  return { name: "13th Month Pay", header: ["Employee No", "Name", "Department", "Group", "Position", ...MONN, "Total basic earned", "Less absences and late", "Net basic salary", "13th month pay", "Taxable over 90,000", "Year", "Edited by hand"], text: [0],
    rows: R.map((x) => [x.no, x.name, x.dept, x.grp, x.position || "", ...x.m.map(r2), x.basic, x.ded, x.net, x.pay, x.taxable, M.year, x.edited ? "Yes" : ""]) };
}

function m13Slip(x, copy) {
  const P = (n) => "\u20B1" + money(n), M = ST.m13, sg = ST.settings.signatories || [], cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`, dash = (v) => (v ? esc(v) : "-");
  const pd = M.pay ? new Date(M.pay + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
  const mr = [0, 1].map((r) => `<tr>${[0, 1, 2, 3, 4, 5].map((i) => `<td colspan="2"><span class="k">${MONN[r * 6 + i]}</span><span class="v">${P(x.m[r * 6 + i])}</span></td>`).join("")}</tr>`).join("");
  const L = (a, b, c) => `<tr${c ? ' class="tot"' : ""}><td colspan="9">${a}</td><td colspan="3" class="n">${b}</td></tr>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">${copy}</b></small></div></div>
  <h2>13TH MONTH PAY</h2>
  <table><tr>${cell("Employee", esc(x.name), 5)}${cell("Employee No.", esc(x.no), 4)}${cell("Year", M.year, 3)}</tr><tr>${cell("Position", dash(x.position), 5)}${cell("Department", dash(x.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr><th colspan="12">BASIC SALARY EARNED PER MONTH</th></tr>${mr}
  <tr><th colspan="9">COMPUTATION</th><th colspan="3">Amount</th></tr>${L(`Total basic salary earned (January - December ${M.year})`, P(x.basic))}${L("Less: absences and late", P(x.ded))}${L("Net basic salary earned", P(x.net))}${L("Divided by 12 months", "12")}${L("13TH MONTH PAY", P(x.pay), 1)}${x.taxable > 0 ? L(`Taxable part (over ${P(M13_EXEMPT)})`, P(x.taxable)) : ""}</table>
  <div class="net">13TH MONTH PAY: ${P(x.pay)}</div>
  <div class="sg"><div>Received by<i>Employee</i></div>${sg.map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div></div>`;
}

function m13Draw() {
  const M = ST.m13, R = m13Rows(), el = $("#m13b"), tot = (k) => R.reduce((n, x) => n + x[k], 0), off = (M.off ||= new Set()), nEd = (M.rows || []).filter((x) => x.edited).length;
  if (!M.rows) { el.innerHTML = '<div class="card noprint empty muted">Loading the 13th month pay...</div>'; return; }
  const num = (x, k, v) => `<input class="in m13e" type="number" step="any" min="0" data-no="${esc(x.no)}" data-k="${k}" value="${v}" style="width:7.5rem;text-align:right${x.edited && (((M.edits || {})[String(x.no)] || {})[k] !== undefined) ? ";background:#fff6d6;border-color:#d9a400" : ""}">`;
  el.innerHTML = `<div class="card noprint"><div class="row" style="margin-bottom:.8rem"><button class="btn p" id="m_ps">Show payslips</button><button class="btn" id="m_pr">Print payslips</button><button class="btn" id="m_xl">Download Excel</button><button class="btn" id="m_gs">Update Google Sheet</button><button class="btn p" id="m_sv">Save my edits${M.dirty ? " *" : ""}</button>${nEd ? '<button class="btn d" id="m_ra">Reset all edits</button>' : ""}<span class="muted">${R.length} employee(s), total 13th month <b>&#8369;${money(tot("pay"))}</b>${nEd ? ` &middot; ${nEd} edited by hand` : ""}</span></div>
  <p class="muted">The numbers are calculated automatically. <b>You can type over</b> <i>Total basic earned</i>, <i>Less absent &amp; late</i> or the <i>13th month pay</i> itself; edited cells turn yellow and the pay is recalculated (basic less absences &divide; 12) unless you typed the pay yourself. Press <b>Save my edits</b> to keep them for ${M.year}.</p>
  ${R.length ? `<div class="tw"><table><tr><th><input type="checkbox" id="m_all" ${R.every((x) => !off.has(String(x.no))) ? "checked" : ""}></th><th>No.</th><th>Employee</th><th>Group</th><th class="n">Monthly salary</th><th class="n">Total basic earned</th><th class="n">Less absent &amp; late</th><th class="n">Net basic</th><th class="n">13th month pay</th><th class="n">Taxable (over &#8369;90,000)</th><th></th></tr>${R.map((x) => `<tr><td><input type="checkbox" class="m13c" data-no="${esc(x.no)}" ${off.has(String(x.no)) ? "" : "checked"}></td><td>${esc(x.no)}</td><td>${esc(x.name)}<br><small class="muted">${esc(x.position || "")}${x.dept ? " &middot; " + esc(x.dept) : ""}</small></td><td>${esc(x.grp)}</td><td class="n">${x.monthly === null ? "per hour" : money(x.monthly)}</td><td class="n">${num(x, "basic", x.basic)}<br><small class="muted">auto ${money(x.autoBasic)}</small></td><td class="n">${num(x, "ded", x.ded)}<br><small class="muted">auto ${money(x.autoDed)}</small></td><td class="n">${money(x.net)}</td><td class="n">${num(x, "pay", x.pay)}<br><small class="muted">auto ${money(x.auto)}</small></td><td class="n">${money(x.taxable)}</td><td>${x.edited ? `<button class="btn sm" data-mr="${esc(x.no)}">Reset</button>` : ""}</td></tr>`).join("")}<tr class="tot"><td></td><td colspan="4">TOTAL</td><td class="n">${money(tot("basic"))}</td><td class="n">${money(tot("ded"))}</td><td class="n">${money(tot("net"))}</td><td class="n">${money(tot("pay"))}</td><td class="n">${money(tot("taxable"))}</td><td></td></tr></table></div>` : '<p class="muted">No pay found for this year and group. Finalize payroll runs first (drafts are not counted), or choose "The monthly salary of each employee".</p>'}</div>`;
  const picked = () => R.filter((x) => !off.has(String(x.no)));
  const show = () => { const L = picked(); $("#m13ps").innerHTML = L.map((x) => `<div class="slipset">${m13Slip(x, "EMPLOYEE COPY")}<div class="cut">- - - - - - - - cut here - - - - - - - -</div>${m13Slip(x, "FINANCE COPY")}</div>`).join(""); return L.length; };
  const redraw = () => { $("#m13ps").innerHTML = ""; m13Draw(); };
  if ($("#m_all")) $("#m_all").onchange = (e) => { R.forEach((x) => e.target.checked ? off.delete(String(x.no)) : off.add(String(x.no))); document.querySelectorAll(".m13c").forEach((c) => c.checked = e.target.checked); };
  document.querySelectorAll(".m13c").forEach((c) => c.onchange = () => { c.checked ? off.delete(c.dataset.no) : off.add(c.dataset.no); });
  document.querySelectorAll(".m13e").forEach((inp) => inp.onchange = () => {
    const no = inp.dataset.no, k = inp.dataset.k, x = (M.rows || []).find((r) => String(r.no) === no); if (!x) return;
    const E = ((M.edits ||= {})[no] ||= {}), v = inp.value.trim(), auto = k === "basic" ? x.autoBasic : k === "ded" ? x.autoDed : x.auto;
    if (k !== "pay") delete E.pay;   // changing basic / absences recalculates the pay
    if (v === "" || isNaN(+v) || r2(Math.max(0, +v)) === r2(auto)) delete E[k]; else E[k] = r2(Math.max(0, +v));
    if (!Object.keys(E).length) delete M.edits[no];
    M.dirty = true; m13Fin(x); redraw();
  });
  document.querySelectorAll("[data-mr]").forEach((b) => b.onclick = () => { const x = (M.rows || []).find((r) => String(r.no) === b.dataset.mr); delete (M.edits || {})[b.dataset.mr]; if (x) m13Fin(x); M.dirty = true; redraw(); });
  if ($("#m_ra")) $("#m_ra").onclick = () => { if (!confirm("Remove all manual edits and go back to the automatic calculation?")) return; M.edits = {}; (M.rows || []).forEach(m13Fin); M.dirty = true; redraw(); };
  $("#m_sv").onclick = async () => { const S = ST.settings; S.m13Edits = { ...(S.m13Edits || {}), [M.year]: JSON.parse(JSON.stringify(M.edits || {})) }; try { await api("saveSettings", S); } catch (e) { return; } M.dirty = false; toast(`13th month edits for ${M.year} saved.`); redraw(); };
  $("#m_ps").onclick = () => { if (!show()) toast("Tick at least one employee.", true); };
  $("#m_pr").onclick = () => { if (show()) print(); else toast("Tick at least one employee.", true); };
  $("#m_xl").onclick = () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to download.", true); xlsxBook([sh], `ARK-13th-Month-${M.year}.xlsx`); };
  $("#m_gs").onclick = async () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to send.", true); try { await sendSheets([sh]); } catch (e) { } };
}

async function m13Load() { try { await m13Compute(); } catch (e) { ST.m13.rows = []; } $("#m13ps").innerHTML = ""; m13Draw(); }

function m13() {
  const M = (ST.m13 ||= { year: new Date().getFullYear(), basis: "runs", group: "all", pay: "", rows: null }), yr = new Date().getFullYear(); if (!M.pay) M.pay = `${M.year}-12-15`; if (!M.edits) M.edits = m13Saved(M.year);
  V(`<div class="card noprint"><h3>13th month pay</h3><p class="muted">13th month pay = total basic salary earned from January to December &divide; 12. Overtime, allowances and holiday pay are not included; absences and late are subtracted. Up to &#8369;90,000 is tax-free; the part over it is shown. <b>Choose the year and the pay is shown below automatically</b>; only finalized payrolls are counted.</p>
  <div class="row"><div><label>Year</label><select id="m_y">${[yr - 2, yr - 1, yr, yr + 1].map((y) => `<option ${y === +M.year ? "selected" : ""}>${y}</option>`).join("")}</select></div>
  <div><label>Salary taken from</label><select id="m_b"><option value="runs">Saved payroll runs (salary actually earned)</option><option value="salary" ${M.basis === "salary" ? "selected" : ""}>The monthly salary of each employee</option></select></div>
  <div><label>Group</label><select id="m_g"><option value="all">Everybody</option>${CATEGORIES.map((c) => `<option value="${c.key}" ${M.group === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="m_d" value="${M.pay}"></div><button class="btn" id="m_c">Refresh</button></div></div><div id="m13b"></div><div id="m13ps"></div>`);
  $("#m_y").onchange = (e) => { if (M.dirty && !confirm("You have edits that are not saved. Change the year anyway?")) { e.target.value = M.year; return; } M.year = +e.target.value; M.pay = `${M.year}-12-15`; $("#m_d").value = M.pay; M.edits = m13Saved(M.year); M.dirty = false; M.off = new Set(); M.rows = null; m13Draw(); m13Load(); };
  $("#m_b").onchange = (e) => { M.basis = e.target.value; M.rows = null; m13Draw(); m13Load(); };
  $("#m_g").onchange = (e) => { M.group = e.target.value; $("#m13ps").innerHTML = ""; m13Draw(); };
  $("#m_d").onchange = (e) => { M.pay = e.target.value; };
  $("#m_c").onclick = () => { M.rows = null; m13Draw(); m13Load(); };
  m13Draw(); if (!M.rows) m13Load();
}

