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
  dtr: { start: "08:00", end: "17:00", lunchMin: 60, graceMin: 30, graceStaff: 30, graceTeacher: 15, otStartMin: 30, otBlockMin: 30, halfDayHrs: 4, workDays: [1, 2, 3, 4, 5, 6], restDayAsOt: true, teacherStart: "", teacherEnd: "", teacherDefHrs: 8, deptTimes: {}, shifts: [{ id: "sh1", name: "Maintenance - Shift A", dept: "Maintenance", start: "06:00", end: "15:00" }, { id: "sh2", name: "Maintenance - Shift B", dept: "Maintenance", start: "10:00", end: "19:00" }, { id: "sh3", name: "Security", dept: "Security", start: "06:00", end: "18:00" }], empShift: {}, grace: { staff: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 15, 0: 15 }, teacher: { 1: 15, 2: 15, 3: 15, 4: 15, 5: 15, 6: 15, 0: 15 }, admin: { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30, 6: 15, 0: 15 } }, ot: { groups: { staff: false, teacher: false, admin: false }, people: {}, startMin: 0, blockMin: 1, minMin: 0, maxHrs: 0 }, late: { countFrom: "official", round: "down", blockMin: 1, deduct: true }, early: { on: true, inMin: 1, outMin: 1 }, teacher: { lateDeduct: true, earlyOutDeduct: true, earlyInOt: false }, noInRule: "absent", noOutRule: "half", halfDayAbs: 0.5, satHalf: { on: true, start: "08:00", end: "12:00", otFrom: "13:00", otMode: "filed", depts: ["Finance", "Registrar", "IT", "Marketing", "Administrative", "Executive"], people: {} }, holidays: [], wfhDays: [], dateOrder: "MDY" },   // Daily Time Record from the biometric file
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

