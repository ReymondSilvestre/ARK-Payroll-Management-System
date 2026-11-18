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

/** The 13th month is paid in two releases: 1st = January - June, 2nd = July - December (each = basic earned in those 6 months, less absences and late, divided by 12). "all" = the whole year in one payment. */
const M13_PARTS = { h1: { lo: 0, hi: 5, label: "January - June", title: "1st release (Jan - Jun)" }, h2: { lo: 6, hi: 11, label: "July - December", title: "2nd release (Jul - Dec)" }, all: { lo: 0, hi: 11, label: "January - December", title: "Whole year (Jan - Dec)" } };
const m13Key = (no, part) => String(no) + ((part || ST.m13.part) === "all" ? "" : "|" + (part || ST.m13.part));

/** Numbers of one row for one release: the automatic calculation, replaced by whatever was typed in by hand (ST.m13.edits[employee no | part]). */
function m13Calc(x, part) {
  const P = M13_PARTS[part] || M13_PARTS.all, ed = ((ST.m13.edits || {})[m13Key(x.no, part)]) || {}, has = (k) => ed[k] !== undefined && ed[k] !== null && ed[k] !== "", o = {};
  o.autoBasic = r2(x.m.slice(P.lo, P.hi + 1).reduce((n, v) => n + v, 0)); o.autoDed = part === "all" ? x.dedAll : r2((x.dm || []).slice(P.lo, P.hi + 1).reduce((n, v) => n + v, 0));
  o.basic = has("basic") ? r2(+ed.basic) : o.autoBasic; o.ded = has("ded") ? r2(+ed.ded) : o.autoDed;
  o.net = Math.max(0, r2(o.basic - o.ded)); o.auto = r2(o.net / 12); o.pay = has("pay") ? r2(+ed.pay) : o.auto; o.edited = has("basic") || has("ded") || has("pay");
  return o;
}
function m13Fin(x) {
  const part = ST.m13.part || "all"; Object.assign(x, m13Calc(x, part));
  const tx = (v) => Math.max(0, r2(v - M13_EXEMPT));
  if (part === "h2") { const f = m13Calc(x, "h1").pay; x.taxable = r2(tx(f + x.pay) - tx(f)); } else x.taxable = tx(x.pay);   // the 90,000 tax-free limit is for the whole year: the 2nd release counts the 1st
}

const m13Saved = (y) => JSON.parse(JSON.stringify(((ST.settings && ST.settings.m13Edits) || {})[y] || {}));

async function m13Compute() {
  const M = ST.m13, y = +M.year, S = ST.settings, by = {}, keep = new Map(), find = (no) => ST.employees.find((x) => String(x.no) === String(no));
  const row = (no, name, pos) => (by[no] ||= { no, name, position: pos, e: find(no), m: Array(12).fill(0), dm: Array(12).fill(0), ded: 0 });
  ST.runs.forEach((r) => { if (runYM(r).y === y && r.status !== "Draft") keep.set((r.group || "") + "|" + r.period, r); });   // the same period saved twice counts once
  const hourly = ST.employees.some((e) => isHourly(e));
  if (M.basis === "runs" || hourly) {
    ST._rc = {};
    for (const r of keep.values()) {
      const L = (ST._rc[r.id] ||= await api("getRun", { id: r.id })), q = runYM(r);
      L.forEach((s) => { const c = s.calc || {}, x = row(s.no, s.name, s.position); if (q.m >= 0) x.m[q.m] += +c.basic || 0; const dd = r2((+c.absent || 0) + (+c.late || 0)); x.ded += dd; if (q.m >= 0) x.dm[q.m] += dd; });
    }
  }
  if (M.basis === "salary") ST.employees.filter((e) => !e.status || /^active$/i.test(e.status)).forEach((e) => { if (isHourly(e)) return; const mb = monthlyBasicOf(e, S), x = row(e.no, nameOf(e), e.position); x.m = MONN.map((_, i) => r2(mb * monthShare(y, i, e))); x.ded = 0; x.dm = Array(12).fill(0); });
  M.rows = Object.values(by).map((x) => { x.dedAll = x.ded; x.dept = x.e ? x.e.dept || "" : ""; x.grp = x.e ? groupName(x.e) : ""; x.cat = x.e ? categoryOf(x.e) : ""; x.monthly = x.e && !isHourly(x.e) ? monthlyBasicOf(x.e, S) : null; m13Fin(x); return x; })
    .filter((x) => x.m.some((v) => v > 0)).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
}

const m13Rows = () => (ST.m13.rows || []).filter((x) => x.autoBasic > 0 && (ST.m13.group === "all" || x.cat === ST.m13.group));

function m13Sheet() {
  const R = m13Rows(), M = ST.m13;
  return { name: M.part === "h1" ? "13th Month Jan-Jun" : M.part === "h2" ? "13th Month Jul-Dec" : "13th Month Pay", header: ["Employee No", "Name", "Department", "Group", "Position", ...MONN, "Release", "Total basic earned", "Less absences and late", "Net basic salary", "13th month pay", "Taxable over 90,000", "Year", "Edited by hand"], text: [0],
    rows: R.map((x) => [x.no, x.name, x.dept, x.grp, x.position || "", ...x.m.map(r2), M13_PARTS[M.part].title, x.basic, x.ded, x.net, x.pay, x.taxable, M.year, x.edited ? "Yes" : ""]) };
}

function m13Slip(x, copy) {
  const P = (n) => "\u20B1" + money(n), M = ST.m13, sg = ST.settings.signatories || [], cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`, dash = (v) => (v ? esc(v) : "-");
  const pd = M.pay ? new Date(M.pay + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
  const PT = M13_PARTS[M.part], mr = [0, 1].filter((r) => M.part === "all" || (M.part === "h1" ? r === 0 : r === 1)).map((r) => `<tr>${[0, 1, 2, 3, 4, 5].map((i) => `<td colspan="2"><span class="k">${MONN[r * 6 + i]}</span><span class="v">${P(x.m[r * 6 + i])}</span></td>`).join("")}</tr>`).join("");
  const L = (a, b, c) => `<tr${c ? ' class="tot"' : ""}><td colspan="9">${a}</td><td colspan="3" class="n">${b}</td></tr>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">${copy}</b></small></div></div>
  <h2>13TH MONTH PAY &middot; ${PT.title.toUpperCase()}</h2>
  <table><tr>${cell("Employee", esc(x.name), 5)}${cell("Employee No.", esc(x.no), 4)}${cell("Year", M.year, 3)}</tr><tr>${cell("Position", dash(x.position), 5)}${cell("Department", dash(x.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr><th colspan="12">BASIC SALARY EARNED PER MONTH</th></tr>${mr}
  <tr><th colspan="9">COMPUTATION</th><th colspan="3">Amount</th></tr>${L(`Total basic salary earned (${PT.label} ${M.year})`, P(x.basic))}${L("Less: absences and late", P(x.ded))}${L("Net basic salary earned", P(x.net))}${L(M.part === "all" ? "Divided by 12 months" : `Divided by 12 (13th month pay is always basic earned &divide; 12; this release counts ${PT.label.split(" - ")[0]} to ${PT.label.split(" - ")[1]} only, so it is half of the full year)`, "12")}${L("13TH MONTH PAY", P(x.pay), 1)}${M.part === "h2" ? L("1st release (January - June) already given", P(m13Calc(x, "h1").pay)) + L(`TOTAL 13TH MONTH PAY FOR ${M.year} (1st + 2nd release)`, P(r2(m13Calc(x, "h1").pay + x.pay)), 1) : ""}${x.taxable > 0 ? L(`Taxable part (over ${P(M13_EXEMPT)} for the year)`, P(x.taxable)) : ""}</table>
  <div class="net">13TH MONTH PAY (${PT.title}): ${P(x.pay)}</div>
  <div class="sg"><div>Received by<i>Employee</i></div>${sg.map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div></div>`;
}

function m13Draw() {
  const M = ST.m13, R = m13Rows(), el = $("#m13b"), tot = (k) => R.reduce((n, x) => n + x[k], 0), off = (M.off ||= new Set()), nEd = R.filter((x) => x.edited).length;
  if (!M.rows) { el.innerHTML = '<div class="card noprint empty muted">Loading the 13th month pay...</div>'; return; }
  const num = (x, k, v) => `<input class="in m13e" type="number" step="any" min="0" data-no="${esc(x.no)}" data-k="${k}" value="${v}" style="width:7.5rem;text-align:right${x.edited && (((M.edits || {})[m13Key(x.no)] || {})[k] !== undefined) ? ";background:#fff6d6;border-color:#d9a400" : ""}">`;
  el.innerHTML = `<div class="card noprint"><div class="row" style="margin-bottom:.8rem"><button class="btn p" id="m_ps">Show payslips</button><button class="btn" id="m_pr">Print payslips</button><button class="btn" id="m_xl">Download Excel</button><button class="btn" id="m_gs">Update Google Sheet</button><button class="btn p" id="m_sv">Save my edits${M.dirty ? " *" : ""}</button>${nEd ? '<button class="btn d" id="m_ra">Reset all edits</button>' : ""}<span class="muted">${R.length} employee(s), total 13th month (${M13_PARTS[M.part].label}) <b>&#8369;${money(tot("pay"))}</b>${nEd ? ` &middot; ${nEd} edited by hand` : ""}</span></div>
  <p class="muted">The numbers are calculated automatically. <b>You can type over</b> <i>Total basic earned</i>, <i>Less absent &amp; late</i> or the <i>13th month pay</i> itself; edited cells turn yellow and the pay is recalculated (basic less absences &divide; 12) unless you typed the pay yourself. The edits belong to the release chosen above. Press <b>Save my edits</b> to keep them for ${M.year}.</p>
  ${R.length ? `<div class="tw"><table><tr><th><input type="checkbox" id="m_all" ${R.every((x) => !off.has(String(x.no))) ? "checked" : ""}></th><th>No.</th><th>Employee</th><th>Group</th><th class="n">Monthly salary</th><th class="n">Total basic earned</th><th class="n">Less absent &amp; late</th><th class="n">Net basic</th><th class="n">13th month pay</th><th class="n">Taxable (over &#8369;90,000)</th><th></th></tr>${R.map((x) => `<tr><td><input type="checkbox" class="m13c" data-no="${esc(x.no)}" ${off.has(String(x.no)) ? "" : "checked"}></td><td>${esc(x.no)}</td><td>${esc(x.name)}<br><small class="muted">${esc(x.position || "")}${x.dept ? " &middot; " + esc(x.dept) : ""}</small></td><td>${esc(x.grp)}</td><td class="n">${x.monthly === null ? "per hour" : money(x.monthly)}</td><td class="n">${num(x, "basic", x.basic)}<br><small class="muted">auto ${money(x.autoBasic)}</small></td><td class="n">${num(x, "ded", x.ded)}<br><small class="muted">auto ${money(x.autoDed)}</small></td><td class="n">${money(x.net)}</td><td class="n">${num(x, "pay", x.pay)}<br><small class="muted">auto ${money(x.auto)}</small></td><td class="n">${money(x.taxable)}</td><td>${x.edited ? `<button class="btn sm" data-mr="${esc(x.no)}">Reset</button>` : ""}</td></tr>`).join("")}<tr class="tot"><td></td><td colspan="4">TOTAL</td><td class="n">${money(tot("basic"))}</td><td class="n">${money(tot("ded"))}</td><td class="n">${money(tot("net"))}</td><td class="n">${money(tot("pay"))}</td><td class="n">${money(tot("taxable"))}</td><td></td></tr></table></div>` : '<p class="muted">No pay found for this year and group. Finalize payroll runs first (drafts are not counted), or choose "The monthly salary of each employee".</p>'}</div>`;
  const picked = () => R.filter((x) => !off.has(String(x.no)));
  const show = () => { const L = picked(); $("#m13ps").innerHTML = L.map((x) => `<div class="slipset">${m13Slip(x, "EMPLOYEE COPY")}<div class="cut">- - - - - - - - cut here - - - - - - - -</div>${m13Slip(x, "FINANCE COPY")}</div>`).join(""); return L.length; };
  const redraw = () => { $("#m13ps").innerHTML = ""; m13Draw(); };
  if ($("#m_all")) $("#m_all").onchange = (e) => { R.forEach((x) => e.target.checked ? off.delete(String(x.no)) : off.add(String(x.no))); document.querySelectorAll(".m13c").forEach((c) => c.checked = e.target.checked); };
  document.querySelectorAll(".m13c").forEach((c) => c.onchange = () => { c.checked ? off.delete(c.dataset.no) : off.add(c.dataset.no); });
  document.querySelectorAll(".m13e").forEach((inp) => inp.onchange = () => {
    const no = inp.dataset.no, k = inp.dataset.k, x = (M.rows || []).find((r) => String(r.no) === no); if (!x) return;
    const kk = m13Key(no), E = ((M.edits ||= {})[kk] ||= {}), v = inp.value.trim(), auto = k === "basic" ? x.autoBasic : k === "ded" ? x.autoDed : x.auto;
    if (k !== "pay") delete E.pay;   // changing basic / absences recalculates the pay
    if (v === "" || isNaN(+v) || r2(Math.max(0, +v)) === r2(auto)) delete E[k]; else E[k] = r2(Math.max(0, +v));
    if (!Object.keys(E).length) delete M.edits[kk];
    M.dirty = true; m13Fin(x); redraw();
  });
  document.querySelectorAll("[data-mr]").forEach((b) => b.onclick = () => { const x = (M.rows || []).find((r) => String(r.no) === b.dataset.mr); delete (M.edits || {})[m13Key(b.dataset.mr)]; if (x) m13Fin(x); M.dirty = true; redraw(); });
  if ($("#m_ra")) $("#m_ra").onclick = () => { if (!confirm("Remove all manual edits and go back to the automatic calculation?")) return; Object.keys(M.edits || {}).forEach((k) => { if (m13Key(k.split("|")[0]) === k) delete M.edits[k]; }); (M.rows || []).forEach(m13Fin); M.dirty = true; redraw(); };
  $("#m_sv").onclick = async () => { const S = ST.settings; S.m13Edits = { ...(S.m13Edits || {}), [M.year]: JSON.parse(JSON.stringify(M.edits || {})) }; try { await api("saveSettings", S); } catch (e) { return; } M.dirty = false; toast(`13th month edits for ${M.year} saved.`); redraw(); };
  $("#m_ps").onclick = () => { if (!show()) toast("Tick at least one employee.", true); };
  $("#m_pr").onclick = () => { if (show()) print(); else toast("Tick at least one employee.", true); };
  $("#m_xl").onclick = () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to download.", true); xlsxBook([sh], `ARK-13th-Month-${M.year}-${M.part}.xlsx`); };
  $("#m_gs").onclick = async () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to send.", true); try { await sendSheets([sh]); } catch (e) { } };
}

async function m13Load() { try { await m13Compute(); } catch (e) { ST.m13.rows = []; } $("#m13ps").innerHTML = ""; m13Draw(); }

function m13() {
  const M = (ST.m13 ||= { year: new Date().getFullYear(), basis: "runs", group: "all", part: new Date().getMonth() < 6 ? "h1" : "h2", pay: "", rows: null }), yr = new Date().getFullYear(), payOf = () => M.part === "h1" ? `${M.year}-06-15` : `${M.year}-12-15`; if (!M.pay) M.pay = payOf(); if (!M.edits) M.edits = m13Saved(M.year);
  V(`<div class="card noprint"><h3>13th month pay</h3><p class="muted">The 13th month pay is paid in <b>two releases</b>: the <b>1st release (January - June)</b> and the <b>2nd release (July - December)</b>. Each release = total basic salary earned in its 6 months, less absences and late, &divide; 12; the two releases together equal the full-year 13th month pay. Overtime, allowances and holiday pay are not included; absences and late are subtracted. Up to &#8369;90,000 is tax-free; the part over it is shown. <b>Choose the year and the pay is shown below automatically</b>; only finalized payrolls are counted.</p>
  <div class="row"><div><label>Year</label><select id="m_y">${[yr - 2, yr - 1, yr, yr + 1].map((y) => `<option ${y === +M.year ? "selected" : ""}>${y}</option>`).join("")}</select></div>
  <div><label>Release</label><select id="m_p">${Object.entries(M13_PARTS).map(([k, v]) => `<option value="${k}" ${M.part === k ? "selected" : ""}>${v.title}</option>`).join("")}</select></div>
  <div><label>Salary taken from</label><select id="m_b"><option value="runs">Saved payroll runs (salary actually earned)</option><option value="salary" ${M.basis === "salary" ? "selected" : ""}>The monthly salary of each employee</option></select></div>
  <div><label>Group</label><select id="m_g"><option value="all">Everybody</option>${CATEGORIES.map((c) => `<option value="${c.key}" ${M.group === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="m_d" value="${M.pay}"></div><button class="btn" id="m_c">Refresh</button></div></div><div id="m13b"></div><div id="m13ps"></div>`);
  $("#m_y").onchange = (e) => { if (M.dirty && !confirm("You have edits that are not saved. Change the year anyway?")) { e.target.value = M.year; return; } M.year = +e.target.value; M.pay = payOf(); $("#m_d").value = M.pay; M.edits = m13Saved(M.year); M.dirty = false; M.off = new Set(); M.rows = null; m13Draw(); m13Load(); };
  $("#m_p").onchange = (e) => { M.part = e.target.value; M.pay = payOf(); $("#m_d").value = M.pay; (M.rows || []).forEach(m13Fin); $("#m13ps").innerHTML = ""; m13Draw(); };
  $("#m_b").onchange = (e) => { M.basis = e.target.value; M.rows = null; m13Draw(); m13Load(); };
  $("#m_g").onchange = (e) => { M.group = e.target.value; $("#m13ps").innerHTML = ""; m13Draw(); };
  $("#m_d").onchange = (e) => { M.pay = e.target.value; };
  $("#m_c").onclick = () => { M.rows = null; m13Draw(); m13Load(); };
  m13Draw(); if (!M.rows) m13Load();
}

