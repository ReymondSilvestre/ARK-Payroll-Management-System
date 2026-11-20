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

