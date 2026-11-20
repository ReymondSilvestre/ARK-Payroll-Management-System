/* ============================================================
   CORE - settings, periods, payroll calculation, app base (state, api, login, layout) and the attendance (DTR) engine
   Combined file. Each section below is one of the former separate files (kept in the same order).
   ============================================================ */

/* >>>>>>>>>> js/core/settings.js >>>>>>>>>> */
/* ============================================================
   DEFAULT SETTINGS - every rate/rule the payroll starts with, and how saved settings are merged over them.
   File: js/core/settings.js
   ============================================================ */

/* Finance - Payroll: the automatic calculation. Pure functions (no screen, no server) so the same numbers are used everywhere.
   Every rate below is only a DEFAULT: the Payroll officer can change all of them under Settings (the government changes them from time to time). */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const DEFAULT_SETTINGS = {
  otFile: [],                     // the overtime file: [{id, empId, date, hours, reason}]
  frequency: "semi",              // "semi" = twice a month (1-15 and 16-end), "monthly" = once a month
  payByCutoff: true,             // twice-a-month pay of daily-rate people = paid days of THAT cut-off x daily rate (holidays included); off = fixed half of the monthly pay
  restDayHoliday: true,          // a REGULAR holiday that falls on a rest day (Sunday) is counted and paid (true) or not counted at all (false)
  workDays: 26,                   // working days in a month: daily rate = monthly pay / workDays
  hoursPerDay: 8,
  otRate: 1.25,                   // overtime = hourly rate x this
  contribTiming: "split",         // older single setting, now only the fallback: each benefit (sss / phic / hdmf) has its own `when`: "split" = half in each cut-off, "first" / "second" = all in that cut-off
  minWage: { on: true, daily: 645, admin: 1000, teacherHour: 100 },   // minimum wage: the lowest DAILY rate paid to any employee (teachers: this / hours a day, per hour). Changeable under Settings > Minimum wage
  teacherRate: 100,               // starting rate per hour of a teacher (pesos). New teacher pay records start with this; it can be changed here, and per teacher under Add information
  adminRange: { min: 0, max: 0 },   // salary range of the school admins (monthly); a pay outside it is flagged, 0 = no limit
  cutoffPair: "B",                // usual cut-off: "A" = 26th-10th and 11th-25th, "B" = 1st-15th and 16th-end (the cut-off can still be chosen for every payroll)
  // Government benefits: mode "fixed" = the same fixed amount a month (employee share / employer share) typed here or per employee under Add information;
  // mode "percent" = the rate below applied to the monthly pay.
  sss: { on: true, mode: "fixed", fixedEe: 0, fixedEr: 0, rate: 5, min: 5000, max: 35000, step: 500, erRate: 10, ec: 30 },                       // employee 5%, employer 10% (+EC) of the Monthly Salary Credit
  phic: { on: true, mode: "fixed", fixedEe: 0, fixedEr: 0, rate: 5, employeeShare: 50, min: 10000, max: 100000 },                                // 5% premium shared equally, on the monthly basic pay
  hdmf: { on: true, mode: "fixed", fixedEe: 0, fixedEr: 0, rate: 2, erRate: 2, cap: 10000 },                                                      // Pag-IBIG: 2% of pay up to the Monthly Fund Salary cap
  tax: { on: true, method: "bracket", flatRate: 0, flatOver: 0, mweExempt: false, afterContrib: true, includeAllowances: true, employerName: "", employerTin: "", rdo: "", brackets: [{ over: 0, rate: 0, base: 0 }, { over: 250000, rate: 15, base: 0 }, { over: 400000, rate: 20, base: 22500 }, { over: 800000, rate: 25, base: 102500 }, { over: 2000000, rate: 30, base: 402500 }, { over: 8000000, rate: 35, base: 2202500 }] },   // yearly taxable income
  dtr: { start: "08:00", end: "17:00", lunchMin: 60, graceMin: 30, graceStaff: 30, graceTeacher: 15, otStartMin: 30, otBlockMin: 30, halfDayHrs: 4, workDays: [1, 2, 3, 4, 5, 6], restDayAsOt: true, teacherStart: "", teacherEnd: "", teacherDefHrs: 8, deptTimes: {}, shifts: [{ id: "sh1", name: "Maintenance - Shift A", dept: "Maintenance", start: "06:00", end: "15:00" }, { id: "sh2", name: "Maintenance - Shift B", dept: "Maintenance", start: "10:00", end: "19:00" }, { id: "sh3", name: "Security", dept: "Security", start: "06:00", end: "18:00" }], empShift: {}, grace: { staff: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 15, 0: 15 }, teacher: { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15, 0: 15 }, admin: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 15, 0: 15 } }, ot: { groups: { staff: false, teacher: false, admin: false }, people: {}, startMin: 0, blockMin: 60, roundFrom: 30, minMin: 0, maxHrs: 0 }, late: { countFrom: "official", round: "down", blockMin: 1, deduct: true, hourOn: true, fromStaff: 30, fromTeacher: 16 }, early: { on: true, inMin: 1, outMin: 1 }, hrsBlock: 30, teacher: { lateDeduct: true, earlyOutDeduct: true }, noInRule: "absent", noOutRule: "half", halfDayAbs: 0.5, satHalf: { on: true, start: "08:00", end: "12:00", otFrom: "13:00", otMode: "filed", depts: ["Finance", "Registrar", "IT", "Marketing", "Administrative", "Executive"], off: ["Maintenance", "Security"], people: {} }, holidays: [], wfhDays: [], dateOrder: "MDY" },   // Daily Time Record from the biometric file
  // Payment of holidays (holidays that fall on a working day). % of the DAILY rate: notWorked = paid although nobody worked, worked = paid for a day worked on that holiday.
  // Fixed-pay employees: the monthly pay (daily rate x working days) already covers the holiday, so 100 / 200 means nothing extra for a holiday not worked and one extra day for a holiday worked.
  holiday: { regular: { notWorked: 100, worked: 200 }, special: { notWorked: 100, worked: 130 }, teachersPaid: true },
  // Work from home (WFH) / asynchronous class days (the dates are in dtr.wfhDays). Staff and admins are paid PER DAY (% of the daily rate; the monthly pay already covers the day, so 100 = nothing extra and nothing deducted).
  // Teachers are paid PER HOUR: the hours of that day (set per date, or the default hours) x the hourly rate x teacherPct / 100.
  wfh: { staffPaid: true, staffPct: 100, teachersPaid: true, teacherBasis: "rate", teacherHours: 8, teacherPct: 100 },   // teacherBasis: "rate" = hours x the teacher's own hourly rate; "minhour" = hours x the minimum hourly rate (Settings > Salary range); "minday" = the minimum daily wage for the day (not by hours)
  leaveTotal: 7, leaveTypes: null, m13Edits: {},   // total paid leave a year shared by Personal/Birthday/Emergency/Sick; custom leave list; manual 13th month edits per year
  unpaidLeave: true,              // approved "without pay" leave is deducted automatically
  period: { firstFrom: 1, firstTo: 15, secondFrom: 16, payFirst: 15, paySecond: 0, payWhole: 0 },   // pay periods and the usual pay day (0 = last day of the month); both can still be changed for every payroll
  signatories: [{ label: "Prepared by", name: "", position: "Finance Officer" }, { label: "Approved by", name: "", position: "School Head / Principal" }],   // printed under every payslip (the employee's "Received by" is always first)
  preparedBy: "", checkedBy: "", approvedBy: "", approvedTitle: "School Head / Principal",   // older settings, kept only so saved settings still open
};

/** Settings saved by the officer, filled in with the defaults for anything missing. */
function mergeSettings(saved) {
  const d = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), s = saved || {};
  for (const k of Object.keys(d)) {
    if (d[k] && typeof d[k] === "object" && !Array.isArray(d[k])) d[k] = { ...d[k], ...(s[k] || {}) };
    else if (s[k] !== undefined && s[k] !== null && s[k] !== "") d[k] = s[k];
  }
  if (s.tax && Array.isArray(s.tax.brackets) && s.tax.brackets.length) d.tax.brackets = s.tax.brackets;
  if (!Array.isArray(s.signatories) || !s.signatories.length) {          // settings saved before the signatory list existed
    d.signatories = [{ label: "Prepared by", name: s.preparedBy || "", position: "Finance Officer" }, { label: "Approved by", name: s.approvedBy || "", position: s.approvedTitle || "School Head / Principal" }];
  }
  return d;
}


/* >>>>>>>>>> js/core/periods.js >>>>>>>>>> */
/* ============================================================
   PAY PERIODS - cut-offs (1-15 / 16-end), monthly periods, custom periods.
   File: js/core/periods.js
   ============================================================ */

/** The pay period for a month and a half ("first", "second", "whole"). P = the pay period rules from the Settings (first day / last day of each half). */
function periodOf(month, half, P) {
  const R = { ...DEFAULT_SETTINGS.period, ...(P || {}) };
  const [y, m] = month.split("-").map(Number), last = new Date(y, m, 0).getDate(), p = (n) => String(n).padStart(2, "0"), cl = (n) => Math.min(last, Math.max(1, Math.round(+n) || 1));
  const a = half === "second" ? cl(R.secondFrom) : cl(R.firstFrom), b = half === "first" ? cl(R.firstTo) : last;
  const mon = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
  const label = half === "whole" ? mon + " " + y : `${mon} ${a} - ${b}, ${y}`;
  return { start: `${y}-${p(m)}-${p(a)}`, end: `${y}-${p(m)}-${p(b)}`, label, half };
}

/** A period typed by hand (start and end dates), for the half the contributions follow. */
function customPeriod(start, end, half) {
  const f = (d) => new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { start, end, label: `${f(start)} - ${f(end)}`, half };
}

/** The cut-off periods a payroll can follow. half = which pay of the month it is (for "contributions in the 1st / 2nd pay"). */
const CUTOFFS = [
  { key: "c26_10", label: "26th - 10th", half: "first", pair: "A" },
  { key: "c11_25", label: "11th - 25th", half: "second", pair: "A" },
  { key: "c1_15", label: "1st - 15th", half: "first", pair: "B" },
  { key: "c16_end", label: "16th - 30th / 31st (end of month)", half: "second", pair: "B" },
];

/** The period of a cut-off for a month. For 26th - 10th the month is the one the period ENDS in (Nov 2026 = Oct 26 - Nov 10). */
function cutoffPeriod(month, key) {
  const [y, m] = month.split("-").map(Number), p = (n) => String(n).padStart(2, "0"), mon = (yy, mm) => new Date(yy, mm - 1, 1).toLocaleString("en-US", { month: "short" }), last = (yy, mm) => new Date(yy, mm, 0).getDate();
  const c = CUTOFFS.find((x) => x.key === key) || CUTOFFS[2];
  let a, b, label;
  if (key === "c26_10") { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; a = `${py}-${p(pm)}-26`; b = `${y}-${p(m)}-10`; label = `${mon(py, pm)} 26 - ${mon(y, m)} 10, ${y}`; }
  else if (key === "c11_25") { a = `${y}-${p(m)}-11`; b = `${y}-${p(m)}-25`; label = `${mon(y, m)} 11 - 25, ${y}`; }
  else if (key === "c16_end") { const l = last(y, m); a = `${y}-${p(m)}-16`; b = `${y}-${p(m)}-${p(l)}`; label = `${mon(y, m)} 16 - ${l}, ${y}`; }
  else { a = `${y}-${p(m)}-01`; b = `${y}-${p(m)}-15`; label = `${mon(y, m)} 1 - 15, ${y}`; }
  return { start: a, end: b, label, half: c.half, cut: c.key };
}

/** Which cut-off a pair of dates is ("custom" when it is none of them, "whole" for a whole month). */
function cutOfDates(start, end) {
  if (!start || !end) return "custom";
  const d = (x) => +x.slice(8, 10), [ey, em] = end.split("-").map(Number), l = new Date(ey, em, 0).getDate(), sm = start.slice(0, 7) === end.slice(0, 7);
  if (d(start) === 26 && d(end) === 10 && !sm) return "c26_10";
  if (d(start) === 11 && d(end) === 25 && sm) return "c11_25";
  if (d(start) === 1 && d(end) === 15 && sm) return "c1_15";
  if (d(start) === 16 && d(end) === l && sm) return "c16_end";
  if (d(start) === 1 && d(end) === l && sm) return "whole";
  return "custom";
}


/* >>>>>>>>>> js/core/payroll-calc.js >>>>>>>>>> */
/* ============================================================
   PAYROLL CALCULATION - rates, SSS/PhilHealth/Pag-IBIG, tax and computeSlip(). Pure functions: no screen, no server.
   File: js/core/payroll-calc.js
   ============================================================ */

/** Monthly pay of a fixed-pay employee: DAILY RATE x working days a month (Settings). Pay information saved before the daily rate existed keeps its monthly pay. */
const minDaily = (S, info) => { const M = S && S.minWage; if (!M || M.on === false) return 0; const g = info ? categoryOf(info) : "staff"; return g === "teacher" ? 0 : g === "admin" ? (+M.admin > 0 ? +M.admin : +M.daily || 0) : (+M.daily > 0 ? +M.daily : 0); };

   // Staff 645 / Admins 1000 per day
const minHourly = (S) => (S && S.minWage && S.minWage.on !== false && +S.minWage.teacherHour > 0 ? +S.minWage.teacherHour : 0);

   // Teachers: minimum per hour
/** Daily rate that is really paid: the saved daily rate (or the old monthly pay / working days), never below the minimum wage. */
const dailyRateOf = (info, S) => { const w = +(S && S.workDays) || 22, d = info && +info.dailyRate > 0 ? +info.dailyRate : info && +info.basicMonthly > 0 ? r2(+info.basicMonthly / w) : 0; return Math.max(d, minDaily(S, info)); };

const monthlyBasicOf = (info, S) => { const w = +(S && S.workDays) || 22, own = info && +info.dailyRate > 0 ? r2(+info.dailyRate * w) : +(info && info.basicMonthly) || 0; return isHourly(info) ? own : Math.max(own, r2(minDaily(S, info) * w)); };

/** Monthly amount of one allowance: a daily allowance (perDay) x working days a month; an older allowance is already a monthly amount. */
const allowMonthly = (a, S) => (isDowAllow(a) ? r2((+a.amount || 0) * a.days.length * 52 / 12) : a && a.perDay ? r2((+a.amount || 0) * (+(S && S.workDays) || 22)) : +(a && a.amount) || 0);

/** An allowance paid on chosen weekdays (e.g. transportation: Mon, Wed, Fri x 100 a day). a = { perDow: true, days: [1, 3, 5] (0 = Sunday ... 6 = Saturday), amount: per day, presentOnly }.
    Monthly amount above is only an estimate (for the tax estimate and the lists): the pay itself counts the real days of the period. */
function isDowAllow(a) { return !!(a && a.perDow === true && Array.isArray(a.days)); }

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dowLabel = (days) => [1, 2, 3, 4, 5, 6, 0].filter((d) => (days || []).includes(d)).map((d) => DOW_SHORT[d]).join(", ");

/** The dates of the pay period on which a weekday allowance is paid (a.incHol = holidays and WFH days are paid too). "Pay only on days present": only days with a punch in the DTR (i.presentDates); without DTR data, or when switched off, every matching weekday that is not a holiday. */
function allowDaysIn(a, S, period, i) {
  const out = [], days = a.days || [], pd = i && Array.isArray(i.presentDates) ? new Set(i.presentDates) : null, hol = new Set(((S.dtr && S.dtr.holidays) || []).map((h) => h.date)), wfh = new Set(((S.dtr && S.dtr.wfhDays) || []).map((h) => h.date));
  if (!period || !period.start || !period.end) return out;
  for (let d = new Date(period.start + "T12:00"), z = new Date(period.end + "T12:00"); d <= z; d.setDate(d.getDate() + 1)) {
    if (!days.includes(d.getDay())) continue;
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    if (a.incHol === true && (hol.has(k) || wfh.has(k))) { out.push(k); continue; }   // "Include holidays and WFH days": a ticked weekday that is a holiday or a WFH day is paid even without a punch
    if (a.presentOnly !== false && pd) { if (pd.has(k)) out.push(k); } else if (!hol.has(k)) out.push(k);
  }
  return out;
}

/** A per-hour employee (teachers are paid for the hours they teach, not a fixed daily pay). Saved choice first; without one, a position with teacher / instructor / professor is per hour. */
const CATEGORIES = [{ key: "staff", label: "Employee staff", short: "Staff" }, { key: "teacher", label: "Teachers (paid per hour)", short: "Teachers" }, { key: "admin", label: "School admins", short: "School admins" }];

const TEACHER_RX = /teacher|instructor|professor|faculty/i, ADMIN_RX = /principal|school head|head of school|school admin|director|administrator|president|dean|superintendent|supervisor|coordinator/i;

/** The payroll group of an employee: staff, teacher (paid per hour) or admin (school admins). The saved choice first; without one it follows the position. */
function categoryOf(info) {
  if (!info) return "staff";
  if (/^\s*admins?(\s+(department|dept\.?))?\s*$/i.test(info.dept || "") && info.category !== "teacher") return "admin";   // department "admins" = school admins
  if (info.category === "staff" || info.category === "teacher" || info.category === "admin") return info.category;
  const pos = info.position || "";
  if (info.payType === "hourly") return "teacher";
  if (info.payType === "monthly") return ADMIN_RX.test(pos) ? "admin" : "staff";
  return TEACHER_RX.test(pos) ? "teacher" : ADMIN_RX.test(pos) ? "admin" : "staff";
}

/** A per-hour employee: teachers are paid for the hours they teach, not a fixed daily pay. */
const isHourly = (info) => categoryOf(info) === "teacher";

/** The usual pay day of a period (rule from the Settings; 0 = last day of the month). */
function payDateOf(month, half, P) {
  const R = { ...DEFAULT_SETTINGS.period, ...(P || {}) }, [y, m] = month.split("-").map(Number), last = new Date(y, m, 0).getDate(), p = (n) => String(n).padStart(2, "0");
  const d = half === "first" ? R.payFirst : half === "second" ? R.paySecond : R.payWhole;
  return `${y}-${p(m)}-${p(+d > 0 ? Math.min(last, +d) : last)}`;
}

/** Monday-Friday days of [a,b] that fall inside the period (both "YYYY-MM-DD"). Used for approved leave without pay. */
function weekdaysIn(a, b, ps, pe) {
  const from = a > ps ? a : ps, to = b < pe ? b : pe; if (from > to) return 0;
  let n = 0; for (let d = new Date(from + "T00:00"); d <= new Date(to + "T00:00"); d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Yearly withholding tax from the bracket table (over / rate % / base amount). */
function yearlyTax(taxable, brackets) {
  let row = brackets[0]; for (const b of brackets) if (taxable > b.over) row = b;
  return taxable <= brackets[0].over ? 0 : r2((row.base || 0) + (taxable - row.over) * (row.rate / 100));
}

/** Paid days of a pay period = the working days (Settings > work days, Mon-Sat by default) from its first to its last date, holidays included because they are paid.
    Depends on the cut-off: 1st - 15th, 16th - end of month, 26th - 10th, 11th - 25th or a custom period. Without dates it falls back to workDays / number of pays. */
function paidDaysOf(period, S, div) {
  const a = period && period.start, b = period && period.end;
  if (!a || !b || a > b) return r2((+S.workDays || 0) / (div || 1));
  const wd = ((S.dtr && S.dtr.workDays) || [1, 2, 3, 4, 5, 6]).map(Number), ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  // a REGULAR holiday that falls on a rest day (e.g. a Sunday) is still paid, so it counts as a paid day of the cut-off too (the payroll page adds it to the holidays of the period the same way)
  const restHol = new Set(((S.dtr && S.dtr.holidays) || []).filter((h) => S.restDayHoliday !== false && h.type === "regular" && h.date >= a && h.date <= b).map((h) => String(h.date).slice(0, 10))); let n = 0;
  for (let d = new Date(a + "T12:00"), e = new Date(b + "T12:00"); d <= e; d.setDate(d.getDate() + 1)) if (wd.includes(d.getDay()) || restHol.has(ymd(d))) n++;
  return n;
}

/** The monthly government contributions for a monthly basic pay (employee share and employer share). */
function monthlyContrib(basicMonthly, info, S) {
  const out = { sssEe: 0, sssEr: 0, phicEe: 0, phicEr: 0, hdmfEe: 0, hdmfEr: 0 }, fixedOf = (g) => g.mode !== "percent";      // mode "fixed" is the default
  if (info.sss !== false && S.sss.on) { if (fixedOf(S.sss)) { out.sssEe = r2(S.sss.fixedEe); out.sssEr = r2(S.sss.fixedEr); } else { const msc = clamp(Math.floor((basicMonthly + S.sss.step / 2) / S.sss.step) * S.sss.step, S.sss.min, S.sss.max); out.sssEe = r2(msc * S.sss.rate / 100); out.sssEr = r2(msc * S.sss.erRate / 100 + (S.sss.ec || 0)); } }
  if (info.philhealth !== false && S.phic.on) { if (fixedOf(S.phic)) { out.phicEe = r2(S.phic.fixedEe); out.phicEr = r2(S.phic.fixedEr); } else { const base = clamp(basicMonthly, S.phic.min, S.phic.max), tot = base * S.phic.rate / 100; out.phicEe = r2(tot * S.phic.employeeShare / 100); out.phicEr = r2(tot - out.phicEe); } }
  if (info.pagibig !== false && S.hdmf.on) { if (fixedOf(S.hdmf)) { out.hdmfEe = r2(S.hdmf.fixedEe); out.hdmfEr = r2(S.hdmf.fixedEr); } else { const base = Math.min(basicMonthly, S.hdmf.cap); out.hdmfEe = r2(base * S.hdmf.rate / 100); out.hdmfEr = r2(base * S.hdmf.erRate / 100); } }
  // a fixed amount typed under Add information (per month) replaces the amount from the Settings for that employee
  const fx = info.fixed || {}, has = (v) => v !== undefined && v !== null && v !== "" && +v >= 0;
  if (has(fx.sss)) out.sssEe = r2(+fx.sss); if (has(fx.phic)) out.phicEe = r2(+fx.phic); if (has(fx.hdmf)) out.hdmfEe = r2(+fx.hdmf);
  return out;
}

/** One employee's pay for one period.
 *  info: the pay information; inp: { absentDays, lateMin, otHours, otherEarn, otherDed } typed for this run; leaveDays: unpaid leave days found automatically. */
function computeSlip(info, inp, S, period) {
  const semi = S.frequency === "semi" && period.half !== "whole", div = semi ? 2 : 1, i = inp || {};
  const perHour = !!isHourly(info), rate = perHour ? Math.max(+info.hourlyRate || 0, minHourly(S)) : 0, hours = perHour ? r2(+i.hoursWorked || 0) : 0;
  // per-hour employee (teacher): pay = hours worked x rate for THIS period; no absence / late deduction (only the hours worked are paid).
  // fixed-pay employee: monthly pay (half of it in a twice-a-month payroll) less absences and late.
  const mB = !perHour && i.mBasic !== undefined && i.mBasic !== null && i.mBasic !== "" && !isNaN(+i.mBasic);      // pay of this period typed by hand (administrators)
  const baseMonthly = monthlyBasicOf(info, S);
  const byDays = !perHour && !mB && semi && S.payByCutoff !== false && period && period.start && period.end;   // Settings > Pay by days of the cut-off
  const basic = perHour ? r2(hours * rate) : mB ? r2(+i.mBasic) : byDays ? r2(paidDaysOf(period, S, div) * dailyRateOf(info, S)) : r2(baseMonthly / div);   // monthly (for SSS / tax) stays baseMonthly
  const monthly = perHour || mB ? r2(basic * div) : baseMonthly;      // the monthly equivalent (used by the percent rates and the tax estimate)
  const daily = !perHour && !mB ? dailyRateOf(info, S) : monthly / S.workDays, hourly = perHour ? rate : daily / S.hoursPerDay;
  const absentDays = perHour ? 0 : (+i.absentDays || 0) + (+i.leaveDays || 0);
  const cutDays = semi && S.payByCutoff !== false && !!(period && period.start && period.end), allowList = (info.allowances || []).map((a) => { if (isDowAllow(a)) { const dd = allowDaysIn(a, S, period, i); return { label: a.label, amount: r2((+a.amount || 0) * dd.length), perDay: true, daily: r2(+a.amount || 0), count: dd.length, dowLabel: dowLabel(a.days) }; } if (a.perDay && cutDays) { const nd = paidDaysOf(period, S, div); return { label: a.label, amount: r2((+a.amount || 0) * nd), perDay: true, daily: r2(+a.amount || 0), count: nd }; }   // daily allowance: the paid days of THIS cut-off x the daily amount (not a fixed half of workDays)
    return { label: a.label, amount: r2(allowMonthly(a, S) / div), perDay: !!a.perDay, daily: a.perDay ? r2(+a.amount || 0) : null }; });
  let allowLess = 0;
  /* A DAILY allowance is not paid for a day the employee is absent: absent days (a half day counts as the half-day value, unpaid leave as a full day) x the daily amount are taken off (a minus on the payslip's earnings side).
     Weekday allowances set to "Pay only on days present" already skip absent days, so nothing is taken off twice. Teachers (paid per hour) are only paid for the hours they worked. */
  if (!perHour) { const hv0 = +((S.dtr || {}).halfDayAbs ?? 0.5), lvDates = new Set(); (i.leaveList || []).forEach((x) => { if (!x || !x.from || !x.to) return; for (let d = new Date(String(x.from).slice(0, 10) + "T12:00"), z = new Date(String(x.to).slice(0, 10) + "T12:00"); d <= z; d.setDate(d.getDate() + 1)) lvDates.add(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")); });
    (info.allowances || []).forEach((a, k) => { const L = allowList[k]; if (!L || !L.perDay || !(L.daily > 0) || !(L.amount > 0)) return; let nd = 0;
      if (isDowAllow(a)) { if (a.presentOnly !== false && Array.isArray(i.presentDates)) return; const dd = new Set(allowDaysIn(a, S, period, i)), w = {}; (Array.isArray(i.absentList) ? i.absentList : []).forEach((x) => { w[x.d] = x.why === "half day" ? hv0 : 1; }); lvDates.forEach((d) => { w[d] = 1; }); Object.keys(w).forEach((d) => { if (dd.has(d)) nd += w[d]; }); }
      else nd = absentDays;   // Working day / per-day allowance: every absent (and unpaid leave) day, as in the absences deduction
      nd = r2(Math.max(0, nd)); const amt = Math.min(L.amount, r2(nd * L.daily)); if (amt > 0.004) { L.less = amt; L.lessDays = nd; allowLess = r2(allowLess + amt); } }); }
  const allow = r2(allowList.reduce((n, a) => n + a.amount, 0));
  const ot = r2((+i.otHours || 0) * hourly * S.otRate), otherEarn = r2(+i.otherEarn || 0);
  const absent = perHour ? 0 : r2(absentDays * daily), late = perHour ? 0 : r2((lateDeductMin(S, +i.lateMin || 0) / 60) * hourly);
  const mc = monthlyContrib(monthly, info, S);
  const share = (v, when) => { const t = when || S.contribTiming; return !semi ? v : t === "split" ? r2(v / 2) : (t === "first") === (period.half === "first") ? v : 0; };   // which cut-off takes the contribution (chosen per benefit under Settings)
  const sssEe = share(mc.sssEe, S.sss.when), phicEe = share(mc.phicEe, S.phic.when), hdmfEe = share(mc.hdmfEe, S.hdmf.when), sssEr = share(mc.sssEr, S.sss.when), phicEr = share(mc.phicEr, S.phic.when), hdmfEr = share(mc.hdmfEr, S.hdmf.when);
  let tax = 0, taxWhy = "";
  const fx = info.fixed || {}, has = (v) => v !== undefined && v !== null && v !== "" && !isNaN(+v) && +v >= 0;
  if (has(fx.tax)) { tax = r2(+fx.tax / div); taxWhy = "fixed"; }
  else if (info.tax !== false && S.tax.on) {
    const T = S.tax, mwe = T.mweExempt && (perHour ? minHourly(S) > 0 && rate <= minHourly(S) + 0.005 : minDaily(S, info) > 0 && daily <= minDaily(S, info) + 0.005);   // minimum wage earners pay no income tax (RA 9504)
    if (mwe) taxWhy = "mwe"; else {
      taxWhy = "table";
      const monthlyAllow = T.includeAllowances === false ? 0 : (info.allowances || []).reduce((n, a) => n + (a.taxable === false ? 0 : allowMonthly(a, S)), 0);
      const contrib = T.afterContrib === false ? 0 : mc.sssEe + mc.phicEe + mc.hdmfEe;
      const taxableMonth = Math.max(0, monthly + monthlyAllow - contrib);
      if (T.method === "flat") tax = r2(Math.max(0, taxableMonth - (+T.flatOver || 0)) * (+T.flatRate || 0) / 100 / div);
      else tax = r2(yearlyTax(taxableMonth * 12, T.brackets) / 12 / div);
    }
  }
  // amounts typed by hand for THIS payroll replace the automatic ones (government benefits and tax)
  const manual = { basic: mB, sss: has(i.mSss), phic: has(i.mPhic), hdmf: has(i.mHdmf), tax: has(i.mTax) };
  const sssF = manual.sss ? r2(+i.mSss) : sssEe, phicF = manual.phic ? r2(+i.mPhic) : phicEe, hdmfF = manual.hdmf ? r2(+i.mHdmf) : hdmfEe, taxF = manual.tax ? r2(+i.mTax) : tax;
  // recurring loans / other deductions (per month, shared by the pay periods); a loan with a balance stops when the balance is paid
  const dedList = (info.deductions || []).map((d) => {
    let amount = r2((+d.amount || 0) / div); const tracked = d.balance !== undefined && d.balance !== null && d.balance !== "" && !isNaN(+d.balance), bal = tracked ? r2(+d.balance) : null;
    if (tracked) amount = Math.min(amount, Math.max(0, bal));
    return { id: d.id || "", type: d.type || "", label: d.label, amount, balanceBefore: bal, balanceAfter: tracked ? r2(Math.max(0, bal - amount)) : null };
  });
  const loans = r2(dedList.reduce((n, d) => n + d.amount, 0)), otherDed = r2(+i.otherDed || 0), other = r2(loans + otherDed);
  // cash advance: the amount taken this pay (never more than the balance) and what is left
  const caBal = r2(Math.max(0, +(info.ca && info.ca.balance) || 0)), caWant = i.caDed !== undefined && i.caDed !== "" ? +i.caDed || 0 : Math.min(+(info.ca && info.ca.perPay) || 0, caBal), caDed = r2(Math.min(Math.max(0, caWant), caBal)), caAfter = r2(caBal - caDed);
  // holidays of the period (inp.hol: [{ date, label, type: "regular" | "special", worked, hours }]) paid by the rules under Settings > Payment of holidays
  const HS = S.holiday || DEFAULT_SETTINGS.holiday, hl = Array.isArray(i.hol) ? i.hol : [], pct = (t, k, def) => (t && t[k] !== undefined && t[k] !== "" && !isNaN(+t[k]) ? +t[k] : def);
  // teachers can have a FIXED amount instead of the per-hour pay: the teacher's own (Teacher Hours menu) first, then the school-wide one (Settings); blank = the per-hour rule
  const fxAmt = (v) => (v !== undefined && v !== null && v !== "" && !isNaN(+v) && +v >= 0 ? r2(+v) : null), TF = ((S.dtr || {}).teacherFixed || {})[info.id] || {}, GF = HS.tFixed || {};
  let holPay = 0, holDed = 0, holFixed = false; const holDedList = [], wfhDedList = [];
  for (const h of hl) {
    const sp = h.type === "special", T = sp ? HS.special : HS.regular, nw = pct(T, "notWorked", 100), wk = pct(T, "worked", sp ? 130 : 200);
    if (h.worked) { const f = perHour ? fxAmt(GF[sp ? "spWork" : "regWork"]) : null; if (f !== null) { holPay += f; holFixed = true; } else holPay += perHour ? (+h.hours || 0) * rate * (wk - 100) / 100 : daily * (wk - 100) / 100; }            // extra for working on the holiday (teachers: a fixed amount when one is set)
    else if (perHour) { if (HS.teachersPaid !== false) { const f = fxAmt(TF.hol) ?? fxAmt(GF[sp ? "spNot" : "regNot"]); if (f !== null) { holPay += f; holFixed = true; } else holPay += (h.sched !== undefined && h.sched !== null ? +h.sched : S.hoursPerDay) * rate * nw / 100; } }                    // teachers: a holiday not worked is paid at this % of a day
    else { const x = daily * (nw - 100) / 100; if (x < 0) { holDed -= x; holDedList.push({ date: h.date, label: h.label || "", type: h.type || "regular", pct: nw, amount: r2(-x) }); } else holPay += x; }                           // fixed pay: already in the monthly pay; below 100% = deducted
  }
  holPay = r2(holPay); holDed = r2(holDed);
  // work from home / asynchronous class days of the period (inp.wfh: [{ date, label, type, hours, worked }]): staff per day, teachers per hour, with pay
  const WS = S.wfh || DEFAULT_SETTINGS.wfh, wl = Array.isArray(i.wfh) ? i.wfh : [], hasN = (v) => v !== undefined && v !== null && v !== "" && !isNaN(+v);
  let wfhPay = 0, wfhDed = 0, wfhFixed = false;
  for (const w of wl) {
    if (w.worked) continue;                                                                                           // punched in that day: the DTR already pays it
    if (perHour) {
      if (WS.teachersPaid !== false) {
        const ff = fxAmt(TF.wfh) ?? fxAmt(WS.teacherFixed); if (ff !== null) { wfhPay += ff; wfhFixed = true; continue; }   // a fixed amount per WFH / asynchronous day
        const hrs = hasN(w.hours) ? +w.hours : hasN(WS.teacherHours) ? +WS.teacherHours : S.hoursPerDay, pc = (hasN(WS.teacherPct) ? +WS.teacherPct : 100) / 100, mh = minHourly(S) || r2((+(S.minWage && S.minWage.daily) || 0) / (+S.hoursPerDay || 8));
        wfhPay += WS.teacherBasis === "minday" ? (+(S.minWage && S.minWage.daily) || 0) * pc : hrs * (WS.teacherBasis === "minhour" ? mh : rate) * pc;
      }
    }   // teachers: per hour
    else if (WS.staffPaid === false) { wfhDed += daily; wfhDedList.push({ date: w.date, label: w.label || "", pct: 0, amount: r2(daily) }); }                                                                  // staff / admin: WFH without pay = the day is deducted
    else { const pc2 = hasN(WS.staffPct) ? +WS.staffPct : 100, x = daily * (pc2 - 100) / 100; if (x < 0) { wfhDed -= x; wfhDedList.push({ date: w.date, label: w.label || "", pct: pc2, amount: r2(-x) }); } else wfhPay += x; }   // staff / admin: per day, % of the daily rate
  }
  wfhPay = r2(wfhPay); wfhDed = r2(wfhDed);
  const gross = r2(basic + allow + ot + otherEarn + holPay + wfhPay), totalDed = r2(absent + allowLess + late + holDed + wfhDed + sssF + phicF + hdmfF + taxF + other + caDed), net = r2(gross - totalDed);
  return { cat: categoryOf(info), perHour, rate, hours, basic, allow, allowList, ot, otherEarn, gross, absent, allowLess, late, sssEe: sssF, phicEe: phicF, hdmfEe: hdmfF, sssEr, phicEr, hdmfEr, tax: taxF, other, dedList, otherDed, caDed, caBal, caAfter, manual, auto: { sssEe, phicEe, hdmfEe, tax }, totalDed, net, absentDays, leaveDays: +i.leaveDays || 0,
    holidays: hl.length, holWorked: hl.filter((h) => h.worked).length, holPay, holDed, holFixed, wfhPay, wfhDed, wfhFixed, wfhDays: wl.length, wfhList: wl.map((w) => ({ date: w.date, label: w.label || "", type: w.type || "wfh", hours: hasN(w.hours) ? +w.hours : null, worked: !!w.worked })), holList: hl.map((h) => ({ date: h.date, label: h.label || "", type: h.type || "regular", worked: !!h.worked })),
    dailyRate: perHour ? 0 : r2(daily), paidDays: paidDaysOf(period, S, div), otHours: r2(+i.otHours || 0), lateMin: r2(+i.lateMin || 0), presentDays: i.dtr && i.dtr.present !== undefined && i.dtr.present !== null ? +i.dtr.present : null,
    /* WHY each deduction was made (printed on the payslip) */
    why: { absentList: i.absentList || null, lateList: i.lateList || null, halfList: i.halfList || null, underList: i.underList || null, leaveList: i.leaveList || [], otherDedNote: String(i.otherDedNote || "").trim(), holDedList, wfhDedList, taxWhy, semi, half: period.half, sssWhen: S.sss.when, phicWhen: S.phic.when, hdmfWhen: S.hdmf.when, manualSss: manual.sss, manualPhic: manual.phic, manualHdmf: manual.hdmf, manualTax: manual.tax, absentTyped: i.absentList === null, lateTyped: i.lateList === null },
    classInfo: i.classInfo || null };
}


/* >>>>>>>>>> js/app/state.js >>>>>>>>>> */
/* ============================================================
   APP STATE - API url, tiny helpers ($, esc, money), the ST state object, school details.
   File: js/app/state.js
   ============================================================ */

const API_URL = "https://script.google.com/macros/s/AKfycbziiRmj072ytw_7bT42ia3EGimasoL74xoXwZJFttyyqZbuLeL4KQng8OUUVRbon_Fc/exec";

const $ = (s, r = document) => r.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const money = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const A = $("#app");

 let ST = { user: null, settings: DEFAULT_SETTINGS, employees: [], runs: [], tab: "dash", sheet: "", users: [], run: null };

let token = localStorage.getItem("pms.token") || "";

const SCHOOL = { name: "ARK Technological Institute Education System Inc.", address: "J-Seven Bldg. Magallanes Cor. Granja St. Brgy 7 Lucena City", contact: "717-65-10 or at 0907-365-6617" };


/* >>>>>>>>>> js/app/api.js >>>>>>>>>> */
/* ============================================================
   SERVER CALLS - api() to the Google Apps Script backend (backend/Code.gs), loading messages.
   File: js/app/api.js
   ============================================================ */

async function api(action, data) {
  $("#busy").style.display = "flex";
  try {
    let r, t, j;
    try { r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, token, data: action === "saveSettings" && data ? (({ otFile, ...rest }) => rest)(data) : data, ...(action === "login" ? data : {}) }) }); t = await r.text(); }
    catch (e) { throw new Error("Cannot reach the server. In Apps Script deploy a NEW VERSION as Web app with 'Who has access: Anyone', then reload."); }
    try { j = JSON.parse(t); } catch (e) { throw new Error("The server did not return data. Set 'Who has access' to Anyone and deploy a New version of Code.gs."); }
    if (!j.ok) { const m = typeof j.error === "string" ? j.error : (j.error && j.error.message) || "Server error"; if (m === "unauthenticated") { logout(); throw new Error("Session expired. Please sign in again."); } if (j.error && typeof j.error === "object") throw new Error("The deployed script is the old one (not this Payroll Code.gs). Paste the new Code.gs and deploy a New version."); throw new Error(m); }
    return j.data;
  } catch (e) { toast(e.message || "No connection.", true); throw e; } finally { $("#busy").style.display = "none"; }
}

async function checkApi() {
  const el = $("#st"); if (!el) return;
  try { const r = await fetch(API_URL), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    if (j && j.ok && /Payroll Management System/.test(j.data)) { if (j.version) { el.textContent = "Server connected. Code version: " + j.version; el.style.color = "#1a7f37"; } else { el.textContent = "Server connected but it is running OLD Code.gs (no backup/database features). Paste the new Code.gs and deploy a New version."; el.style.color = "#7a0c14"; } }
    else if (j) { el.textContent = "Server answers but it is NOT the Payroll Code.gs. Paste the new Code.gs and deploy a New version."; el.style.color = "#7a0c14"; }
    else { el.textContent = "Server not public. Deploy as Web app, Who has access: Anyone."; el.style.color = "#7a0c14"; }
  } catch (e) { el.textContent = "Cannot reach the server. Check the URL / deployment access (Anyone)."; el.style.color = "#7a0c14"; }
}

/* ===== v2: loading animations, 3 payroll sections, cash loan, holidays, biometric DTR ===== */
const BUSY = { login: "Signing in", bootstrap: "Loading your data", getRun: "Loading payslips", saveRun: "Saving payroll", saveEmployees: "Saving", saveSettings: "Saving settings", deleteRun: "Deleting payroll", deleteEmployee: "Deleting employee", saveLeave: "Saving leave", deleteLeave: "Deleting leave", otAdd: "Saving overtime", otRemove: "Removing overtime", listRuns: "Loading payrolls" };

const _api = api;

api = async (a, d) => { const w = BUSY[a] || (/^(save|add|set|toggle)/.test(a) ? "Saving" : "Loading"); $("#busy").innerHTML = `<div class="bx"><div class="spin"></div><b>${w}</b><div class="bar"><i></i></div></div>`; return _api(a, d); };


/** After saveEmployees: the server sends back only the people it saved (partial), so photos of the others are not sent again on every save. Merge them into the list in memory. */
function applyEmps(r) {
  if (!r.partial) { ST.employees = r.employees; return; }
  const L = ST.employees || [];
  r.employees.forEach((n) => { const c = { ...n }; if (c.photo === undefined) delete c.photo; const i = L.findIndex((x) => x.id === c.id); if (i >= 0) L[i] = { ...L[i], ...c }; else L.push(c); });
  ST.employees = L;
}

/* >>>>>>>>>> js/app/auth.js >>>>>>>>>> */
/* ============================================================
   LOGIN / LOGOUT and first data load.
   File: js/app/auth.js
   ============================================================ */

function logout() { token = ""; localStorage.removeItem("pms.token"); ST.user = null; showLogin(); }

function showLogin() {
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  A.innerHTML = `<div class="lgw"><section class="lgh"><div class="lgh-in"><div class="lgb"><img src="${LOGO}" alt=""><div><b>ARK Technological Institute</b><small>Education System Inc.</small></div></div>
  <h1>Payroll Management<br>System</h1><p class="lgt">One secure place for attendance, payroll, payslips and employee records.</p>
  <ul class="lgf"><li>${ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')}<div><b>Biometric DTR &amp; attendance</b><span>Late, absent and overtime read straight from the punches.</span></div></li>
  <li>${ic('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>')}<div><b>Accurate payroll &amp; payslips</b><span>SSS, PhilHealth, Pag-IBIG, tax and 13th month pay.</span></div></li>
  <li>${ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>')}<div><b>Secure &amp; centralised</b><span>Every record is saved to one database spreadsheet.</span></div></li></ul>
  <div class="lgc">${esc(SCHOOL.address)}<br>${esc(SCHOOL.contact)}</div></div></section>
  <section class="lgp"><form class="lgcard" id="lgform" autocomplete="on" novalidate><div class="lgm"><img src="${LOGO}" alt=""><b>ARK-Payroll</b></div><h2>Welcome back</h2><p class="lgs">Sign in to your payroll account to continue.</p>
  <label for="em">Email address</label><div class="fld">${ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>')}<input id="em" type="email" name="email" placeholder="name@school.edu.ph" autocomplete="username" autofocus></div>
  <label for="pw">Password</label><div class="fld">${ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}<input id="pw" type="password" name="password" placeholder="Enter your password" autocomplete="current-password"><button type="button" class="eye" id="eye" aria-label="Show password" title="Show / hide password">${ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')}</button></div>
  <button type="submit" class="btn p lgbtn" id="go">Sign in ${ic('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button>
  <p id="st" class="lgst">Checking server...</p><p class="lgfoot">&copy; ${new Date().getFullYear()} ARK Technological Institute Education System Inc.</p></form></section></div>`; checkApi();
  $("#eye").onclick = () => { const p = $("#pw"); p.type = p.type === "password" ? "text" : "password"; $("#eye").classList.toggle("on", p.type === "text"); };
  $("#lgform").onsubmit = (e) => { e.preventDefault(); go(); };
  const go = async () => { try { const r = await api("login", { email: $("#em").value, password: $("#pw").value }); token = r.token; localStorage.setItem("pms.token", token); ST.user = r.user; await load(); } catch { } };
}

async function load() {
  const b = await api("bootstrap"); ST.settings = mergeSettings(b.settings); daysMigrate(); minutesMigrate(); otHourMigrate(); satMigrate(); phAutoFill(); ST.employees = b.employees; ST.runs = b.runs; ST.sheet = ""; ST.backup = b.backup || ""; ST.leaves = b.leaves || [];
  if (Array.isArray(b.dtrLinks)) {   // biometric records linked by hand: the database is the master. A browser that never synced before adds its own links to it once.
    const sv = {}; b.dtrLinks.forEach((x) => (sv[x.key] = x.empId)); const synced = localStorage.getItem("pms.dtrLinkSync") === "1", merged = synced ? sv : { ...((ST.dtr && ST.dtr.link) || {}), ...sv };
    ST.dtr.link = merged; ST._dm = null; saveDtr(); try { localStorage.setItem("pms.dtrLinkSync", "1"); } catch { }
    if (!synced && Object.keys(merged).some((k) => sv[k] !== merged[k])) saveLinks();
  }
  if (!ST.user) ST.user = JSON.parse(localStorage.getItem("pms.user") || "null"); else localStorage.setItem("pms.user", JSON.stringify(ST.user));
  shell();
}


/* >>>>>>>>>> js/app/layout.js >>>>>>>>>> */
/* ============================================================
   LAYOUT - toast messages, tabs (menu), sidebar, shell(), logo.
   File: js/app/layout.js
   ============================================================ */

const TABS = [["dash", "Dashboard"], ["emp", "Employees"], ["run", "Payroll"], ["slips", "Payslips"], ["m13", "13th Month Pay"], ["loans", "Cash Loan"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]];

const V = (h) => ($("#v").innerHTML = h);

function toast(t, err) { const m = document.createElement("div"); m.className = "msg" + (err ? " err" : ""); m.innerHTML = (err ? '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.01"/></svg>' : '<svg viewBox="0 0 24 24"><path class="ck" d="M5 12.5l4.5 4.5L19 7.5"/></svg>') + "<span>" + esc(t) + "</span>"; document.body.append(m); setTimeout(() => { m.classList.add("out"); setTimeout(() => m.remove(), 250); }, 3200); }

TABS.splice(0, TABS.length, ["dash", "Dashboard"], ["emp", "Employees"], ["dtr", "DTR / Biometric"], ["th", "Teacher Hours"], ["cls", "Class Monitor"], ["leave", "Leave"], ["otf", "Overtime File"], ["run", "Payroll"], ["slips", "Payslips"], ["m13", "13th Month Pay"], ["ca", "Cash Advance"], ["loans", "Loans"], ["allow", "Allowances"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]);

/** HR accounts (role "hr") only see Leave and the Overtime File. The server refuses every other request from an HR account too. */
const isHR = () => !!(ST.user && ST.user.role === "hr");

const HR_TABS = ["leave", "otf"];

/** Class Monitor accounts (role "monitor") only see the Class Monitor and DTR / Biometric (class check DTR) menus. The server refuses every other request from them too. */
const isMon = () => !!(ST.user && ST.user.role === "monitor");

const MON_TABS = ["cls", "dtr"];

const visibleTabs = () => (isHR() ? TABS.filter((t) => HR_TABS.includes(t[0])) : isMon() ? TABS.filter((t) => MON_TABS.includes(t[0])) : TABS);

const LOGO = "assets/logo.png";   // the school logo (assets/logo.png)

const NAVICON = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  emp: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dtr: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  th: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M4 4l2 2M20 4l-2 2"/>',
  leave: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  run: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  slips: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  m13: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  loans: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  rep: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',
  set: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  cls: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M7 9h4M7 13h10"/><circle cx="16" cy="9" r="1.5"/>',
  otf: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M19 5l1.5 1.5"/>',
  ca: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9v6M14.5 10.5c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.7 0 2.2 5 1 5 3.2 0 1-1.1 1.7-2.5 1.7-1.1 0-2-.4-2.5-1.2"/>',
  allow: '<path d="M12 2v20M17 6.5C16 5 14.2 4 12 4 9.2 4 7 5.3 7 7.5c0 4.5 10 2.5 10 7 0 2.2-2.2 3.5-5 3.5-2.2 0-4-1-5-2.5"/>',
  usr: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>' };

const NAVSUB = { dash: "Overview of your payroll", emp: "Manage employee records, groups and pictures", dtr: "Biometric punches, attendance check and daily time records", th: "Hours of each teacher per day, from the teacher's schedule", cls: "Check that each teacher is in class, every hour, and clock the teacher in and out per class", leave: "Leave requests and balances", run: "Compute and finalize payroll per cut-off", slips: "Saved payroll runs and printable payslips", m13: "13th month pay per employee", loans: "Company, SSS (salary / calamity) and HDMF (MPL / calamity) loans per employee", ca: "Cash advance balance and deduction per payday", allow: "Monthly or per-day allowances per employee", otf: "Overtime hours filed per employee and date", rep: "Payroll reports and exports", set: "Payroll rules, late and overtime, holidays and signatories", usr: "Accounts that can sign in" };

function whoAmI() {   // the signed-in user's 2x2 picture, full name and department (from the matching employee record when the e-mail matches)
  const u = ST.user || {}, em = String(u.email || "").toLowerCase(), e = (em && (ST.employees || []).find((x) => String(x.email || "").toLowerCase() === em)) || {};
  return { name: u.name || nameOf(e) || "User", dept: u.dept || e.dept || "Finance - Payroll", position: u.position || e.position || "", photo: u.photo || e.photo || "" };
}

function shell() {
  if (isHR() && !HR_TABS.includes(ST.tab)) ST.tab = "leave";
  if (isMon() && !MON_TABS.includes(ST.tab)) ST.tab = "cls";
  const w = whoAmI(), cur = (TABS.find((t) => t[0] === ST.tab) || [])[1] || "";
  A.innerHTML = `<div class="layout"><aside class="side noprint"><div class="sbrand"><img src="${LOGO}" alt=""><b>ARK-Payroll Management System</b></div>
  <div class="prof">${w.photo ? `<img class="pic" src="${w.photo}" alt="">` : `<div class="pic">${esc(String(w.name).charAt(0).toUpperCase() || "?")}</div>`}<div class="pn">${esc(w.name)}</div><div class="pd">${esc(w.position || w.dept)}</div></div>
  <div class="slab">Menu</div><div class="smenu">${visibleTabs().map(([k, l]) => `<button data-t="${k}" class="${ST.tab === k ? "on" : ""}"><svg viewBox="0 0 24 24" aria-hidden="true">${NAVICON[k] || ""}</svg><span>${l}</span></button>`).join("")}</div>
  <div class="sfoot"><a href="#" id="lo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Sign out</a></div></aside>
  <div class="content"><div class="top noprint"><div class="tt"><h1>${esc(cur)}</h1><p>${esc(NAVSUB[ST.tab] || "")}</p></div><div class="tdate"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div><main id="v"></main></div></div>`;
  $("#lo").onclick = (e) => { e.preventDefault(); logout(); };
  document.querySelectorAll(".smenu [data-t]").forEach((b) => b.onclick = () => { ST.tab = b.dataset.t; shell(); });
  ({ dash, emp, dtr, th: teacherHours, cls: classMonitor, leave, otf: otfPage, ca: loans, loans, allow: loans, run, slips, m13, rep, set, usr })[ST.tab]();
}


/* >>>>>>>>>> js/dtr/punches.js >>>>>>>>>> */
/* ============================================================
   DTR DATA - dates, name matching, which employee owns which biometric record, saved punches.
   File: js/dtr/punches.js
   ============================================================ */

/* ---------- Biometric files -> DTR ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDay = (s, n = 1) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); };

const normNo = (s) => String(s ?? "").trim().replace(/^0+(?=.)/, "").toLowerCase();

/* ---------- Several biometric devices (Building 1, Building 2 ...) ----------
   A record key is "ID" (old uploads / no device chosen) or "Building 1|ID". The device is part of the key so the same ID number on two devices
   never mixes two people; the records of one person on different devices are joined by NAME (or linked by hand) in dtrMap() / daysOf(). */
const devKey = (dev, k) => { dev = String(dev ?? "").replace(/\|/g, " ").trim(); return dev ? dev + "|" + k : k; };
const keyDev = (k) => { const i = String(k).indexOf("|"); return i > 0 ? String(k).slice(0, i) : ""; };
const keyId = (k) => { const i = String(k).indexOf("|"); return i > 0 ? String(k).slice(i + 1) : String(k); };
const keyLabel = (k) => { const id = keyId(k), dv = keyDev(k); return (id.startsWith("n:") ? "(name only)" : id) + (dv ? " - " + dv : ""); };
/** Which device recorded the punch at minute m on date d for this employee ("" = unknown / no device chosen). */
function devOf(e, d, m) {
  const x = dtrMap().byEmp[e.id]; if (!x || m == null) return "";
  for (const k of x.keys) if (((ST.dtr.days[k] || {})[d] || []).includes(m)) return keyDev(k);
  return "";
}

const hm = (n) => n == null ? "" : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

/* ---------- Biometric record -> employee, matched by NAME (Last name, First name, Initial) ----------
   The Biometric ID does not have to equal the Employee ID. Order of trust: manual link > name in the file > same ID number. */
const nameNorm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9,\s]/g, " ").replace(/\s+/g, " ").trim();

const SUFFIX = new Set(["JR", "SR", "II", "III", "IV"]);

const words = (s) => nameNorm(s).replace(/,/g, " ").split(" ").filter((t) => t && !SUFFIX.has(t));

function empParts(e) {
  let last = e.last, first = e.first;
  if (!last && !first && e.name) { const [a, ...b] = String(e.name).split(","); if (b.length) { last = a; first = b.join(" "); } else first = a; }
  const F = words(first), ini = nameNorm(e.mi).charAt(0) || (F.length > 1 && F[F.length - 1].length === 1 ? F[F.length - 1] : "");
  return { L: words(last), F: F.filter((t) => t.length > 1), mi: ini };
}

function bioParts(raw) {
  const s = nameNorm(raw); if (!s) return null;
  const sp = (x) => x.split(" ").filter((t) => t && !SUFFIX.has(t));
  if (s.includes(",")) { const [a, ...b] = s.split(","), L = sp(a), R = sp(b.join(" ")); return { flat: false, L, ini: R.filter((t) => t.length === 1), all: [...L, ...R.filter((t) => t.length > 1)] }; }
  const T = sp(s); return { flat: true, L: [], ini: T.filter((t) => t.length === 1), all: T.filter((t) => t.length > 1) };
}

const lev = (a, b) => { const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };

const tokEq = (a, b) => a === b || (a.length > 4 && b.length > 4 && lev(a, b) <= 1) || (a === "MA" && b.startsWith("MA")) || (b === "MA" && a.startsWith("MA"));

/** How well does a biometric name fit an employee (0 = not the same person, 1 = same)? Tolerates the usual differences between the device and the employee file:
    "Last, First" or "First Last" order, glued surnames (DELACRUZ), a full middle name in the file (employee file has only the M.I.), initials instead of given names (J.C., "M. ELENA"),
    and names cut short by the device (DELA CRUZ JUAN CAR). A different middle initial / middle name still means another person: link that one by hand. */
function nameScore(bp, ep) {
  const E = [...ep.L, ...ep.F]; if (!bp || !bp.all.length || !E.length) return 0;
  const cb = bp.all.join(""), Lc = ep.L.join(""), Fc = ep.F.join(""); let sc;
  if (cb === Lc + Fc || cb === Fc + Lc) sc = 1;
  else {
    const toks = bp.all.slice(), used = new Set(); let pen = 0, fh = 0, ini = bp.ini.slice(), midDone = false;
    if (ep.L.length > 1) { const i = toks.findIndex((t) => tokEq(t, Lc)); if (i >= 0) { toks.splice(i, 1); ep.L.forEach((_, j) => used.add(j)); } }   // "DELACRUZ" = "Dela Cruz"
    const extra = [];
    toks.forEach((t, ti) => {
      let k = E.findIndex((x, i) => !used.has(i) && tokEq(t, x));
      if (k < 0 && ti === toks.length - 1 && t.length >= 3) { k = E.findIndex((x, i) => !used.has(i) && x.length > t.length && x.startsWith(t)); if (k >= 0) pen += 0.12; }   // cut short by the device
      if (k >= 0) { used.add(k); if (k >= ep.L.length) fh++; } else extra.push(t);
    });
    for (const t of extra) {
      if (ep.mi && t[0] === ep.mi && !midDone) { midDone = true; continue; }                     // the full middle name: its first letter is the employee's M.I.
      const g = [...Array(ep.F.length).keys()].map((i) => ep.L.length + i).filter((i) => !used.has(i));
      if (t.length <= 3 && g.length) { const pick = []; let gi = 0; for (const ch of t) { const m = g.slice(gi).findIndex((i) => E[i][0] === ch); if (m < 0) { pick.length = 0; break; } pick.push(g[gi + m]); gi += m + 1; } if (pick.length === t.length) { pick.forEach((i) => used.add(i)); fh++; pen += 0.04; continue; } }   // squashed initials: JC = Juan Carlos
      if (ep.mi) return 0;                                                                          // another middle name: probably another person
      pen += 0.1; if (pen > 0.25) return 0;                                                         // an extra name (the employee file has no middle name)
    }
    let initOnly = 0;
    for (const c of ini) {
      const g = [...Array(ep.F.length).keys()].map((i) => ep.L.length + i).find((i) => !used.has(i) && E[i][0] === c);
      if (g !== undefined && !(ep.mi === c && !fh)) { used.add(g); initOnly++; }                    // initial of a given name (M. ELENA, J. C.)
      else if (ep.mi && c === ep.mi) midDone = true;
      else if (ep.mi) return 0;                                                                     // a different middle initial = probably another person
    }
    if (!(fh + initOnly) || [...used].filter((i) => i < ep.L.length).length !== ep.L.length) return 0;   // the whole surname AND at least one given name (or its initial) must be there
    if (!bp.flat && !bp.L.every((t) => ep.L.some((x) => tokEq(t, x)) || tokEq(t, Lc))) return 0; // "LAST, First" must agree on the surname side
    sc = 0.6 + 0.4 * used.size / E.length - pen;
    if (!fh) sc = Math.min(sc, 0.8);                                                              // initials only: a weaker match
    if (midDone) sc += 0.05;
    return Math.max(0, Math.min(1, sc));
  }
  if (bp.ini.length && ep.mi) { if (!bp.ini.includes(ep.mi)) return 0; sc += 0.05; }
  return Math.min(1, sc);
}

/** A record with only a FIRST NAME in the file (e.g. "JUAN" or "MARIA ELENA"): it belongs to the employee whose given name it is, but only when no other employee has that first name; otherwise it is listed as "fits several" (the ID number can still decide). */
function firstNameOnly(bp, P) {
  if (!bp || !bp.flat || !bp.all.length || bp.all.length > 3) return null;
  const hit = P.filter(([, ep]) => { const used = new Set(); return ep.F.length && bp.all.every((t) => { const k = ep.F.findIndex((x, i) => !used.has(i) && tokEq(t, x)); if (k < 0) return false; used.add(k); return true; }); }).map((x) => x[0]);
  if (!hit.length) return null;
  return hit.length === 1 ? { e: hit[0], first: true } : { amb: hit };
}

function matchName(name, P) {
  const bp = bioParts(name); if (!bp) return null;
  const r = P.map(([e, ep]) => [e, nameScore(bp, ep)]).filter((x) => x[1] >= 0.7).sort((a, b) => b[1] - a[1]);
  if (!r.length) return firstNameOnly(bp, P);
  return r[1] && r[0][1] - r[1][1] < 0.1 ? { amb: r.filter((x) => r[0][1] - x[1] < 0.1).map((x) => x[0]) } : { e: r[0][0] };
}

/** Which employee does each biometric record belong to? Cached; reset with ST._dm = null. */
function dtrMap() {
  if (ST._dm) return ST._dm;
  const D = ST.dtr, emps = ST.employees; D.names ||= {}; D.link ||= {};
  const P = emps.map((e) => [e, empParts(e)]), byNo = new Map(emps.map((e) => [normNo(e.no), e])), byEmp = {}, unmatched = [];
  for (const k of Object.keys(D.days)) {
    const nm = D.names[k] || "", man = D.link[k] && emps.find((e) => e.id === D.link[k]), m = !man && nm ? matchName(nm, P) : null, idE = byNo.get(normNo(keyId(k)));
    let e = null, by = "", warn = "";
    if (man) { e = man; by = "manual"; }
    else if (m && m.e) { e = m.e; by = m.first ? "first name" : "name"; }
    else if (m && m.amb && idE && m.amb.includes(idE)) { e = idE; by = "name + ID"; }
    else if (!(m && m.amb) && idE) { e = idE; by = "ID"; if (nm) warn = "name in file: " + nm; }
    if (e) { const x = (byEmp[e.id] ||= { keys: [], by: [], warn: [] }); (x.kb ||= {})[k] = by; x.keys.push(k); if (!x.by.includes(by)) x.by.push(by); if (warn) x.warn.push(warn); }
    else unmatched.push({ key: k, name: nm, amb: m && m.amb ? m.amb : null });
  }
  return (ST._dm = { byEmp, unmatched });
}

/** All punches of one employee (several biometric IDs of the same person are merged). */
function daysOf(e) {
  const m = dtrMap().byEmp[e.id]; if (!m) return null;
  if (m.keys.length === 1) return ST.dtr.days[m.keys[0]];
  const out = {}; for (const k of m.keys) for (const [d, a] of Object.entries(ST.dtr.days[k])) out[d] = [...new Set([...(out[d] || []), ...a])];
  return out;
}

ST.dtr = (() => { try { return JSON.parse(localStorage.getItem("pms.dtr")) || { days: {} }; } catch { return { days: {} }; } })();

const saveDtr = () => { try { localStorage.setItem("pms.dtr", JSON.stringify(ST.dtr)); } catch { } };

/** Records linked by hand to an employee are also kept in the main database (tab "Biometric Links") and the backup report (sheet BIOMETRIC LINKS), so they survive a new computer or a cleared browser. The whole list is sent, so an unlink is saved too. */
const dtrLinkList = () => {
  const D = ST.dtr || {}, out = {}, nm = (k) => (D.names || {})[k] || "";
  for (const [key, empId] of Object.entries(D.link || {})) out[key] = { key, empId, name: nm(key), by: "manual" };
  for (const [empId, m] of Object.entries(dtrMap().byEmp)) for (const [key, by] of Object.entries(m.kb || {})) if (!out[key]) out[key] = { key, empId, name: nm(key), by };   // matched by the app (name / first name / ID): listed too, but recomputed at every upload
  return Object.values(out);
};
/** true = saved in the database. A failure is NOT hidden: the caller shows it (a "Linked" message must not cover it). */
async function saveLinks() { try { await api("saveDtrLinks", { links: dtrLinkList() }); return true; } catch { return false; } }

function parseStamp(v) {
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
  const s = String(v ?? "").trim(); let y, mo, d, h, mi, ap, m;
  if (m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { [, y, mo, d, h, mi, ap] = m; }
  else if (m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { y = +m[3] < 100 ? 2000 + (+m[3]) : m[3]; [mo, d] = ST.settings.dtr.dateOrder === "DMY" ? [m[2], m[1]] : [m[1], m[2]]; h = m[4]; mi = m[5]; ap = m[6]; }
  else return null;
  h = +h; if (ap) { ap = ap.toUpperCase(); if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0; }
  const sc = s.match(/\d{1,2}:\d{2}:(\d{2})/);
  return new Date(+y, +mo - 1, +d, h, +mi, sc ? +sc[1] : 0);
}


/* >>>>>>>>>> js/dtr/biometric-reader.js >>>>>>>>>> */
/* ============================================================
   BIOMETRIC FILE READER - reads Excel / CSV / DAT exports of any layout into punches.
   File: js/dtr/biometric-reader.js
   ============================================================ */

/* ===== BIOMETRIC READER (any layout) ===== */
/* Reads Excel (.xlsx/.xls/.ods), CSV and text/DAT exports in these layouts:
   1) one row per day with Time In / Time Out (and break) columns   2) one punch per row (ID + date/time)
   3) separate Date and Time columns   4) calendar grid (days 1-31 across the page)   5) plain text lines.
   The header row can be anywhere, column names can be anything reasonable, and times can be 24h, AM/PM, text or Excel time cells. */
const BIO = (() => {
  const MONS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", mon = (s) => MONS.split("|").indexOf(String(s).slice(0, 3).toLowerCase()) + 1;
  const ok = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null);
  const order = () => (ST.settings && ST.settings.dtr && ST.settings.dtr.dateOrder) || "MDY";
  const ab = (a, b, y) => { a = +a; b = +b; y = +y; if (y < 100) y += 2000; return a > 12 ? ok(y, b, a) : b > 12 ? ok(y, a, b) : order() === "DMY" ? ok(y, b, a) : ok(y, a, b); };
  const blank = (v) => v === "" || v === null || v === undefined || (typeof v === "string" && !v.trim());

  /* ---- dates ---- */
  function dateIn(s) {   // first date written inside a string -> {y,m,d,i,n}
    const find = (rx, f) => { const m = rx.exec(s); if (!m) return null; const x = f(m); return x && { ...x, i: m.index + (m[1] || "").length, n: m[0].length - (m[1] || "").length }; };
    return find(/(^|\D)(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/, (m) => ok(+m[2], +m[3], +m[4]))
      || find(new RegExp("(^|\\D)(\\d{1,2})[\\s\\-\\/.]*(" + MONS + ")[a-z]*\\.?[\\s\\-,\\/.]*(\\d{4}|\\d{2})(?!\\d)", "i"), (m) => ok(+m[4] < 100 ? 2000 + +m[4] : +m[4], mon(m[3]), +m[2]))
      || find(new RegExp("(^|[^A-Za-z])(" + MONS + ")[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})(?!\\d)", "i"), (m) => ok(+m[4], mon(m[2]), +m[3]))
      || find(/(^|\D)(\d{1,2})[-\/](\d{1,2})[-\/](\d{4}|\d{2})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/(^|\D)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/^\s*()(\d{4})(\d{2})(\d{2})(?:\d{4,6})?\s*$/, (m) => ok(+m[2], +m[3], +m[4]));
  }
  function dateOf(v) {
    if (v instanceof Date) return isNaN(v) ? null : ok(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === "number") {
      if (v >= 30000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
      return Number.isInteger(v) && v >= 19900101 && v <= 21001231 ? dateIn(String(v)) : null;
    }
    return typeof v === "string" ? dateIn(v) : null;
  }

  /* ---- times (minutes after midnight) ---- */
  const TRX = /(^|[^\d:.])(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?(?![\d:])/g;
  function timesIn(s) {
    const out = []; let m; TRX.lastIndex = 0;
    while ((m = TRX.exec(s))) { let h = +m[2]; const mi = +m[3]; let ap = m[5]; if (mi > 59) continue; if (ap) { if (h < 1 || h > 12) continue; ap = ap.toUpperCase(); if (ap === "P" && h < 12) h += 12; if (ap === "A" && h === 12) h = 0; } else if (h > 23) continue; out.push(h * 60 + mi); }
    return out;
  }
  function timesOf(v, loose) {   // loose: the column is known to hold times, so 0727 / 730 also count
    let r = [];
    if (v instanceof Date) r = isNaN(v) ? [] : [v.getHours() * 60 + v.getMinutes() + Math.round(v.getSeconds() / 60 * 1e4) / 1e4];
    else if (typeof v === "number") {
      if (v > 0 && v < 1) r = [Math.round(v * 1440) % 1440];
      else if (v >= 30000 && v < 80000 && v % 1) r = [Math.round((v % 1) * 1440) % 1440];
      else if (loose && Number.isInteger(v) && v >= 100 && v <= 2359 && v % 100 < 60) r = [Math.floor(v / 100) * 60 + (v % 100)];
    } else if (typeof v === "string") {
      const s = v.trim(); r = timesIn(s);
      if (!r.length && loose && /^\d{3,4}$/.test(s)) { const n = +s; if (n % 100 < 60 && n < 2400) r = [Math.floor(n / 100) * 60 + (n % 100)]; }
    }
    return r.filter((t) => t > 0);   // 00:00 is how many exports show an empty cell
  }

  /* ---- what is each column? ---- */
  const NOT = /late|under|overtime|hrs|hours?|total|(^|[^a-z])mins?([^a-z]|$)|minutes?|rate|pay|status|leave|type|dept|remark|note|shift|sched|hired|birth|dtr|summary|balance|loan/;
  function roleOf(h) {
    const s = String(h ?? "").toLowerCase().replace(/[\r\n]+/g, " ").trim(); if (!s || s.length > 40) return null;
    if (/^(m\.?\s?i\.?|middle.*)$/.test(s)) return "mi";
    if (/last.?name|surname|family.?name|^l\.?name$/.test(s)) return "last";
    if (/first.?name|given.?name|^f\.?name$/.test(s)) return "first";
    if (/date.?time|time.?stamp|punch|check.?time|log.?time|scan.?time|clock.?time/.test(s)) return "tm";
    if (/name/.test(s) && !/file|machine|device|company|branch|position|group|type|shift|leave|dept|department|sheet/.test(s)) return "name";
    if (/^(employee|emp|person|staff)$/.test(s)) return "name";
    if ((/(^|[^a-z])(id|no|num|number|code)\.?$/.test(s) || /^(id|no|userid|user id|badge|pin)\b/.test(s)) && !/type|dept|department|status|note|device|machine|terminal|leave|work|verify|event|mode|rate|rank|sss|tin|philhealth|pag|account|bank/.test(s)) return "id";
    if (/date/.test(s) && !/hired|birth|end|start|from|expir|period|created|(^|[^a-z])to$/.test(s)) return "date";
    if (/(^|[^a-z])(time|in|out|am|pm|break|lunch|check|clock|arriv|depart|punch|scan|log)([^a-z]|$)/.test(s) && !NOT.test(s) && !/(^|[^a-z])ot([^a-z]|$)|code/.test(s)) return "tm";
    return NOT.test(s) || /(^|[^a-z])ot([^a-z]|$)/.test(s) ? "x" : null;
  }
  function findHeader(rows) {
    let best = -1, bs = 1;
    rows.slice(0, 40).forEach((r, i) => { let sc = 0, t = false, d = false; for (const c of r || []) { if (typeof c !== "string") continue; const ro = roleOf(c); if (ro && ro !== "x") { sc++; if (ro === "tm") t = true; if (ro === "date") d = true; } } if ((t || d) && sc > bs) { best = i; bs = sc; } });
    return best;
  }

  /* ---- layout A: a table (one row per day, or one punch per row) ---- */
  function table(rows, push) {
    const hi = findHeader(rows), start = hi + 1; let N = 0; rows.slice(0, 300).forEach((r) => { N = Math.max(N, (r || []).length); });
    const role = new Array(N).fill(null), blankHead = new Array(N).fill(true);
    if (hi >= 0) rows[hi].forEach((h, j) => { if (!blank(h)) blankHead[j] = false; role[j] = roleOf(h); });
    const sample = rows.slice(start, start + 80);
    for (let j = 0; j < N; j++) {      // columns the header could not explain: look at the data itself
      if (role[j] && role[j] !== "x") continue; if (role[j] === "x") continue;
      const v = sample.map((r) => (r || [])[j]).filter((x) => !blank(x)); if (v.length < 2) continue;
      const share = (f) => v.filter(f).length / v.length;
      if (share((x) => timesOf(x, false).length > 0) >= 0.7) role[j] = "tm";
      else if (share((x) => !!dateOf(x)) >= 0.7) role[j] = "date";
      else if (blankHead[j]) {
        const idLike = (x) => /^[A-Za-z]{0,6}[-_ ]?\d{1,12}$/.test(String(x).trim()), nameLike = (x) => typeof x === "string" && /[A-Za-z]{3,}/.test(x) && !timesOf(x, false).length && !dateOf(x);
        if (!role.includes("id") && share(idLike) >= 0.8) role[j] = "id";
        else if (!role.includes("name") && share(nameLike) >= 0.8 && new Set(v.map((x) => String(x).trim().toLowerCase())).size >= 3) role[j] = "name";
      }
    }
    const idx = (k) => role.map((r, j) => (r === k ? j : -1)).filter((j) => j >= 0), C = { id: idx("id"), name: idx("name"), date: idx("date"), tm: idx("tm"), last: idx("last")[0] ?? -1, first: idx("first")[0] ?? -1, mi: idx("mi")[0] ?? -1 };
    if (!C.tm.length && !C.date.length) return;
    if (!C.id.length && !C.name.length && !(C.last >= 0 && C.first >= 0)) return;
    let cur = null;
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]; if (!r || !r.some((x) => !blank(x))) continue;
      const cell = (j) => (blank(r[j]) ? "" : r[j]);
      let id = ""; for (const j of C.id) { const v = String(cell(j)).trim(); if (v) { id = v; break; } }
      let nm = ""; if (C.last >= 0 && C.first >= 0) nm = `${cell(C.last)}, ${cell(C.first)} ${C.mi >= 0 ? cell(C.mi) : ""}`.replace(/^[\s,]+|[\s,]+$/g, ""); else for (const j of C.name) { const v = String(cell(j)).trim(); if (v) { nm = v; break; } }
      let date = null; for (const j of C.date) { date = dateOf(cell(j)); if (date) break; }
      const ts = [];
      for (const j of C.tm) { const v = cell(j); if (v === "") continue; const t = timesOf(v, true); if (!t.length) continue; const cd = dateOf(v); t.forEach((m) => ts.push([m, cd])); }
      if (!ts.length) for (const j of C.date) for (const m of timesOf(cell(j), false)) ts.push([m, null]);   // a "Date" column that also holds the time
      if (!id && !nm) { if (date && !ts.length) cur = date; continue; }   // a line like "Date: 11/11/2026" above a group of rows
      if (!ts.length) continue;
      for (const [m, cd] of ts) { const d = cd || date || cur; if (d) push(id, new Date(d.y, d.m - 1, d.d, Math.floor(m / 60), m % 60), nm); }
    }
  }

  /* ---- layout B: calendar grid, days 1-31 (or dates) across the top, several times in each cell ---- */
  let warn = "";
  function grid(rows, push) {
    let hi = -1, cols = [];
    for (let i = 0; i < Math.min(rows.length, 40) && hi < 0; i++) {
      const r = rows[i] || [], dt = [], dn = [];
      r.forEach((c, j) => {
        const s = String(c ?? "").trim(), m = /^(\d{1,2})(?:[\s\r\n]+[A-Za-z]{2,9}\.?)?$/.exec(s);
        if (m && +m[1] >= 1 && +m[1] <= 31) dn.push([j, +m[1]]);
        else if (!timesOf(c, false).length && !blank(c)) { const d = dateOf(c); if (d && (typeof c !== "string" || dateIn(c).n >= s.length - 1)) dt.push([j, d]); }
      });
      const asc = (a) => a.length >= 7 && a.slice(1).filter((x, k) => x[1] > a[k][1]).length >= (a.length - 1) * 0.8;
      if (dt.length >= 5) { hi = i; cols = dt.map(([j, d]) => ({ j, d })); }
      else if (asc(dn)) { hi = i; cols = dn.map(([j, d]) => ({ j, day: d })); }
    }
    if (hi < 0) return;
    if (cols[0].day !== undefined) {   // only day numbers: the month comes from the title lines
      const txt = rows.slice(0, hi + 3).flat().filter((x) => x !== "" && x != null).map((x) => (typeof x === "number" && x >= 30000 && x < 80000 ? (() => { const d = dateOf(x); return d ? `${d.y}-${d.m}-${d.d}` : ""; })() : String(x))).join(" | ");
      let y = 0, mo = 0, m;
      if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      else if ((m = new RegExp("(" + MONS + ")[a-z]*\\.?[\\s,\\-]*(\\d{4})", "i").exec(txt))) { y = +m[2]; mo = mon(m[1]); }
      else if ((m = new RegExp("(\\d{4})[\\s,\\-]*(" + MONS + ")", "i").exec(txt))) { y = +m[1]; mo = mon(m[2]); }
      else if ((m = /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(txt))) { const d = ab(m[1], m[2], m[3]); if (d) { y = d.y; mo = d.m; } }
      else if ((m = /(\d{4})[-\/.](\d{1,2})(?![\d])/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      if (!y || mo < 1 || mo > 12) { warn = "This looks like a calendar-style report (days 1-31 across the page) but the month and year could not be found. Type the month, for example 2026-11, in a cell above the table and upload again."; return; }
      let prev = 0; for (const c of cols) { if (c.day < prev) { mo++; if (mo > 12) { mo = 1; y++; } } prev = c.day; c.d = ok(y, mo, c.day); }
    }
    const first = Math.min(...cols.map((c) => c.j)), left = {}; (rows[hi] || []).forEach((h, j) => { if (j < first) { const ro = roleOf(h); if (ro === "id" || ro === "name") left[j] = ro; } });
    const LI = /^\s*(?:user\s*)?(?:id|no\.?|emp(?:loyee)?\s*(?:id|no\.?)|badge(?:\s*(?:id|no\.?))?)\s*[:\uFF1A]\s*(.*)$/i, LN = /^\s*(?:emp(?:loyee)?\s*)?name\s*[:\uFF1A]\s*(.*)$/i;
    const nextNZ = (r, j) => { for (let k = j + 1; k < r.length; k++) { const s = String(r[k] ?? "").trim(); if (s) return LI.test(s) || LN.test(s) ? "" : s; } return ""; };
    let cur = { id: "", nm: "" };
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || []; let id = "", nm = "";
      for (let j = 0; j < r.length; j++) { const s = String(r[j] ?? "").trim(); let m; if ((m = LI.exec(s))) id = m[1].trim() || nextNZ(r, j); else if ((m = LN.exec(s))) nm = m[1].trim() || nextNZ(r, j); }
      for (const j in left) { const v = String(r[j] ?? "").trim(); if (!v) continue; if (left[j] === "id" && !id) id = v; if (left[j] === "name" && !nm) nm = v; }
      if (id) cur = { id, nm }; else if (nm) cur = { id: cur.id, nm };
      if (!cur.id && !cur.nm) continue;
      for (const c of cols) { if (!c.d) continue; for (const m of timesOf(r[c.j], false)) push(cur.id, new Date(c.d.y, c.d.m - 1, c.d.d, Math.floor(m / 60), m % 60), cur.nm); }
    }
  }

  /* ---- layout C: text / DAT / CSV ---- */
  function splitLine(l, d) { const out = []; let c = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === d && !q) { out.push(c.trim()); c = ""; } else c += ch; } out.push(c.trim()); return out; }
  const STOP = /^(in|out|check|(check|clock|time)[-_]?(in|out)|c\/(in|out)|fp|face|card|pw|normal|ot|am|pm|i|o)$/i;
  function scanLine(ln, push) {
    const dm = dateIn(ln); if (!dm) return;
    const rest0 = ln.slice(0, dm.i) + " " + ln.slice(dm.i + dm.n), ts = timesIn(rest0); if (!ts.length) return;
    const toks = rest0.replace(TRX, " ").split(/[\s|;]+/).filter(Boolean), id = toks.find((t) => /^[A-Za-z]{0,6}[-_]?\d{1,12}$/.test(t)) || "";
    const nm = toks.filter((t) => t !== id && /[A-Za-z]{2,}/.test(t) && !STOP.test(t)).join(" ");
    if (!id && !nm) return;
    ts.forEach((m) => { if (m > 0) push(id, new Date(dm.y, dm.m - 1, dm.d, Math.floor(m / 60), m % 60), nm); });
  }
  function text(txt, push) {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return;
    const smp = lines.slice(0, 12), delim = ["\t", ";", "|", ","].find((d) => smp.filter((l) => l.includes(d)).length >= Math.ceil(smp.length * 0.8));
    const rows = delim ? lines.map((l) => splitLine(l, delim)) : null;
    let n = 0; const counted = (...x) => { n++; push(...x); };
    const viaRows = () => { if (rows) sheet(rows, counted); }, viaLines = () => lines.forEach((l) => scanLine(l, counted));
    const [a, b] = rows && (delim === "\t" || findHeader(rows) >= 0) ? [viaRows, viaLines] : [viaLines, viaRows];
    a(); if (!n) b();
  }
  function sheet(rows, push) { let n = 0; const p = (...x) => { n++; push(...x); }; grid(rows, p); if (!n) table(rows, p); }

  async function readText(f) {
    const b = new Uint8Array(await f.arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
    return new TextDecoder("utf-8").decode(b).replace(/^\uFEFF/, "");
  }
  return { sheet, text, readText, take: () => { const w = warn; warn = ""; return w; } };
})();

async function readPunches(f) {
  const out = [], push = (id, dt, nm) => {
    nm = String(nm ?? "").replace(/\s+/g, " ").trim(); if (!/[A-Za-z]/.test(nm)) nm = "";
    const has = id !== "" && id != null && String(id).trim() !== "", k = has ? normNo(id) : (nm ? "n:" + nameNorm(nm).replace(/,/g, " ").replace(/\s+/g, " ") : "");
    if (k && dt && !isNaN(dt)) out.push([k, dt, nm]);
  };
  BIO.take();
  const buf = await f.arrayBuffer(), h = new Uint8Array(buf.slice(0, 8)), isZip = h[0] === 0x50 && h[1] === 0x4b, isOle = h[0] === 0xd0 && h[1] === 0xcf;
  if (isZip || isOle) {
    const wb = XLSX.read(buf, { type: "array", raw: true });
    for (const n of wb.SheetNames) BIO.sheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }), push);
  } else BIO.text(await BIO.readText({ arrayBuffer: async () => buf }), push);
  const w = BIO.take(); if (!out.length && w) throw new Error(w);
  return out;
}


/* >>>>>>>>>> js/dtr/rules.js >>>>>>>>>> */
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
  const fill = new Set(["department", "dept", "office", "division", "section", "unit", "team", "the", "of", "and"]), words = (t) => { const w = t.split(/[^a-z0-9]+/).filter(Boolean), k = w.filter((x) => !fill.has(x)); return k.length ? k : w; };   // "Registrar Department" must not match "Finance Department"
  const wa = words(a), wb = words(b); if (!wa.length || !wb.length) return false;
  if (wb.every((w) => wa.includes(w)) || wa.every((w) => wb.includes(w))) return true;
  return wa.some((x) => wb.some((y) => x.length >= 7 && y.length >= 7 && x.slice(0, 7) === y.slice(0, 7)));
}

/** Saturday half day (Settings > Saturday half-day): the people of the chosen departments (or chosen one by one) work 8:00 AM - 12:00 noon on Saturday, and the day is still paid as ONE full day (the monthly pay already covers it, so nothing is deducted).
    Overtime on such a Saturday starts at the "OT from" time (1:00 PM) and only when it is allowed that day. Returns null for everybody else. */
function deptOn(name, H) {
  const ex = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  if ((H.depts || []).some((x) => ex(name, x))) return true; if ((H.off || []).some((x) => ex(name, x))) return false;
  return (H.depts || []).some((x) => deptLike(name, x)) && !(H.off || []).some((x) => deptLike(name, x));
}
function satHalfOf(e) {
  const H = (ST.settings.dtr || {}).satHalf; if (!H || H.on === false || !e || categoryOf(e) === "teacher") return null;
  const own = (H.people || {})[e.id];
  if (own !== "yes" && (shiftsOfDept(e).length || ((ST.settings.dtr || {}).empShift || {})[e.id])) return null;   // people on a shift (Maintenance, Security...) work their shift on Saturday too: the half-day Saturday time does not apply to them unless chosen one by one under Exceptions
  let yes = own === "yes" ? true : own === "no" ? false : deptOn(e.dept, H); if (!yes) return null;
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


/* >>>>>>>>>> js/dtr/dtr-calc.js >>>>>>>>>> */
/* ============================================================
   DTR CALCULATION - dtrCalc(): present, absent, late, overtime and hours per employee. Holiday / WFH overtime rule is here (Saturday is a regular work day, not overtime).
   File: js/dtr/dtr-calc.js
   ============================================================ */

/* ===== END BIOMETRIC READER ===== */
/** One employee's DTR between two dates from the punches. Rules (working days that are not holidays; all set in Settings):
    - time in after the grace period (staff 30 min = 8:30, teachers 15 min) = Late, counted from the end of the grace period
    - no punch at all = Absent; no time in / no time out = Absent, Half day or not counted, as chosen in Settings
    - work on a non-working day (Sunday) = overtime for the whole time worked (when Settings says so) */
/** Overtime file (Settings > Overtime file): hours filed for a person on a date REPLACE what the biometric gives for that day. With "Add overtime automatically" off, the biometric gives none, so only filed hours are paid. */
/** Time in / out typed by hand in the DTR (Attendance check > DTR). Saved per employee and date, so a new biometric upload does not erase it. {in, out} in minutes after midnight, null = left empty. */
const dtrEditOf = (e, d) => { const x = ((ST.dtr.edits || {})[e.id] || {})[d]; return x ? { in: x.in ?? null, out: x.out ?? null } : null; };

const isHolDay = (d, hol) => hol.includes(d);

const otFileOf = (e, d) => (ST.settings.otFile || []).filter((x) => x.empId === e.id && x.date === d);

function otFileApply(e, r) {
  const O = ST.settings.dtr.ot || {}, f = otFileOf(e, r.d).reduce((n, x) => n + Math.round((+x.hours || 0) * 60), 0);
  if (f > 0) { r.ot = f; r.otFiled = true; r.note = (r.note ? r.note + "; " : "") + "Overtime filed"; }
  else if (O.auto === false) r.ot = 0;
}

function dtrCalc(e, from, to) {
  const D = ST.settings.dtr, days = daysOf(e) || {}, hol = (D.holidays || []).map((h) => h.date), wfhL = (D.wfhDays || []).map((h) => h.date), [sh, sm] = D.start.split(":").map(Number), [eh, em] = D.end.split(":").map(Number);   // MID = 12:30 PM: a lone punch before it is a time in, after it a time out
  const o = { present: 0, absent: 0, half: 0, late: 0, lateDays: 0, early: 0, earlyDays: 0, earlyOut: 0, earlyOutDays: 0, ot: 0, hrs: 0, otMin: 0, hrsMin: 0, scheds: new Set(), presentDates: [], rows: [] };
  for (let d = from; d <= to; d = addDay(d)) {
    const ov = dtrEditOf(e, d), rawP = (days[d] || []).slice().sort((a, b) => a - b), skipHol = isHolDay(d, hol) && !ov && D.holPunch !== true;   // Holiday: biometric time in / out is NOT counted unless Settings allows it (a time typed by hand in the DTR is always counted)
    const p = ov ? [ov.in, ov.out].filter((x) => x !== null && x !== undefined).sort((a, b) => a - b) : skipHol ? [] : rawP, wd = (D.workDays || [1, 2, 3, 4, 5]).includes(new Date(d + "T12:00").getDay()), isH = hol.includes(d), isW = !isH && wfhL.includes(d), lv = wd && !isH ? lvOn(e, d) : null, r = { d, wd, isH, isW, inn: null, out: null, hrs: 0, late: 0, early: 0, earlyOut: 0, ot: 0, note: "", st: "" };
    const SC = schedOf(e, p, new Date(d + "T12:00").getDay()), S0 = SC.S0, E0 = SC.E0, MID = SC.MID; r.sched = hm(S0) + " - " + hm(E0); const TH = wd && !isH ? tHrs(e, new Date(d + "T12:00").getDay()) : null;   // TH = hours of this teacher on this weekday (Teacher Hours menu), null = not set   // each day uses the shift that fits that day's punches
    if (p.length) {
      if (ov) { r.inn = ov.in ?? null; r.out = ov.out ?? null; r.edited = true; }   // time typed by hand in the DTR
      else if (p.length > 1 && p[p.length - 1] - p[0] >= 10) { r.inn = p[0]; r.out = p[p.length - 1]; }   // two scans a few minutes apart are one scan
      else if (p[0] < MID) r.inn = p[0]; else r.out = p[0];
      if (!ov) { r.inDev = devOf(e, d, r.inn); r.outDev = devOf(e, d, r.out); if (r.inDev && r.outDev && r.inDev !== r.outDev) r.note = (r.note ? r.note + "; " : "") + "In: " + r.inDev + ", Out: " + r.outDev; }   // time in at one building, time out at the other
      if (wd && r.inn !== null && !lv) { const gr = graceOf(e, new Date(d + "T12:00").getDay()); if (r.inn > S0 + gr) { r.lateRaw = lateMinutes(r.inn, S0, 0); r.late = lateHourMin(e, r.lateRaw); } }   // late is counted per whole hour like overtime: staff 30-59 min = 1 hr, teachers 16-59 min = 1 hr (r.lateRaw = the actual minutes late from the official time in)
      /* EARLY: time in before the scheduled time in (teachers: their own Time in / Time out from the Teacher Hours menu), or time out before the scheduled time out. Reported only (Settings > Auto late & overtime), nothing is deducted. */
      { const EA = D.early || {}; if (EA.on !== false && wd && !isH && !lv && !isW) { const ei = Math.max(1, +(EA.inMin ?? 1) || 1), eo = Math.max(1, +(EA.outMin ?? 1) || 1); if (r.inn !== null && S0 - r.inn >= ei - 1e-9) r.early = Math.floor(S0 - r.inn + 1e-9); if (r.out !== null && E0 - r.out >= eo - 1e-9) r.earlyOut = Math.floor(E0 - r.out + 1e-9); } }
      if (r.inn !== null && r.out !== null) {
        const span = r.out - (wd && !isH && !isW && r.inn < S0 ? S0 : r.inn), mins = span - (span > 300 ? +D.lunchMin || 0 : 0); r.hrs = Math.max(0, mins) / 60;
        { const HB = Math.max(0, +(D.hrsBlock ?? 30) || 0); if (HB > 1) r.hrs = Math.floor(Math.max(0, mins) / HB + 1e-9) * HB / 60; }   // hours worked are counted in blocks (default 30 min): 8 hrs 20 min = 8:00, 8 hrs 45 min = 8:30; the excess minutes are not counted
        if (TH > 0) r.hrs = D.teacherHrMode === "cap" ? Math.min(r.hrs, TH) : TH;   // scheduled hours of the day
        const dow = new Date(d + "T12:00").getDay(), spOt = D.attOt !== false && (isH || isW);   // holiday / WFH with attendance: whole time worked is overtime. Saturday is a regular work day (never overtime by itself)
        if (spOt && otAllowed(e)) { r.ot = otFloor(Math.round(r.hrs * 60)); r.note = isH ? "Holiday - overtime" : "WFH - overtime"; } else if (wd) { r.ot = SC.sat ? (SC.sat.otAuto && otAllowed(e) ? otMinutes(r.out - SC.sat.otFromMin) : 0) : (otAllowed(e) ? otMinutes(r.out - E0) : 0); }   // Saturday half day: overtime only from 1:00 PM and only when allowed (filed in the Overtime File, or automatic for people allowed overtime) else if (D.restDayAsOt !== false && otAllowed(e)) { r.ot = Math.round(r.hrs * 60); r.note = "Rest day - overtime"; } else r.note = "Rest day - not counted";
      } else if (wd && !isH && !lv && !isW) {   // a missing punch: Settings decides if it means absent, half day or nothing
        const miss = r.inn === null ? "no time in" : "no time out", rule = (r.inn === null ? D.noInRule : D.noOutRule) || (r.inn === null ? "absent" : "half"), W = { absent: "Absent", half: "Half day" };
        r.why = miss; r.note = miss.charAt(0).toUpperCase() + miss.slice(1);
        if (W[rule]) { r.st = rule; r.note += " - " + W[rule]; }
        if (TH > 0 && r.st === "half") r.hrs = TH * (1 - (+(D.halfDayAbs ?? 0.5)));   // half day: part of the scheduled hours
      } else r.note = r.inn === null ? "No time in" : "No time out";
      if (SC.sat && wd && !isH) r.note = (r.note ? r.note + "; " : "") + "Saturday half day (paid 1 day)";
      if (r.late) r.note = (r.note ? r.note + "; " : "") + "Late " + fmtHMc(r.late) + (r.lateRaw && r.lateRaw !== r.late ? " (actual " + fmtHMc(r.lateRaw) + " late)" : "");
      else if (r.lateRaw) r.note = (r.note ? r.note + "; " : "") + "Late " + fmtHMc(r.lateRaw) + " (not counted)";
      if (r.early) r.note = (r.note ? r.note + "; " : "") + "Early in " + fmtHM(r.early);
      if (r.earlyOut) r.note = (r.note ? r.note + "; " : "") + "Early out " + fmtHM(r.earlyOut);
      if (r.st === "absent") o.absent++;
      else if (r.st === "half") { const hv = +(D.halfDayAbs ?? 0.5); o.absent += hv; o.present += 1 - hv; o.half++; }
      else if (wd) o.present++;
      o.late += r.late; if (r.late) o.lateDays++; o.early += r.early || 0; if (r.early) o.earlyDays++; o.earlyOut += r.earlyOut || 0; if (r.earlyOut) o.earlyOutDays++; o.ot += r.ot; o.hrs += r.hrs; o.hrsMin += Math.round(r.hrs * 60); o.scheds.add(r.sched);
    } else if (isW && wd && !lv) { r.note = "WFH / Asynchronous class (with pay)"; r.wfh = true; o.present++; }   // work from home: not absent
    else if (wd && !isH) { if (lv) { r.note = lv.type + (lv.paid ? " (with pay)" : " (without pay)"); r.leave = true; } else if (TH === 0) { r.note = "No class scheduled"; } else { o.absent++; r.st = "absent"; r.why = "no punch"; r.note = "No punch - Absent"; } }
    else if (isH) r.note = skipHol && rawP.length ? "Holiday - biometric time not counted" : "Holiday";
    if (ov && !p.length) r.edited = true;   // times cleared by hand: no punch
    if (r.edited) r.note = (r.note ? r.note + "; " : "") + "Edited";
    if ((r.inn !== null || r.out !== null) && r.st !== "absent" && !r.leave) o.presentDates.push(d);   // days with a punch (used by weekday allowances)
    otFileApply(e, r); o.rows.push(r);
  }
  o.ot = o.rows.reduce((n, r) => n + (r.ot || 0), 0); o.otMin = Math.round(o.ot); o.ot = Math.round(o.ot / 60 * 10000) / 10000; o.hrs = Math.round(o.hrs * 100) / 100; return o;
}

