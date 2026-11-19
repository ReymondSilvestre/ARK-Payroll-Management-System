/* ============================================================
   ATTENDANCE RULES - shift of the day, grace period, who may have overtime, late / overtime minutes.
   File: js/dtr/rules.js
   ============================================================ */

/** Time in / out of one employee: teachers have their own, staff and admins follow their department, everybody else the default (Settings > Work days & hours). */
/** Shifts of the employee's department (Settings > Shifts). */
function shiftsOfDept(e) { const dn = String(e.dept || "").trim().toLowerCase(); return dn ? (ST.settings.dtr.shifts || []).filter((s) => s.start && s.end && String(s.dept || "").trim().toLowerCase() === dn) : []; }

/** Time in / out of one employee on one day. Order: the shift assigned to the employee > the only shift of the department > (several shifts, or "Automatic") the shift closest to the punches of that day > teachers' / department / default times. */
/** Department names match when they are the same, share all their words ("Accounting / Finance" = "Finance") or start the same way ("Administration" = "Administrative"). */
function deptLike(a, b) {
  a = String(a || "").trim().toLowerCase(); b = String(b || "").trim().toLowerCase(); if (!a || !b) return false; if (a === b) return true;
  const wa = a.split(/[^a-z0-9]+/).filter(Boolean), wb = b.split(/[^a-z0-9]+/).filter(Boolean); if (!wa.length || !wb.length) return false;
  if (wb.every((w) => wa.includes(w)) || wa.every((w) => wb.includes(w))) return true;
  return wa.some((x) => wb.some((y) => x.length >= 7 && y.length >= 7 && x.slice(0, 7) === y.slice(0, 7)));
}

/** Saturday half day (Settings > Saturday half-day): the people of the chosen departments (or chosen one by one) work 8:00 AM - 12:00 noon on Saturday, and the day is still paid as ONE full day (the monthly pay already covers it, so nothing is deducted).
    Overtime on such a Saturday starts at the "OT from" time (1:00 PM) and only when it is allowed that day. Returns null for everybody else. */
function satHalfOf(e) {
  const H = (ST.settings.dtr || {}).satHalf; if (!H || H.on === false || !e || categoryOf(e) === "teacher") return null;
  const own = (H.people || {})[e.id]; let yes = own === "yes" ? true : own === "no" ? false : (H.depts || []).some((x) => deptLike(e.dept, x)); if (!yes) return null;
  const m = (x, def) => { const [h, mi] = String(x || def).split(":").map(Number); return h * 60 + (mi || 0); };
  return { start: H.start || "08:00", end: H.end || "12:00", otFromMin: m(H.otFrom, "13:00"), otAuto: H.otMode === "auto" };
}

function schedOf(e, p, dow) {
  const D = ST.settings.dtr, g = categoryOf(e), m = (x) => { const [h, mi] = String(x).split(":").map(Number); return h * 60 + (mi || 0); }; let st = D.start, en = D.end, shift = null;
  if (g === "teacher") { if (D.teacherStart) st = D.teacherStart; if (D.teacherEnd) en = D.teacherEnd; }
  else { const t = (D.deptTimes || {})[String(e.dept || "").trim().toLowerCase()]; if (t) { if (t.start) st = t.start; if (t.end) en = t.end; } }
  const all = (D.shifts || []).filter((s) => s.start && s.end), own = (D.empShift || {})[e.id]; let cand = [];
  if (own && own !== "auto") { const s = all.find((x) => x.id === own); if (s) cand = [s]; }
  if (!cand.length) cand = own === "auto" ? (shiftsOfDept(e).length ? shiftsOfDept(e) : all) : shiftsOfDept(e);
  if (cand.length) {
    shift = cand[0];
    if (cand.length > 1 && p && p.length) {
      const first = p[0], last = p[p.length - 1], two = p.length > 1 && last - first >= 10, sc = (s) => (two ? Math.abs(first - m(s.start)) + Math.abs(last - m(s.end)) : Math.min(Math.abs(first - m(s.start)), Math.abs(first - m(s.end))));
      shift = cand.reduce((b, s) => (sc(s) < sc(b) ? s : b), cand[0]);
    }
    st = shift.start; en = shift.end;
  }
  if (g === "teacher") { const tt = (D.teacherTimes || {})[e.id]; if (tt && tt.start && tt.end) { st = tt.start; en = tt.end; } const dt = ((D.teacherDayTimes || {})[e.id] || {})[dow]; if (dt && dt.start && dt.end) { st = dt.start; en = dt.end; } }   // a different time in / out for each weekday wins   // Teacher Hours menu: this teacher's own time in / time out (e.g. 6:00 AM - 3:00 PM) wins over shifts and the teachers' default
  const sat = dow === 6 ? satHalfOf(e) : null; if (sat) { st = sat.start; en = sat.end; }   // Saturday half day: 8:00 - 12:00 wins over shifts and department times
  const S0 = m(st), E0 = m(en);
  return { st, en, S0, E0, MID: Math.round((S0 + E0) / 2), shift, sat };
}

const ddRow = (n, t) => `<tr data-dd><td><input class="ddn" value="${esc(t.label || n || "")}"></td><td><input type="time" class="dds" value="${esc(t.start || "")}"></td><td><input type="time" class="dde" value="${esc(t.end || "")}"></td><td><button class="btn sm d" type="button" data-ddx>Remove</button></td></tr>`;

/** Departments listed in the settings table: the saved ones plus every department of the (non-teacher) employees. */
function deptNames(S) {
  const seen = new Map(); Object.values((S.dtr && S.dtr.deptTimes) || {}).forEach((t) => seen.set(String(t.label || "").toLowerCase(), t.label));
  (ST.employees || []).forEach((e) => { const d = String(e.dept || "").trim(); if (d && categoryOf(e) !== "teacher" && !seen.has(d.toLowerCase())) seen.set(d.toLowerCase(), d); });
  return [...seen.values()].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Teacher Hours menu: the hours a teacher is scheduled on one weekday (0 = Sunday ... 6 = Saturday). no hours typed for this teacher = the default hours per day; null = no default either (the biometric hours are used); 0 = a day without classes. */
function tHrs(e, dow) {
  if (!e || categoryOf(e) !== "teacher") return null;
  const D = ST.settings.dtr, t = (D.teacherHrs || {})[e.id], def = +(D.teacherDefHrs ?? 8) || 0; if (!t || !t.h) { const tt = (D.teacherTimes || {})[e.id], mm = (x) => { const [h, i] = String(x).split(":").map(Number); return h * 60 + (i || 0); }; if (tt && tt.start && tt.end && mm(tt.end) > mm(tt.start)) { const span = mm(tt.end) - mm(tt.start); return Math.max(0, span - (span > 300 ? +D.lunchMin || 0 : 0)) / 60; } return def > 0 ? def : null; }   // no hours typed but a personal time in / out is set (6:00 - 15:00): hours = time out - time in - lunch break   // no hours typed: the default hours per day (Teacher Hours menu, 8 unless changed; 0 = use the biometric hours)
  const v = t.h[dow]; return v === undefined || v === null || v === "" ? 0 : Math.max(0, +v || 0);
}

/** Grace period (minutes) before an employee counts as late: teachers have their own, everybody else (staff, admins) uses the staff one. */
function graceOf(e, dow) {
  const D = ST.settings.dtr, g = categoryOf(e), t = g === "teacher", row = D.grace && D.grace[g], v = row && dow !== undefined && row[dow] !== undefined && row[dow] !== "" ? row[dow] : (t ? D.graceTeacher : D.graceStaff);
  return +(v ?? (t ? 15 : (D.graceMin ?? 30))) || 0;
}

/** Grace for a group on a weekday (0 = Sunday ... 6 = Saturday), straight from the Settings grid. */
const graceFor = (g, dow) => { const D = ST.settings.dtr, r = D.grace && D.grace[g]; return +(r && r[dow] !== undefined ? r[dow] : g === "teacher" ? D.graceTeacher ?? 15 : D.graceStaff ?? 30) || 0; };

/** Who may take overtime (Settings > Overtime): a person's own choice first, otherwise the choice for the group. Nobody by default. */
function otAllowed(e) {
  const O = ST.settings.dtr.ot || {}, own = (O.people || {})[e.id];
  if (own === "yes") return true; if (own === "no") return false;
  return !!(O.groups || {})[categoryOf(e)];
}

/** Teacher-only switches (Settings > Auto late & overtime > Teachers). They are separate from the staff / admin switches.
    lateDeduct: a late time in is not paid (hours count from the time in); OFF = hours count from the class start, late is only reported.
    earlyOutDeduct: an early time out is not paid (hours stop at the time out); OFF = hours count to the class end, early out is only reported.
    An early time in is never overtime and is not paid (fixed rule). */
function tchOpt() { const T = (ST.settings.dtr || {}).teacher || {}; return { lateDeduct: T.lateDeduct !== false, earlyOutDeduct: T.earlyOutDeduct !== false }; }

/** Is late deducted automatically for this person? Teachers use their own switch, staff and admins the general one. */
const lateOn = (e) => (categoryOf(e) === "teacher" ? tchOpt().lateDeduct : (((ST.settings.dtr || {}).late || {}).deduct !== false));

/** Late minutes: counted only after the grace period ends (8:00 + 30 grace: 8:31 is 1 late minute), rounded down / up / nearest as Settings says. */
function lateMinutes(inn, S0, grace) {
  const L = ST.settings.dtr.late || {}, x = inn - S0 - grace, R = L.round === "up" ? Math.ceil(x - 1e-9) : L.round === "nearest" ? Math.round(x) : Math.floor(x + 1e-9);
  return Math.max(1, R);
}

/** Late counted per hour, same idea as overtime (Settings > Late computation): the minutes past the official time in are counted in whole hours.
    Staff / admins: 30-59 min late = 1 hr. Teachers: 16-59 min late = 1 hr. The minutes past the last full hour count as one more hour only from that minute (staff 30, teachers 16):
    e.g. staff 45 min = 1 hr, 1 hr 20 min = 1 hr, 1 hr 40 min = 2 hrs. Below the start minute = 0. Switch off (hourOn = false) = exact minutes as before.
    x = minutes late counted from the official time in (not from the end of the grace period). Returns minutes (a multiple of 60). */
function lateHourMin(e, x) {
  const L = ST.settings.dtr.late || {}; if (L.hourOn === false) return Math.max(0, x);
  const fm = categoryOf(e) === "teacher" ? +(L.fromTeacher ?? 16) : +(L.fromStaff ?? 30), rem = x % 60;
  return Math.floor((x + 1e-9) / 60) * 60 + (fm > 0 && rem >= fm - 1e-9 ? 60 : 0);
}

/** Minutes deducted for late: none when switched off, otherwise rounded up to the block set in Settings (1 = every minute). */
function lateDeductMin(S, m) { const L = (S.dtr && S.dtr.late) || {}; if (L.deduct === false || !m) return 0; const b = Math.max(1, +L.blockMin || 1); return Math.ceil(m / b) * b; }

/** Minutes as hours and minutes: 85 -> "1 hr 25 min", 120 -> "2 hrs", 45 -> "45 min". fmtHM0 / fmtHMd show "" / "-" for zero. */
const fmtHM = (m) => { m = Math.round(+m || 0); if (m <= 0) return "0 min"; const h = Math.floor(m / 60), r = m % 60; return (h ? h + (h === 1 ? " hr" : " hrs") : "") + (h && r ? " " : "") + (r ? r + " min" : ""); };

/** Minutes as Hours:Minutes: 510 -> "8:30", 45 -> "0:45". hmParse reads "8:30" or a decimal "8.5" back into decimal hours (null when it is not a number). */
const fmtHMc = (m) => { m = Math.max(0, Math.round(+m || 0)); return Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0"); };
const hmParse = (t) => { t = String(t ?? "").trim(); if (t === "") return ""; const c = /^(\d+)\s*:\s*(\d{1,2})$/.exec(t); if (c) return Math.round((+c[1] + Math.min(59, +c[2]) / 60) * 10000) / 10000; return isNaN(+t) || +t < 0 ? null : +t; };

const fmtHM0 = (m) => (Math.round(+m || 0) > 0 ? fmtHM(m) : ""), fmtHMd = (m) => (Math.round(+m || 0) > 0 ? fmtHM(m) : "-");

/** Overtime minutes from a time out: only after the start minutes, in whole blocks, with a minimum and a daily cap. */
/** Overtime rounding (Settings > Overtime): counted in blocks (default 1 hour). The minutes past the last full block count as one more block only from "roundFrom" minutes (default 30):
    1 hr 29 min = 1 hr, 1 hr 30 min to 1 hr 59 min = 2 hrs, 25 min = 0. roundFrom 0 = the excess minutes are never counted. */
function otRound(x) {
  const O = ST.settings.dtr.ot || {}, bl = Math.max(1, +(O.blockMin ?? 60) || 1), rf = Math.max(0, +(O.roundFrom ?? 30) || 0), rem = x % bl;
  return Math.floor((x + 1e-9) / bl) * bl + (rf > 0 && rem >= rf - 1e-9 ? bl : 0);
}
const otFloor = otRound;   // holiday / WFH work and early-in overtime use the same rounding

/** Overtime minutes from a time out: only after the start minutes, rounded as above, with a minimum and a daily cap. */
function otMinutes(x) {
  const O = ST.settings.dtr.ot || {}, st = +(O.startMin ?? 0) || 0; if (x < st || x < 1e-9) return 0;
  let m = otRound(x); if (m < 1 || m < (+O.minMin || 0)) return 0; if (+O.maxHrs > 0) m = Math.min(m, O.maxHrs * 60); return m;
}

