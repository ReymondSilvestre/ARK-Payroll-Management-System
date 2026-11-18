/* ============================================================
   CLASS MONITOR tab - checks, class by class and hour by hour, that each teacher is in the classroom.
   - Class Monitor account (role "monitor"): sees ONLY this menu. Today's classes, clock the teacher in / out per class.
   - Payroll / owner: the same check for any date + the Class Schedule editor + a Report.
   Saved in the database tabs "Class Schedule" and "Class Attendance" (backend/Code.gs: clsGet, clsMark, clsSave, clsReport).
   File: js/pages/class-monitor.js
   ============================================================ */

Object.assign(BUSY, { clsGet: "Loading the classes", clsMark: "Saving", clsSave: "Saving the class schedule", clsReport: "Loading the report" });

const CM_DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const cmMin = (x) => { const [h, i] = String(x || "0:0").split(":").map(Number); return (h || 0) * 60 + (i || 0); };
const cmT12 = (x) => { if (!x) return ""; const [h, i] = String(x).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(i || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const cmYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const cmNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const cmDow = (ymd) => new Date(ymd + "T12:00").getDay();
const cmTeachers = () => activeEmps().filter((e) => categoryOf(e) === "teacher").sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
const isMonitor = () => !!(ST.user && ST.user.role === "monitor");

/** Late, present, absent or pending of one class, from what was recorded. The teacher's grace minutes (Settings) are allowed. */
function cmStatus(c, rec, date) {
  if (!rec) return "Pending";
  if (rec.status === "Absent") return "Absent";
  if (!rec.in) return "Pending";
  const e = (ST.employees || []).find((x) => String(x.id) === String(c.empId)), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0;
  return cmMin(rec.in) > cmMin(c.start) + grace ? "Late" : "Present";
}
const cmLate = (c, rec, date) => { const e = (ST.employees || []).find((x) => String(x.id) === String(c.empId)), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0; return rec && rec.in ? Math.max(0, cmMin(rec.in) - cmMin(c.start) - grace) : 0; };
const CM_COLOR = { Present: "#1a7f37", Late: "#b45309", Absent: "#b3121f", Pending: "#667085" };
const cmBadge = (s) => `<span style="display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.75rem;font-weight:700;color:#fff;background:${CM_COLOR[s] || "#667085"}">${s}</span>`;

async function cmLoad(date) {
  const r = await api("clsGet", { date });
  ST.cls.classes = r.classes || []; ST.cls.att = {}; (r.att || []).forEach((a) => { ST.cls.att[a.classId] = a; });
}

function classMonitor() {
  const C = (ST.cls ||= { view: "monitor", date: cmYmd(new Date()), hour: "now", status: "all", q: "", classes: null, att: {}, sel: null, from: cmYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: cmYmd(new Date()) });
  if (isMonitor()) { C.view = "monitor"; C.date = cmYmd(new Date()); }
  clearInterval(C.timer);
  if (C.classes === null) { V('<div class="card muted">Loading the classes...</div>'); cmLoad(C.date).then(classMonitor).catch(() => { C.classes = []; classMonitor(); }); return; }
  const tabs = isMonitor() ? "" : `<div class="chips noprint" style="display:inline-flex;margin-bottom:1rem"><button data-cv="monitor" class="${C.view === "monitor" ? "on" : ""}">Class check</button><button data-cv="schedule" class="${C.view === "schedule" ? "on" : ""}">Class schedule</button><button data-cv="report" class="${C.view === "report" ? "on" : ""}">Report</button></div>`;
  V(`${tabs}<div id="cmv"></div>`);
  document.querySelectorAll("[data-cv]").forEach((b) => b.onclick = () => { C.view = b.dataset.cv; classMonitor(); });
  ({ monitor: cmCheck, schedule: cmSchedule, report: cmReport })[C.view]();
}

/* ======================= 1. CLASS CHECK (the Class Monitor) ======================= */
function cmCheck() {
  const C = ST.cls, S = ST.settings, D = S.dtr || {}, date = C.date, dow = cmDow(date), mon = isMonitor(), att = C.att, today = cmYmd(new Date());
  const hol = (D.holidays || []).find((h) => h.date === date), wfh = (D.wfhDays || []).find((w) => w.date === date);
  const all = (C.classes || []).filter((c) => c.active && !String(c.id).startsWith("n") && c.days.includes(dow)).sort((a, b) => cmMin(a.start) - cmMin(b.start) || String(a.name).localeCompare(String(b.name)));
  const nowM = cmMin(cmNow()), live = date === today, inSession = (c) => cmMin(c.start) <= nowM && nowM < cmMin(c.end);
  const hours = [...new Set(all.flatMap((c) => { const o = []; for (let h = Math.floor(cmMin(c.start) / 60); h * 60 < cmMin(c.end); h++) o.push(h); return o; }))].sort((a, b) => a - b);
  const q = C.q.trim().toLowerCase();
  const rows = all.filter((c) => (C.hour === "all" || (C.hour === "now" ? (live ? inSession(c) : true) : (cmMin(c.start) < (+C.hour + 1) * 60 && cmMin(c.end) > +C.hour * 60))) && (C.status === "all" || cmStatus(c, att[c.id], date) === C.status) && (!q || [c.name, c.subject, c.room, c.no].join(" ").toLowerCase().includes(q)));
  const cnt = { Present: 0, Late: 0, Absent: 0, Pending: 0 }; all.forEach((c) => cnt[cmStatus(c, att[c.id], date)]++);
  const chip = (l, v, k) => `<div style="flex:1;min-width:7rem;padding:.7rem 1rem;border:1px solid var(--line,#e4e7ec);border-radius:12px;background:#fff"><div class="muted" style="font-size:.75rem">${l}</div><div style="font-size:1.4rem;font-weight:800;color:${CM_COLOR[k] || "#1d2433"}">${v}</div></div>`;
  const line = (c) => {
    const r = att[c.id] || {}, st = cmStatus(c, r, date), now = live && inSession(c), lm = cmLate(c, r, date), early = r.out && cmMin(r.out) < cmMin(c.end) - 5;
    return `<tr data-c="${esc(c.id)}" style="${now ? "background:#fff8e1" : ""}"><td style="white-space:nowrap"><b>${cmT12(c.start)}</b> - ${cmT12(c.end)}${now ? '<br><small style="color:#b45309;font-weight:700">IN SESSION NOW</small>' : ""}</td>
      <td><b>${esc(c.name)}</b><br><small class="muted">No. ${esc(c.no)}</small></td><td>${esc(c.subject)}${c.room ? `<br><small class="muted">${esc(c.room)}</small>` : ""}</td>
      <td><input class="thin ci" type="time" value="${esc(r.in || "")}" style="width:6.6rem"><br><button class="btn sm p" data-nowin>Clock in now</button></td>
      <td><input class="thin co" type="time" value="${esc(r.out || "")}" style="width:6.6rem"><br><button class="btn sm" data-nowout>Clock out now</button></td>
      <td>${cmBadge(st)}${lm ? `<br><small class="muted">${lm} min late</small>` : ""}${early ? '<br><small class="muted">left early</small>' : ""}${r.by ? `<br><small class="muted">${esc(r.by)}</small>` : ""}</td>
      <td><input class="thin cr" placeholder="Remarks" value="${esc(r.remarks || "")}" style="width:9rem"><br><button class="btn sm d" data-abs>${st === "Absent" ? "Undo absent" : "Absent"}</button></td></tr>`;
  };
  $("#cmv").innerHTML = `<div class="card"><h3>Class check &middot; ${new Date(date + "T12:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
    ${hol ? `<p style="background:#fff4ce;padding:.5rem .8rem;border-radius:8px"><b>Holiday:</b> ${esc(hol.label || "")}. Classes may be suspended.</p>` : ""}${wfh ? `<p style="background:#e7f1ff;padding:.5rem .8rem;border-radius:8px"><b>${esc(wfh.type === "async" ? "Asynchronous" : "WFH")} day:</b> ${esc(wfh.label || "")}</p>` : ""}
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:.9rem">${chip("Classes today", all.length)}${chip("Present", cnt.Present, "Present")}${chip("Late", cnt.Late, "Late")}${chip("Absent", cnt.Absent, "Absent")}${chip("Not yet checked", cnt.Pending, "Pending")}</div>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div><label>Date</label><input type="date" id="cmd" value="${date}" ${mon ? "disabled" : ""}></div>
      <div><label>Hour</label><select id="cmh"><option value="now">${live ? "Now (in session)" : "All hours"}</option><option value="all">All day</option>${hours.map((h) => `<option value="${h}">${cmT12(h + ":00")} - ${cmT12(h + 1 + ":00")}</option>`).join("")}</select></div>
      <div><label>Status</label><select id="cms"><option value="all">All</option><option>Pending</option><option>Present</option><option>Late</option><option>Absent</option></select></div>
      <div style="flex:1;min-width:12rem"><label>Search teacher / subject</label><input id="cmq" type="search" value="${esc(C.q)}" style="width:100%"></div><button class="btn" id="cmr">Refresh</button></div>
    <div class="tw" style="margin-top:.7rem"><table><tr><th>Class time</th><th>Teacher</th><th>Subject / Section</th><th>Time in</th><th>Time out</th><th>Status</th><th></th></tr>${rows.map(line).join("") || `<tr><td colspan="7" class="muted">${all.length ? "No class matches the filters." : "No classes scheduled for this day."}</td></tr>`}</table></div>
    <p class="muted">Check every hour: press <b>Clock in now</b> when the teacher is in the classroom and <b>Clock out now</b> when the class ends. You can also type the time. A teacher who arrives after the class start (plus the grace minutes in Settings) is marked <b>Late</b>. Press <b>Absent</b> when the teacher did not come. Each change is saved at once.</p></div>`;
  $("#cmh").value = C.hour; $("#cms").value = C.status;
  $("#cmd").onchange = async (e) => { C.date = e.target.value; await cmLoad(C.date); cmCheck(); };
  $("#cmh").onchange = (e) => { C.hour = e.target.value; cmCheck(); };
  $("#cms").onchange = (e) => { C.status = e.target.value; cmCheck(); };
  $("#cmq").oninput = (e) => { C.q = e.target.value; const pos = e.target.selectionStart; cmCheck(); const n = $("#cmq"); n.focus(); n.setSelectionRange(pos, pos); };
  $("#cmr").onclick = async () => { await cmLoad(C.date); cmCheck(); };
  const save = async (tr, patch) => {
    const id = tr.dataset.c, old = att[id] || {}, rec = { in: tr.querySelector(".ci").value, out: tr.querySelector(".co").value, remarks: tr.querySelector(".cr").value.trim(), status: old.status === "Absent" ? "Absent" : "", ...patch };
    const c = C.classes.find((x) => x.id === id); if (rec.status !== "Absent") rec.status = cmStatus(c, rec, date);
    if (rec.out && rec.in && cmMin(rec.out) < cmMin(rec.in)) return toast("The time out is earlier than the time in.", true);
    try { const r = await api("clsMark", { date, items: [{ classId: id, in: rec.in, out: rec.out, status: rec.status === "Pending" ? "" : rec.status, remarks: rec.remarks }] }); (r || []).forEach((a) => { att[a.classId] = a; }); } catch (e) { return; }
    toast("Saved."); cmCheck();
  };
  document.querySelectorAll("#cmv tr[data-c]").forEach((tr) => {
    tr.querySelector("[data-nowin]").onclick = () => save(tr, { in: cmNow(), status: "" });
    tr.querySelector("[data-nowout]").onclick = () => { if (!tr.querySelector(".ci").value) return toast("Clock in the teacher first.", true); save(tr, { out: cmNow() }); };
    tr.querySelector("[data-abs]").onclick = () => { const a = (att[tr.dataset.c] || {}).status === "Absent"; save(tr, a ? { status: "" } : { status: "Absent", in: "", out: "" }); };
    [".ci", ".co", ".cr"].forEach((k) => tr.querySelector(k).onchange = () => save(tr, {}));
  });
  if (live) C.timer = setInterval(() => { if (!$("#cmv") || ST.tab !== "cls" || C.view !== "monitor") return clearInterval(C.timer); const a = document.activeElement; if (a && a.closest && a.closest("#cmv") && /INPUT|SELECT/.test(a.tagName)) return; cmCheck(); }, 60000);   // the "in session" highlight follows the clock
}

/* ======================= 2. CLASS SCHEDULE (payroll / owner) ======================= */
function cmSchedule() {
  const C = ST.cls, list = cmTeachers(); if (!list.find((e) => e.id === C.sel)) C.sel = list.length ? list[0].id : null;
  const mine = (C.classes || []).filter((c) => String(c.empId) === String(C.sel)).sort((a, b) => cmMin(a.start) - cmMin(b.start));
  const row = (c) => `<tr data-c="${esc(c.id)}"><td><input class="thin cs" placeholder="Subject" value="${esc(c.subject)}" style="width:11rem"></td><td><input class="thin cm" placeholder="Section / Room" value="${esc(c.room)}" style="width:9rem"></td>
    <td style="white-space:nowrap">${CM_DAYS.map(([n, l]) => `<label style="display:inline-flex;gap:.15rem;margin-right:.35rem;font-weight:500"><input type="checkbox" class="cd" value="${n}" ${c.days.includes(n) ? "checked" : ""}>${l}</label>`).join("")}</td>
    <td><input class="thin ca" type="time" value="${esc(c.start)}"></td><td><input class="thin cb" type="time" value="${esc(c.end)}"></td><td><button class="btn sm d" data-del>Remove</button></td></tr>`;
  const grid = () => { const q = ST.cls.classes.filter((c) => c.active); return q.length; };
  $("#cmv").innerHTML = `<div class="card"><h3>Class schedule of the teachers</h3><p class="muted">Type each class of the teacher: the subject, the section or room, the days and the time, for example <b>Mathematics &middot; Grade 7 - Rizal &middot; Mon Wed Fri &middot; 6:00 AM - 8:00 AM</b>. The Class Monitor then clocks the teacher in and out of each class.</p>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div style="flex:1;min-width:16rem"><label>Teacher</label><select id="cst" style="width:100%;font-weight:600">${list.map((e) => `<option value="${esc(e.id)}" ${e.id === C.sel ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))} (${(C.classes || []).filter((c) => String(c.empId) === String(e.id)).length} classes)</option>`).join("")}</select></div>
      <button class="btn" id="csa">+ Add class</button><button class="btn p" id="css">Save class schedule</button></div>
    <div class="tw" style="margin-top:.7rem"><table id="cstab"><tr><th>Subject</th><th>Section / Room</th><th>Days</th><th>Start</th><th>End</th><th></th></tr>${mine.map(row).join("") || '<tr><td colspan="6" class="muted">No class yet for this teacher. Press + Add class.</td></tr>'}</table></div>
    <p class="muted">Changes are kept on this screen when you switch teacher; press <b>Save class schedule</b> to save everybody's classes. ${grid()} class(es) in total.</p></div>`;
  const pull = () => document.querySelectorAll("#cstab tr[data-c]").forEach((tr) => { const c = C.classes.find((x) => x.id === tr.dataset.c); if (!c) return; c.subject = tr.querySelector(".cs").value.trim(); c.room = tr.querySelector(".cm").value.trim(); c.days = [...tr.querySelectorAll(".cd")].filter((x) => x.checked).map((x) => +x.value); c.start = tr.querySelector(".ca").value; c.end = tr.querySelector(".cb").value; });
  $("#cst").onchange = (e) => { pull(); C.sel = e.target.value; cmSchedule(); };
  $("#csa").onclick = () => { pull(); if (!C.sel) return toast("No teacher.", true); const e = list.find((x) => x.id === C.sel); C.classes.push({ id: "n" + Math.random().toString(36).slice(2, 9), empId: C.sel, no: e.no, name: nameOf(e), subject: "", room: "", days: [1, 2, 3, 4, 5], start: "", end: "", active: true }); cmSchedule(); };
  $("#cstab").onclick = (ev) => { const b = ev.target.closest("[data-del]"); if (!b) return; pull(); const id = b.closest("tr").dataset.c; C.classes = C.classes.filter((c) => c.id !== id); cmSchedule(); };
  $("#css").onclick = async () => {
    pull(); const bad = C.classes.find((c) => !c.subject || !c.start || !c.end || cmMin(c.end) <= cmMin(c.start) || !c.days.length);
    if (bad) { C.sel = bad.empId; cmSchedule(); return toast(`Complete the class of ${bad.name}: subject, days, start and end (the end must be after the start).`, true); }
    for (const c of C.classes) for (const o of C.classes) if (c.id < o.id && c.empId === o.empId && c.days.some((d) => o.days.includes(d)) && cmMin(c.start) < cmMin(o.end) && cmMin(o.start) < cmMin(c.end)) { C.sel = c.empId; cmSchedule(); return toast(`${c.name}: "${c.subject}" and "${o.subject}" overlap on the same day.`, true); }
    const r = await api("clsSave", { classes: C.classes.map((c) => ({ id: String(c.id).startsWith("n") ? "" : c.id, empId: c.empId, subject: c.subject, room: c.room, days: c.days, start: c.start, end: c.end, active: c.active })) });
    C.classes = r || []; toast("Class schedule saved."); cmSchedule();
  };
}

/* ======================= 3. REPORT (payroll / owner) ======================= */
async function cmReport() {
  const C = ST.cls, list = cmTeachers();
  $("#cmv").innerHTML = `<div class="card"><h3>Class attendance report</h3><div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div><label>From</label><input type="date" id="rf" value="${C.from}"></div><div><label>To</label><input type="date" id="rt" value="${C.to}"></div>
    <div style="min-width:15rem"><label>Teacher</label><select id="rtc"><option value="">All teachers</option>${list.map((e) => `<option value="${esc(e.id)}" ${C.rteacher === e.id ? "selected" : ""}>${esc(nameOf(e))}</option>`).join("")}</select></div><button class="btn p" id="rg">Show report</button><button class="btn" id="rx">Download Excel</button><button class="btn" id="rp">Print</button></div><div id="rb" style="margin-top:.8rem" class="muted">Press Show report.</div></div>`;
  let data = null;
  const draw = () => {
    const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), by = {}, det = [];
    const att = {}; data.att.forEach((a) => { att[a.date + "|" + a.classId] = a; });
    for (let d = new Date(C.from + "T12:00"); cmYmd(d) <= C.to; d.setDate(d.getDate() + 1)) {
      const ymd = cmYmd(d); if (hol.has(ymd)) continue;
      data.classes.filter((c) => c.active && c.days.includes(d.getDay()) && (!C.rteacher || String(c.empId) === String(C.rteacher))).forEach((c) => {
        const r = att[ymd + "|" + c.id], st = cmStatus(c, r, ymd), x = (by[c.empId] ||= { no: c.no, name: c.name, total: 0, present: 0, late: 0, absent: 0, none: 0, mins: 0, lateMin: 0 });
        x.total++; if (st === "Present") x.present++; else if (st === "Late") { x.late++; x.lateMin += cmLate(c, r, ymd); } else if (st === "Absent") x.absent++; else x.none++;
        if (r && r.in && r.out && cmMin(r.out) > cmMin(r.in)) x.mins += cmMin(r.out) - cmMin(r.in);
        det.push([ymd, c.no, c.name, c.subject, c.room, cmT12(c.start), cmT12(c.end), r ? cmT12(r.in) : "", r ? cmT12(r.out) : "", st === "Pending" ? "No record" : st, r ? r.remarks : "", r ? r.by : ""]);
      });
    }
    const sum = Object.values(by).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
    data.sum = sum; data.det = det;
    $("#rb").innerHTML = sum.length ? `<div class="tw"><table><tr><th>No.</th><th>Teacher</th><th class="n">Classes</th><th class="n">Present</th><th class="n">Late</th><th class="n">Late (min)</th><th class="n">Absent</th><th class="n">No record</th><th class="n">Hours in class</th><th class="n">Attendance %</th></tr>${sum.map((x) => `<tr><td>${esc(x.no)}</td><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.present}</td><td class="n">${x.late}</td><td class="n">${x.lateMin}</td><td class="n">${x.absent}</td><td class="n">${x.none}</td><td class="n">${(x.mins / 60).toFixed(2)}</td><td class="n"><b>${x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0}%</b></td></tr>`).join("")}</table></div><p class="muted">Holidays are left out. "No record" = the class was scheduled but nobody clocked the teacher. This report does not change the pay by itself.</p>` : '<p class="muted">No class in this range.</p>';
  };
  const run = async () => { C.from = $("#rf").value; C.to = $("#rt").value; C.rteacher = $("#rtc").value; if (!C.from || !C.to || C.from > C.to) return toast("Choose the From and To dates.", true); data = await api("clsReport", { from: C.from, to: C.to }); data.classes = data.classes || []; draw(); };
  $("#rg").onclick = run;
  $("#rx").onclick = () => { if (!data || !data.det) return toast("Press Show report first.", true); xlsxBook([{ name: "Class Summary", header: ["Employee No", "Teacher", "Classes", "Present", "Late", "Late (min)", "Absent", "No record", "Hours in class", "Attendance %"], rows: data.sum.map((x) => [x.no, x.name, x.total, x.present, x.late, x.lateMin, x.absent, x.none, +(x.mins / 60).toFixed(2), x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0]) }, { name: "Class Attendance", header: ["Date", "Employee No", "Teacher", "Subject", "Section / Room", "Class start", "Class end", "Time in", "Time out", "Status", "Remarks", "Checked by"], rows: data.det }], `ARK-Class-Attendance-${C.from}_to_${C.to}.xlsx`); };
  $("#rp").onclick = () => { if (!data) return toast("Press Show report first.", true); print(); };
}
