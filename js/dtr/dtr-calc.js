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
      if (wd && r.inn !== null && !lv) { const gr = graceOf(e, new Date(d + "T12:00").getDay()); r.late = r.inn > S0 + gr ? lateMinutes(r.inn, S0, gr) : 0; }
      /* EARLY: time in before the scheduled time in (teachers: their own Time in / Time out from the Teacher Hours menu), or time out before the scheduled time out. Reported only (Settings > Auto late & overtime), nothing is deducted. */
      { const EA = D.early || {}; if (EA.on !== false && wd && !isH && !lv && !isW) { const ei = Math.max(1, +(EA.inMin ?? 1) || 1), eo = Math.max(1, +(EA.outMin ?? 1) || 1); if (r.inn !== null && S0 - r.inn >= ei - 1e-9) r.early = Math.floor(S0 - r.inn + 1e-9); if (r.out !== null && E0 - r.out >= eo - 1e-9) r.earlyOut = Math.floor(E0 - r.out + 1e-9); } }
      if (r.inn !== null && r.out !== null) {
        const span = r.out - r.inn, mins = span - (span > 300 ? +D.lunchMin || 0 : 0); r.hrs = Math.max(0, mins) / 60;
        if (TH > 0) r.hrs = D.teacherHrMode === "cap" ? Math.min(r.hrs, TH) : TH;   // scheduled hours of the day
        const dow = new Date(d + "T12:00").getDay(), spOt = D.attOt !== false && (isH || isW);   // holiday / WFH with attendance: whole time worked is overtime. Saturday is a regular work day (never overtime by itself)
        if (spOt && otAllowed(e)) { r.ot = Math.round(r.hrs * 60); r.note = isH ? "Holiday - overtime" : "WFH - overtime"; } else if (wd) { r.ot = SC.sat ? (SC.sat.otAuto && otAllowed(e) ? otMinutes(r.out - SC.sat.otFromMin) : 0) : (otAllowed(e) ? otMinutes(r.out - E0) : 0); }   // Saturday half day: overtime only from 1:00 PM and only when allowed (filed in the Overtime File, or automatic for people allowed overtime) else if (D.restDayAsOt !== false && otAllowed(e)) { r.ot = Math.round(r.hrs * 60); r.note = "Rest day - overtime"; } else r.note = "Rest day - not counted";
      } else if (wd && !isH && !lv && !isW) {   // a missing punch: Settings decides if it means absent, half day or nothing
        const miss = r.inn === null ? "no time in" : "no time out", rule = (r.inn === null ? D.noInRule : D.noOutRule) || (r.inn === null ? "absent" : "half"), W = { absent: "Absent", half: "Half day" };
        r.why = miss; r.note = miss.charAt(0).toUpperCase() + miss.slice(1);
        if (W[rule]) { r.st = rule; r.note += " - " + W[rule]; }
        if (TH > 0 && r.st === "half") r.hrs = TH * (1 - (+(D.halfDayAbs ?? 0.5)));   // half day: part of the scheduled hours
      } else r.note = r.inn === null ? "No time in" : "No time out";
      if (SC.sat && wd && !isH) r.note = (r.note ? r.note + "; " : "") + "Saturday half day (paid 1 day)";
      if (r.late) r.note = (r.note ? r.note + "; " : "") + "Late";
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

