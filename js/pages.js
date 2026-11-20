/* ============================================================
   PAGES - dashboard, employees, loans, payroll, payslips, reports, settings screen
   Combined file. Each section below is one of the former separate files (kept in the same order).
   ============================================================ */

/* >>>>>>>>>> js/pages/dashboard.js >>>>>>>>>> */
/* ============================================================
   DASHBOARD tab - charts and totals.
   File: js/pages/dashboard.js
   ============================================================ */

/* ---------- Dashboard ---------- */
/* ---------- Dashboard charts (plain SVG) ---------- */
const kfmt = (n) => (Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "k" : String(Math.round(n * 10) / 10));

const pesoK = (n) => "\u20B1" + kfmt(n);

function barChart(labels, series, fmt) {
  fmt = fmt || kfmt; if (!labels.length) return '<div class="empty" style="padding:1.6rem"><span class="muted">No data yet.</span></div>';
  const W = 640, H = 270, L = 46, R = 10, T = 12, B = 62, iw = W - L - R, ih = H - T - B, max = Math.max(1e-9, ...series.flatMap((x) => x.data)), top = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))), m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const gw = iw / labels.length, bw = Math.min(30, (gw * 0.72) / series.length), g = [0, .25, .5, .75, 1].map((k) => { const y = T + ih - ih * k; return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 6}" y="${y + 3.5}" text-anchor="end" class="ax">${fmt(top * k)}</text>`; }).join("");
  const bars = labels.map((lb, i) => { const cx = L + gw * i + gw / 2, x0 = cx - (bw * series.length) / 2; return series.map((x, k) => { const v = x.data[i] || 0, h = (v / top) * ih; return `<rect x="${x0 + bw * k}" y="${T + ih - h}" width="${bw - 2}" height="${Math.max(h, v > 0 ? 1.5 : 0)}" rx="3" fill="${x.color}"><title>${esc(lb)} - ${esc(x.name)}: ${fmt(v)}</title></rect>`; }).join("") + `<text x="${cx}" y="${T + ih + 14}" class="ax" text-anchor="end" transform="rotate(-28 ${cx} ${T + ih + 14})">${esc(lb)}</text>`; }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}${bars}</svg>${series.length > 1 ? `<div class="lgd">${series.map((x) => `<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join("")}</div>` : ""}`;
}

/** Totals per cut-off (1-15 / 16-end) or per month from the saved payroll runs and from the biometric DTR. */
function dashData(by) {
  const mo = (y, m) => `${MONN[m].slice(0, 3)} ${y}`, pay = new Map(), dt = new Map();
  (ST.runs || []).filter((r) => r.status !== "Draft").slice().sort((a, b) => String(a.payDate) < String(b.payDate) ? -1 : 1).forEach((r) => { const k = by === "month" ? (() => { const q = runYM(r); return q.m >= 0 ? `${q.y}-${String(q.m + 1).padStart(2, "0")}` : String(r.period); })() : String(r.period), o = pay.get(k) || { label: by === "month" ? (() => { const q = runYM(r); return q.m >= 0 ? mo(q.y, q.m) : String(r.period); })() : String(r.period), gross: 0, net: 0 }; o.gross += +r.gross || 0; o.net += +r.net || 0; pay.set(k, o); });
  const D = ST.dtr || { days: {} }, ids = Object.keys(D.days || {});
  if (ids.length) {
    const dates = ids.flatMap((i) => Object.keys(D.days[i])).sort(), from = D.from || dates[0], to = D.to || dates[dates.length - 1], hv = +(ST.settings.dtr.halfDayAbs ?? 0.5);
    ST.employees.filter((e) => daysOf(e)).forEach((e) => dtrCalc(e, from, to).rows.forEach((r) => {
      const y = +r.d.slice(0, 4), m = +r.d.slice(5, 7) - 1, half = +r.d.slice(8, 10) <= 15, k = by === "month" ? r.d.slice(0, 7) : r.d.slice(0, 7) + (half ? "a" : "b"), lab = by === "month" ? mo(y, m) : `${MONN[m].slice(0, 3)} ${half ? "1-15" : "16-" + new Date(y, m + 1, 0).getDate()}, ${y}`;
      const o = dt.get(k) || { label: lab, late: 0, abs: 0, ot: 0 }; o.late += r.late || 0; o.abs += r.st === "absent" ? 1 : r.st === "half" ? hv : 0; o.ot += r.ot || 0; dt.set(k, o);
    }));
  }
  const pk = (M, n) => [...M.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-n).map((x) => x[1]);
  return { pay: by === "month" ? pk(pay, 12) : [...pay.values()].slice(-10), dt: pk(dt, by === "month" ? 12 : 10) };
}

/** Horizontal bars with the employee name on every row. rows: [{label, data:[v1, v2...]}] */
function hBarChart(rows, series, fmt, msg) {
  if (!rows.length) return '<div class="empty" style="padding:1.6rem"><span class="muted">' + (msg || "No data yet.") + '</span></div>';
  const W = 520, L = 146, R = 84, T = 6, bh = 12, gap = 3, pad = 10, bl = series.length * (bh + gap) - gap, rh = bl + pad, H = T * 2 + rows.length * rh, pw = W - L - R, max = Math.max(1e-9, ...rows.flatMap((r) => r.data));
  const grid = [0, .25, .5, .75, 1].map((k) => `<line x1="${L + pw * k}" x2="${L + pw * k}" y1="${T}" y2="${H - T}" class="gl"/>`).join("");
  const body = rows.map((r, i) => {
    const y0 = T + i * rh + pad / 2, nm = r.label.length > 24 ? r.label.slice(0, 23) + "\u2026" : r.label;
    return `<text x="${L - 8}" y="${y0 + bl / 2 + 3.5}" text-anchor="end" class="ax nm">${esc(nm)}<title>${esc(r.label)}</title></text>` + series.map((x, k) => {
      const v = r.data[k] || 0, w = Math.max((v / max) * pw, v > 0 ? 1.5 : 0), y = y0 + k * (bh + gap);
      return `<rect x="${L}" y="${y}" width="${w}" height="${bh}" rx="3" fill="${x.color}"><title>${esc(r.label)} - ${esc(x.name)}: ${esc(fmt(v))}</title></rect><text x="${L + w + 5}" y="${y + bh - 2.5}" class="ax bv">${esc(fmt(v))}</text>`;
    }).join("");
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${grid}${body}</svg>${series.length > 1 ? `<div class="lgd">${series.map((x) => `<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join("")}</div>` : ""}`;
}

/** The cut-offs (1-15 / 16-end) or months that the loaded biometric data covers, newest first. */
function dtrPeriods(by) {
  const D = ST.dtr || { days: {} }, ids = Object.keys(D.days || {}); if (!ids.length) return [];
  const dates = ids.flatMap((i) => Object.keys(D.days[i])).sort(), from = D.from || dates[0], to = D.to || dates[dates.length - 1], out = new Map(), p2 = (n) => String(n).padStart(2, "0");
  for (let d = from; d && d <= to; d = addDay(d)) {
    const ym = d.slice(0, 7), y = +d.slice(0, 4), m = +d.slice(5, 7) - 1, ld = new Date(y, m + 1, 0).getDate(), half = +d.slice(8, 10) <= 15, mon = MONN[m].slice(0, 3);
    const key = by === "month" ? ym : ym + (half ? "a" : "b"), a = by === "month" ? ym + "-01" : ym + (half ? "-01" : "-16"), b = by === "month" ? ym + "-" + p2(ld) : ym + "-" + (half ? "15" : p2(ld));
    if (!out.has(key)) out.set(key, { key, from: a < from ? from : a, to: b > to ? to : b, label: by === "month" ? mon + " " + y : mon + " " + (half ? "1-15" : "16-" + ld) + ", " + y });
  }
  return [...out.values()].reverse();
}

/** Dashboard block: gross / net pay, late, absent and overtime per employee, each bar labelled with the name. */
function empDash(by, cc) {
  const fin = (ST.runs || []).filter((r) => r.status !== "Draft").slice().sort((a, b) => String(a.payDate) < String(b.payDate) ? 1 : -1), pers = dtrPeriods(by);
  if (!fin.some((r) => r.id === ST.dRun)) ST.dRun = fin.length ? fin[0].id : "";
  if (!pers.some((q) => q.key === ST.dPer)) ST.dPer = pers.length ? pers[0].key : "";
  const per = pers.find((q) => q.key === ST.dPer), run = fin.find((r) => r.id === ST.dRun), top = ST.dAll ? Infinity : 10, hasDtr = pers.length > 0;
  const opt = (v, l, on) => `<option value="${esc(v)}" ${on ? "selected" : ""}>${esc(l)}</option>`;
  const ctl = `<div class="card noprint"><h3>By employee<small>every bar shows the employee name</small></h3><div class="row">
    <div><label>Payroll run</label><select id="dRun">${fin.map((r) => opt(r.id, r.period + (r.group ? " - " + r.group : ""), r.id === ST.dRun)).join("") || '<option value="">No finalized payroll yet</option>'}</select></div>
    <div><label>Attendance period</label><select id="dPer">${pers.map((q) => opt(q.key, q.label, q.key === ST.dPer)).join("") || '<option value="">No biometric data yet</option>'}</select></div>
    <div><label>Show</label><select id="dAll">${opt("0", "Top 10 employees", !ST.dAll)}${opt("1", "All employees", ST.dAll)}</select></div></div></div>`;
  const rows = per ? ST.employees.filter((e) => daysOf(e)).map((e) => { const c = dtrCalc(e, per.from, per.to); return { label: nameOf(e), late: Math.round((c.late / 60) * 100) / 100, abs: Math.round(c.absent * 100) / 100, ot: Math.round(c.ot * 100) / 100 }; }) : [];
  const noDtr = '<div class="empty" style="padding:1.6rem"><span class="muted">Upload biometric files under DTR / Biometric to see this chart.</span></div>';
  const att = (k, nm, color, unit, none) => hasDtr ? hBarChart(rows.filter((x) => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, top).map((x) => ({ label: x.label, data: [x[k]] })), [{ name: nm, color }], (n) => n + unit, none) : noDtr;
  const sub = per ? per.label : "";
  return ctl + `<div class="grid cgrid2">${cc("Gross pay and net pay", run ? esc(run.period) : "", '<div id="epay"></div>')}${cc("Late", "hours, " + esc(sub), att("late", "Late (hours)", "#f79009", " h", "No late records in this period."))}${cc("Absent", "days, " + esc(sub), att("abs", "Absent (days)", "#d92d20", " d", "No absences in this period."))}${cc("Overtime", "hours, " + esc(sub), att("ot", "Overtime (hours)", "#12b76a", " h", "No overtime in this period."))}</div>`;
}

async function empPayChart() {
  const box = $("#epay"); if (!box) return;
  const msg = (t) => '<div class="empty" style="padding:1.6rem"><span class="muted">' + t + '</span></div>', id = ST.dRun;
  if (!id) { box.innerHTML = msg("No finalized payroll yet."); return; }
  box.innerHTML = msg("Loading...");
  try {
    const L = ((ST._rc ||= {})[id] ||= await api("getRun", { id }));
    if ($("#epay") !== box) return;   // the dashboard was redrawn or closed meanwhile
    const rows = L.filter((x) => x.calc).map((x) => ({ label: String(x.name || ""), data: [+x.calc.gross || 0, +x.calc.net || 0] })).sort((a, b) => b.data[1] - a.data[1]).slice(0, ST.dAll ? Infinity : 10);
    box.innerHTML = hBarChart(rows, [{ name: "Gross pay", color: "#98a2b3" }, { name: "Net pay", color: "#a61e33" }], (n) => "\u20B1" + money(n), "No payslips in this run.");
  } catch (e) { if ($("#epay") === box) box.innerHTML = msg("Could not load this payroll run."); }
}

function empDashInit() {
  [["dRun", (v) => (ST.dRun = v)], ["dPer", (v) => (ST.dPer = v)], ["dAll", (v) => (ST.dAll = v === "1")]].forEach(([id, f]) => { const el = $("#" + id); if (el) el.onchange = () => { f(el.value); dash(); }; });
  empPayChart();
}

function dash() {
  const cat = (k) => ST.employees.filter((e) => categoryOf(e) === k).length, last = ST.runs[ST.runs.length - 1], w = whoAmI(), h = new Date().getHours(), hi = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening", by = ST.chartBy || "cut";
  const ic = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${NAVICON[k]}</svg>`, kpi = (k, l, v, sub) => `<div class="kpi"><div class="ki">${ic(k)}</div><div><small>${l}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ""}</div></div>`;
  const d = dashData(by), lbl = (a) => a.map((x) => x.label), hrs = (m) => Math.round((m / 60) * 100) / 100, hasDtr = d.dt.length > 0, none = '<div class="empty" style="padding:1.6rem"><span class="muted">Upload biometric files under DTR / Biometric to see this chart.</span></div>';
  const cc = (t, sub, body) => `<div class="card chartcard"><h3>${t}${sub ? `<small>${sub}</small>` : ""}</h3>${body}</div>`;
  V(`<div class="welcome"><div><h2>${hi}, ${esc(String(w.name).split(" ")[0])}</h2><p>Here is what is happening in the ARK payroll today.</p></div><div class="chips noprint" id="cby"><button data-cb="cut" class="${by === "cut" ? "on" : ""}">Per cut-off</button><button data-cb="month" class="${by === "month" ? "on" : ""}">Per month</button></div></div>
  <div class="grid kpis">${kpi("emp", "Employees", ST.employees.length, `${cat("staff")} staff &middot; ${cat("teacher")} teachers &middot; ${cat("admin")} admins`)}${kpi("slips", "Payroll runs saved", ST.runs.length, "Drafts and finalized")}${kpi("run", "Last net pay", last ? "\u20B1" + money(last.net) : "-", last ? esc(last.period) : "No payroll yet")}${kpi("dtr", "Biometric punches", Object.keys((ST.dtr && ST.dtr.days) || {}).length ? "Loaded" : "None", "Upload under DTR / Biometric")}</div>
  <div class="grid cgrid2">${cc("Gross pay", (by === "month" ? "per month" : "per cut-off") + " - finalized payrolls", barChart(lbl(d.pay), [{ name: "Gross pay", color: "#98a2b3", data: d.pay.map((x) => x.gross) }], pesoK))}${cc("Net pay", (by === "month" ? "per month" : "per cut-off") + " - finalized payrolls", barChart(lbl(d.pay), [{ name: "Net pay", color: "#a61e33", data: d.pay.map((x) => x.net) }], pesoK))}</div>
  <div class="grid cgrid">${cc("Late", "hours, " + (by === "month" ? "per month" : "per cut-off"), hasDtr ? barChart(lbl(d.dt), [{ name: "Late (hours)", color: "#f79009", data: d.dt.map((x) => hrs(x.late)) }]) : none)}${cc("Absent", "days, " + (by === "month" ? "per month" : "per cut-off"), hasDtr ? barChart(lbl(d.dt), [{ name: "Absent (days)", color: "#d92d20", data: d.dt.map((x) => Math.round(x.abs * 100) / 100) }]) : none)}${cc("Overtime", "hours, " + (by === "month" ? "per month" : "per cut-off"), hasDtr ? barChart(lbl(d.dt), [{ name: "Overtime (hours)", color: "#12b76a", data: d.dt.map((x) => hrs(x.ot)) }]) : none)}</div>
  ${empDash(by, cc)}
  <div class="card"><h3>Recent payroll runs</h3>${runsTable(ST.runs.slice(-5).reverse())}</div>`);
  document.querySelectorAll("[data-cb]").forEach((b) => b.onclick = () => { ST.chartBy = b.dataset.cb; dash(); });
  empDashInit();
}

const runsTable = (rs) => rs.length ? `<div class="tw"><table><tr><th>Period</th><th>Pay date</th><th class="n">Employees</th><th class="n">Gross (\u20B1)</th><th class="n">Deductions (\u20B1)</th><th class="n">Net (\u20B1)</th><th>Status</th><th>Saved by</th></tr>${rs.map((r) => `<tr><td>${esc(r.period)}</td><td>${esc(String(r.payDate).slice(0, 10))}</td><td class="n">${r.count}</td><td class="n">${money(r.gross)}</td><td class="n">${money(r.ded)}</td><td class="n">${money(r.net)}</td><td>${r.status === "Draft" ? '<b style="color:#8a5a00">Draft</b>' : '<b style="color:#1a7f37">Finalized</b>'}</td><td>${esc(r.by)}</td></tr>`).join("")}</table></div>` : `<p class="muted">No payroll saved yet.</p>`;


/* >>>>>>>>>> js/pages/employees.js >>>>>>>>>> */
/* ============================================================
   EMPLOYEES tab - list, add/edit, upload, photo, group buttons.
   File: js/pages/employees.js
   ============================================================ */

/* ---------- Employees: add, edit, upload ---------- */
const OPT = { gender: ["", "Male", "Female"], civil: ["", "Single", "Married", "Widowed", "Separated"], etype: ["", "Regular", "Probationary", "Contractual", "Part-time", "Casual", "Project-based"], status: ["Active", "Inactive", "On leave", "Resigned", "Terminated"], category: [["", "Automatic (from position)"], ["staff", "Employee staff"], ["teacher", "Teacher (paid per hour)"], ["admin", "School admin"]] };

const EF = [["no", "Employee No. *"], ["last", "Last name *"], ["first", "First name *"], ["mi", "M.I."], ["birthday", "Birthday *", "date"], ["gender", "Gender", OPT.gender], ["civil", "Civil status", OPT.civil], ["position", "Position", "dyn"], ["dept", "Department", "dyn"], ["etype", "Employment type", OPT.etype], ["hired", "Date hired", "date"], ["status", "Status *", OPT.status]];

const GF = [["sssNo", "SSS No."], ["philhealthNo", "PhilHealth No."], ["pagibigNo", "Pag-IBIG No."], ["tin", "TIN"]];

const PF = [["basicMonthly", "Monthly basic (\u20B1)"], ["dailyRate", "Daily rate (optional)"], ["hourlyRate", "Hourly rate (teachers)"], ["email", "Email"], ["category", "Payroll group", OPT.category]];

const nameOf = (e) => e.name || [e.last, [e.first, e.mi ? String(e.mi).replace(/\.?$/, ".") : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/* Position and Department are dropdowns: what is already used by employees, a starting list, and "+ Add new". */
const DEF_POS = ["Teacher", "Head Teacher", "Principal", "Assistant Principal", "School Administrator", "Registrar", "Cashier", "Accountant", "HR Officer", "Guidance Counselor", "Librarian", "IT Staff", "Nurse", "Secretary", "Clerk", "Maintenance Staff", "Security Guard", "Driver"];

const DEF_DEPT = ["Elementary", "Junior High School", "Senior High School", "College", "Administration", "Registrar", "Accounting / Finance", "Human Resources", "IT", "Guidance", "Library", "Clinic", "Maintenance", "Security"];

const dynOpts = (k, cur) => { const seen = new Map(); [cur, ...ST.employees.map((x) => x[k]), ...(k === "position" ? DEF_POS : DEF_DEPT)].forEach((v) => { v = String(v || "").trim(); if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v); }); return [...seen.values()].sort((a, b) => a.localeCompare(b)); };

document.addEventListener("change", (ev) => {
  const el = ev.target; if (!el || el.value !== "__new__" || !/^f_(position|dept)$/.test(el.id)) return;
  const nm = (prompt("Enter the new " + (el.id === "f_dept" ? "department" : "position") + ":") || "").trim();
  if (!nm) { el.value = el.dataset.prev || ""; return; }
  let o = [...el.options].find((x) => x.value.toLowerCase() === nm.toLowerCase());
  if (!o) { o = new Option(nm, nm); el.insertBefore(o, el.querySelector('option[value="__new__"]')); }
  el.value = o.value; el.dataset.prev = o.value;
});

/** Any date as it may be saved in the database or typed in Excel (2026-05-20, 2026-05-20T00:00:00Z, 5/20/1990, 20/05/1990, May 20, 1990, 20-May-1990, an Excel date number) -> "yyyy-mm-dd", the only format the date box of the form can show. "" when it is not a date. */
function isoDate(v) {
  if (v instanceof Date) return isNaN(v) ? "" : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const s = String(v ?? "").trim(), p = (n) => String(n).padStart(2, "0"), ok = (y, m, d) => { const t = new Date(+y, +m - 1, +d); return t.getFullYear() === +y && t.getMonth() === +m - 1 && t.getDate() === +d ? `${y}-${p(m)}-${p(d)}` : ""; };
  if (!s) return ""; let m;
  if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/.exec(s))) return ok(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/.exec(s))) { const y = m[3].length === 2 ? (+m[3] > 30 ? 1900 : 2000) + +m[3] : +m[3], a = +m[1], b = +m[2], dmy = a > 12 || (b <= 12 && ((ST.settings.dtr || {}).dateOrder === "DMY")); return dmy ? ok(y, b, a) : ok(y, a, b); }
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 1000 && +s < 80000) { const t = new Date(Math.round((+s - 25569) * 864e5)); return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`; }   // Excel date number
  if (/[A-Za-z]{3}/.test(s)) { const c = s.replace(/(\d)(st|nd|rd|th)\b/i, "$1"), t = new Date(/\d:\d|GMT/.test(c) ? c : c + " 12:00"); if (!isNaN(t)) return isoDate(t); }
  return "";
}

const fld = (f, e) => { const [k, l, t] = f, v0 = e[k] ?? (k === "status" ? "Active" : ""), v = t === "date" ? isoDate(v0) : v0; if (t === "dyn") { const cur = String(v || "").trim(); return `<div><label>${l}</label><select id="f_${k}" data-prev="${esc(cur)}"><option value="">-</option>${dynOpts(k, cur).map((o) => `<option value="${esc(o)}" ${o.toLowerCase() === cur.toLowerCase() ? "selected" : ""}>${esc(o)}</option>`).join("")}<option value="__new__">+ Add new ${k === "dept" ? "department" : "position"}...</option></select></div>`; } if (Array.isArray(t)) return `<div><label>${l}</label><select id="f_${k}">${t.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o || "-"]; return `<option value="${esc(ov)}" ${String(v) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select></div>`; return `<div><label>${l}</label><input id="f_${k}" type="${t === "date" ? "date" : "text"}" value="${esc(v)}"></div>`; };

function emp(edit) {
  const e = edit || {}; if (edit) ST.empView = "add";
  V(`${empTabs()}<div class="card" data-pane="add" ${paneHide("add")}><h3>${edit ? "Edit" : "Add"} employee information</h3>${photoBox(e)}<div class="form">${EF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Government benefit numbers</h3><div class="form">${GF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Pay information</h3><div class="form">${PF.map((f) => fld(f, e)).join("")}
  ${[["sss", "SSS"], ["philhealth", "PhilHealth"], ["pagibig", "Pag-IBIG"], ["tax", "Withholding tax"]].map(([k, l]) => `<div><label>${l} deduction</label><select id="f_${k}"><option value="1">Deduct</option><option value="0" ${e[k] === false ? "selected" : ""}>Do not deduct</option></select></div>`).join("")}</div>
  <p class="muted">Cash advances, loans and allowances each have their own menu button: <b>Cash Advance</b>, <b>Loans</b> and <b>Allowances</b>.</p>
  <p class="row"><button class="btn p" id="sv">${edit ? "Save changes" : "Add employee"}</button>${edit ? '<button class="btn" id="cn">Cancel</button>' : ""}</p></div>
  <div class="card noprint" data-pane="upload" ${paneHide("upload")}><h3>Upload employees (Excel / CSV)</h3><p class="muted">Use the template columns: Employee No., Last name, First name, M.I., Birthday, Gender, Civil status, Position, Department, Employment type, Date hired, Status, SSS No., PhilHealth No., Pag-IBIG No., TIN, Monthly basic, Daily rate, Hourly rate, Email, Group. Existing employees (same Employee No.) are updated.</p>
  <div class="row"><input type="file" id="up" accept=".xlsx,.xls,.csv"><button class="btn" id="tpl">Download template</button></div></div>
  ${empFilter()}<div class="card" data-pane="list" ${paneHide("list")}><h3>Employees (${empList().length})</h3><div class="tw"><table><tr><th>No.</th><th>Name</th><th>Birthday</th><th>Position</th><th>Department</th><th>Type</th><th>Status</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>TIN</th><th></th></tr>
  ${empList().map((x) => `<tr><td>${esc(x.no)}</td><td>${thumb(x)}${esc(nameOf(x))}</td><td>${esc(x.birthday)}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${esc(x.etype)}</td><td>${esc(x.status)}</td><td>${esc(x.sssNo)}</td><td>${esc(x.philhealthNo)}</td><td>${esc(x.pagibigNo)}</td><td>${esc(x.tin)}</td><td><button class="btn sm" data-e="${x.id}">Edit</button> <button class="btn sm d" data-x="${x.id}">Delete</button></td></tr>`).join("")}</table></div></div>`);
  $("#sv").onclick = async () => {
    const o = { ...e }; if (ST.photoDraft !== undefined) o.photo = ST.photoDraft; [...EF, ...GF, ...PF].forEach(([k]) => o[k] = $("#f_" + k).value.trim()); if (o.position === "__new__") o.position = ""; if (o.dept === "__new__") o.dept = "";
    ["sss", "philhealth", "pagibig", "tax"].forEach((k) => o[k] = $("#f_" + k).value === "1");
    for (const [k, l] of [["no", "Employee No."], ["last", "Last name"], ["first", "First name"], ["birthday", "Birthday"], ["status", "Status"]]) if (!o[k]) {
      const box = $("#f_" + k), old = String(e[k] ?? "").trim();
      if (box && box.type === "date" && box.validity && box.validity.badInput) return toast(l + " is not complete: type the month, day and year, or pick it from the calendar.", true);   // the box holds a half-typed date
      return toast(l + " is required." + (box && box.type === "date" && old && !isoDate(old) ? ` The saved value "${old}" is not a valid date: pick the date again.` : ""), true);
    }
    const r = await api("saveEmployees", { list: [o] }); applyEmps(r); ST.empView = "list"; toast("Saved."); emp();
  };
  if (edit) $("#cn").onclick = () => { ST.empView = "list"; emp(); };
  document.querySelectorAll("[data-e]").forEach((b) => b.onclick = () => { emp(ST.employees.find((x) => x.id === b.dataset.e)); scrollTo(0, 0); });
  document.querySelectorAll("[data-x]").forEach((b) => b.onclick = async () => { if (confirm("Delete this employee?")) { await api("deleteEmployee", { id: b.dataset.x }); ST.employees = ST.employees.filter((x) => x.id !== b.dataset.x); emp(); } });
  $("#tpl").onclick = () => { const H = ["Employee No.", "Last name", "First name", "M.I.", "Birthday", "Gender", "Civil status", "Position", "Department", "Employment type", "Date hired", "Status", "SSS No.", "PhilHealth No.", "Pag-IBIG No.", "TIN", "Monthly basic", "Daily rate", "Hourly rate", "Email", "Group"], ws = XLSX.utils.aoa_to_sheet([H, ["E-001", "Dela Cruz", "Juan", "S", "1990-05-20", "Male", "Single", "Cashier", "Finance", "Regular", "2022-06-01", "Active", "33-1234567-8", "12-345678901-2", "1234-5678-9012", "123-456-789-000", 18000, "", "", "juan@example.com", "staff"]]), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Employees"); XLSX.writeFile(wb, "employee-template.xlsx"); };
  $("#up").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
    const AL = { no: ["employeeno", "employeenumber", "empno"], last: ["lastname", "surname"], first: ["firstname", "givenname"], mi: ["mi", "middleinitial"], birthday: ["birthday", "birthdate", "dateofbirth"], gender: ["gender", "sex"], civil: ["civilstatus"], position: ["position"], dept: ["department"], etype: ["employmenttype"], hired: ["datehired", "datehire"], status: ["status"], sssNo: ["sssno", "sssnumber", "sss"], philhealthNo: ["philhealthno", "philhealthnumber", "philhealth"], pagibigNo: ["pagibigno", "pagibignumber", "pagibig", "hdmfno"], tin: ["tin", "tinno", "tinnumber"], basicMonthly: ["monthlybasic", "monthlysalary", "basicmonthly", "salary"], dailyRate: ["dailyrate"], hourlyRate: ["hourlyrate"], email: ["email"], category: ["group", "category"] };
    const map = {}; for (const k in AL) AL[k].forEach((a) => map[a] = k);
    const dt = (v) => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v).trim();
    const list = [], bad = [];
    rows.forEach((r, i) => { const o = {}; for (const h in r) { const k = map[String(h).toLowerCase().replace(/[^a-z]/g, "")]; if (k) o[k] = ["birthday", "hired"].includes(k) ? dt(r[h]) : typeof r[h] === "string" ? r[h].trim() : r[h]; }
      if (!Object.values(o).some((v) => v !== "")) return; if (!o.no || !o.last || !o.first) { bad.push(i + 2); return; }
      o.no = String(o.no); o.status = o.status || "Active"; if (o.category && !["staff", "teacher", "admin"].includes(o.category)) o.category = /teach/i.test(o.category) ? "teacher" : /admin/i.test(o.category) ? "admin" : "staff";
      const old = ST.employees.find((x) => x.no === o.no); list.push(old ? { ...old, ...o } : o); });
    if (!list.length) return toast("No valid employees found. Employee No., Last name and First name are required.", true);
    if (!confirm(`Import ${list.length} employee(s)?${bad.length ? `\n${bad.length} row(s) skipped (missing Employee No./name): row ${bad.slice(0, 10).join(", ")}` : ""}`)) return;
    const r = await api("saveEmployees", { list }); applyEmps(r); ST.empView = "list"; toast(`${r.added} added, ${r.updated} updated.`); emp();
  };
}

/* ---------- Employees page: one section at a time ---------- */
const EMP_VIEWS = [["list", "Employees"], ["add", "Add employee information"], ["upload", "Upload employees (Excel / CSV)"]];

const empTabs = () => `<div class="chips noprint" id="evs">${EMP_VIEWS.map(([k, l]) => `<button data-ev="${k}" class="${(ST.empView || "list") === k ? "on" : ""}">${l}${k === "list" ? " (" + ST.employees.length + ")" : ""}</button>`).join("")}</div>`;

const paneHide = (k) => ((ST.empView || "list") === k ? "" : "hidden");

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ev]"); if (!b) return; ST.empView = b.dataset.ev; document.querySelectorAll("#evs [data-ev]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== ST.empView); if (ST.empView === "add") scrollTo(0, 0); });

/* ---------- Employee 2x2 picture ---------- */
const thumb = (x) => x.photo ? `<img class="thumb" src="${x.photo}" alt="">` : "";

const photoBox = (e) => { ST.photoDraft = undefined; return `<div class="photo"><div class="ph2" id="phv">${e.photo ? `<img src="${e.photo}" alt="">` : "<span>2x2<br>photo</span>"}</div><div><label>Picture (2x2)</label><input type="file" id="phf" accept="image/*"><p><button class="btn sm d" type="button" id="phx">Remove picture</button></p><p class="muted">Square 2x2 picture. It is cropped to the centre and made smaller automatically. Press Save to keep it.</p></div></div>`; };

function squarePhoto(file) {
  return new Promise((ok, no) => { const im = new Image(), fr = new FileReader(); fr.onerror = no; fr.onload = () => { im.src = fr.result; }; im.onerror = () => no(new Error("That file is not a picture.")); im.onload = () => { const s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 240; c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 240, 240); let q = .8, u = c.toDataURL("image/jpeg", q); while (u.length > 40000 && q > .3) { q -= .1; u = c.toDataURL("image/jpeg", q); } ok(u); }; fr.readAsDataURL(file); });
}

document.addEventListener("change", async (ev) => { if (ev.target.id !== "phf" || !ev.target.files[0]) return; try { ST.photoDraft = await squarePhoto(ev.target.files[0]); $("#phv").innerHTML = `<img src="${ST.photoDraft}" alt="">`; } catch (e) { toast(e.message, true); } });

document.addEventListener("click", (ev) => { if (ev.target.id === "phx") { ST.photoDraft = ""; $("#phv").innerHTML = "<span>2x2<br>photo</span>"; $("#phf").value = ""; } });

/* ---------- Employees: Admins | Staff (per department) | Teachers buttons, like the Payroll tab ---------- */
function empList() {
  const ES = ST.empSec || "all", depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  if (ES === "staff" && ST.empDept && !depts.includes(ST.empDept)) ST.empDept = "";
  const so = ST.empSort || "az";   // Sort filter: Name A - Z (default), Name Z - A, Employee no.
  return ST.employees.filter((x) => (ES === "all" || categoryOf(x) === ES) && (ES !== "staff" || !ST.empDept || (x.dept || "No department") === ST.empDept)).sort((a, b) => so === "no" ? String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) : so === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
}

function empFilter() {
  const ES = ST.empSec || "all", cnt = (k) => ST.employees.filter((x) => k === "all" || categoryOf(x) === k).length, depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  const cards = [["all", "All employees", "Admins, staff and teachers"], ...SECS];
  return `<div data-pane="list" ${paneHide("list")}><div class="seg noprint">${cards.map(([k, l, s]) => `<button class="${ES === k ? "on" : ""}" data-es="${k}"><b>${l}</b><small>${cnt(k)} employees &middot; ${s}</small></button>`).join("")}</div>
  <div class="row noprint" style="margin:.4rem 0"><div><label>Sort names</label><select id="esort">${[["az", "Name A - Z"], ["za", "Name Z - A"], ["no", "Employee no."]].map(([v, l]) => `<option value="${v}" ${(ST.empSort || "az") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
  ${ES === "staff" ? `<div class="chips noprint"><button class="${ST.empDept ? "" : "on"}" data-ed="">All departments</button>${depts.map((d) => `<button class="${ST.empDept === d ? "on" : ""}" data-ed="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}</div>`;
}

document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "esort") { ST.empSort = ev.target.value; emp(); } });

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-es],[data-ed]"); if (!b) return; if (b.dataset.es !== undefined) { ST.empSec = b.dataset.es; ST.empDept = ""; } else ST.empDept = b.dataset.ed; emp(); });


/* >>>>>>>>>> js/pages/loans.js >>>>>>>>>> */
/* ============================================================
   LOANS / CASH ADVANCE / CASH LOAN tab.
   File: js/pages/loans.js
   ============================================================ */

/* ---------- Loans, cash advances and allowances ---------- */
const LOAN_TYPES = ["Company Loan", "SSS Salary Loan", "SSS Calamity Loan", "HDMF MPL", "HDMF Calamity Loan"];

/** Loans saved with the old type names: the two that clearly match a new type are renamed; any other old type stays in the list as "(old type)" until you choose a new one, so nothing is changed behind your back. */
const LOAN_TYPE_MAP = { "SSS Loan": "SSS Salary Loan", "Pag-IBIG Loan": "HDMF MPL" };

const loanTypeOpts = (cur) => (LOAN_TYPES.includes(cur) || !cur ? "" : `<option selected>${esc(cur)} (old type)</option>`) + LOAN_TYPES.map((t) => `<option ${cur === t ? "selected" : ""}>${t}</option>`).join("");

/** The weekday boxes (and the "present only" box) of a weekday allowance row. */
const dowPick = (a) => `<div class="dowp" style="margin-top:.45rem;display:flex;flex-wrap:wrap;gap:.25rem .8rem">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label style="display:inline-flex;gap:.25rem;align-items:center;font-weight:500;white-space:nowrap"><input type="checkbox" class="adw" value="${d}" ${(a.days || []).includes(d) ? "checked" : ""}>${DOW_SHORT[d]}</label>`).join("")}</div><label style="display:flex;gap:.3rem;align-items:center;font-weight:500;margin-top:.3rem"><input type="checkbox" class="apo" ${a.presentOnly !== false ? "checked" : ""}>Pay only on days present (DTR)</label><label style="display:flex;gap:.3rem;align-items:center;font-weight:500;margin-top:.3rem"><input type="checkbox" class="aih" ${a.incHol === true ? "checked" : ""}>Include holidays and WFH days (paid even without a punch)</label>`;

function loans(selId) {
  const E = ST.employees; if (!E.length) return V('<div class="card"><p class="muted">Add employees first.</p></div>');
  const M = ST.tab === "ca" ? "ca" : ST.tab === "allow" ? "allow" : "loan", e = E.find((x) => x.id === selId) || E[0]; let W = { ca: { ...(e.ca || {}) }, deductions: (e.deductions || []).map((x) => ({ ...x, type: LOAN_TYPE_MAP[x.type] || x.type })), allowances: (e.allowances || []).map((x) => ({ ...x })) };
  const collect = () => ({
    ca: M === "ca" ? { ...W.ca, perPay: +$("#cap").value || 0 } : W.ca,   // the outstanding balance is never typed: it only changes through Add cash advance and the payroll
    deductions: M === "loan" ? [...document.querySelectorAll("[data-ln]")].map((r) => ({ id: r.dataset.id, type: $(".lt", r).value.replace(/ \(old type\)$/, ""), label: $(".ll", r).value.trim() || $(".lt", r).value, amount: +$(".la", r).value || 0, balance: $(".lb", r).value === "" ? "" : +$(".lb", r).value })) : W.deductions,
    allowances: M === "allow" ? [...document.querySelectorAll("[data-an]")].map((r) => {
      const m = $(".ap", r).value, o = { label: $(".al", r).value.trim(), amount: +$(".aa", r).value || 0, perDay: m === "1", taxable: $(".at", r).value === "1" };
      if (m === "2") { const bx = r.querySelectorAll(".adw"); o.perDow = true; o.days = bx.length ? [...bx].filter((c) => c.checked).map((c) => +c.value) : [1, 2, 3, 4, 5]; o.presentOnly = bx.length ? $(".apo", r).checked : true; o.incHol = bx.length ? $(".aih", r).checked : false; }   // chosen weekdays (a new one starts with Monday - Friday ticked)
      return o; }).filter((a) => a.label || a.amount) : W.allowances });
  const draw = () => {
    const hist = (W.ca.history || []).slice().reverse(), today = new Date().toISOString().slice(0, 10);
    const caCard = `<div class="card"><h3>Cash advance</h3><div class="form"><div><label>Outstanding balance (\u20B1) - automatic</label><input type="text" id="cab" value="${money(+W.ca.balance || 0)}" readonly disabled style="font-weight:700"></div><div><label>Deduct each payday (\u20B1)</label><input type="number" step="any" id="cap" value="${W.ca.perPay ?? 0}"></div></div>
    <p class="muted">The balance cannot be edited. A new cash advance is added to it automatically, and each payroll deducts the amount per payday (never more than the balance) when the payroll is saved.</p>
    <h4 style="margin:1rem 0 .3rem">Add cash advance</h4><div class="form"><div><label>Amount (\u20B1)</label><input type="number" step="any" min="0" id="ca_amt" placeholder="0.00"></div><div><label>Date</label><input type="date" id="ca_date" value="${today}"></div><div><label>Reason / note</label><input id="ca_note" placeholder="optional"></div></div>
    <p><button class="btn p" id="ca_add" type="button">+ Add cash advance</button></p>
    <h4 style="margin:1rem 0 .3rem">Cash advances given</h4><div class="tw"><table><tr><th>Date</th><th>Amount</th><th>Note</th></tr>${hist.map((h) => `<tr><td>${esc(h.date || "")}</td><td class="n">${money(h.amount)}</td><td>${esc(h.note || "")}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">No cash advance recorded yet.</td></tr>'}</table></div></div>`;
    const loanCard = `<div class="card"><h3>Loans (Company Loan, SSS Salary / Calamity Loan, HDMF MPL / Calamity Loan)</h3><div class="tw"><table><tr><th>Type</th><th>Description</th><th>Amount per month</th><th>Outstanding balance</th><th></th></tr>
    ${W.deductions.map((d, i) => `<tr data-ln data-id="${esc(d.id || "L" + Date.now() + i)}"><td><select class="lt">${loanTypeOpts(d.type)}</select></td><td><input class="ll" value="${esc(d.label || "")}"></td><td><input class="in la" type="number" step="any" value="${d.amount ?? ""}"></td><td><input class="in lb" type="number" step="any" value="${d.balance ?? ""}" placeholder="no limit"></td><td><button class="btn sm d" data-rl="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No loans.</td></tr>'}</table></div>
    <p class="muted">The monthly amount is split between the two cut-offs. When a balance is entered, the loan stops once it is fully paid.</p><p><button class="btn" id="al">+ Add loan</button></p></div>`;
    const allowCard = `<div class="card"><h3>Allowances</h3><div class="tw"><table><tr><th>Name</th><th>Amount (\u20B1)</th><th>Paid</th><th>Taxable</th><th></th></tr>
    ${W.allowances.map((a, i) => `<tr data-an><td><input class="al" value="${esc(a.label || "")}"></td><td><input class="in aa" type="number" step="any" value="${a.amount ?? ""}"></td><td><select class="ap"><option value="0">Month</option><option value="1" ${a.perDay && !isDowAllow(a) ? "selected" : ""}>Working day (every work day)</option><option value="2" ${isDowAllow(a) ? "selected" : ""}>Selected days of the week</option></select>${isDowAllow(a) ? dowPick(a) : ""}</td><td><select class="at"><option value="1">Yes</option><option value="0" ${a.taxable === false ? "selected" : ""}>No</option></select></td><td><button class="btn sm d" data-ra="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No allowances.</td></tr>'}</table></div><p class="muted">Month = a fixed monthly amount (split between the cut-offs). Working day = amount x the working days of a month. <b>Selected days of the week</b> = the amount is paid for each day you tick (for example Transportation: Mon, Wed, Fri = &#8369;100 a day). With "Pay only on days present" a day is paid only when the employee has a punch in the DTR; a day with no punch, a holiday or a leave day is not paid, unless you tick <b>Include holidays and WFH days</b>: then every ticked weekday that is a holiday or a WFH day is paid too. For an every-day allowance, tick all seven days. "Working day (every work day)" already includes holidays and WFH days.</p><p><button class="btn" id="aa">+ Add allowance</button></p></div>`;
    V(`${loanHead(e, E)}${M === "ca" ? caCard : M === "loan" ? loanCard : allowCard}<p><button class="btn p" id="sl">Save ${M === "ca" ? "cash advance" : M === "loan" ? "loans" : "allowances"}</button></p>`);
    $("#lq").onkeydown = (ev) => { if (ev.key === "Enter") { const m = loanSug($("#lq").value); if (m.length) { ev.preventDefault(); ST.loanQ = ""; loans(m[0].id); } } else if (ev.key === "Escape") $("#lsug").hidden = true; };
    if ($("#al")) $("#al").onclick = () => { W = collect(); W.deductions.push({ id: "L" + Date.now(), type: "Company Loan", label: "", amount: "", balance: "" }); draw(); };
    if ($("#aa")) $("#aa").onclick = () => { W = collect(); W.allowances.push({ label: "", amount: "", perDay: false, taxable: true }); draw(); };
    document.querySelectorAll("[data-rl]").forEach((b) => b.onclick = () => { W = collect(); W.deductions.splice(+b.dataset.rl, 1); draw(); });
    document.querySelectorAll("[data-ra]").forEach((b) => b.onclick = () => { W = collect(); W.allowances.splice(+b.dataset.ra, 1); draw(); });
    document.querySelectorAll("[data-an] .ap").forEach((s) => s.onchange = () => { W = collect(); draw(); });   // choosing "Selected days of the week" shows the weekday boxes
    if ($("#ca_add")) $("#ca_add").onclick = async () => {
      const amt = r2($("#ca_amt").value); if (!(amt > 0)) return toast("Enter the cash advance amount.", true);
      const c = collect().ca, h = [...(c.history || []), { id: "C" + Date.now(), date: $("#ca_date").value || new Date().toISOString().slice(0, 10), amount: amt, note: $("#ca_note").value.trim() }];
      e.ca = { ...c, balance: r2((+c.balance || 0) + amt), history: h };
      const r = await api("saveEmployees", { list: [e] }); applyEmps(r); toast("Cash advance added. New balance " + money(e.ca.balance) + "."); loans(e.id);
    };
    $("#sl").onclick = async () => { const nd = collect().allowances.find((a) => isDowAllow(a) && !a.days.length); if (nd) return toast("Tick at least one weekday for \"" + (nd.label || "allowance") + "\".", true); Object.assign(e, collect()); const r = await api("saveEmployees", { list: [e] }); applyEmps(r); toast("Saved."); loans(e.id); };
  };
  draw();
}

/* ---------- Cash Loan: employee number + information ---------- */
function loanHead(e, E) {
  setTimeout(() => { if ($("#lbody")) $("#lbody").innerHTML = loanRows(E, e.id); }, 0);
  const g = CATEGORIES.find((c) => c.key === categoryOf(e)), rate = (x) => isHourly(x) ? money(Math.max(+x.hourlyRate || 0, minHourly(ST.settings))) + " / hr" : money(dailyRateOf(x, ST.settings)) + " / day";
  return `<div class="card noprint"><div class="who">${e.photo ? `<img class="av" src="${e.photo}" alt="">` : `<div class="av">${esc(String(e.first || e.name || "?")[0])}</div>`}<div style="flex:1;min-width:16rem;position:relative"><label>Search employee</label><input id="lq" type="search" autocomplete="off" placeholder="Type employee no. or name" value="" style="width:100%"><div id="lsug" class="noprint" hidden style="position:absolute;left:0;right:0;top:100%;z-index:30;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:16rem;overflow:auto"></div></div></div>
  <div class="facts"><span><small>Employee No.</small><b>${esc(e.no)}</b></span><span><small>Name</small><b>${esc(nameOf(e))}</b></span><span><small>Position</small><b>${esc(e.position || "-")}</b></span><span><small>Department</small><b>${esc(e.dept || "-")}</b></span><span><small>Payroll group</small><b>${g.short}</b></span><span><small>Rate</small><b>${rate(e)}</b></span></div></div>`;
}

const loanFind = (E, q) => E.filter((x) => [x.no, nameOf(x), x.position, x.dept].join(" ").toLowerCase().includes(q));

/** Rows of the cash advance / loans / allowances list: only the employees who have one (biggest first); the search box narrows that list. */
function loanRows(E, selId) {
  const q = (ST.loanQ || "").trim().toLowerCase(), T = ST.tab, bal = (x) => (x.deductions || []).reduce((n, d) => n + (+d.balance || 0), 0), alw = (x) => (x.allowances || []).reduce((n, a) => n + allowMonthly(a, ST.settings), 0);
  const val = (x) => (T === "ca" ? +(x.ca || {}).balance || 0 : T === "allow" ? alw(x) : bal(x)), what = T === "ca" ? "a cash advance" : T === "allow" ? "an allowance" : "a loan";
  let L = E.filter((x) => val(x) > 0).sort((a, b) => val(b) - val(a));
  if (q) L = loanFind(L, q);
  const h = $("#lhint"); if (h) { h.textContent = ""; h.style.display = "none"; }
  return L.map((x) => `<tr class="pick ${x.id === selId ? "sel" : ""}" data-pick="${x.id}"><td>${esc(x.no)}</td><td>${esc(nameOf(x))}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${CATEGORIES.find((c) => c.key === categoryOf(x)).short}</td><td class="n">${money(val(x))}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">${q ? "No employee with " + what + " matches your search." : "Nobody has " + what + "."}</td></tr>`;
}

/** Employees that match what was typed in the search box (employee no., name, position or department): at most 8. */
const loanSug = (q) => { q = String(q || "").trim().toLowerCase(); return q ? loanFind(ST.employees, q).slice(0, 8) : []; };

document.addEventListener("input", (ev) => { if (ev.target.id !== "lq") return; ST.loanQ = ev.target.value; const box = $("#lsug"), L = loanSug(ev.target.value); if (!box) return;
  box.innerHTML = L.map((x) => `<div data-sg="${x.id}" style="padding:.5rem .8rem;cursor:pointer;border-bottom:1px solid var(--line)"><b>${esc(x.no)}</b> - ${esc(nameOf(x))}<br><small class="muted">${esc(x.position || "")}${x.dept ? " &middot; " + esc(x.dept) : ""}</small></div>`).join("") || `<div class="muted" style="padding:.6rem .8rem">No employee found.</div>`;
  box.hidden = !ev.target.value.trim(); });

document.addEventListener("click", (ev) => { const g = ev.target.closest("[data-sg]"); if (g && ["ca", "loans", "allow"].includes(ST.tab)) { ST.loanQ = ""; loans(g.dataset.sg); return; } if (!ev.target.closest("#lsug") && ev.target.id !== "lq") { const b = $("#lsug"); if (b) b.hidden = true; } });

document.addEventListener("click", (ev) => { const r = ev.target.closest("tr[data-pick]"); if (r && ["ca", "loans", "allow"].includes(ST.tab)) loans(r.dataset.pick); });


/* >>>>>>>>>> js/pages/payroll.js >>>>>>>>>> */
/* ============================================================
   PAYROLL tab - Admins | Staff | Teachers payroll run.
   File: js/pages/payroll.js
   ============================================================ */

/* ---------- Payroll run ---------- */
const activeEmps = () => ST.employees.filter((e) => (e.status || "Active") === "Active");

/* ---------- Payroll: Admins | Staff (per department) | Teachers (Faculty) ---------- */
const SECS = [["admin", "Admins", "School admins"], ["staff", "Staff", "Employees per department"], ["teacher", "Teachers", "Faculty, paid per hour"]];

function run() {
  ST._dm = null;
  const S = ST.settings, showLate = (S.dtr.late || {}).deduct !== false, now = new Date(), m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, R = ST.run || { month: m, cut: S.cutoffPair === "A" ? "c11_25" : "c1_15", inp: {}, sec: "staff", dept: "" };
  ST.run = R; R.sec ||= "staff"; R.dept ||= "";
  const per = () => cutoffPeriod(R.month, R.cut);
  /* Teachers: hours come from the CLASS CHECK (acts as the teacher's biometric). Load it for this cut-off first. */
  const clsOn = clsBioOn(S), ckey = per().start + "|" + per().end;
  if (R.sec === "teacher" && clsOn && (!ST.clsPay || ST.clsPay.key !== ckey)) {
    V('<div class="card muted">Loading the class check of this cut-off...</div>');
    api("clsReport", { from: per().start, to: per().end }).then((r) => { ST.clsPay = { key: ckey, classes: r.classes || [], att: r.att || [] }; run(); }).catch(() => { ST.clsPay = { key: ckey, classes: [], att: [], failed: true }; run(); });
    return;
  }
  const eff = (e) => {
    const p = per(), i = { ...(R.inp[e.id] || {}) }, dt = (phEnsure(+p.start.slice(0, 4)), phEnsure(+p.end.slice(0, 4)), daysOf(e)) ? dtrCalc(e, p.start, p.end) : null, fill = (k, v) => { if (i[k] === undefined || i[k] === "") i[k] = v; };
    const cl = R.sec === "teacher" || isHourly(e) ? (clsOn && ST.clsPay && ST.clsPay.key === ckey ? clsHoursOf(e, p.start, p.end, ST.clsPay.classes, ST.clsPay.att) : null) : null, typed = (k) => { const v = (R.inp[e.id] || {})[k]; return v !== undefined && v !== ""; };
    if (dt) { fill("absentDays", dt.absent); fill("lateMin", lateOn(e) ? dt.late : 0); fill("otHours", dt.ot); if (!(cl && cl.has)) fill("hoursWorked", Math.round(dt.hrsMin / 60 * 10000) / 10000); i.dtr = { present: dt.present }; i.presentDates = dt.presentDates;
      i.absentList = typed("absentDays") ? null : dt.rows.filter((r) => r.st === "absent" || r.st === "half").map((r) => ({ d: r.d, why: r.st === "half" ? "half day" : r.why || "absent" }));
      if (!(R.sec === "teacher" || isHourly(e))) { i.halfList = dt.rows.filter((r) => r.st === "half").map((r) => ({ d: r.d, why: r.why || "half day" })); i.underList = dt.rows.filter((r) => r.earlyOut > 0).map((r) => ({ d: r.d, min: r.earlyOut, out: r.out })); }   // shown on the payslip of employees: half days and undertime (early time out)
      i.lateDays = dt.rows.filter((r) => r.late > 0).length; i.lateActMin = dt.rows.reduce((n, r) => n + (r.late > 0 ? (+r.lateRaw || +r.late || 0) : 0), 0); i.lateList = typed("lateMin") ? null : dt.rows.filter((r) => r.late > 0).map((r) => ({ d: r.d, min: r.late, act: r.lateRaw })); }
    if (cl && cl.has) { fill("hoursWorked", Math.round(cl.mins / 60 * 10000) / 10000); i.presentDates = [...new Set([...(i.presentDates || []), ...cl.presentDates])].sort(); i.dtr = { present: cl.presentDates.length }; i.classInfo = { lateOn: cl.lateOn, earlyOutOn: cl.earlyOutOn, schedMin: cl.schedMin, mins: cl.mins, lateMin: cl.lateMin, lateDedMin: cl.lateDedMin, lateList: cl.lateList, earlyInMin: cl.earlyInMin, earlyInList: cl.earlyInList, earlyOutMin: cl.earlyOutMin, earlyOutList: cl.earlyOutList, absent: cl.absent, noRecord: cl.noRecord, noOut: cl.noOut, classes: cl.held }; }
    const lv = lvInPeriod(e, p.start, p.end); i.leavePaid = lv.paid; i.leaveList = lvOf(e).filter((x) => !x.paid && x.from <= p.end && x.to >= p.start).map((x) => ({ type: x.type, from: x.from > p.start ? x.from : p.start, to: x.to < p.end ? x.to : p.end })); if (S.unpaidLeave !== false && !isHourly(e)) i.leaveDays = lv.unpaid;
    i.hol = (S.dtr.holidays || []).filter((h) => h.date >= p.start && h.date <= p.end && ((S.dtr.workDays || [1, 2, 3, 4, 5]).includes(new Date(h.date + "T12:00").getDay()) || (h.type === "regular" && S.restDayHoliday !== false))).filter((h, k, a) => a.findIndex((x) => x.date === h.date) === k).map((h) => { const r = dt && dt.rows.find((x) => x.d === h.date); return { date: h.date, label: h.label, type: h.type, worked: !!(r && r.inn !== null), hours: r ? r.hrs : 0, sched: tHrs(e, new Date(h.date + "T12:00").getDay()) }; });
    const holD = (S.dtr.holidays || []).map((h) => h.date);
    i.wfh = (S.dtr.wfhDays || []).filter((w) => w.date >= p.start && w.date <= p.end && !holD.includes(w.date) && (S.dtr.workDays || [1, 2, 3, 4, 5]).includes(new Date(w.date + "T12:00").getDay())).map((w) => { const r = dt && dt.rows.find((x) => x.d === w.date); return { date: w.date, label: w.label, type: w.type, hours: (w.hours !== null && w.hours !== undefined && w.hours !== "") ? w.hours : (tHrs(e, new Date(w.date + "T12:00").getDay()) ?? w.hours), worked: !!(r && r.inn !== null) }; });
    return i;
  };
  const calc = (e) => computeSlip(e, eff(e), S, per()), all = activeEmps(), inSec = (e) => categoryOf(e) === R.sec;
  const depts = [...new Set(all.filter((e) => categoryOf(e) === "staff").map((e) => e.dept || "No department"))].sort();
  if (R.sec === "staff" && R.dept && !depts.includes(R.dept)) R.dept = "";
  R.sort ||= "az";   // Sort filter: Name A - Z (default), Name Z - A, Employee no.
  const byNo = (a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }), rows = all.filter((e) => inSec(e) && (R.sec !== "staff" || !R.dept || (e.dept || "No department") === R.dept)).sort((a, b) => R.sort === "no" ? byNo(a, b) : R.sort === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
  const exRun = (ST.runs || []).find((x) => x.period === per().label && x.group === R.sec), isFin = !!exRun && exRun.status !== "Draft", isDraft = !!exRun && exRun.status === "Draft";
  const when = (k, l) => `<div><label>${l}</label><select data-w="${k}"><option value="split">Split in both cut-offs</option><option value="first" ${S[k].when === "first" ? "selected" : ""}>1st cut-off</option><option value="second" ${S[k].when === "second" ? "selected" : ""}>2nd cut-off</option></select></div>`;
  const head = `<div class="card noprint"><div class="row"><div><label>Month</label><input type="month" id="rm" value="${R.month}"></div><div><label>Cut-off</label><select id="rc">${CUTOFFS.map((c) => `<option value="${c.key}" ${R.cut === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="pd" value="${R.payDate || payDateOf(R.month, per().half, S.period)}"></div><button class="btn" id="sd" ${isFin ? "disabled" : ""}>Save as draft</button><button class="btn p" id="sr" ${isFin ? "disabled" : ""}>Finalize</button></div>
  ${isFin ? `<p class="muted" style="color:#1a7f37"><b>&#10004; This payroll is FINALIZED and locked.</b> To redo it, delete the run under Payslips first.</p>` : isDraft ? `<p class="muted" style="color:#8a5a00"><b>A DRAFT of this payroll is saved.</b> <button class="btn sm" id="ldd">Load saved draft</button> Drafts are not final: balances are not reduced and they are left out of reports and 13th month pay until you press Finalize.</p>` : `<p class="muted"><b>Save as draft</b> keeps your work so you can come back and change it. <b>Finalize</b> locks the payroll, reduces cash advance / loan balances and counts it in reports and 13th month pay.</p>`}
  <p class="muted">Period: <b>${per().label}</b>. Admins, Staff and Teachers are each saved as their own payroll run.${S.dtr.holidays.some((h) => h.date >= per().start && h.date <= per().end) ? " Holidays in this period are added automatically." : ""}${(S.dtr.wfhDays || []).some((h) => h.date >= per().start && h.date <= per().end) ? " WFH / asynchronous class days in this period are paid automatically." : ""}</p>
  <div class="row benefits"><b>Government benefits are deducted on:</b>${when("sss", "SSS")}${when("phic", "PhilHealth")}${when("hdmf", "Pag-IBIG")}</div></div>
  <div class="seg noprint">${SECS.map(([k, l, s]) => `<button class="${R.sec === k ? "on" : ""}" data-s="${k}"><b>${l}</b><small>${all.filter((e) => categoryOf(e) === k).length} employees &middot; ${s}</small></button>`).join("")}</div>
  <div class="row noprint" style="margin:.4rem 0"><div><label>Sort names</label><select id="rsort"><option value="az" ${R.sort === "az" ? "selected" : ""}>Name A - Z</option><option value="za" ${R.sort === "za" ? "selected" : ""}>Name Z - A</option><option value="no" ${R.sort === "no" ? "selected" : ""}>Employee no.</option></select></div></div>
  ${R.sec === "staff" ? `<div class="chips noprint"><button class="${R.dept ? "" : "on"}" data-d="">All departments</button>${depts.map((d) => `<button class="${R.dept === d ? "on" : ""}" data-d="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}`;
  const showOt = (S.dtr.ot || {}).auto !== false || (S.otFile || []).some((x) => x.date >= per().start && x.date <= per().end), hr = R.sec === "teacher", f = (e, k, off) => { const v = (R.inp[e.id] || {})[k] ?? (off ? "" : eff(e)[k] ?? ""), mm = k === "lateMin" ? +v : k === "otHours" || k === "hoursWorked" ? Math.round(+v * 60) : 0; const shown = (k === "hoursWorked" || k === "otHours") && v !== "" && !isNaN(+v) ? fmtHMc(Math.round(+v * 60)) : v, ci = k === "hoursWorked" ? calc(e).classInfo : null; return `<td><input class="in" data-id="${e.id}" data-k="${k}" value="${shown}" ${k === "hoursWorked" || k === "otHours" ? 'placeholder="H:MM" title="Hours:Minutes, e.g. 2:00" ' : ""}${off ? "disabled" : ""}>${mm > 0 && k !== "hoursWorked" && k !== "otHours" ? `<br><small class="muted">${fmtHM(mm)}</small>` : ""}${ci ? `<br><small class="muted" title="From the class check">Class check: ${fmtHMc(ci.mins)} of ${fmtHMc(ci.schedMin)} scheduled${ci.absent ? ` &middot; <b style="color:#b3121f">${ci.absent} absent</b>` : ""}${ci.noRecord ? ` &middot; <b style="color:#b45309">${ci.noRecord} not checked</b>` : ""}${ci.noOut ? ` &middot; ${ci.noOut} no clock-out` : ""}</small>` : ""}</td>`; };
  /* Teachers: late deduction shown beside Hours taught. Same figure as the Late line on the payslip: the late hours already taken out of Hours taught (class check, counted per whole hour after the grace period), or the late minutes of the DTR when the teacher has no class schedule. */
  const lateInfo = (e, c) => { const ci = c.classInfo, i = eff(e); let lm = 0, real = 0, days = 0; if (ci && ci.lateOn !== false && (+(ci.lateDedMin ?? ci.lateMin) || 0) > 0) { lm = +(ci.lateDedMin ?? ci.lateMin) || 0; real = +ci.lateMin || 0; days = (ci.lateList || []).length; } else if (c.lateMin > 0) { lm = +c.lateMin || 0; real = +i.lateActMin || lm; days = +i.lateDays || 0; } return { lm, real, days, amt: lm > 0 ? (c.perHour ? r2(lm / 60 * c.rate) : r2(c.late)) : 0 }; };   // one source for the payroll columns AND what is saved to the Main DB / Backup report
  const lateDedCell = (e, c) => { const li = lateInfo(e, c); return `<td class="n">${li.lm > 0 ? `<b>${fmtHMc(li.lm)}</b><br><small class="muted" title="Late deduction = late hours x hourly rate">${money(li.amt)}${li.days ? ` &middot; ${li.days} late day${li.days === 1 ? "" : "s"}` : ""}${li.real && li.real !== li.lm ? ` &middot; ${fmtHMc(li.real)} late after grace` : ""}</small>` : '<span class="muted">-</span>'}</td>`; };
  const body = rows.map((e) => { const c = calc(e); return `<tr><td>${esc(e.no)}</td><td>${esc(nameOf(e))}<br><small class="muted">${esc(e.position)}${e.dept ? " &middot; " + esc(e.dept) : ""}</small></td>${hr ? f(e, "hoursWorked") + lateDedCell(e, c) : f(e, "absentDays") + (showLate ? f(e, "lateMin") + `<td class="n">${lateInfo(e, c).days}</td>` : "")}${showOt ? f(e, "otHours") : ""}${f(e, "otherEarn")}${f(e, "otherDed")}<td><input class="in" data-id="${e.id}" data-k="otherDedNote" value="${esc((R.inp[e.id] || {}).otherDedNote || "")}" placeholder="Reason of other deduction" style="min-width:11rem"></td><td class="n"><input class="in" data-id="${e.id}" data-k="caDed" value="${c.caDed}" title="Cash advance deducted this pay (balance ${money(c.caBal)})">${c.caBal > 0 ? `<br><small class="muted">Balance ${money(c.caBal)}</small>` : ""}</td><td class="n">${money(c.holPay + (c.wfhPay || 0))}</td><td class="n">${money(c.gross)}</td><td class="n">${money(c.sssEe + c.phicEe + c.hdmfEe)}</td><td class="n">${money(c.tax)}</td><td class="n">${money(c.totalDed)}</td><td class="n"><b>${money(c.net)}</b></td></tr>`; }).join("");
  const tot = (k) => money(rows.reduce((n, e) => n + calc(e)[k], 0));
  V(head + `<div class="card"><div class="tw"><table><tr><th>No.</th><th>Employee</th>${hr ? "<th>Hours taught</th><th class=\"n\">Late hours deducted</th>" : "<th>Absent days</th>" + (showLate ? "<th>Late min</th><th class=\"n\">Late days</th>" : "")}${showOt ? "<th>OT hours (H:MM)</th>" : ""}<th>Other earn</th><th>Other ded</th><th>Reason (other ded)</th><th class="n">Cash advance</th><th class="n">Holiday / WFH pay</th><th class="n">Gross</th><th class="n">SSS+PHIC+HDMF</th><th class="n">Tax</th><th class="n">Total ded</th><th class="n">Net pay</th></tr>${body || `<tr><td colspan="${2 + (hr ? 2 : 1 + (showLate ? 2 : 0)) + (showOt ? 1 : 0) + 10}" class="muted">No active ${R.sec === "admin" ? "admins" : R.sec === "teacher" ? "teachers" : "staff"} here. Set the payroll group of an employee under Employees.</td></tr>`}
  ${rows.length ? `<tr class="tot"><td colspan="${2 + (hr ? 2 : 1 + (showLate ? 2 : 0)) + (showOt ? 1 : 0) + 3}">Total (${rows.length})</td><td class="n">${tot("caDed")}</td><td class="n">${money(rows.reduce((n, e) => { const c = calc(e); return n + c.holPay + (c.wfhPay || 0); }, 0))}</td><td class="n">${tot("gross")}</td><td class="n">${money(rows.reduce((n, e) => { const c = calc(e); return n + c.sssEe + c.phicEe + c.hdmfEe; }, 0))}</td><td class="n">${tot("tax")}</td><td class="n">${tot("totalDed")}</td><td class="n">${tot("net")}</td></tr>` : ""}</table></div></div>`);
  $("#rm").onchange = (e) => { R.month = e.target.value; R.payDate = ""; run(); }; $("#rc").onchange = (e) => { R.cut = e.target.value; R.payDate = ""; run(); }; $("#pd").onchange = (e) => R.payDate = e.target.value;
  $("#rsort").onchange = (e) => { R.sort = e.target.value; run(); };
  document.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { R.sec = b.dataset.s; run(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { R.dept = b.dataset.d; run(); });
  document.querySelectorAll("[data-w]").forEach((b) => b.onchange = async () => { S[b.dataset.w].when = b.value; await api("saveSettings", S); toast("Deduction cut-off saved."); run(); });
  document.querySelectorAll("input.in").forEach((el) => el.onchange = () => { let v = el.value; if (el.dataset.k === "hoursWorked" || el.dataset.k === "otHours") { v = hmParse(v); if (v === null) { toast("Type the hours as Hours:Minutes, e.g. 8:30.", true); return run(); } } (R.inp[el.dataset.id] ||= {})[el.dataset.k] = v; run(); });
  if (R.sec === "teacher" && clsOn) { const b = document.createElement("p"); b.className = "muted noprint"; b.innerHTML = `Teachers' hours are counted from the <b>Class check</b> (it works as the teacher's biometric). A teacher with no class in the Class schedule uses the DTR hours instead. Typing a time in the Hours taught box overrides it. <button class="btn sm" id="clsrf">Reload class check</button>`; const tw = document.querySelector(".tw"); if (tw && tw.parentElement) tw.parentElement.appendChild(b); $("#clsrf").onclick = () => { ST.clsPay = null; run(); }; }
  const save = async (status) => {
    const sec = R.sec, secL = (SECS.find((x) => x[0] === sec) || [])[1], L = all.filter(inSec), slips = L.map((e) => { const c0 = calc(e), li = lateInfo(e, c0); return { no: e.no, name: nameOf(e), position: e.position, calc: { ...c0, lateDays: li.days, lateDedMin: li.lm, lateActMin: li.real, lateAmt: li.amt, _inp: R.inp[e.id] || {} } }; }), sum = (k) => slips.reduce((n, x) => n + x.calc[k], 0);
    if (!slips.length) return toast(`No active ${secL.toLowerCase()}.`, true);
    const ex = (ST.runs || []).find((x) => x.period === per().label && x.group === sec);
    if (ex && ex.status !== "Draft") return toast("This payroll is already finalized and locked. Delete it under Payslips if you must redo it.", true);
    const noWhy = L.filter((e) => +((R.inp[e.id] || {}).otherDed) > 0 && !String((R.inp[e.id] || {}).otherDedNote || "").trim());
    if (status === "Finalized" && noWhy.length && !confirm(`${noWhy.length} employee(s) have an "Other deduction" without a reason:\n${noWhy.slice(0, 8).map((e) => "- " + nameOf(e)).join("\n")}\n\nThe payslip will say "reason not stated". Finalize anyway?`)) return;
    if (status === "Finalized" && !confirm(`Finalize the ${secL} payroll for ${per().label}?\n\nIt will be locked, cash advance and loan balances will be reduced, and it will be counted in reports and 13th month pay.`)) return;
    const rid = (R.ids && R.ids[sec]) || (ex && ex.id) || "";
    const r = await api("saveRun", { id: rid, group: sec, period: per().label, payDate: $("#pd").value, slips, gross: r2(sum("gross")), ded: r2(sum("totalDed")), net: r2(sum("net")), status });
    (R.ids ||= {})[sec] = r.id;
    if (status === "Finalized") {   // only a finalized payroll lowers the cash advance and loan balances (a draft never does)
      const upd = []; L.forEach((e, i) => { const c = slips[i].calc; let ch = false; if (c.caDed > 0) { e.ca = { ...(e.ca || {}), balance: c.caAfter }; ch = true; } (c.dedList || []).forEach((d) => { const x = (e.deductions || []).find((y) => y.id === d.id); if (x && d.balanceAfter !== null && d.amount > 0) { x.balance = d.balanceAfter; ch = true; } }); if (ch) upd.push(e); }); if (upd.length) await api("saveEmployees", { list: upd });
    }
    ST.runs = r.runs || (await api("listRuns"));
    if (status === "Draft") { toast(`${secL} payroll saved as DRAFT. You can keep editing it and finalize later.`); run(); }
    else { ST.run = null; ST.tab = "slips"; ST.slipRun = r.id; toast(`${secL} payroll FINALIZED and saved to the spreadsheet.`); shell(); }
  };
  $("#sd").onclick = () => save("Draft"); $("#sr").onclick = () => save("Finalized");
  if ($("#ldd")) $("#ldd").onclick = async () => {
    const L = await api("getRun", { id: exRun.id }); R.inp = {};
    L.forEach((s) => { const e = all.find((x) => String(x.no) === String(s.no)); if (e && s.calc && s.calc._inp) R.inp[e.id] = { ...s.calc._inp }; });
    R.payDate = String(exRun.payDate || "").slice(0, 10); (R.ids ||= {})[R.sec] = exRun.id; toast("Draft loaded."); run();
  };
}


/* >>>>>>>>>> js/pages/payslips.js >>>>>>>>>> */
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
  /* Regular Pay = the regular working days of the cut-off; Holiday pay (below it) = the holidays of the cut-off. The monthly pay already covers the holidays, so for fixed-pay people the holidays
     (holidays x daily rate) are taken out of Regular Pay and shown as Holiday pay, plus any extra for working on a holiday. The gross pay is the same as before. */
  const hn = c.holidays || 0, split = !c.perHour && !(c.manual && c.manual.basic) && hn > 0 && c.dailyRate > 0, holBase = split ? Math.min(c.basic, r2(hn * c.dailyRate)) : 0,
    regDays = c.perHour ? null : Math.max(0, r2((c.paidDays || 0) - (split ? hn : 0))), regPay = r2(c.basic - holBase), holAmt = r2(holBase + (c.holPay || 0));
  const E = [[c.perHour ? "Teaching pay" : "Regular Pay", regPay]];   // no "x rate" computation on the line: the days / hours are in the summary row above
  if (holAmt > 0) E.push(["Holiday pay", holAmt]);   // right below Regular Pay
  if ((c.allowList || []).length) c.allowList.forEach((a) => a.amount && E.push([a.label || "Allowance", a.amount])); else if (c.allow) E.push(["Allowances", c.allow]);
  if (c.ot) E.push(["Overtime" + (c.otHours > 0 ? " (" + fmtHMc(Math.round(c.otHours * 60)) + " hrs)" : ""), c.ot]); if (c.otherEarn) E.push(["Other earnings", c.otherEarn]); if (c.wfhPay) E.push([c.perHour ? (c.wfhFixed ? "WFH / Async class pay (fixed per day)" : "WFH / Async class pay (per hour)") : "WFH / Async class pay (per day)", c.wfhPay]);
  /* DEDUCTIONS: every line says WHAT it is for (D = [label, amount, reason]) */
  const W = c.why || {}, fd = (d) => { const x = new Date(String(d).slice(0, 10) + "T12:00"); return isNaN(x) ? String(d) : x.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }, dl = (arr, f, max) => { const a = (arr || []).map(f); return a.slice(0, max || 8).join(", ") + (a.length > (max || 8) ? ` +${a.length - (max || 8)} more` : ""); };
  const D = [], AB = [];   // AB = absences / half days: shown on the EARNINGS side as a minus (not under DEDUCTIONS)
  const hv = +((ST.settings.dtr || {}).halfDayAbs ?? 0.5), hList = !c.perHour && Array.isArray(W.halfList) && Array.isArray(W.absentList) ? W.halfList : [], halfDays = r2(hList.length * hv), halfAmt = Math.min(c.absent || 0, r2(halfDays * (c.dailyRate || 0)));   // half days are shown on their own line
  const m12 = (m) => { m = Math.round(+m || 0); const h = Math.floor(m / 60) % 24; return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
  if (hList.length && halfAmt > 0) AB.push(["Less: Half day", halfAmt, hList.map((x) => `${fd(x.d)} (${x.why})`).join("; ") + ` x ${hv} day x ${P(c.dailyRate)} per day`]);
  if (c.absent - halfAmt > 0.004) { const lvD = +c.leaveDays || 0, abD = Math.max(0, r2((c.absentDays || 0) - lvD - halfDays)), parts = [], aList = Array.isArray(W.absentList) ? W.absentList.filter((x) => !(hList.length && x.why === "half day")) : W.absentList;
    if (abD > 0) parts.push(`${abD} day${abD === 1 ? "" : "s"} absent` + (Array.isArray(aList) && aList.length ? ": " + dl(aList, (x) => `${fd(x.d)} (${x.why})`) : " (entered by payroll)"));
    if (lvD > 0) parts.push(`${lvD} day${lvD === 1 ? "" : "s"} leave without pay` + ((W.leaveList || []).length ? ": " + dl(W.leaveList, (x) => `${x.type || "Leave"} ${fd(x.from)}${x.to !== x.from ? " - " + fd(x.to) : ""}`) : ""));
    AB.push([lvD > 0 ? "Less: Absences / unpaid leave" : "Less: Absences", r2(c.absent - halfAmt), parts.join("; ") + ` x ${P(c.dailyRate)} per day`]); }
  { const al = r2((c.allowList || []).reduce((t, x) => t + (x.less > 0.004 ? x.less : 0), 0));   // daily allowance not paid on absent days: added into the "Less: Absences" line (one minus for the absences)
    if (al > 0.004) { const ab = AB.find((x) => /^Less: Absences/.test(x[0])); if (ab) ab[1] = r2(ab[1] + al); else AB.push(["Less: Absences", al, ""]); } }
  if (c.late) AB.push(["Less: Late" + (c.lateMin ? " (" + fmtHMc(c.lateMin) + ")" : ""), c.late, (Array.isArray(W.lateList) && W.lateList.length ? `Came in late ${W.lateList.length} day${W.lateList.length === 1 ? "" : "s"}: ` + dl(W.lateList, (x) => `${fd(x.d)} ${fmtHMc(x.min)}${x.act && x.act !== x.min ? " (actual " + fmtHMc(x.act) + " late)" : ""}`) : "Late minutes entered by payroll") + "; after the grace period", true]);
  if (!c.perHour && Array.isArray(W.underList) && W.underList.length) { const um = W.underList.reduce((n, x) => n + (+x.min || 0), 0); AB.push(["Less: Undertime (" + fmtHMc(um) + ") - no deduction", 0, dl(W.underList, (x) => `${fd(x.d)}: out ${m12(x.out)} (${fmtHMc(x.min)} early)`), true]); }
  (W.holDedList || []).length ? D.push(["Holiday deduction", c.holDed, W.holDedList.map((h) => `${h.label || fd(h.date)} (${fd(h.date)}): paid at ${h.pct}% of the day`).join("; ")]) : c.holDed ? D.push(["Holiday deduction", c.holDed, "Holiday paid below 100% of the day (Settings)"]) : 0;
  (W.wfhDedList || []).length ? D.push(["WFH / Async deduction", c.wfhDed, W.wfhDedList.map((h) => `${fd(h.date)}${h.label ? " " + h.label : ""}: ${h.pct ? "paid at " + h.pct + "%" : "day without pay"}`).join("; ")]) : c.wfhDed ? D.push(["WFH / Async deduction", c.wfhDed, "WFH / asynchronous day paid below 100%"]) : 0;
  const timing = (w) => (!W.semi ? "" : w === "first" ? "; taken in the 1st cut-off" : w === "second" ? "; taken in the 2nd cut-off" : "; half in each cut-off"), gov = (nm, v, w, man) => D.push([nm, v, man ? "Amount set by payroll for this run" : v > 0 ? "Required contribution, employee share" + timing(w) : W.semi ? "Taken in the other cut-off" : "Not deducted"]);
  gov("SSS", c.sssEe, W.sssWhen, W.manualSss); gov("PhilHealth", c.phicEe, W.phicWhen, W.manualPhic); gov("Pag-IBIG", c.hdmfEe, W.hdmfWhen, W.manualHdmf);
  D.push(["Withholding tax", c.tax, W.manualTax ? "Amount set by payroll for this run" : W.taxWhy === "fixed" ? "Fixed tax amount set for this employee" : W.taxWhy === "mwe" ? "Minimum wage earner: no income tax" : c.tax > 0 ? "Tax on compensation (BIR table)" : "No tax due"]);
  (c.dedList || []).filter((d) => d.amount > 0).forEach((d) => D.push([[d.type, d.label].filter(Boolean).join(": ") || "Loan", d.amount, d.balanceBefore !== null && d.balanceBefore !== undefined ? `Loan payment; balance ${P(d.balanceBefore)} to ${P(d.balanceAfter)}` : "Loan / recurring deduction"]));
  if (c.otherDed) D.push(["Other deduction", c.otherDed, W.otherDedNote || "Reason not stated"]);
  if (!(c.dedList || []).length && !c.otherDed && c.other) D.push(["Loans / other", c.other, "Loans / other deductions"]);
  if (c.caDed) D.push(["Cash advance", c.caDed, `Repayment; balance ${P(c.caBal)} to ${P(c.caAfter)}`]);
  const ci = c.classInfo;
  let lateAdd = 0;
  if (c.perHour && !(ci && (ci.lateDedMin ?? ci.lateMin) > 0 && ci.lateOn !== false) && c.lateMin > 0) {
    const dy0 = (d) => new Date(String(d).slice(0, 10) + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), amt0 = r2(c.lateMin / 60 * c.rate);
    lateAdd += amt0; AB.push(["Less: Late (" + fmtHMc(c.lateMin) + ")", amt0, (W.lateList || []).map((x) => `${dy0(x.d)}: ${fmtHMc(x.min)} late`).join("; "), true]);
    const bi0 = E.findIndex((x) => /^Teaching pay/.test(x[0])); if (bi0 >= 0) E[bi0] = [E[bi0][0].replace(/\(.*? hrs/, `(${fmtHMc(Math.round(c.hours * 60) + c.lateMin)} hrs`), E[bi0][1] + amt0];
  }
  if (c.perHour && ci) {
    const t12 = (x) => { if (!x) return ""; const [h, i] = String(x).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(i || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
    const dy = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const eo = ci.earlyOutOn === false ? 0 : (+ci.earlyOutMin || 0), lm = ci.lateOn === false ? 0 : (ci.lateDedMin !== undefined ? +ci.lateDedMin || 0 : +ci.lateMin || 0);   // a late / early out that is not deducted (Settings > Teachers) is not shown as a deduction
    if (lm > 0) { const amt = r2(lm / 60 * c.rate); lateAdd += amt; AB.push(["Less: Late (" + fmtHMc(lm) + ")", amt, (ci.lateList || []).map((x) => `${dy(x.d)}: class ${t12(x.start)}, in ${t12(x.inn)} (${fmtHMc(x.min)} late after grace${x.ded ? ", deducted " + fmtHMc(x.ded) : ""})`).join("; "), true]); }
    if (eo > 0) { const amt = r2(eo / 60 * c.rate); lateAdd += amt; AB.push(["Less: Early out / undertime (" + fmtHMc(eo) + ")", amt, (ci.earlyOutList || []).map((x) => `${dy(x.d)}: class ends ${t12(x.end)}, out ${t12(x.out)} (${fmtHMc(x.min)} early)`).join("; "), true]); }
    if ((+ci.earlyInMin || 0) > 0) D.push(["Early in (" + fmtHMc(ci.earlyInMin) + ") - no deduction", 0, "", (ci.earlyInList || []).map((x) => `${dy(x.d)}: class ${t12(x.start)}, in ${t12(x.inn)} (${fmtHMc(x.min)} early)`).join("; ")]);
    const bi = E.findIndex((x) => /^Teaching pay/.test(x[0])); if (bi >= 0 && lateAdd > 0) E[bi] = [E[bi][0].replace(/\(.*? hrs/, `(${fmtHMc(Math.round(c.hours * 60) + lm + eo)} hrs`), E[bi][1] + lateAdd];
  }
  AB.forEach((x) => E.push([x[0], x[1] ? -x[1] : 0, x[3] ? x[2] : ""])); const moved = r2(AB.reduce((t, x) => t + x[1], 0));   // minus on the earnings side: gross pay is lower by the same amount and the deductions are too, so NET PAY does not change
  const PM = (v) => (v < 0 ? "-" + P(-v) : P(v));
  const n = Math.max(E.length, D.length, 6); let body = "";
  for (let i = 0; i < n; i++) { const a = E[i], b = D[i]; body += `<tr><td colspan="3">${a ? esc(a[0]) + (a[2] ? `<br><span style="font-weight:400;font-size:8.5px;color:#333;line-height:1.25">${esc(a[2])}</span>` : "") : "&nbsp;"}</td><td colspan="2" class="n">${a ? PM(a[1]) : ""}</td><td colspan="5">${b ? esc(b[0]) + (b[3] ? `<br><span style="font-weight:400;font-size:8.5px;color:#333;line-height:1.25">${esc(b[3])}</span>` : "") : ""}</td><td colspan="2" class="n">${b ? P(b[1]) : ""}</td></tr>`; }
  /* Summary row: only the NUMBERS - work days, holidays, allowance days, absent (plus the rate and overtime hours) */
  const alc = (c.allowList || []).filter((a) => a.count !== undefined && a.amount), alv = !alc.length ? "-" : alc.every((a) => a.count === alc[0].count) ? String(alc[0].count) : alc.map((a) => `${esc(a.label || "Allowance")}: ${a.count}`).join("<br>");
  const RL = c.perHour ? ["Rate per hour", "Hours taught (H:MM)", "No. of holidays", "Allowance days", "Days absent", "Overtime"] : ["Rate per day", "No. of work days", "No. of holidays", "Allowance days", "Days absent", "Overtime"];
  const otv = c.otHours > 0 ? fmtHMc(Math.round(c.otHours * 60)) : "-";
  const RV = c.perHour ? [P(c.rate), fmtHMc(Math.round(c.hours * 60)), c.holidays || 0, alv, "-", otv] : [P(c.dailyRate), regDays, c.holidays || 0, alv, c.absentDays, otv];
  const cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}${ST.settings.tax && ST.settings.tax.employerTin ? `<br>Employer TIN: ${esc(ST.settings.tax.employerTin)}` : ""}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">${copy || "EMPLOYEE COPY"}</b></small></div></div>
  <h2>PAYSLIP</h2>
  <table><tr>${cell("Employee", esc(s.name), 5)}${cell("Employee No.", esc(s.no), 4)}${cell("Pay period", esc(run.period), 3)}</tr>
  <tr>${cell("Position", dash(s.position || e.position), 5)}${cell("Department", dash(e.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr>${cell("SSS No.", dash(e.sssNo), 3)}${cell("PhilHealth No.", dash(e.philhealthNo), 3)}${cell("Pag-IBIG No.", dash(e.pagibigNo), 3)}${cell("TIN", dash(e.tin), 3)}</tr>
  <tr>${RL.map((x) => `<th colspan="2">${x}</th>`).join("")}</tr>
  <tr>${RV.map((x) => `<td colspan="2" class="c">${x}</td>`).join("")}</tr>
  <tr><th colspan="3">EARNINGS</th><th colspan="2">Amount</th><th colspan="5">DEDUCTIONS</th><th colspan="2">Amount</th></tr>${body}
  <tr class="tot"><td colspan="3">GROSS PAY</td><td colspan="2" class="n">${P(c.gross + lateAdd - moved)}</td><td colspan="5">TOTAL DEDUCTIONS</td><td colspan="2" class="n">${P(c.totalDed + lateAdd - moved)}</td></tr></table>
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

/* >>>>>>>>>> js/pages/reports.js >>>>>>>>>> */
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


/* >>>>>>>>>> js/pages/settings.js >>>>>>>>>> */
/* ============================================================
   SETTINGS tab - the page itself and its section buttons. (The sections live in js/settings/.)
   File: js/pages/settings.js
   ============================================================ */

/* ---------- Settings ---------- */
function set() {
  const S = ST.settings, n = (id, l, v, step) => `<div><label>${l}</label><input type="number" step="${step || "any"}" id="${id}" value="${v}"></div>`, on = (id, l, v) => `<div><label>${l}</label><select id="${id}"><option value="1">On</option><option value="0" ${v === false ? "selected" : ""}>Off</option></select></div>`;
  V(`${setTabs()}<div class="card"><div data-sp="pay" ${spHide("pay")}><h3>Payroll settings</h3><div class="form">
  <div><label>Pay frequency</label><select id="s_freq"><option value="semi">Twice a month</option><option value="monthly" ${S.frequency === "monthly" ? "selected" : ""}>Monthly</option></select></div>
  ${n("s_wd", "Working days per month", S.workDays)}${n("s_hpd", "Hours per day", S.hoursPerDay)}${n("s_ot", "Overtime multiplier", S.otRate)}${on("s_pbc", "Pay by days of the cut-off (paid days x daily rate)", S.payByCutoff)}${on("s_rdh", "Count a holiday that falls on Sunday / rest day (On = counted and paid, Off = not counted)", S.restDayHoliday)}
  ${on("s_sss", "SSS", S.sss.on)}${n("s_sssEe", "SSS employee share / month (fixed)", S.sss.fixedEe)}${on("s_phic", "PhilHealth", S.phic.on)}${n("s_phicEe", "PhilHealth employee share / month", S.phic.fixedEe)}
  ${on("s_hdmf", "Pag-IBIG", S.hdmf.on)}${n("s_hdmfEe", "Pag-IBIG employee share / month", S.hdmf.fixedEe)}</div>
  </div><div data-sp="sal" ${spHide("sal")}><h3>Salary range</h3><div class="form">${n("s_mw", "Employee minimum wage (\u20B1 / day)", S.minWage.daily)}${n("s_mwa", "Admin minimum wage (\u20B1 / day)", S.minWage.admin)}${n("s_mwt", "Teacher minimum rate (\u20B1 / hour)", S.minWage.teacherHour)}</div><p class="muted">Nobody is paid below the minimum of their group: Staff and Admins per day, Teachers per hour.</p></div>${taxHTML(S)}${holHTML(S)}${satHTML(S)}<div data-sp="sig" ${spHide("sig")}><h3>Signatories printed on payslips</h3><div class="form">${[0, 1].map((i) => { const g = S.signatories[i] || { label: "", name: "", position: "" }; return `<div><label>Label</label><input id="g${i}l" value="${esc(g.label)}"></div><div><label>Name</label><input id="g${i}n" value="${esc(g.name)}"></div><div><label>Position</label><input id="g${i}p" value="${esc(g.position)}"></div>`; }).join("")}</div>
  </div><p><button class="btn p" id="ss">Save settings</button></p></div>`);
  setExtras(); taxInit(); $("#ss").onclick = async () => { collectExtras(); taxCollect(); satCollect();
    const v = (id) => $("#" + id).value, b = (id) => v(id) === "1";
    Object.assign(S, { frequency: v("s_freq"), workDays: +v("s_wd"), hoursPerDay: +v("s_hpd"), otRate: +v("s_ot") });
    S.payByCutoff = b("s_pbc"); S.restDayHoliday = b("s_rdh"); S.minWage.daily = +v("s_mw"); S.minWage.admin = +v("s_mwa"); S.minWage.teacherHour = +v("s_mwt"); S.sss.on = b("s_sss"); S.sss.fixedEe = +v("s_sssEe"); S.phic.on = b("s_phic"); S.phic.fixedEe = +v("s_phicEe"); S.hdmf.on = b("s_hdmf"); S.hdmf.fixedEe = +v("s_hdmfEe"); 
    S.signatories = [0, 1].map((i) => ({ label: v(`g${i}l`), name: v(`g${i}n`), position: v(`g${i}p`) })).filter((g) => g.label);
    await api("saveSettings", S); toast("Settings saved.");
  };
}

/* ---------- Settings page: one section at a time ---------- */
const SET_VIEWS = [["pay", "Payroll settings"], ["sal", "Salary range"], ["tax", "TIN / Tax computation (PH)"], ["hol", "Holidays"], ["wfh", "WFH / Asynchronous class"], ["hp", "Holiday pay (% of the daily rate)"], ["dtr", "Work days & hours (DTR)"], ["sat", "Saturday half day"], ["sh", "Shifts (per department / employee)"], ["gr", "Grace periods"], ["auto", "Auto late & overtime"], ["ot", "Overtime"], ["lt", "Late computation"], ["lv", "Leave types"], ["sig", "Signatories printed on payslips"]];

const setTabs = () => `<div class="chips noprint" id="svs">${SET_VIEWS.map(([k, l]) => `<button data-sv="${k}" class="${(ST.setView || "pay") === k ? "on" : ""}">${l}</button>`).join("")}</div>`;

const spHide = (k) => ((ST.setView || "pay") === k ? "" : "hidden");

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-sv]"); if (!b) return; ST.setView = b.dataset.sv; document.querySelectorAll("#svs [data-sv]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-sp]").forEach((p) => p.hidden = p.dataset.sp !== ST.setView); });

