/* ============================================================
   CLASS CHECK DTR - the daily time record of each teacher built from the class check the Class Monitor encoded.
   - DTR / Biometric tab > "Class check DTR" (payroll / owner), and the DTR / Biometric menu of the Class Monitor account.
   - One row per class: time in / time out / status / remarks can be edited (Edit > Save). Saved with clsMark (same data as the Class check).
   - The Class Monitor can edit only the classes of today (server rule); payroll / owner can edit any date.
   File: js/pages/class-dtr.js
   ============================================================ */

function cdtrState() {
  const t = new Date(), today = cmYmd(t);
  return (ST.cd ||= { from: cmYmd(new Date(t.getFullYear(), t.getMonth(), 1)), to: today, emp: "", edit: false, loaded: false, classes: [], att: [] });
}

/** The class-check DTR of one teacher: one entry per date with its classes and totals. */
function cdtrDays(e, C) {
  const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), today = cmYmd(new Date()), att = {}; C.att.forEach((a) => { att[a.date + "|" + a.classId] = a; });
  const mine = C.classes.filter((c) => String(c.empId) === String(e.id)), out = [];
  for (let d = C.from; d <= C.to && d <= today; d = addDay(d)) {
    const dow = cmDow(d), items = [];
    mine.forEach((c) => { const r = att[d + "|" + c.id]; if (r || (c.active && c.days.includes(dow) && !hol.has(d))) items.push({ c, r, s: (r && r.start) || c.start, e: (r && r.end) || c.end }); });
    if (!items.length) continue;
    items.sort((a, b) => cmMin(a.s) - cmMin(b.s));
    const x = { d, items, in: "", out: "", mins: 0, late: 0, absent: 0, none: 0, present: 0 };
    items.forEach((it) => {
      const r = it.r; if (r && r.status === "Absent") { x.absent++; return; }
      if (!r || !r.in) { x.none++; return; }
      const k = cmCounted({ ...r, start: it.s, end: it.e }, e, d); x.mins += k.mins; x.late += k.late; x.present++; it.mins = k.mins; it.late = k.late; it.noOut = k.noOut;
      if (!x.in || cmMin(r.in) < cmMin(x.in)) x.in = r.in; if (r.out && (!x.out || cmMin(r.out) > cmMin(x.out))) x.out = r.out;
    });
    out.push(x);
  }
  return out;
}

function cdtrPage() {
  const mon = isMon(), C = cdtrState(), today = cmYmd(new Date()), tabs = mon ? "" : dtrTabs(0, 0);
  if (!C.loaded) {
    V(tabs + '<div class="card muted">Loading the class check...</div>');
    api("clsReport", { from: C.from, to: C.to }).then((r) => { C.classes = r.classes || []; C.att = r.att || []; C.loaded = true; cdtrPage(); }).catch(() => { C.loaded = true; cdtrPage(); });
    return;
  }
  const list = cmTeachers(), sel = list.find((e) => String(e.id) === String(C.emp)) || null;
  const head = `<div class="card noprint"><h3>Class check DTR</h3><p class="muted">The daily time record of each teacher, built from the class check encoded by the Class Monitor: time in = first class clocked in, time out = last class clocked out, hours = time counted for pay. Press <b>Edit</b> to change a time, then <b>Save</b>.${mon ? " The Class Monitor can edit the last 31 days." : ""}</p>
    <div class="row" style="gap:.7rem;flex-wrap:wrap;align-items:end"><div><label>From</label><input type="date" id="cdf" value="${C.from}"></div><div><label>To</label><input type="date" id="cdt" value="${C.to}"></div>
    <div style="min-width:16rem"><label>Teacher</label><select id="cde"><option value="">All teachers (summary) - choose a teacher to edit</option>${list.map((e) => `<option value="${esc(e.id)}" ${sel && sel.id === e.id ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
    <button class="btn" id="cdr">Refresh</button>${sel ? `<button class="btn" id="cdp">Print</button><button class="btn" id="cdx">Download Excel</button>${C.edit ? '<button class="btn p" id="cds">Save</button><button class="btn" id="cdc">Cancel</button>' : '<button class="btn p" id="cde2">Edit</button>'}` : ""}</div></div>`;
  let body = "";
  if (!sel) {
    const rows = list.map((e) => { const D = cdtrDays(e, C), t = D.reduce((n, x) => ({ days: n.days + (x.present ? 1 : 0), cls: n.cls + x.items.length, pres: n.pres + x.present, late: n.late + x.late, abs: n.abs + x.absent, none: n.none + x.none, mins: n.mins + x.mins }), { days: 0, cls: 0, pres: 0, late: 0, abs: 0, none: 0, mins: 0 }); return { e, t, has: D.length }; }).filter((r) => r.has);
    body = `<div class="card"><div class="tw"><table><tr><th>No.</th><th>Teacher</th><th class="n">Days present</th><th class="n">Classes</th><th class="n">Checked in</th><th class="n">Late (min)</th><th class="n">Absent</th><th class="n">Not checked</th><th class="n">Hours counted</th><th></th></tr>${rows.map((r) => `<tr><td>${esc(r.e.no)}</td><td>${esc(nameOf(r.e))}</td><td class="n">${r.t.days}</td><td class="n">${r.t.cls}</td><td class="n">${r.t.pres}</td><td class="n">${r.t.late}</td><td class="n">${r.t.abs}</td><td class="n">${r.t.none}</td><td class="n"><b>${fmtHMc(r.t.mins)}</b></td><td style="white-space:nowrap"><button class="btn sm" data-open="${esc(r.e.id)}">Open DTR</button> <button class="btn sm p" data-edit="${esc(r.e.id)}">Edit</button></td></tr>`).join("") || '<tr><td colspan="10" class="muted">No class or class check in this range.</td></tr>'}</table></div></div>`;
  } else {
    const D = cdtrDays(sel, C), tot = D.reduce((n, x) => ({ mins: n.mins + x.mins, late: n.late + x.late }), { mins: 0, late: 0 }), wd = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" });
    const rowHTML = (x) => x.items.map((it, i) => {
      const r = it.r || {}, can = !mon || (x.d <= today && x.d >= cmYmd(new Date(Date.now() - 31 * 86400000))), ed = C.edit && can, st = r.status === "Absent" ? "Absent" : cmStatus({ ...it.c, start: it.s }, r.in ? r : null, x.d), k = `data-c="${esc(it.c.id)}" data-d="${x.d}"`;
      const cell = (cls, v) => (ed ? `<input type="time" class="${cls}" ${k} data-o="${esc(v)}" value="${esc(v)}" >` : v ? cmT12(v) : "");
      return `<tr style="${st === "Absent" ? "background:#fdecec" : ""}">${i === 0 ? `<td rowspan="${x.items.length}" style="vertical-align:top;white-space:nowrap"><b>${x.d}</b><br>${wd(x.d)}<br><small class="muted">In ${x.in ? cmT12(x.in) : "-"} &middot; Out ${x.out ? cmT12(x.out) : "-"}<br>Counted ${fmtHMc(x.mins)}</small></td>` : ""}
      <td><b>${esc(it.c.subject)}</b>${it.c.room ? ` &middot; ${esc(it.c.room)}` : ""}<br><small class="muted">${cmT12(it.s)} - ${cmT12(it.e)}</small></td><td>${cell("cdi", r.in || "")}</td><td>${cell("cdo", r.out || "")}</td>
      <td>${ed ? `<select class="cds" ${k} data-o="${st === "Absent" ? "Absent" : ""}"><option value="">Present / Late</option><option ${st === "Absent" ? "selected" : ""} value="Absent">Absent</option></select>` : cmBadge(st)}${it.late ? `<br><small class="muted">${it.late} min late</small>` : ""}${it.noOut ? '<br><small class="muted">no time out</small>' : ""}</td>
      <td class="n">${it.mins ? fmtHMc(it.mins) : ""}</td><td>${ed ? `<input class="cdm" ${k} data-o="${esc(r.remarks || "")}" value="${esc(r.remarks || "")}" placeholder="Remarks">` : esc(r.remarks || "")}</td></tr>`;
    }).join("");
    body = `<style>.cdtr{max-width:100%;overflow:hidden}.cdtr .tw{overflow-x:visible}.cdtr table{width:100%;table-layout:fixed;font-size:.82rem}.cdtr th,.cdtr td{padding:.35rem .4rem;white-space:normal;word-break:break-word;vertical-align:top}.cdtr th:nth-child(1){width:15%}.cdtr th:nth-child(2){width:25%}.cdtr th:nth-child(3),.cdtr th:nth-child(4){width:12%}.cdtr th:nth-child(5){width:13%}.cdtr th:nth-child(6){width:8%}.cdtr th:nth-child(7){width:15%}.cdtr input,.cdtr select{width:100%;min-width:0;box-sizing:border-box;font-size:.8rem;padding:.25rem .3rem}.cdtr input[type=time]{max-width:6.5rem}@media print{.cdtr table{font-size:.72rem}}</style><div class="card ps dtrsheet cdtr"><h2>DAILY TIME RECORD (CLASS CHECK)</h2><p style="text-align:center;margin:0">${C.from} to ${C.to}</p><p><b>${esc(nameOf(sel))}</b> &middot; ${esc(sel.position || "")} &middot; No. ${esc(sel.no)}</p>
      <div class="tw"><table><tr><th>Date</th><th>Class</th><th>Time in</th><th>Time out</th><th>Status</th><th class="n">Hours counted</th><th>Remarks</th></tr>${D.map(rowHTML).join("") || '<tr><td colspan="7" class="muted">No class or class check for this teacher in this range.</td></tr>'}<tr class="tot"><td colspan="5">Total</td><td class="n">${fmtHMc(tot.mins)}</td><td>${tot.late ? tot.late + " min late (not paid)" : ""}</td></tr></table></div></div>`;
  }
  V(tabs + head + body);
  const go = () => { C.loaded = false; C.edit = false; ST.clsPay = null; cdtrPage(); };
  $("#cdf").onchange = (e) => { C.from = e.target.value; go(); }; $("#cdt").onchange = (e) => { C.to = e.target.value; go(); };
  if (C.from > C.to) return toast("The From date is after the To date.", true);
  $("#cde").onchange = (e) => { C.emp = e.target.value; C.edit = false; cdtrPage(); }; $("#cdr").onclick = go;
  document.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { C.emp = b.dataset.open; C.edit = false; cdtrPage(); });
  document.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => { C.emp = b.dataset.edit; C.edit = true; cdtrPage(); });
  if (!sel) return;
  $("#cdp").onclick = () => print();
  $("#cdx").onclick = () => { const D = cdtrDays(sel, C); xlsxBook([{ name: "Class check DTR", header: ["Date", "Class start", "Class end", "Subject", "Section / Room", "Time in", "Time out", "Status", "Hours counted", "Remarks"], rows: D.flatMap((x) => x.items.map((it) => { const r = it.r || {}; return [x.d, cmT12(it.s), cmT12(it.e), it.c.subject, it.c.room, r.in ? cmT12(r.in) : "", r.out ? cmT12(r.out) : "", r.status === "Absent" ? "Absent" : r.in ? "Present" : "No record", it.mins ? +(it.mins / 60).toFixed(2) : 0, r.remarks || ""]; })) }], `ARK-Class-Check-DTR-${sel.no}-${C.from}_${C.to}.xlsx`); };
  if ($("#cde2")) $("#cde2").onclick = () => { C.edit = true; cdtrPage(); };
  if ($("#cdc")) $("#cdc").onclick = () => { C.edit = false; cdtrPage(); };
  if ($("#cds")) $("#cds").onclick = async () => {
    const by = {}, g = (el) => { const o = ((by[el.dataset.d] ||= {})[el.dataset.c] ||= { ch: false }); return o; };
    document.querySelectorAll(".cdi,.cdo,.cds,.cdm").forEach((el) => { const o = g(el), k = el.classList.contains("cdi") ? "in" : el.classList.contains("cdo") ? "out" : el.classList.contains("cds") ? "status" : "remarks"; o[k] = el.value; if (el.value !== el.dataset.o) o.ch = true; });
    const jobs = [];
    for (const [date, m] of Object.entries(by)) { const items = []; for (const [cid, o] of Object.entries(m)) {
      if (!o.ch) continue; const c = C.classes.find((x) => x.id === cid); if (!c) continue;
      if (o.status !== "Absent" && !o.in && o.out) return toast(`${date} ${c.subject}: type the time in too.`, true);
      if (o.in && o.out && cmMin(o.out) < cmMin(o.in)) return toast(`${date} ${c.subject}: the time out is earlier than the time in.`, true);
      const rec = { in: o.status === "Absent" ? "" : o.in, out: o.status === "Absent" ? "" : o.out }; let st = o.status === "Absent" ? "Absent" : cmStatus(c, rec, date); if (st === "Pending") st = "";
      items.push({ classId: cid, in: rec.in, out: rec.out, status: st, remarks: (o.remarks || "").trim() }); }
      if (items.length) jobs.push({ date, items }); }
    if (!jobs.length) { C.edit = false; toast("No changes."); return cdtrPage(); }
    try { for (const j of jobs) await api("clsMark", j); } catch (e) { return; }
    toast(`${jobs.reduce((n, j) => n + j.items.length, 0)} class(es) saved.`); go();
  };
}
