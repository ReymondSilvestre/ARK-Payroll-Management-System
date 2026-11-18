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

/* ===== CLASS CHECK = the teacher's biometric for payroll =====
   Hours paid for one class = from the later of (class start, time in) to the earlier of (class end, time out).
   Time in within the teacher's grace minutes counts from the class start. Absent / not clocked in = 0 hours.
   No clock-out: counted to the class end (Settings below) or not counted. Records keep their own start / end, so a later change of the schedule never changes past pay. */
const clsBioOn = (S) => ((S && S.dtr || {}).classBio || {}).on !== false;
function cmCounted(rec, e, date) {
  const cb = ((ST.settings.dtr || {}).classBio || {}), s = cmMin(rec.start), en = cmMin(rec.end), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0, inn = cmMin(rec.in);
  const from = inn <= s + grace ? s : inn; let to, noOut = false;
  if (rec.out) to = Math.min(cmMin(rec.out), en); else { noOut = true; to = cb.noOut === "none" ? from : en; }
  return { mins: Math.max(0, to - from), late: Math.max(0, inn - s - grace), noOut };
}
/** Hours of one teacher between two dates from the class check. has = the teacher has classes in the Class schedule (otherwise the DTR hours are used). */
function clsHoursOf(e, from, to, classes, att) {
  const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), wfh = new Set((D.wfhDays || []).map((h) => h.date)), today = cmYmd(new Date());
  const mine = (classes || []).filter((c) => String(c.empId) === String(e.id)), recs = (att || []).filter((a) => String(a.empId) === String(e.id) && a.date >= from && a.date <= to);
  const o = { has: mine.some((c) => c.active) || recs.length > 0, mins: 0, schedMin: 0, lateMin: 0, absent: 0, noRecord: 0, noOut: 0, held: 0, presentDates: [] }, by = {}, pd = new Set();
  recs.forEach((a) => { by[a.date + "|" + a.classId] = a; if (hol.has(a.date) && D.holPunch !== true) return; if (a.status === "Absent") { o.absent++; return; } if (!a.in) return;
    const r = cmCounted(a, e, a.date); o.mins += r.mins; o.lateMin += r.late; if (r.noOut) o.noOut++; o.held++; pd.add(a.date); });
  for (let d = from; d <= to && d <= today; d = addDay(d)) { if (hol.has(d)) continue; const dow = cmDow(d);
    mine.filter((c) => c.active && c.days.includes(dow)).forEach((c) => { const r = by[d + "|" + c.id], wf = wfh.has(d) && !(r && r.in); if (wf) return; o.schedMin += Math.max(0, cmMin(c.end) - cmMin(c.start)); if (!r || (!r.in && r.status !== "Absent")) o.noRecord++; }); }
  o.presentDates = [...pd].sort(); return o;
}

async function cmLoad(date) {
  const r = await api("clsGet", { date });
  ST.cls.classes = r.classes || []; ST.cls.att = {}; (r.att || []).forEach((a) => { ST.cls.att[a.classId] = a; });
}

function classMonitor() {
  const C = (ST.cls ||= { view: "monitor", date: cmYmd(new Date()), hour: "now", status: "all", q: "", classes: null, att: {}, sel: null, from: cmYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: cmYmd(new Date()) });
  if (isMonitor()) { if (C.view !== "schedule") C.view = "monitor"; C.date = cmYmd(new Date()); }
  clearInterval(C.timer);
  if (C.classes === null) { V('<div class="card muted">Loading the classes...</div>'); cmLoad(C.date).then(classMonitor).catch(() => { C.classes = []; classMonitor(); }); return; }
  const tabs = `<div class="chips noprint" style="display:inline-flex;margin-bottom:1rem"><button data-cv="monitor" class="${C.view === "monitor" ? "on" : ""}">Class check</button><button data-cv="schedule" class="${C.view === "schedule" ? "on" : ""}">Class schedule</button>${isMonitor() ? "" : `<button data-cv="report" class="${C.view === "report" ? "on" : ""}">Report</button>`}</div>`;
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
      <td><input class="thin cr" placeholder="Remarks" value="${esc(r.remarks || "")}" style="width:9rem"><br><button class="btn sm p" data-save style="margin-right:.3rem">Save</button><button class="btn sm d" data-abs>${st === "Absent" ? "Undo absent" : "Absent"}</button></td></tr>`;
  };
  $("#cmv").innerHTML = `<div class="card"><h3>Class check &middot; ${new Date(date + "T12:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
    ${hol ? `<p style="background:#fff4ce;padding:.5rem .8rem;border-radius:8px"><b>Holiday:</b> ${esc(hol.label || "")}. Classes may be suspended.</p>` : ""}${wfh ? `<p style="background:#e7f1ff;padding:.5rem .8rem;border-radius:8px"><b>${esc(wfh.type === "async" ? "Asynchronous" : "WFH")} day:</b> ${esc(wfh.label || "")}</p>` : ""}
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:.9rem">${chip("Classes today", all.length)}${chip("Present", cnt.Present, "Present")}${chip("Late", cnt.Late, "Late")}${chip("Absent", cnt.Absent, "Absent")}${chip("Not yet checked", cnt.Pending, "Pending")}</div>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div><label>Date</label><input type="date" id="cmd" value="${date}" ${mon ? "disabled" : ""}></div>
      <div><label>Hour</label><select id="cmh"><option value="now">${live ? "Now (in session)" : "All hours"}</option><option value="all">All day</option>${hours.map((h) => `<option value="${h}">${cmT12(h + ":00")} - ${cmT12(h + 1 + ":00")}</option>`).join("")}</select></div>
      <div><label>Status</label><select id="cms"><option value="all">All</option><option>Pending</option><option>Present</option><option>Late</option><option>Absent</option></select></div>
      <div style="flex:1;min-width:12rem"><label>Search teacher / subject</label><input id="cmq" type="search" value="${esc(C.q)}" style="width:100%"></div><button class="btn" id="cmr">Refresh</button></div>
    <div class="tw" style="margin-top:.7rem"><table><tr><th>Class time</th><th>Teacher</th><th>Subject / Section</th><th>Time in</th><th>Time out</th><th>Status</th><th></th></tr>${rows.map(line).join("") || `<tr><td colspan="7" class="muted">${all.length ? "No class matches the filters." : "No classes scheduled for this day."}</td></tr>`}</table></div>
    <p class="muted">Check every hour: press <b>Clock in now</b> when the teacher is in the classroom and <b>Clock out now</b> when the class ends. You can also type the time. A teacher who arrives after the class start (plus the grace minutes in Settings) is marked <b>Late</b>. Press <b>Absent</b> when the teacher did not come. Press <b>Save</b> on the row to keep the times (nothing is saved until then); <b>Absent</b> saves at once.</p></div>${cuCard()}`;
  $("#cmh").value = C.hour; $("#cms").value = C.status; cuInit();
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
    ST.clsPay = null; C.dirty = false; toast("Saved."); cmCheck();
  };
  document.querySelectorAll("#cmv tr[data-c]").forEach((tr) => {
    const dirty = () => { C.dirty = true; tr.style.outline = "2px solid #b45309"; tr.querySelector("[data-save]").textContent = "Save *"; };
    tr.querySelector("[data-nowin]").onclick = () => { tr.querySelector(".ci").value = cmNow(); dirty(); };   // fills the time only: press Save to keep it
    tr.querySelector("[data-nowout]").onclick = () => { if (!tr.querySelector(".ci").value) return toast("Clock in the teacher first.", true); tr.querySelector(".co").value = cmNow(); dirty(); };
    tr.querySelector("[data-save]").onclick = () => { C.dirty = false; save(tr, {}); };
    tr.querySelector("[data-abs]").onclick = () => { const a = (att[tr.dataset.c] || {}).status === "Absent"; save(tr, a ? { status: "" } : { status: "Absent", in: "", out: "" }); };
    [".ci", ".co", ".cr"].forEach((k) => tr.querySelector(k).oninput = dirty);   // no auto-save: the Save button saves the row
  });
  if (live) C.timer = setInterval(() => { if (!$("#cmv") || ST.tab !== "cls" || C.view !== "monitor") return clearInterval(C.timer); const a = document.activeElement; if (C.dirty || C.cimp || (a && a.closest && a.closest("#cmv") && /INPUT|SELECT/.test(a.tagName))) return; cmCheck(); }, 60000);   // the "in session" highlight follows the clock
}

/* ======================= 2. CLASS SCHEDULE (payroll / owner) ======================= */
function cmSchedule() {
  const C = ST.cls, list = cmTeachers(); if (!list.find((e) => e.id === C.sel)) C.sel = list.length ? list[0].id : null;
  const mine = (C.classes || []).filter((c) => c.active && String(c.empId) === String(C.sel)).sort((a, b) => cmMin(a.start) - cmMin(b.start));
  const row = (c) => `<tr data-c="${esc(c.id)}"><td><input class="thin cs" placeholder="Subject" value="${esc(c.subject)}" style="width:11rem"></td><td><input class="thin cm" placeholder="Section / Room" value="${esc(c.room)}" style="width:9rem"></td>
    <td style="white-space:nowrap">${CM_DAYS.map(([n, l]) => `<label style="display:inline-flex;gap:.15rem;margin-right:.35rem;font-weight:500"><input type="checkbox" class="cd" value="${n}" ${c.days.includes(n) ? "checked" : ""}>${l}</label>`).join("")}</td>
    <td><input class="thin ca" type="time" value="${esc(c.start)}"></td><td><input class="thin cb" type="time" value="${esc(c.end)}"></td><td><button class="btn sm d" data-del>Remove</button></td></tr>`;
  const grid = () => { const q = ST.cls.classes.filter((c) => c.active); return q.length; };
  $("#cmv").innerHTML = `${cmImportCard()}<div class="card"><h3>Class schedule of the teachers</h3><p class="muted">Type each class of the teacher: the subject, the section or room, the days and the time, for example <b>Mathematics &middot; Grade 7 - Rizal &middot; Mon Wed Fri &middot; 6:00 AM - 8:00 AM</b>. The Class Monitor then clocks the teacher in and out of each class.</p>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div style="flex:1;min-width:16rem"><label>Teacher</label><select id="cst" style="width:100%;font-weight:600">${list.map((e) => `<option value="${esc(e.id)}" ${e.id === C.sel ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))} (${(C.classes || []).filter((c) => c.active && String(c.empId) === String(e.id)).length} classes)</option>`).join("")}</select></div>
      <button class="btn" id="csa">+ Add class</button><button class="btn p" id="css">Save class schedule</button></div>
    <div class="tw" style="margin-top:.7rem"><table id="cstab"><tr><th>Subject</th><th>Section / Room</th><th>Days</th><th>Start</th><th>End</th><th></th></tr>${mine.map(row).join("") || '<tr><td colspan="6" class="muted">No class yet for this teacher. Press + Add class.</td></tr>'}</table></div>
    <p class="muted">Changes are kept on this screen when you switch teacher; press <b>Save class schedule</b> to save everybody's classes. ${grid()} class(es) in total.</p></div>`;
  cmImportInit();
  const pull = () => document.querySelectorAll("#cstab tr[data-c]").forEach((tr) => { const c = C.classes.find((x) => x.id === tr.dataset.c); if (!c) return; c.subject = tr.querySelector(".cs").value.trim(); c.room = tr.querySelector(".cm").value.trim(); c.days = [...tr.querySelectorAll(".cd")].filter((x) => x.checked).map((x) => +x.value); c.start = tr.querySelector(".ca").value; c.end = tr.querySelector(".cb").value; });
  $("#cst").onchange = (e) => { pull(); C.sel = e.target.value; cmSchedule(); };
  $("#csa").onclick = () => { pull(); if (!C.sel) return toast("No teacher.", true); const e = list.find((x) => x.id === C.sel); C.classes.push({ id: "n" + Math.random().toString(36).slice(2, 9), empId: C.sel, no: e.no, name: nameOf(e), subject: "", room: "", days: [1, 2, 3, 4, 5], start: "", end: "", active: true }); cmSchedule(); };
  $("#cstab").onclick = (ev) => { const b = ev.target.closest("[data-del]"); if (!b) return; pull(); const id = b.closest("tr").dataset.c; C.classes = String(id).startsWith("n") ? C.classes.filter((c) => c.id !== id) : C.classes.map((c) => (c.id === id ? { ...c, active: false } : c)); cmSchedule(); };   // a saved class is switched off, not erased: its past class checks keep counting in the payroll
  $("#css").onclick = async () => {
    pull(); const bad = C.classes.filter((c) => c.active).find((c) => !c.subject || !c.start || !c.end || cmMin(c.end) <= cmMin(c.start) || !c.days.length);
    if (bad) { C.sel = bad.empId; cmSchedule(); return toast(`Complete the class of ${bad.name}: subject, days, start and end (the end must be after the start).`, true); }
    const act = C.classes.filter((c) => c.active); for (const c of act) for (const o of act) if (c.id < o.id && c.empId === o.empId && c.days.some((d) => o.days.includes(d)) && cmMin(c.start) < cmMin(o.end) && cmMin(o.start) < cmMin(c.end)) { C.sel = c.empId; cmSchedule(); return toast(`${c.name}: "${c.subject}" and "${o.subject}" overlap on the same day.`, true); }
    ST.clsPay = null; const r = await api("clsSave", { classes: C.classes.map((c) => ({ id: String(c.id).startsWith("n") ? "" : c.id, empId: c.empId, subject: c.subject, room: c.room, days: c.days, start: c.start, end: c.end, active: c.active })) });
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
        if (r && r.in) { const e0 = (ST.employees || []).find((z) => String(z.id) === String(c.empId)); x.mins += cmCounted({ ...r, start: r.start || c.start, end: r.end || c.end }, e0, ymd).mins; }
        det.push([ymd, c.no, c.name, c.subject, c.room, cmT12(c.start), cmT12(c.end), r ? cmT12(r.in) : "", r ? cmT12(r.out) : "", st === "Pending" ? "No record" : st, r ? r.remarks : "", r ? r.by : ""]);
      });
    }
    const sum = Object.values(by).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
    data.sum = sum; data.det = det;
    $("#rb").innerHTML = sum.length ? `<div class="tw"><table><tr><th>No.</th><th>Teacher</th><th class="n">Classes</th><th class="n">Present</th><th class="n">Late</th><th class="n">Late (min)</th><th class="n">Absent</th><th class="n">No record</th><th class="n">Hours counted for pay</th><th class="n">Attendance %</th></tr>${sum.map((x) => `<tr><td>${esc(x.no)}</td><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.present}</td><td class="n">${x.late}</td><td class="n">${x.lateMin}</td><td class="n">${x.absent}</td><td class="n">${x.none}</td><td class="n">${(x.mins / 60).toFixed(2)}</td><td class="n"><b>${x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0}%</b></td></tr>`).join("")}</table></div><p class="muted">Holidays are left out. "No record" = the class was scheduled but nobody clocked the teacher. \"Hours counted for pay\" is what the Payroll uses for teachers (Class schedule tab > Payroll rule).</p>` : '<p class="muted">No class in this range.</p>';
  };
  const run = async () => { C.from = $("#rf").value; C.to = $("#rt").value; C.rteacher = $("#rtc").value; if (!C.from || !C.to || C.from > C.to) return toast("Choose the From and To dates.", true); data = await api("clsReport", { from: C.from, to: C.to }); data.classes = data.classes || []; draw(); };
  $("#rg").onclick = run;
  $("#rx").onclick = () => { if (!data || !data.det) return toast("Press Show report first.", true); xlsxBook([{ name: "Class Summary", header: ["Employee No", "Teacher", "Classes", "Present", "Late", "Late (min)", "Absent", "No record", "Hours counted for pay", "Attendance %"], rows: data.sum.map((x) => [x.no, x.name, x.total, x.present, x.late, x.lateMin, x.absent, x.none, +(x.mins / 60).toFixed(2), x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0]) }, { name: "Class Attendance", header: ["Date", "Employee No", "Teacher", "Subject", "Section / Room", "Class start", "Class end", "Time in", "Time out", "Status", "Remarks", "Checked by"], rows: data.det }], `ARK-Class-Attendance-${C.from}_to_${C.to}.xlsx`); };
  $("#rp").onclick = () => { if (!data) return toast("Press Show report first.", true); print(); };
}


/* ======================= 4. UPLOAD A FILE OF TEACHERS' SCHEDULES + TEMPLATES ======================= */
const CM_HEAD = ["Employee No", "Teacher name", "Subject", "Section / Room", "Days", "Start", "End"];
const CM_DMAP = { sun: 0, sunday: 0, su: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sa: 6 };
const cmPad = (n) => String(n).padStart(2, "0");
const cmDaysTxt = (days) => [1, 2, 3, 4, 5, 6, 0].filter((d) => (days || []).includes(d)).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");

/** "Mon, Wed, Fri" | "MWF" | "TTh" | "Mon-Fri" | "weekdays" -> [1,3,5]; null = not understood */
function cmParseDays(v) {
  let t = String(v ?? "").trim().toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\./g, ""); if (!t) return null;
  if (/^(weekdays?|mon\s*-\s*fri|monday\s*-\s*friday)$/.test(t)) return [1, 2, 3, 4, 5];
  const out = new Set(), tok = t.split(/[,\s/&+;]+/).filter(Boolean);
  for (const k of tok) {
    if (/^[a-z]+-[a-z]+$/.test(k) && CM_DMAP[k.split("-")[0]] !== undefined && CM_DMAP[k.split("-")[1]] !== undefined) { let a = CM_DMAP[k.split("-")[0]], b = CM_DMAP[k.split("-")[1]]; for (let n = 0; n < 7; n++) { out.add(a); if (a === b) break; a = (a + 1) % 7; } continue; }
    if (CM_DMAP[k] !== undefined) { out.add(CM_DMAP[k]); continue; }
    let i = 0; while (i < k.length) { const two = k.slice(i, i + 2); if (two === "th") { out.add(4); i += 2; } else if (two === "su") { out.add(0); i += 2; } else if (two === "sa") { out.add(6); i += 2; } else { const m = { m: 1, t: 2, w: 3, h: 4, f: 5, s: 6 }[k[i]]; if (m === undefined) return null; out.add(m); i++; } }
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}
/** "6:00 AM" | "06:00" | "18:00" | 0.25 (Excel time) -> { t: "06:00", assumed: bool }; null = not understood. Without AM/PM, 1:00-6:59 is taken as PM (flagged). */
function cmParseTime(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 24) v = String(v);
  if (typeof v === "number") { const m = Math.round((v % 1) * 1440); return isNaN(m) ? null : { t: cmPad(Math.floor(m / 60) % 24) + ":" + cmPad(m % 60), assumed: false }; }
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*([ap])?m?$/.exec(String(v).trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").replace(/\s?([ap]m)$/, "$1")); if (!m) return null;
  let h = +m[1], mi = +(m[2] || 0), ap = m[3], assumed = false; if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap === "p" ? 12 : 0); } else { if (h > 23) return null; if (h >= 1 && h <= 6) { h += 12; assumed = true; } }
  return { t: cmPad(h) + ":" + cmPad(mi), assumed };
}
const cmNorm = (x) => String(x ?? "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

function cmTemplateRows(kind) {
  if (kind === "export") return (ST.cls.classes || []).filter((c) => c.active).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) || cmMin(a.start) - cmMin(b.start)).map((c) => [String(c.no), c.name, c.subject, c.room, cmDaysTxt(c.days), cmT12(c.start), cmT12(c.end)]);
  if (kind === "mine") return cmTeachers().map((e) => [String(e.no), nameOf(e), "", "", "", "", ""]);
  return [["e.g. 1001", "e.g. Juan Dela Cruz", "Mathematics", "Grade 7 - Rizal", "Mon, Wed, Fri", "6:00 AM", "7:00 AM"], ["e.g. 1001", "e.g. Juan Dela Cruz", "Science", "Grade 8 - Bonifacio", "Tue, Thu", "8:00 AM", "9:30 AM"], ["e.g. 1002", "e.g. Maria Santos", "English", "Grade 7 - Rizal", "Mon-Fri", "1:00 PM", "2:00 PM"]];
}
const CM_HELP = [["HOW TO FILL IN THE CLASS SCHEDULE TEMPLATE"], [""], ["One row = one class of one teacher. A teacher with many classes has many rows."], ["Employee No  - the employee number in the Employees tab (best). If it is empty, the Teacher name is used."], ["Teacher name - used only when the Employee No is empty. Any order (Juan Dela Cruz = Dela Cruz, Juan)."], ["Subject      - required."], ["Section / Room - optional, e.g. Grade 7 - Rizal."], ["Days         - Mon, Wed, Fri  |  MWF  |  TTh  |  Mon-Fri  |  weekdays   (M T W Th F S Su)"], ["Start / End  - 6:00 AM, 6:30 PM or 18:30. Without AM / PM, 1:00 to 6:59 is read as PM."], ["Rows starting with \"e.g.\" and rows with nothing in Subject / Days / Start / End are skipped."], ["A teacher cannot have two classes at the same time on the same day."], ["Upload the file in Attendance > Class check > Class schedule > Upload schedule file. You see a preview first; nothing is saved until you press Import."]];

function cmDownloadTemplate(kind, csv) {
  const rows = cmTemplateRows(kind), name = kind === "export" ? "ARK-Class-Schedule-Current" : kind === "mine" ? "ARK-Class-Schedule-Template-My-Teachers" : "ARK-Class-Schedule-Template";
  if (csv) { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, txt = "\ufeff" + [CM_HEAD, ...rows].map((r) => r.map(q).join(",")).join("\r\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
  const sheets = [{ name: "Schedule", header: CM_HEAD, rows }, { name: "How to fill in", header: CM_HELP[0], rows: CM_HELP.slice(1) }];
  if (kind === "mine" || kind === "blank") sheets.push({ name: "Teachers", header: ["Employee No", "Teacher name"], rows: cmTeachers().map((e) => [String(e.no), nameOf(e)]) });
  xlsxBook(sheets, name + ".xlsx");
}

/** Read the uploaded file into rows with errors / warnings. */
function cmReadFile(buf) {
  const wb = XLSX.read(buf, { type: "array" }), sh = wb.Sheets[wb.SheetNames.find((n) => /^schedule$/i.test(n)) || wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: "" });
  const key = (x) => String(x).toLowerCase().replace(/[^a-z]/g, ""), find = (names) => (r) => r.findIndex((c) => names.includes(key(c)));
  let hi = A.findIndex((r) => r.some((c) => key(c) === "subject") && r.some((c) => ["start", "starttime", "from", "timestart"].includes(key(c))));
  if (hi < 0) throw new Error("The header row was not found. Use the template: Employee No, Teacher name, Subject, Section / Room, Days, Start, End.");
  const H = A[hi], col = { no: find(["employeeno", "empno", "no", "teacherno", "id", "employeenumber"])(H), name: find(["teachername", "teacher", "name", "employeename"])(H), subject: find(["subject"])(H), room: find(["sectionroom", "section", "room", "sectionorroom"])(H), days: find(["days", "day"])(H), start: find(["start", "starttime", "from", "timestart"])(H), end: find(["end", "endtime", "to", "timeend"])(H) };
  const emps = activeEmps(), byNo = {}, byName = {}; emps.forEach((e) => { byNo[String(e.no).trim().toLowerCase()] = e; byName[cmNorm(nameOf(e))] = e; });
  const out = [];
  for (let i = hi + 1; i < A.length; i++) {
    const r = A[i], g = (k) => (col[k] >= 0 ? r[col[k]] : ""), no = String(g("no")).trim(), nm = String(g("name")).trim(), subj = String(g("subject")).trim();
    if (/^e\.?g\.?/i.test(no) || /^e\.?g\.?/i.test(nm)) continue;
    if (!subj && !String(g("days")).trim() && !String(g("start")).trim() && !String(g("end")).trim()) continue;
    const row = { line: i + 1, no, name: nm, subject: subj, room: String(g("room")).trim(), errors: [], warns: [] };
    let e = no ? byNo[no.toLowerCase()] : null; if (!e && nm) e = byName[cmNorm(nm)];
    if (!e) row.errors.push(no || nm ? `Teacher not found (${no || nm}). Check the Employee No in the Employees tab.` : "No Employee No or Teacher name.");
    else if (categoryOf(e) !== "teacher") row.errors.push(`${nameOf(e)} is not in the Teachers payroll group (change it under Employees).`);
    else { row.empId = e.id; row.no = e.no; row.name = nameOf(e); if (no && nm && cmNorm(nm) !== cmNorm(nameOf(e))) row.warns.push(`Employee No ${no} is ${nameOf(e)} (the file says ${nm}).`); }
    if (!subj) row.errors.push("Subject is empty.");
    row.days = cmParseDays(g("days")); if (!row.days) row.errors.push(`Days not understood ("${g("days")}"). Use Mon, Wed, Fri or MWF.`);
    const a = cmParseTime(g("start")), b = cmParseTime(g("end")); if (!a) row.errors.push(`Start time not understood ("${g("start")}").`); if (!b) row.errors.push(`End time not understood ("${g("end")}").`);
    if (a && b) { row.start = a.t; row.end = b.t; if (cmMin(b.t) <= cmMin(a.t) && b.assumed === false && !a.assumed) row.errors.push("End must be after Start."); else if (cmMin(b.t) <= cmMin(a.t)) row.errors.push("End must be after Start."); if (a.assumed || b.assumed) row.warns.push("No AM/PM: read as " + cmT12(a.t) + " - " + cmT12(b.t) + "."); }
    out.push(row);
  }
  return out;
}
const cmSame = (c, r) => String(c.empId) === String(r.empId) && c.subject.trim().toLowerCase() === r.subject.trim().toLowerCase() && String(c.room || "").trim().toLowerCase() === String(r.room || "").trim().toLowerCase() && c.start === r.start && c.end === r.end && [...c.days].sort().join() === [...r.days].sort().join();

/** Which imported rows overlap each other (or an existing class that stays) - marks them as errors. */
function cmImportCheck(imp) {
  const C = ST.cls, mode = imp.mode, ok = imp.rows.filter((r) => !r.errors.length), touched = new Set(ok.map((r) => String(r.empId)));
  const kept = (C.classes || []).filter((c) => c.active && (mode === "add" ? true : mode === "replace" ? !touched.has(String(c.empId)) : false));
  imp.rows.forEach((r) => { r.dup = false; r.errors = r.errors.filter((m) => !m.startsWith("Overlaps")); });
  const seen = [];
  imp.rows.filter((r) => !r.errors.length).forEach((r) => {
    if (mode === "add" && kept.some((c) => cmSame(c, r))) { r.dup = true; return; }
    const clash = [...kept.filter((c) => String(c.empId) === String(r.empId)), ...seen.filter((x) => String(x.empId) === String(r.empId))].find((c) => c.days.some((d) => r.days.includes(d)) && cmMin(c.start) < cmMin(r.end) && cmMin(r.start) < cmMin(c.end));
    if (clash) r.errors.push(`Overlaps "${clash.subject}" (${cmT12(clash.start)} - ${cmT12(clash.end)}) on the same day.`); else seen.push(r);
  });
}
function cmImportApply() {
  const C = ST.cls, imp = C.imp; cmImportCheck(imp);
  const good = imp.rows.filter((r) => !r.errors.length && !r.dup), touched = new Set(imp.rows.filter((r) => !r.errors.length).map((r) => String(r.empId)));
  const old = (C.classes || []).filter((c) => c.active), keepIds = new Set(), fresh = [];
  good.forEach((r) => { const ex = old.find((c) => cmSame(c, r) && !keepIds.has(c.id)); if (ex) keepIds.add(ex.id); else fresh.push({ id: "n" + Math.random().toString(36).slice(2, 9), empId: r.empId, no: r.no, name: r.name, subject: r.subject, room: r.room, days: r.days, start: r.start, end: r.end, active: true }); });
  const next = (C.classes || []).map((c) => { if (!c.active) return c; const drop = imp.mode === "all" ? !keepIds.has(c.id) : imp.mode === "replace" ? touched.has(String(c.empId)) && !keepIds.has(c.id) : false; return drop ? { ...c, active: false } : c; });   // removed classes are switched off, never erased
  return { classes: [...next, ...fresh], added: fresh.length, kept: keepIds.size, off: next.filter((c, i) => !c.active && (C.classes[i] || {}).active).length };
}

function cmImportCard() {
  const C = ST.cls, imp = C.imp, bio = ((ST.settings.dtr || {}).classBio || {}), on = clsBioOn(ST.settings);
  const rule = `<div class="card"><h3>Payroll rule: the Class check is the teacher's biometric</h3><div class="row noprint" style="gap:.7rem;flex-wrap:wrap;align-items:end"><div><label>Teachers' hours in the payroll come from</label><select id="cbOn"><option value="1">Class check (hours the teacher was in the classroom)</option><option value="0" ${on ? "" : "selected"}>DTR biometric (old way)</option></select></div><div><label>Time in but no time out</label><select id="cbOut"><option value="sched">Count until the class end</option><option value="none" ${bio.noOut === "none" ? "selected" : ""}>Do not count the class</option></select></div><button class="btn p" id="cbSave">Save rule</button></div>
    <p class="muted">Paid time of a class = from the later of the class start and the time in, to the earlier of the class end and the time out (time in within the grace minutes counts from the class start). Absent or not checked = not paid. A teacher with no class in the schedule keeps using the DTR hours. Past records keep their own class times, so changing the schedule never changes old pay.</p></div>`;
  const up = `<div class="card"><h3>Upload the teachers' schedules from a file</h3><p class="muted">Download a template, fill it in (one row per class), then upload it. You will see a preview and any problems before anything is saved.</p>
    <div class="row noprint" style="gap:.5rem;flex-wrap:wrap"><button class="btn" id="tpB">Template (Excel, with examples)</button><button class="btn" id="tpM">Template with my teachers' names</button><button class="btn" id="tpC">Template (CSV)</button><button class="btn" id="tpX">Download current schedule</button></div>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap;align-items:end;margin-top:.8rem"><div><label>Schedule file (.xlsx, .xls or .csv)</label><input type="file" id="upF" accept=".xlsx,.xls,.csv"></div><div><label>When importing</label><select id="upM"><option value="replace" ${!imp || imp.mode === "replace" ? "selected" : ""}>Replace the classes of the teachers in the file</option><option value="add" ${imp && imp.mode === "add" ? "selected" : ""}>Add to the existing classes</option><option value="all" ${imp && imp.mode === "all" ? "selected" : ""}>Replace the whole school schedule</option></select></div></div>
    <div id="upP">${imp ? cmImportPreview() : ""}</div></div>`;
  return (isMonitor() ? "" : rule) + up;
}
function cmImportPreview() {
  const imp = ST.cls.imp; cmImportCheck(imp);
  const bad = imp.rows.filter((r) => r.errors.length), good = imp.rows.filter((r) => !r.errors.length), dup = good.filter((r) => r.dup).length, ap = good.length ? cmImportApply() : null;
  return `<div style="margin-top:.9rem"><p><b>${esc(imp.file)}</b>: ${imp.rows.length} row(s) read &middot; <b style="color:#1a7f37">${good.length - dup} ready</b>${dup ? ` &middot; ${dup} already in the schedule` : ""} &middot; <b style="color:${bad.length ? "#b3121f" : "#667085"}">${bad.length} with problems (not imported)</b></p>
  ${ap ? `<p class="muted">Result: ${ap.added} class(es) added, ${ap.kept} unchanged, ${ap.off} switched off (their past class checks still count in the payroll).</p>` : ""}
  <div class="tw"><table><tr><th>Row</th><th>Teacher</th><th>Subject / Section</th><th>Days</th><th>Time</th><th>Check</th></tr>${imp.rows.map((r) => `<tr style="${r.errors.length ? "background:#fdecec" : r.dup ? "color:#667085" : ""}"><td>${r.line}</td><td>${esc(r.name || r.no || "")}</td><td>${esc(r.subject)}${r.room ? `<br><small class="muted">${esc(r.room)}</small>` : ""}</td><td>${r.days ? cmDaysTxt(r.days) : ""}</td><td>${r.start && r.end ? cmT12(r.start) + " - " + cmT12(r.end) : ""}</td><td>${r.errors.length ? r.errors.map((m) => `<span style="color:#b3121f">${esc(m)}</span>`).join("<br>") : r.dup ? "Already in the schedule" : '<span style="color:#1a7f37">OK</span>'}${r.warns.map((m) => `<br><small style="color:#b45309">${esc(m)}</small>`).join("")}</td></tr>`).join("")}</table></div>
  <div class="row noprint" style="margin-top:.7rem"><button class="btn p" id="upGo" ${good.length - dup ? "" : "disabled"}>Import ${good.length - dup} class(es)</button><button class="btn" id="upX">Cancel</button></div></div>`;
}
function cmImportInit() {
  const C = ST.cls, bind = (id, fn) => { const n = $("#" + id); if (n) n.onclick = fn; };
  bind("tpB", () => cmDownloadTemplate("blank")); bind("tpM", () => cmDownloadTemplate("mine")); bind("tpC", () => cmDownloadTemplate("blank", true)); bind("tpX", () => cmDownloadTemplate("export"));
  bind("cbSave", async () => { const D = (ST.settings.dtr ||= {}); D.classBio = { on: $("#cbOn").value === "1", noOut: $("#cbOut").value }; ST.clsPay = null; await api("saveSettings", ST.settings); toast("Payroll rule saved."); cmSchedule(); });
  $("#upF").onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { C.imp = { file: f.name, mode: $("#upM").value, rows: cmReadFile(new Uint8Array(rd.result)) }; if (!C.imp.rows.length) { C.imp = null; toast("No class rows found in the file.", true); } } catch (e) { C.imp = null; toast(e.message || "The file could not be read.", true); } $("#upP").innerHTML = C.imp ? cmImportPreview() : ""; cmImportInit2(); };
    rd.readAsArrayBuffer(f); };
  $("#upM").onchange = (ev) => { if (C.imp) { C.imp.mode = ev.target.value; $("#upP").innerHTML = cmImportPreview(); cmImportInit2(); } };
  cmImportInit2();
}
function cmImportInit2() {
  const C = ST.cls, go = $("#upGo"), x = $("#upX");
  if (x) x.onclick = () => { C.imp = null; cmSchedule(); };
  if (go) go.onclick = async () => {
    const ap = cmImportApply(); const act = ap.classes.filter((c) => c.active);
    const r = await api("clsSave", { classes: ap.classes.map((c) => ({ id: String(c.id).startsWith("n") ? "" : c.id, empId: c.empId, subject: c.subject, room: c.room, days: c.days, start: c.start, end: c.end, active: c.active })) });
    ST.clsPay = null; C.classes = r || act; C.imp = null; toast(`Schedule imported: ${ap.added} added, ${ap.kept} unchanged.`); cmSchedule();
  };
}


/* ======================= 5. UPLOAD THE CLASS CHECK FROM A FILE (payroll / owner) ======================= */
const CU_HEAD = ["Date", "Employee No", "Teacher name", "Subject", "Section / Room", "Class start", "Class end", "Time in", "Time out", "Status", "Remarks"];
function cuParseDate(v) {
  if (typeof v === "number" && v > 30000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const t = String(v ?? "").trim(); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return `${m[1]}-${cmPad(m[2])}-${cmPad(m[3])}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t); if (m) return `${m[3]}-${cmPad(m[1])}-${cmPad(m[2])}`;
  const d = new Date(t + " 12:00"); return t && !isNaN(d) ? cmYmd(d) : null;
}
function cuTemplate(kind, csv) {
  const C = ST.cls, ex = [["e.g. 2026-11-18", "e.g. Juan Dela Cruz", "Mathematics", "Grade 7 - Rizal", "6:00 AM", "7:00 AM", "6:05 AM", "7:00 AM", "Present", ""], ["e.g. 2026-11-18", "e.g. Maria Santos", "English", "Grade 7 - Rizal", "1:00 PM", "2:00 PM", "", "", "Absent", "Sick"]];
  const dow = cmDow(C.date), rows = kind === "day" ? (C.classes || []).filter((c) => c.active && c.days.includes(dow)).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) || cmMin(a.start) - cmMin(b.start)).map((c) => { const r = (C.att || {})[c.id] || {}; return [C.date, String(c.no), c.name, c.subject, c.room, cmT12(c.start), cmT12(c.end), r.in ? cmT12(r.in) : "", r.out ? cmT12(r.out) : "", r.status === "Absent" ? "Absent" : "", r.remarks || ""]; }) : ex.map((r) => [r[0], r[1].replace("e.g. Juan Dela Cruz", "1001").replace("e.g. Maria Santos", "1002"), ...r.slice(1)]).map((r, i) => [ex[i][0], "e.g. " + (i ? "1002" : "1001"), ex[i][1], ...ex[i].slice(2)]);
  const name = kind === "day" ? `ARK-Class-Check-${C.date}` : "ARK-Class-Check-Template";
  if (csv) { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + [CU_HEAD, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
  xlsxBook([{ name: "Class check", header: CU_HEAD, rows }, { name: "How to fill in", header: ["HOW TO FILL IN THE CLASS CHECK TEMPLATE"], rows: [[""], ["One row = one class on one date."], ["Date         - 2026-11-18 or 11/18/2026."], ["Employee No - from the Employees tab (best). If empty, the Teacher name is used."], ["Subject / Class start - used to find the right class when a teacher has several classes that day."], ["Time in / Time out - 6:05 AM or 06:05. Without AM/PM, 1:00 to 6:59 is read as PM. Time out can stay empty."], ["Status      - Absent for a teacher who did not come. Leave empty (or Present / Late) when the teacher came; Late is worked out from the time in."], ["Remarks     - optional."], ["Rows starting with \"e.g.\" and empty rows are skipped. A class already checked on that date is replaced by the file."], ["Upload it under Class check > Upload class check. You see a preview first; nothing is saved until you press Import."]] }], name + ".xlsx");
}
function cuRead(buf) {
  const wb = XLSX.read(buf, { type: "array" }), sh = wb.Sheets[wb.SheetNames.find((n) => /class\s*check/i.test(n)) || wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: "" }), key = (x) => String(x).toLowerCase().replace(/[^a-z]/g, "");
  const hi = A.findIndex((r) => r.some((c) => key(c) === "date") && r.some((c) => ["timein", "in"].includes(key(c)))); if (hi < 0) throw new Error("The header row was not found. Use the template (Date, Employee No, ..., Time in, Time out, Status).");
  const H = A[hi], ix = (n) => H.findIndex((c) => n.includes(key(c))), col = { date: ix(["date"]), no: ix(["employeeno", "empno", "no"]), name: ix(["teachername", "teacher", "name"]), subject: ix(["subject"]), start: ix(["classstart", "start", "scheduledstart"]), inn: ix(["timein", "in"]), out: ix(["timeout", "out"]), st: ix(["status"]), rm: ix(["remarks", "remark"]) };
  const emps = activeEmps(), byNo = {}, byName = {}; emps.forEach((e) => { byNo[String(e.no).trim().toLowerCase()] = e; byName[cmNorm(nameOf(e))] = e; });
  const today = cmYmd(new Date()), out = [];
  for (let i = hi + 1; i < A.length; i++) {
    const r = A[i], g = (k) => (col[k] >= 0 ? r[col[k]] : ""), no = String(g("no")).trim(), nm = String(g("name")).trim();
    if (/^e\.?g\.?/i.test(no) || /^e\.?g\.?/i.test(String(g("date")))) continue;
    if (!String(g("date")).trim() && !no && !nm) continue;
    const row = { line: i + 1, errors: [], warns: [], remarks: String(g("rm")).trim() }, date = cuParseDate(g("date"));
    if (!date) row.errors.push(`Date not understood ("${g("date")}").`); else if (date > today) row.errors.push("The date is in the future."); else if (isMonitor() && date < cmYmd(new Date(Date.now() - 31 * 86400000))) row.errors.push("The Class Monitor can upload the last 31 days only."); row.date = date;
    let e = no ? byNo[no.toLowerCase()] : null; if (!e && nm) e = byName[cmNorm(nm)];
    if (!e) row.errors.push(`Teacher not found (${no || nm || "empty"}).`); else { row.emp = e; row.name = nameOf(e); }
    const stt = String(g("st")).trim().toLowerCase(); row.absent = /^abs/.test(stt);
    const a = cmParseTime(g("inn")), b = cmParseTime(g("out")); if (!row.absent) { if (String(g("inn")).trim() === "") row.errors.push("Time in is empty (or write Absent in Status)."); else if (!a) row.errors.push(`Time in not understood ("${g("inn")}").`); if (String(g("out")).trim() !== "" && !b) row.errors.push(`Time out not understood ("${g("out")}").`); if (a && b && cmMin(b.t) < cmMin(a.t)) row.errors.push("Time out is earlier than the time in."); if ((a && a.assumed) || (b && b.assumed)) row.warns.push("No AM/PM: read as " + (a ? cmT12(a.t) : "") + (b ? " - " + cmT12(b.t) : "") + "."); }
    row.inn = a ? a.t : ""; row.outT = b ? b.t : "";
    if (e && date) {
      const dow = cmDow(date), subj = String(g("subject")).trim().toLowerCase(), st = cmParseTime(g("start")); let cand = (ST.cls.classes || []).filter((c) => c.active && String(c.empId) === String(e.id) && c.days.includes(dow));
      if (st && cand.length > 1) cand = cand.filter((c) => c.start === st.t); if (subj && cand.length > 1) cand = cand.filter((c) => String(c.subject).trim().toLowerCase() === subj);
      if (cand.length === 1) { row.cls = cand[0]; } else row.errors.push(cand.length ? `${cand.length} classes fit: write the Class start or Subject.` : `${nameOf(e)} has no class in the schedule on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]}.`);
    }
    out.push(row);
  }
  const seen = {}; out.forEach((r) => { if (r.cls && !r.errors.length) { const k = r.date + "|" + r.cls.id; if (seen[k]) r.errors.push(`Same class and date as row ${seen[k]}.`); else seen[k] = r.line; } });
  return out;
}
function cuCard() {
  const C = ST.cls, im = C.cimp;
  return `<div class="card noprint"><h3>Upload class check</h3><p class="muted">Fill in a template with the times of the teachers (for example from paper sheets) and upload it. A preview shows any problem before anything is saved. A class already checked on the same date is replaced by the file.</p>
  <div class="row" style="gap:.5rem;flex-wrap:wrap"><button class="btn" id="cuD">Template of the classes on ${esc(C.date)}</button><button class="btn" id="cuB">Template (blank, with examples)</button><button class="btn" id="cuC">Template (CSV)</button></div>
  <div class="row" style="margin-top:.8rem"><div><label>Class check file (.xlsx, .xls or .csv)</label><input type="file" id="cuF" accept=".xlsx,.xls,.csv"></div></div><div id="cuP">${im ? cuPreview() : ""}</div></div>`;
}
function cuPreview() {
  const im = ST.cls.cimp, good = im.rows.filter((r) => !r.errors.length), bad = im.rows.length - good.length;
  return `<div style="margin-top:.9rem"><p><b>${esc(im.file)}</b>: ${im.rows.length} row(s) &middot; <b style="color:#1a7f37">${good.length} ready</b> &middot; <b style="color:${bad ? "#b3121f" : "#667085"}">${bad} with problems (not imported)</b></p>
  <div class="tw"><table><tr><th>Row</th><th>Date</th><th>Teacher</th><th>Class</th><th>Time in</th><th>Time out</th><th>Status</th><th>Check</th></tr>${im.rows.map((r) => `<tr style="${r.errors.length ? "background:#fdecec" : ""}"><td>${r.line}</td><td>${esc(r.date || "")}</td><td>${esc(r.name || "")}</td><td>${r.cls ? esc(r.cls.subject) + `<br><small class="muted">${cmT12(r.cls.start)} - ${cmT12(r.cls.end)}</small>` : ""}</td><td>${r.inn ? cmT12(r.inn) : ""}</td><td>${r.outT ? cmT12(r.outT) : ""}</td><td>${r.absent ? "Absent" : "Present"}</td><td>${r.errors.length ? r.errors.map((m) => `<span style="color:#b3121f">${esc(m)}</span>`).join("<br>") : '<span style="color:#1a7f37">OK</span>'}${r.warns.map((m) => `<br><small style="color:#b45309">${esc(m)}</small>`).join("")}</td></tr>`).join("")}</table></div>
  <div class="row" style="margin-top:.7rem"><button class="btn p" id="cuGo" ${good.length ? "" : "disabled"}>Import ${good.length} class check(s)</button><button class="btn" id="cuX">Cancel</button></div></div>`;
}
function cuInit() {
  const C = ST.cls, b = (id, f) => { const n = $("#" + id); if (n) n.onclick = f; };
  b("cuD", () => cuTemplate("day")); b("cuB", () => cuTemplate("blank")); b("cuC", () => cuTemplate("blank", true));
  b("cuX", () => { C.cimp = null; cmCheck(); });
  b("cuGo", async () => {
    const good = C.cimp.rows.filter((r) => !r.errors.length), by = {}; good.forEach((r) => (by[r.date] ||= []).push(r));
    for (const [date, L] of Object.entries(by)) {
      const items = L.map((r) => { const rec = { in: r.absent ? "" : r.inn, out: r.absent ? "" : r.outT, remarks: r.remarks, status: r.absent ? "Absent" : "" }; if (!r.absent) rec.status = cmStatus(r.cls, rec, date); if (rec.status === "Pending") rec.status = ""; return { classId: r.cls.id, in: rec.in, out: rec.out, status: rec.status, remarks: rec.remarks }; });
      try { await api("clsMark", { date, items }); } catch (e) { return; }
    }
    ST.clsPay = null; C.cimp = null; await cmLoad(C.date); toast(`Class check imported: ${good.length} class(es).`); cmCheck();
  });
  const f = $("#cuF"); if (f) f.onchange = (ev) => { const file = ev.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { C.cimp = { file: file.name, rows: cuRead(new Uint8Array(rd.result)) }; if (!C.cimp.rows.length) { C.cimp = null; toast("No rows found in the file.", true); } } catch (e) { C.cimp = null; toast(e.message || "The file could not be read.", true); } $("#cuP").innerHTML = C.cimp ? cuPreview() : ""; cuInit2(); }; rd.readAsArrayBuffer(file); };
}
function cuInit2() { const C = ST.cls, g = $("#cuGo"), x = $("#cuX"); if (x) x.onclick = () => { C.cimp = null; cmCheck(); }; if (g) g.onclick = () => { cuInit(); g.onclick(); }; }
