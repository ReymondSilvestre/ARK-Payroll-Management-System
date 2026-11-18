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

/** The dates of the pay period on which a weekday allowance is paid. "Pay only on days present": only days with a punch in the DTR (i.presentDates); without DTR data, or when switched off, every matching weekday that is not a holiday. */
function allowDaysIn(a, S, period, i) {
  const out = [], days = a.days || [], pd = i && Array.isArray(i.presentDates) ? new Set(i.presentDates) : null, hol = new Set(((S.dtr && S.dtr.holidays) || []).map((h) => h.date));
  if (!period || !period.start || !period.end) return out;
  for (let d = new Date(period.start + "T12:00"), z = new Date(period.end + "T12:00"); d <= z; d.setDate(d.getDate() + 1)) {
    if (!days.includes(d.getDay())) continue;
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
  const basic = perHour ? r2(hours * rate) : mB ? r2(+i.mBasic) : r2(baseMonthly / div);
  const monthly = perHour || mB ? r2(basic * div) : baseMonthly;      // the monthly equivalent (used by the percent rates and the tax estimate)
  const daily = !perHour && !mB ? dailyRateOf(info, S) : monthly / S.workDays, hourly = perHour ? rate : daily / S.hoursPerDay;
  const absentDays = perHour ? 0 : (+i.absentDays || 0) + (+i.leaveDays || 0);
  const allowList = (info.allowances || []).map((a) => { if (isDowAllow(a)) { const dd = allowDaysIn(a, S, period, i); return { label: a.label, amount: r2((+a.amount || 0) * dd.length), perDay: true, daily: r2(+a.amount || 0), count: dd.length, dowLabel: dowLabel(a.days) }; } return { label: a.label, amount: r2(allowMonthly(a, S) / div), perDay: !!a.perDay, daily: a.perDay ? r2(+a.amount || 0) : null }; }), allow = r2(allowList.reduce((n, a) => n + a.amount, 0));
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
  const gross = r2(basic + allow + ot + otherEarn + holPay + wfhPay), totalDed = r2(absent + late + holDed + wfhDed + sssF + phicF + hdmfF + taxF + other + caDed), net = r2(gross - totalDed);
  return { cat: categoryOf(info), perHour, rate, hours, basic, allow, allowList, ot, otherEarn, gross, absent, late, sssEe: sssF, phicEe: phicF, hdmfEe: hdmfF, sssEr, phicEr, hdmfEr, tax: taxF, other, dedList, otherDed, caDed, caBal, caAfter, manual, auto: { sssEe, phicEe, hdmfEe, tax }, totalDed, net, absentDays, leaveDays: +i.leaveDays || 0,
    holidays: hl.length, holWorked: hl.filter((h) => h.worked).length, holPay, holDed, holFixed, wfhPay, wfhDed, wfhFixed, wfhDays: wl.length, wfhList: wl.map((w) => ({ date: w.date, label: w.label || "", type: w.type || "wfh", hours: hasN(w.hours) ? +w.hours : null, worked: !!w.worked })), holList: hl.map((h) => ({ date: h.date, label: h.label || "", type: h.type || "regular", worked: !!h.worked })),
    dailyRate: perHour ? 0 : r2(daily), paidDays: r2((+S.workDays || 0) / div), otHours: r2(+i.otHours || 0), lateMin: r2(+i.lateMin || 0), presentDays: i.dtr && i.dtr.present !== undefined && i.dtr.present !== null ? +i.dtr.present : null,
    /* WHY each deduction was made (printed on the payslip) */
    why: { absentList: i.absentList || null, lateList: i.lateList || null, leaveList: i.leaveList || [], otherDedNote: String(i.otherDedNote || "").trim(), holDedList, wfhDedList, taxWhy, semi, half: period.half, sssWhen: S.sss.when, phicWhen: S.phic.when, hdmfWhen: S.hdmf.when, manualSss: manual.sss, manualPhic: manual.phic, manualHdmf: manual.hdmf, manualTax: manual.tax, absentTyped: i.absentList === null, lateTyped: i.lateList === null },
    classInfo: i.classInfo || null };
}

