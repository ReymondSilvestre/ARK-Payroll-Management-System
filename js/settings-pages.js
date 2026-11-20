/* ============================================================
   SETTINGS TABS - holidays, shifts, Saturday, auto overtime, overtime file, tax, extras
   Combined file. Each section below is one of the former separate files (kept in the same order).
   ============================================================ */

/* >>>>>>>>>> js/settings/holidays.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: Philippine holidays (auto-detect), WFH days, holiday table.
   File: js/settings/holidays.js
   ============================================================ */

/* ---------- Philippine holidays: detected automatically (no internet needed) ----------
   Fixed holidays, Holy Week and National Heroes Day are worked out for ANY year.
   Dates that Malacañang declares year by year (Chinese New Year, Eid'l Fitr / Eid'l Adha, All Souls' Day, Christmas Eve)
   are listed per year below. When next year's proclamation is out, add one more line to PH_PROCLAIMED. */
const PH_PROCLAIMED = {
  2026: { src: "Proclamation No. 1006 s. 2025, No. 1189 (Eid'l Fitr) and No. 1264 (Eid'l Adha)", list: [["02-17", "Chinese New Year", "special"], ["03-20", "Eid'l Fitr", "regular"], ["05-27", "Eid'l Adha", "regular"], ["11-02", "All Souls' Day", "special"], ["12-24", "Christmas Eve", "special"]] },
  2027: { src: "Proclamation No. 1427 s. 2026", pending: "Eid'l Fitr and Eid'l Adha 2027", list: [["02-06", "Chinese New Year", "special"], ["11-02", "All Souls' Day", "special"], ["12-24", "Christmas Eve", "special"]] }
};

function phEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), t = h + l - 7 * m + 114;
  return new Date(y, Math.floor(t / 31) - 1, (t % 31) + 1, 12);
}

function phHolidays(y) {
  const L = [], add = (date, label, type) => L.push({ date, label, type });
  [["01-01", "New Year's Day"], ["04-09", "Araw ng Kagitingan (Day of Valor)"], ["05-01", "Labor Day"], ["06-12", "Independence Day"], ["11-30", "Bonifacio Day"], ["12-25", "Christmas Day"], ["12-30", "Rizal Day"]].forEach(([md, n]) => add(`${y}-${md}`, n, "regular"));
  const h = new Date(y, 7, 31, 12); while (h.getDay() !== 1) h.setDate(h.getDate() - 1); add(ymd(h), "National Heroes Day", "regular");   // last Monday of August
  const E = phEaster(y), off = (n) => { const x = new Date(E); x.setDate(x.getDate() + n); return ymd(x); };
  add(off(-3), "Maundy Thursday", "regular"); add(off(-2), "Good Friday", "regular"); add(off(-1), "Black Saturday", "special");
  [["08-21", "Ninoy Aquino Day"], ["11-01", "All Saints' Day"], ["12-08", "Feast of the Immaculate Conception"], ["12-31", "Last Day of the Year"]].forEach(([md, n]) => add(`${y}-${md}`, n, "special"));
  const P = PH_PROCLAIMED[y]; if (P) P.list.forEach(([md, n, t]) => add(`${y}-${md}`, n, t));
  L.sort((a, b) => a.date < b.date ? -1 : 1);
  const note = P ? `Source: ${P.src}.${P.pending ? ` ${P.pending} will be proclaimed separately - add them when announced.` : ""}` : `No yearly proclamation is loaded for ${y}. Fixed holidays, Holy Week and National Heroes Day were filled in. Chinese New Year, Eid'l Fitr, Eid'l Adha, All Souls' Day and Christmas Eve are declared each year, so add them when announced.`;
  return { list: L, note };
}

/** Adds the detected holidays of a year to Settings once (never overwrites a date you already have, never re-adds one you removed and saved). */
function phEnsure(y, force) {
  const D = ST.settings.dtr; D.holidays ||= []; D.holAuto ||= [];
  if (!force && D.holAuto.includes(y)) return 0;
  const have = new Set(D.holidays.map((h) => h.date)); let n = 0;
  for (const h of phHolidays(y).list) if (!have.has(h.date)) { D.holidays.push({ ...h }); n++; }
  if (!D.holAuto.includes(y)) D.holAuto.push(y);
  return n;
}

function phAutoFill() { const y = new Date().getFullYear(); phEnsure(y); phEnsure(y + 1); }

/* ---------- Settings: holidays, holiday pay, DTR hours ---------- */
const wfhRow = (h) => `<tr data-wr><td><input type="date" class="wd" value="${esc(h.date || "")}"></td><td><input class="wl" value="${esc(h.label || "")}" placeholder="e.g. Typhoon - class suspended"></td><td><select class="wt"><option value="wfh">Work from home</option><option value="async" ${h.type === "async" ? "selected" : ""}>Asynchronous class</option></select></td><td><input type="number" step="any" min="0" class="wh" value="${h.hours === undefined || h.hours === null ? "" : esc(h.hours)}" placeholder="default"></td><td><button class="btn sm d" data-wx>Remove</button></td></tr>`;

const holRow = (h) => `<tr data-hr><td><input type="date" class="hd" value="${esc(h.date || "")}"></td><td><input class="hl" value="${esc(h.label || "")}"></td><td><select class="ht"><option value="regular">Regular holiday</option><option value="special" ${h.type === "special" ? "selected" : ""}>Special non-working day</option></select></td><td><button class="btn sm d" data-hx>Remove</button></td></tr>`;

function holHTML(S) {
  const H = S.holiday, D = S.dtr, O = D.ot || {}, Lt = D.late || {}, DOW = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]], yr = new Date().getFullYear(), p = (id, l, v) => `<div><label>${l}</label><input type="number" step="any" id="${id}" value="${v}"></div>`;
  return `<div data-sp="hol" ${spHide("hol")}><h3>Holidays</h3><div class="row noprint"><div><label>Year</label><select id="hy">${[yr - 1, yr, yr + 1, yr + 2].map((y) => `<option value="${y}" ${y === yr ? "selected" : ""}>${y}</option>`).join("")}</select></div><button class="btn p" id="ahd">Auto-detect Philippine holidays</button></div><p class="muted" id="hn">Philippine holidays for ${yr} and ${yr + 1} are added automatically. Choose a year and press the button to add another year. Remove or edit any line that does not apply to your school.</p><div class="tw"><table id="htab"><tr><th>Date</th><th>Holiday</th><th>Type</th><th></th></tr>${(D.holidays || []).slice().sort((a, b) => a.date < b.date ? -1 : 1).map(holRow).join("")}</table></div><p><button class="btn" id="ah">+ Add holiday</button></p></div>
  <div data-sp="wfh" ${spHide("wfh")}><h3>Work from home (WFH) / Asynchronous class &mdash; with pay</h3><p class="muted">Add the dates when the school has work from home or asynchronous classes. <b>Staff and admins are paid per day</b> and are not marked absent on these dates. <b>Teachers are paid per hour</b>: the hours of that day (typed per date, or the default hours below) &times; the teacher's hourly rate. A date that is also a holiday is paid as a holiday, and a teacher or employee who punches in that day is paid from the biometric as usual.</p><div class="tw"><table id="wtab"><tr><th>Date</th><th>Description</th><th>Type</th><th>Teacher hours</th><th></th></tr>${(D.wfhDays || []).slice().sort((a, b) => a.date < b.date ? -1 : 1).map(wfhRow).join("")}</table></div><p><button class="btn" id="aw">+ Add WFH / Asynchronous day</button></p>
  <h3>WFH / Asynchronous pay</h3><div class="form"><div><label>Staff &amp; admin paid on WFH days (per day)</label><select id="wf1"><option value="1">Yes, with pay</option><option value="0" ${(S.wfh || {}).staffPaid === false ? "selected" : ""}>No, without pay (the day is deducted)</option></select></div>${p("wf2", "Staff &amp; admin pay (% of the daily rate)", (S.wfh || {}).staffPct ?? 100)}<div><label>Teachers paid on asynchronous / WFH days (per hour)</label><select id="wf3"><option value="1">Yes, with pay</option><option value="0" ${(S.wfh || {}).teachersPaid === false ? "selected" : ""}>No</option></select></div><div><label>Teacher WFH / Asynchronous pay basis</label><select id="wf6"><option value="rate">Per hour - hours x the teacher's own hourly rate</option><option value="minhour" ${(S.wfh || {}).teacherBasis === "minhour" ? "selected" : ""}>Minimum wage per hour - hours x minimum hourly rate</option><option value="minday" ${(S.wfh || {}).teacherBasis === "minday" ? "selected" : ""}>Minimum daily wage - one minimum daily wage for the day</option></select></div>${p("wf4", "Teacher default hours per day", (S.wfh || {}).teacherHours ?? S.hoursPerDay)}${p("wf5", "Teacher pay (% of the hourly rate)", (S.wfh || {}).teacherPct ?? 100)}${p("wf7", "Teacher FIXED pay per WFH / async day (₱, optional)", (S.wfh || {}).teacherFixed ?? "")}</div><p class="muted">Fixed pay: type an amount (for example 500) and every teacher gets exactly that for each WFH / asynchronous day, <b>not per hour</b>. Leave it blank to pay by the hour as set above. A teacher's own fixed amount in the <b>Teacher Hours</b> menu comes first.</p><p class="muted">Staff and admins: the monthly pay already covers the day, so 100% means no extra pay and no deduction (below 100% is deducted, above 100% is added). Teachers: the pay is added on top of the hours taught, shown on the payslip as &ldquo;WFH / Async class pay&rdquo;.</p></div>
  <div data-sp="hp" ${spHide("hp")}><h3>Holiday pay (% of the daily rate)</h3><div class="form">${p("hp1", "Regular holiday, not worked", H.regular.notWorked)}${p("hp2", "Regular holiday, worked", H.regular.worked)}${p("hp3", "Special day, not worked", H.special.notWorked)}${p("hp4", "Special day, worked", H.special.worked)}${p("hp6", "Teachers FIXED: regular holiday, not worked (₱ per day)", (H.tFixed || {}).regNot ?? "")}${p("hp7", "Teachers FIXED: regular holiday, worked (extra ₱ per day)", (H.tFixed || {}).regWork ?? "")}${p("hp8", "Teachers FIXED: special day, not worked (₱ per day)", (H.tFixed || {}).spNot ?? "")}${p("hp9", "Teachers FIXED: special day, worked (extra ₱ per day)", (H.tFixed || {}).spWork ?? "")}<div><label>Teachers paid on holidays</label><select id="hp5"><option value="1">Yes</option><option value="0" ${H.teachersPaid === false ? "selected" : ""}>No</option></select></div></div><p class="muted">Teachers: type a <b>fixed amount</b> (₱ per holiday) to pay that exact amount instead of hours &times; rate. Leave a box <b>blank</b> to pay by the hour as before. A teacher's own fixed holiday pay in the <b>Teacher Hours</b> menu comes first.</p></div>
  <div data-sp="dtr" ${spHide("dtr")}><h3>Work days, hours and attendance rules (DTR and payroll)</h3><div class="form"><div><label>Staff &amp; admin time in (default)</label><input type="time" id="dt1" value="${D.start}"></div><div><label>Staff &amp; admin time out (default)</label><input type="time" id="dt2" value="${D.end}"></div><div><label>Teachers time in</label><input type="time" id="dt1t" value="${D.teacherStart || D.start}"></div><div><label>Teachers time out</label><input type="time" id="dt2t" value="${D.teacherEnd || D.end}"></div>${p("dt3", "Lunch break (minutes)", D.lunchMin)}</div><h4 style="margin:1rem 0 .3rem">Employee time in and time out per department</h4><p class="muted">Staff and admins use the time of their department. Leave a time blank to use the default above. Teachers always use the teachers' time. Late, absent and overtime are computed from these times.</p>
  <div class="tw"><table id="ddt"><tr><th>Department</th><th>Time in</th><th>Time out</th><th></th></tr>${deptNames(S).map((n) => ddRow(n, (D.deptTimes || {})[n.toLowerCase()] || {})).join("")}</table></div><p><button class="btn" id="add_dd" type="button">+ Add department</button></p>
  <p class="muted">Grace periods, overtime and late computation each have their own tab above.</p>
  <h4 style="margin:1rem 0 .3rem">Working days</h4><div>${[[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]].map(([n, l]) => `<label style="display:inline-flex;gap:.3rem;align-items:center;margin-right:1rem"><input type="checkbox" class="wdc" value="${n}" ${(D.workDays || [1, 2, 3, 4, 5, 6]).includes(n) ? "checked" : ""}>${l}</label>`).join("")}</div>
  <p class="muted">Days not ticked are rest days: nobody is marked absent on them, and a rest day is not paid unless it is worked. The payroll's <b>Working days per month</b> (Payroll settings, now ${S.workDays}) sets the daily rate = monthly pay &divide; that number; use 26 for Monday to Saturday.</p>
  <h4 style="margin:1rem 0 .3rem">Attendance rules</h4><div class="form">
  <div><label>No time in (only a time out)</label><select id="dt7">${[["absent", "Absent (whole day)"], ["half", "Half day"], ["none", "Not counted (present)"]].map(([k, l]) => `<option value="${k}" ${(D.noInRule || "absent") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div><label>No time out (only a time in)</label><select id="dt8">${[["half", "Half day"], ["absent", "Absent (whole day)"], ["none", "Not counted (present)"]].map(([k, l]) => `<option value="${k}" ${(D.noOutRule || "half") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  ${p("dt9", "Half day counts as (days absent)", D.halfDayAbs ?? 0.5)}</div>
  <div style="margin-top:.6rem"><label style="display:inline-flex;gap:.4rem;align-items:center"><input type="checkbox" id="dt10" ${D.attOt !== false ? "checked" : ""}>Holiday and WFH with attendance count as overtime (whole time worked). Saturday is a regular work day, not overtime</label></div>
  <div style="margin-top:.4rem"><label style="display:inline-flex;gap:.4rem;align-items:center"><input type="checkbox" id="dt11" ${D.holPunch === true ? "checked" : ""}>Count the biometric time in / time out on a holiday (when not ticked, punches on a holiday are ignored; a time typed by hand in the DTR is still counted)</label></div>
  <p class="muted">No punch at all on a working day is always absent. A half day is deducted from the salary as the number of absent days above (0.5 = half a day's pay) and shows in the payslip's days absent. Work on a rest day is added to the overtime hours of the payroll (overtime multiplier is in Payroll settings).</p></div>

  <div data-sp="gr" ${spHide("gr")}><h3>Grace periods (minutes)</h3><p class="muted">Time in up to and <b>including</b> the grace minutes is on time (8:00 + 30 = 8:30:00 is on time, 8:30:01 is late). Set it for every group and every day of the week; days that are not working days are ignored.</p>
  <div class="tw"><table id="grt"><tr><th>Group</th>${DOW.map(([n, l]) => `<th class="n">${l}</th>`).join("")}</tr>${[["staff", "Staff"], ["teacher", "Teachers"], ["admin", "School admins"]].map(([g, l]) => `<tr><td><b>${l}</b></td>${DOW.map(([n]) => `<td class="n"><input type="number" min="0" step="any" class="in gri" data-g="${g}" data-d="${n}" value="${graceFor(g, n)}"></td>`).join("")}</tr>`).join("")}</table></div>
  <p class="muted">Default: Staff 30 minutes Monday to Friday and 15 on Saturday; Teachers 15 minutes every day.</p></div>
  ${autoHTML(S)}
  <div data-sp="ot" ${spHide("ot")}><h3>Overtime</h3><p class="muted">The biometric never counts overtime on its own. An early time in is never overtime. Overtime from a late time out is counted <b>only for people allowed here</b>; for everyone else it stays 0 (you can still type overtime hours by hand in Payroll).</p>
  <h4 style="margin:.8rem 0 .3rem">Who can take overtime</h4><div class="row">${[["staff", "Staff"], ["teacher", "Teachers"], ["admin", "School admins"]].map(([g, l]) => `<label class="chk"><input type="checkbox" class="otg" data-g="${g}" ${O.groups && O.groups[g] ? "checked" : ""}> ${l}</label>`).join("")}</div>
  <div class="tw" style="max-height:20rem;overflow:auto;margin-top:.6rem"><table id="otp"><tr><th>No.</th><th>Employee</th><th>Group</th><th>Overtime</th></tr>${ST.employees.map((e) => `<tr data-oe="${esc(e.id)}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc((CATEGORIES.find((c) => c.key === categoryOf(e)) || {}).short || "")}</td><td><select class="otw">${[["", "Follow the group"], ["yes", "Allowed"], ["no", "Not allowed"]].map(([k, l]) => `<option value="${k}" ${((O.people || {})[e.id] || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></td></tr>`).join("")}</table></div>
  <h4 style="margin:1rem 0 .3rem">How overtime is computed</h4><div class="form">${p("ot1", "Overtime starts after the time out by (minutes, 0 = right away)", O.startMin ?? 0)}${p("ot2", "Counted in blocks of (minutes, 60 = per hour, 1 = exact minutes)", O.blockMin ?? 60)}${p("ot6", "Minutes of the hour from which a full hour counts (30 = minutes 30 to 59 count as 1 hour, 1 to 29 are not counted; 0 = the excess minutes are never counted)", O.roundFrom ?? 30)}${p("ot3", "Minimum overtime to count (minutes)", O.minMin ?? 0)}${p("ot4", "Daily maximum (hours, 0 = no limit)", O.maxHrs ?? 0)}<div><label>Work on a rest day (Sunday)</label><select id="dt6"><option value="1">Counts as overtime</option><option value="0" ${D.restDayAsOt === false ? "selected" : ""}>Not counted</option></select></div></div>
  <p class="muted">Overtime and late are counted in <b>exact minutes</b> and shown as hours and minutes. Example: time out 17:00, leaving 18:25 = 1 hr 25 min overtime. Raise the numbers above only if you want a waiting time, a minimum or blocks. Pay = hourly rate &times; the overtime multiplier (Payroll settings, now ${S.otRate}).</p></div>
  <div data-sp="lt" ${spHide("lt")}><h3>Late computation</h3><div class="form"><div><label>Round the late minutes</label><select id="lt2">${[["down", "Down (8:31:40 = 31 min)"], ["up", "Up (8:31:40 = 32 min)"], ["nearest", "Nearest minute"]].map(([k, l]) => `<option value="${k}" ${(Lt.round || "down") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  ${p("lt3", "Deduct in blocks of (minutes, 1 = every minute)", Lt.blockMin ?? 1)}<div><label>Count late per hour (like overtime)</label><select id="lt5"><option value="1">ON - whole hours</option><option value="0" ${Lt.hourOn === false ? "selected" : ""}>OFF - exact minutes</option></select></div>${p("lt6", "Staff / admins: minutes late from which 1 hour counts (30 = 30-59 min late = 1 hr)", Lt.fromStaff ?? 30)}${p("lt7", "Teachers: minutes late from which 1 hour counts (16 = 16-59 min late = 1 hr)", Lt.fromTeacher ?? 16)}</div>
  <p class="muted">Deduction = late minutes &divide; 60 &times; the hourly rate. Teachers paid per hour are not deducted for late. <b>Late is counted per hour like overtime</b>: the minutes late from the official time in are rounded to whole hours - staff 30-59 min = 1 hr, teachers 16-59 min = 1 hr (the minutes past the last full hour count as one more hour only from that minute; 1 hr 20 min = 1 hr, 1 hr 40 min = 2 hrs). Late is only flagged when the time in is past the grace period of that group and day, and late minutes are counted from the end of the grace period (8:30 grace end: 8:31 = 1 minute late).</p></div>
  ${shiftHTML(S)}
  <div data-sp="lv" ${spHide("lv")}><h3>Leave types</h3><p class="muted">Choose which leave is <b>with pay</b> (no salary deduction) or <b>without pay</b> (deducted). Days per year: 0 = no limit. Leave marked <b>Counts to total</b> (Personal, Birthday, Emergency, Sick) shares one total a year instead of its own days.</p><div class="form"><div><label>Total leave per year (shared)</label><input type="number" min="0" step="any" id="lv_tot" value="${leaveTotal(S)}"></div></div><p><button class="btn" id="lvreset" type="button">Reset leave types to default</button></p><div class="tw"><table id="ltab"><tr><th>Leave type</th><th>Pay</th><th>Days per year</th><th>Counts to total</th><th></th></tr>${leaveTypes(S).map(lvRow).join("")}</table></div><p><button class="btn" id="alt">+ Add leave type</button></p><div class="form"><div><label>Deduct approved leave without pay automatically</label><select id="lv_ded"><option value="1">Yes</option><option value="0" ${S.unpaidLeave === false ? "selected" : ""}>No</option></select></div></div></div>`;
}


/* >>>>>>>>>> js/settings/shifts.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: shifts per department.
   File: js/settings/shifts.js
   ============================================================ */

/* ---------- Shifts: several work times per department, assigned per employee ---------- */
const shName = (s) => s.name || `${s.dept || "Shift"} ${s.start}-${s.end}`;

const shLabel = (s) => `${shName(s)} (${s.start} - ${s.end})`;

const shRow = (s) => `<tr data-sh data-id="${esc(s.id || "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5))}"><td><input class="shn" value="${esc(s.name || "")}" placeholder="e.g. Maintenance - Shift A"></td><td><input class="shd" list="shdl" value="${esc(s.dept || "")}"></td><td><input type="time" class="shs" value="${esc(s.start || "")}"></td><td><input type="time" class="she" value="${esc(s.end || "")}"></td><td><button class="btn sm d" type="button" data-shx>Remove</button></td></tr>`;

const shOpts = (list, cur) => `<option value="">Follow the department</option><option value="auto" ${cur === "auto" ? "selected" : ""}>Automatic (closest to the first punch)</option>${list.map((s) => `<option value="${esc(s.id)}" ${cur === s.id ? "selected" : ""}>${esc(shLabel(s))}</option>`).join("")}`;

const shCollect = () => [...document.querySelectorAll("[data-sh]")].map((r) => ({ id: r.dataset.id, name: $(".shn", r).value.trim(), dept: $(".shd", r).value.trim(), start: $(".shs", r).value, end: $(".she", r).value })).filter((s) => s.start && s.end);

function shiftHTML(S) {
  const D = S.dtr, L = D.shifts || [], depts = [...new Set((ST.employees || []).map((e) => String(e.dept || "").trim()).filter(Boolean))].sort();
  return `<div data-sp="sh" ${spHide("sh")}><h3>Shifts (work schedules)</h3><p class="muted">Some departments work in shifts, for example Maintenance 6:00 AM - 3:00 PM <i>and</i> 10:00 AM - 7:00 PM, or Security 6:00 AM - 6:00 PM. Add every shift with its department. Late and overtime are then counted from the shift of each employee. A department with <b>one</b> shift uses it for everybody. A department with <b>several</b> shifts uses, for each day, the shift closest to the employee's punches (<i>Automatic</i>), unless you assign a shift below. Departments without a shift use the times under Work days &amp; hours.</p>
  <datalist id="shdl">${depts.map((d) => `<option value="${esc(d)}">`).join("")}</datalist>
  <div class="tw"><table id="sht"><tr><th>Shift name</th><th>Department</th><th>Time in</th><th>Time out</th><th></th></tr>${L.map(shRow).join("")}</table></div><p><button class="btn" id="ash" type="button">+ Add shift</button></p>
  <h4 style="margin:1rem 0 .3rem">Shift of each employee</h4><div class="row noprint"><div style="flex:1;min-width:14rem"><label>Search employee</label><input id="shq" type="search" placeholder="Employee no., name or department" style="width:100%"></div></div>
  <div class="tw" style="max-height:22rem;overflow:auto;margin-top:.6rem"><table id="shp"><tr><th>No.</th><th>Employee</th><th>Department</th><th>Shift</th></tr>${(ST.employees || []).map((e) => `<tr data-se data-q="${esc([e.no, nameOf(e), e.dept].join(" ").toLowerCase())}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(e.dept || "-")}</td><td><select class="shw" data-id="${esc(e.id)}">${shOpts(L, (D.empShift || {})[e.id] || "")}</select></td></tr>`).join("")}</table></div>
  <p class="muted">Press <b>Save settings</b> to keep the shifts.</p></div>`;
}


/* >>>>>>>>>> js/settings/saturday.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: Saturday half day - who works 8:00 AM - 12:00 noon on Saturday (still paid as one day), and Saturday overtime.
   File: js/settings/saturday.js
   (The rule itself is in js/dtr/rules.js: satHalfOf() and schedOf(); the overtime part is in js/dtr/dtr-calc.js.)
   ============================================================ */

function satHTML(S) {
  const H = { ...DEFAULT_SETTINGS.dtr.satHalf, ...((S.dtr && S.dtr.satHalf) || {}) }, emps = (ST.employees || []).filter((e) => categoryOf(e) !== "teacher");
  // every department of the employees, plus any saved department that no employee has (yet)
  const names = new Map(); emps.forEach((e) => { const d = String(e.dept || "").trim(); if (d && !names.has(d.toLowerCase())) names.set(d.toLowerCase(), d); });
  (H.depts || []).forEach((d) => { d = String(d).trim(); if (d && ![...names.values()].some((n) => deptLike(n, d))) names.set(d.toLowerCase(), d); });
  const list = [...names.values()].sort((a, b) => a.localeCompare(b)), isOn = (n) => deptOn(n, H);
  const people = emps.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return `<div data-sp="sat" ${spHide("sat")}><h3>Saturday half day</h3>
  <p class="muted">Some departments only work half a day on Saturday, but the pay is still <b>one full day</b> (the monthly pay already includes it, so nothing is deducted). On those Saturdays the DTR uses the time below instead of the usual time in / out: late, early out and absent are checked against it.</p>
  <div class="swgrid">${swRow("sat_on", H.on !== false, "Saturday half day", "Employees of the departments ticked below work the Saturday hours set here.", "ON - the half-day Saturday rule is used.", "OFF - Saturday is a normal full work day for everybody.")}</div>
  <div class="form"><div><label>Saturday time in</label><input type="time" id="sat_s" value="${esc(H.start || "08:00")}"></div><div><label>Saturday time out (half day)</label><input type="time" id="sat_e" value="${esc(H.end || "12:00")}"></div>
  <div><label>Overtime starts from (lunch 12:00 - 1:00 is not counted)</label><input type="time" id="sat_o" value="${esc(H.otFrom || "13:00")}"></div>
  <div><label>Saturday overtime</label><select id="sat_m"><option value="filed">Only when allowed that day (filed in the Overtime File)</option><option value="auto" ${H.otMode === "auto" ? "selected" : ""}>Automatic from the biometric (people allowed overtime)</option></select></div></div>
  <p class="muted">Overtime on a half-day Saturday is counted only for the time worked <b>after the "Overtime starts from" time</b>. With the first choice nothing is paid unless the hours are filed for that date in the <a href="#" data-go="otf">Overtime File</a> (that is how you allow overtime for a certain Saturday). With the second choice the biometric time out is used for the people who are allowed overtime (<a href="#" data-go="ot">Overtime rules</a>).</p>
  <p class="muted"><b>Employees on a shift</b> (Settings &gt; Shifts, e.g. Maintenance and Security) are not affected: on Saturday they work their own shift, with the late and overtime counted from it. Only an exception chosen one by one below (Half day) changes that.</p>
  <h4 style="margin:1rem 0 .3rem">Departments on a half-day Saturday</h4>
  <div class="chips" style="flex-wrap:wrap">${list.map((n) => `<label style="display:inline-flex;gap:.35rem;align-items:center;margin:.2rem .9rem .2rem 0;font-weight:500"><input type="checkbox" class="satd" value="${esc(n)}" ${isOn(n) ? "checked" : ""}>${esc(n)}</label>`).join("") || '<span class="muted">No departments yet.</span>'}</div>
  <details style="margin-top:.8rem"><summary><b>Exceptions - choose one by one</b> (an employee whose department is not on the list, or who works a full Saturday)</summary>
  <div class="tw"><table><tr><th>No.</th><th>Name</th><th>Department</th><th>Saturday</th></tr>${people.map((e) => { const v = (H.people || {})[e.id] || ""; return `<tr data-satp="${esc(e.id)}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(e.dept || "-")}</td><td><select class="satw"><option value="">Follow the department</option><option value="yes" ${v === "yes" ? "selected" : ""}>Half day (paid 1 day)</option><option value="no" ${v === "no" ? "selected" : ""}>Full day</option></select></td></tr>`; }).join("") || '<tr><td colspan="4" class="muted">No employees.</td></tr>'}</table></div></details>
  <p class="muted" style="margin-top:.6rem">Make sure Saturday is ticked in <a href="#" data-go="dtr">Work days &amp; hours</a>. Press <b>Save settings</b> to keep the change.</p></div>`;
}

function satCollect() {
  if (!document.getElementById("sat_on")) return;
  const S = ST.settings, v = (id) => $("#" + id).value, people = {};
  document.querySelectorAll("[data-satp]").forEach((r) => { const k = $(".satw", r).value; if (k) people[r.dataset.satp] = k; });
  S.dtr.satHalf = { on: $("#sat_on").checked, start: v("sat_s") || "08:00", end: v("sat_e") || "12:00", otFrom: v("sat_o") || "13:00", otMode: v("sat_m") === "auto" ? "auto" : "filed", depts: [...document.querySelectorAll(".satd")].filter((c) => c.checked).map((c) => c.value), off: [...document.querySelectorAll(".satd")].filter((c) => !c.checked).map((c) => c.value), satV: 1, people };
}

/* >>>>>>>>>> js/settings/auto-overtime.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: automatic late deduction / automatic overtime switches.
   File: js/settings/auto-overtime.js
   ============================================================ */

/* ---------- Settings: automatic late deduction / automatic overtime ---------- */
const swRow = (id, on, title, sub, onTxt, offTxt) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span class="trk"></span><span class="swt"><b>${title}</b><small>${sub}</small><em class="sws" data-on="${onTxt}" data-off="${offTxt}"></em></span></label>`;

function autoHTML(S) {
  const L = (S.dtr && S.dtr.late) || {}, O = (S.dtr && S.dtr.ot) || {}, E = (S.dtr && S.dtr.early) || {}, Tc = (S.dtr && S.dtr.teacher) || {};
  return `<div data-sp="auto" ${spHide("auto")}><h3>Automatic late deduction &amp; overtime</h3><p class="muted">Choose what the system does by itself when it reads the biometric DTR. You can still type over any number in the Payroll tab.</p>
  <div class="swgrid">${swRow("lt4", L.deduct !== false, "Deduct late automatically (staff &amp; admins)", "Late minutes from the DTR are taken off the salary of the payroll. Teachers have their own switches below.", "ON - late is deducted from the salary.", "OFF - late is only reported, nothing is deducted.")}
  ${swRow("ot5", O.auto !== false, "Add overtime automatically", "Overtime read from the biometric (late time out, rest-day work) is added to the payroll for the people allowed to take overtime.", "ON - overtime is added by itself.", "OFF - only hours in the Overtime file are paid.")}
  ${swRow("ea1", E.on !== false, "Detect early time in / early time out", "Flags employees and teachers who punch in before their scheduled time in (a teacher's own Time in from the Teacher Hours menu counts first), or punch out before their scheduled time out. It is only reported in the Attendance check, the DTR and the attendance sheets: nothing is deducted.", "ON - early time in / out is flagged.", "OFF - early time is not checked.")}</div>
  <h4 style="margin:1rem 0 .3rem">Teachers (separate settings)</h4><p class="muted">Teachers are paid per hour from the Class check, so these switches only apply to teachers and do not change the staff / admin settings above.</p>
  <div class="swgrid">${swRow("tl1", Tc.lateDeduct !== false, "Auto late deduction", "Late is counted after the teacher's grace period and deducted per hour, rounded up (any late after grace = 1 hr, over 1 hr = 2 hrs, and so on, for each class). The Late line is shown on the payslip.", "ON - late is deducted automatically.", "OFF - late is only reported; nothing is deducted.")}
  ${swRow("tl2", Tc.earlyOutDeduct !== false, "Auto early-out deduction", "An early time out is not paid: the hours stop at the time out and the Early out line is shown on the payslip.", "ON - early out is deducted automatically.", "OFF - early out is only reported; hours count to the class end.")}
  <div class="muted" style="padding:.5rem .2rem"><b>Early time in is never counted as overtime</b> (teachers, staff and admins): the early minutes are not paid and never added to overtime. Overtime starts only after the time out.</div></div>
  <div class="form"><div><label>Flag early time in when at least this many minutes before the time in</label><input id="ea2" type="number" min="1" step="1" value="${E.inMin ?? 1}"></div><div><label>Flag early time out when at least this many minutes before the time out</label><input id="ea3" type="number" min="1" step="1" value="${E.outMin ?? 1}"></div></div>
  <div class="form"><div><label>Biometric DTR: count hours worked in blocks of (minutes) - the excess minutes are not counted. 30 = 8 hrs 45 min counts as 8:30. 0 = exact minutes.</label><input id="hb1" type="number" min="0" step="1" value="${(S.dtr && S.dtr.hrsBlock) ?? 30}"></div></div>
  <p class="muted">Related settings: <a href="#" data-go="gr">Grace periods</a> &middot; <a href="#" data-go="lt">Late computation</a> &middot; <a href="#" data-go="ot">Overtime rules</a> &middot; <a href="#" data-go="otf">Overtime File page</a>. Press <b>Save settings</b> to keep the change.</p></div>`;
}

document.addEventListener("change", (ev) => { if (ev.target.closest && ev.target.closest(".sw")) swSync(); });

function swSync() { document.querySelectorAll(".sw").forEach((w) => { const c = w.querySelector("input").checked, s = w.querySelector(".sws"); if (s) { s.textContent = c ? s.dataset.on : s.dataset.off; s.className = "sws " + (c ? "on" : "off"); } }); }


/* >>>>>>>>>> js/settings/overtime-file.js >>>>>>>>>> */
/* ============================================================
   SETTINGS + PAGE: Overtime file (filed overtime per employee).
   File: js/settings/overtime-file.js
   ============================================================ */

/* ---------- Settings: Overtime file ---------- */
const parseHrs = (t) => { t = String(t ?? "").trim(); if (!t) return 0; if (t.includes(":")) { const [h, m] = t.split(":").map(Number); return (h || 0) + (m || 0) / 60; } return +t || 0; };

function otfHTML() {
  const q = (ST.otfQ || "").trim().toLowerCase(), L = (ST.settings.otFile || []).map((x) => ({ x, e: ST.employees.find((e) => e.id === x.empId) })).filter((r) => r.e && (!q || [r.e.no, nameOf(r.e), r.e.dept, r.x.date].join(" ").toLowerCase().includes(q))).sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : nameOf(a.e).localeCompare(nameOf(b.e))));
  const tot = L.reduce((n, r) => n + (+r.x.hours || 0), 0);
  return L.length ? `<div class="tw" style="max-height:26rem;overflow:auto"><table><tr><th>Date</th><th>No.</th><th>Employee</th><th>Group</th><th class="n">Overtime hours</th><th>Reason</th><th></th></tr>${L.map(({ x, e }) => `<tr><td>${esc(x.date)} <small class="muted">${new Date(x.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</small></td><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(groupName(e))}</td><td class="n"><b>${fmtHM(Math.round((+x.hours || 0) * 60))}</b> <small class="muted">(${+(+x.hours).toFixed(2)} h)</small></td><td>${esc(x.reason || "")}</td><td><button type="button" class="btn sm d" data-otx="${esc(x.id)}">Remove</button></td></tr>`).join("")}<tr class="tot"><td colspan="4">Total (${L.length} entries)</td><td class="n">${fmtHM(Math.round(tot * 60))}</td><td colspan="2"></td></tr></table></div>` : `<div class="empty"><b>No overtime filed yet</b><p class="muted">Add the first overtime hours above, or upload an Excel / CSV file.</p></div>`;
}

function otfPage() { V(`<div class="card">${otFileHTML()}</div>`); otfInit(); }

function otFileHTML() {
  const today = ymd(new Date()), emps = ST.employees.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return `<div><h3>Overtime file</h3><p class="muted">Record the overtime hours of each employee here. Hours filed for a date are paid as overtime for that date <b>and replace</b> whatever the biometric gave for that day, so nothing is counted twice. They are paid even if the person is not on the &ldquo;Who can take overtime&rdquo; list, and also when ${isHR() ? "Add overtime automatically (Settings)" : '<a href="#" data-go="auto">Add overtime automatically</a> (Settings)'} is OFF.</p>
  <div class="otbox"><div class="form"><div><label>Employee</label><select id="of_e"><option value="">Choose employee...</option>${emps.map((e) => `<option value="${esc(e.id)}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
  <div><label>Date</label><input type="date" id="of_d" value="${today}"></div><div><label>Overtime hours (1.5 or 1:30)</label><input id="of_h" inputmode="decimal" placeholder="e.g. 2"></div><div><label>Reason (optional)</label><input id="of_r" placeholder="e.g. Enrollment, event, make-up class"></div></div>
  <div class="row" style="margin-top:.7rem"><button type="button" class="btn p" id="of_add">Add overtime</button><span class="muted">or</span><div><input type="file" id="of_f" accept=".xlsx,.xls,.csv"></div></div>
  <p class="muted" style="margin:.5rem 0 0">Upload columns: <b>Employee No, Date, Hours, Reason</b> (the first row may be a heading). Entries are saved to the database right away.</p></div>
  <div class="row" style="margin:1rem 0 .5rem"><div style="flex:1;min-width:14rem"><input id="of_q" type="search" placeholder="Search name, employee no., department or date" value="${esc(ST.otfQ || "")}" style="width:100%"></div></div>
  <div id="otf_body">${otfHTML()}</div></div>`;
}

/** The overtime file has its own tab in the database. Entries are added / removed on the server and the full list comes back, so two people (HR and payroll) filing at the same time never overwrite each other. */
async function otfAdd(list, msg) { try { ST.settings.otFile = await api("otAdd", { list }); if (msg) toast(msg); } catch (e) { } otfRedraw(); }

async function otfRemove(ids, msg) { try { ST.settings.otFile = await api("otRemove", { ids }); if (msg) toast(msg); } catch (e) { } otfRedraw(); }

function otfRedraw() { const b = $("#otf_body"); if (b) b.innerHTML = otfHTML(); }

function otfInit() {
  swSync();
  document.querySelectorAll("[data-go]").forEach((a) => a.onclick = (e) => { e.preventDefault(); const go = a.dataset.go, b = document.querySelector(`#svs [data-sv="${go}"]`); if (go === "otf") { ST.tab = "otf"; shell(); } else if (b) b.click(); else { ST.setView = go; ST.tab = "set"; shell(); } });
  if (!$("#of_add")) return;
  $("#of_add").onclick = async () => {
    const id = $("#of_e").value, d = $("#of_d").value, h = parseHrs($("#of_h").value);
    if (!id) return toast("Choose the employee.", true); if (!d) return toast("Choose the date.", true); if (!(h > 0) || h > 24) return toast("Enter the overtime hours (more than 0, up to 24).", true);
    const dup0 = (ST.settings.otFile || []).find((x) => x.empId === id && x.date === d);   // one entry per person and date: filing again changes it
    const ent = { id: dup0 ? dup0.id : "ot" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), empId: id, date: d, hours: Math.round(h * 10000) / 10000, reason: $("#of_r").value.trim() };
    $("#of_h").value = ""; $("#of_r").value = ""; await otfAdd([ent], dup0 ? "Overtime of that date changed." : "Overtime added to the file.");
  };
  $("#of_q").oninput = (e) => { ST.otfQ = e.target.value; otfRedraw(); };
  $("#otf_body").onclick = async (e) => { const b = e.target.closest("[data-otx]"); if (!b) return; if (!confirm("Remove this overtime entry?")) return; await otfRemove([b.dataset.otx], "Entry removed."); };
  $("#of_f").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return; ev.target.value = "";
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      let c = { no: 0, date: 1, hrs: 2, why: 3 }, start = 0;
      const hi = rows.findIndex((r) => r.some((x) => /hour|hrs/i.test(String(x))));
      if (hi >= 0) { start = hi + 1; const f2 = (re) => rows[hi].findIndex((x) => re.test(String(x).trim())); const no = f2(/^(emp(loyee)?\.?\s*)?(no|id|number|#)\.?$|emp.*(no|id)/i), dt = f2(/date/i), hr = f2(/hour|hrs/i), wy = f2(/reason|remark|note|purpose/i); c = { no: no >= 0 ? no : 0, date: dt >= 0 ? dt : 1, hrs: hr, why: wy }; }
      const toDate = (v) => { if (typeof v === "number") { const o = XLSX.SSF.parse_date_code(v); return o ? `${o.y}-${String(o.m).padStart(2, "0")}-${String(o.d).padStart(2, "0")}` : ""; } const t = String(v).trim(), m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), u = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`; if (u) return `${u[3]}-${u[1].padStart(2, "0")}-${u[2].padStart(2, "0")}`; const d = new Date(t); return isNaN(d) ? "" : ymd(d); };
      let ok = 0, bad = 0; const L = (ST.settings.otFile ||= []), send = new Map();
      for (const r of rows.slice(start)) {
        if (!r.some((x) => String(x).trim())) continue;
        const key = String(r[c.no] ?? "").trim(), e = ST.employees.find((x) => normNo(x.no) === normNo(key)) || ST.employees.find((x) => key && nameNorm(nameOf(x)) === nameNorm(key)), d = toDate(r[c.date]), h = parseHrs(r[c.hrs]);
        if (!e || !d || !(h > 0) || h > 24) { bad++; continue; }
        const dup = L.find((x) => x.empId === e.id && x.date === d), dk = e.id + "|" + d, why = c.why >= 0 ? String(r[c.why] ?? "").trim() : "";
        send.set(dk, dup ? { id: dup.id, empId: e.id, date: d, hours: h, reason: why || dup.reason || "" } : { id: "ot" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + send.size, empId: e.id, date: d, hours: h, reason: why });
        ok++;
      }
      if (ok) await otfAdd([...send.values()], `${ok} overtime entr${ok === 1 ? "y" : "ies"} saved${bad ? `, ${bad} row(s) skipped (employee, date or hours not recognised)` : ""}.`); else toast("No valid rows found. Use the columns Employee No, Date, Hours.", true);
    } catch (e) { toast("Could not read the file: " + e.message, true); }
  };
}


/* >>>>>>>>>> js/settings/tax.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: TIN / Tax computation (Philippines) - withholding tax method, brackets, minimum wage earner rule, employer TIN.
   File: js/settings/tax.js
   ============================================================ */

/** BIR income tax table for 2023 onward (TRAIN law): yearly taxable income. */
const TRAIN_BRACKETS = [{ over: 0, rate: 0, base: 0 }, { over: 250000, rate: 15, base: 0 }, { over: 400000, rate: 20, base: 22500 }, { over: 800000, rate: 25, base: 102500 }, { over: 2000000, rate: 30, base: 402500 }, { over: 8000000, rate: 35, base: 2202500 }];

const taxRow = (b) => `<tr data-tb><td><input type="number" step="any" class="tbo" value="${esc(b.over)}"></td><td><input type="number" step="any" class="tbr" value="${esc(b.rate)}"></td><td><input type="number" step="any" class="tbb" value="${esc(b.base)}"></td><td><button class="btn sm d" type="button" data-tbx>Remove</button></td></tr>`;

function taxHTML(S) {
  const T = S.tax, sel = (id, l, v, a, b) => `<div><label>${l}</label><select id="${id}"><option value="1">${a}</option><option value="0" ${v === false ? "selected" : ""}>${b}</option></select></div>`, n = (id, l, v) => `<div><label>${l}</label><input type="number" step="any" id="${id}" value="${v}"></div>`;
  return `<div data-sp="tax" ${spHide("tax")}><h3>TIN / Tax computation (Philippines)</h3>
  <p class="muted">How the withholding tax on compensation is computed on every payroll. Each employee's own TIN is typed under Employees (it is printed on the payslip and the tax report).</p>
  <h4 style="margin:.6rem 0 .3rem">Employer (school)</h4>
  <div class="form"><div><label>Employer name</label><input id="tx_en" value="${esc(T.employerName || "")}" placeholder="ARK Technological Institute Education System Inc"></div><div><label>Employer TIN</label><input id="tx_et" value="${esc(T.employerTin || "")}" placeholder="000-000-000-000"></div><div><label>BIR RDO code</label><input id="tx_rdo" value="${esc(T.rdo || "")}" placeholder="e.g. 056"></div></div>
  <h4 style="margin:1rem 0 .3rem">Withholding tax computation</h4>
  <div class="form">${sel("s_tax", "Withholding tax", T.on, "On - computed automatically", "Off - no tax withheld").replace('value="0" ', 'value="0" ')}
  <div><label>Method</label><select id="tx_m"><option value="bracket">Graduated rates (TRAIN table, yearly)</option><option value="flat" ${T.method === "flat" ? "selected" : ""}>Flat percentage of the pay</option></select></div>
  ${sel("tx_mwe", "Minimum wage earners (MWE)", !T.mweExempt ? false : true, "Exempt from tax (daily rate at or below the minimum wage)", "Taxed like everyone else").replace('<option value="1">', '<option value="1">')}
  ${sel("tx_ac", "Taxable pay is reduced by SSS, PhilHealth and Pag-IBIG", T.afterContrib, "Yes (mandatory contributions are tax-free)", "No (tax on the full pay)")}
  ${sel("tx_al", "Include taxable allowances in the taxable pay", T.includeAllowances, "Yes (unless the allowance is marked non-taxable)", "No (allowances are not taxed)")}
  ${n("tx_fr", "Flat method: tax rate (%)", T.flatRate || 0)}${n("tx_fo", "Flat method: monthly pay exempt from tax (\u20B1)", T.flatOver || 0)}</div>
  <h4 style="margin:1rem 0 .3rem">Graduated tax table (yearly taxable income)</h4>
  <p class="muted">Tax = base amount + rate % of the income over the lower limit. The first row is the tax-free income (\u20B10 tax up to the next row's limit). Use the BIR table in force; the default is the 2023-onward TRAIN table.</p>
  <div class="tw"><table id="tbtab"><tr><th>Income over (\u20B1 / year)</th><th>Rate (%)</th><th>Plus base tax (\u20B1)</th><th></th></tr>${T.brackets.map(taxRow).join("")}</table></div>
  <p><button class="btn" id="atb" type="button">+ Add bracket</button> <button class="btn" id="rtb" type="button">Reset to TRAIN table (2023+)</button></p>
  <p class="muted">Press <b>Save settings</b> to keep the change. An employee can still be set to &ldquo;Do not deduct&rdquo; tax, or given a fixed monthly tax, under Employees &rarr; Add information.</p></div>`;
}

function taxInit() {
  const t = $("#tbtab"); if (!t) return;
  $("#atb").onclick = () => t.insertAdjacentHTML("beforeend", taxRow({ over: 0, rate: 0, base: 0 }));
  $("#rtb").onclick = () => { if (confirm("Replace the table with the BIR TRAIN table (2023 onward)?")) t.innerHTML = "<tr><th>Income over (\u20B1 / year)</th><th>Rate (%)</th><th>Plus base tax (\u20B1)</th><th></th></tr>" + TRAIN_BRACKETS.map(taxRow).join(""); };
  t.onclick = (e) => { const b = e.target.closest("[data-tbx]"); if (b && t.querySelectorAll("[data-tb]").length > 1) b.closest("tr").remove(); };
}

function taxCollect() {
  const T = ST.settings.tax, v = (id) => $("#" + id).value, num = (x) => (isNaN(+x) ? 0 : +x);
  const L = [...document.querySelectorAll("[data-tb]")].map((r) => ({ over: num($(".tbo", r).value), rate: num($(".tbr", r).value), base: num($(".tbb", r).value) })).sort((a, b) => a.over - b.over);
  if (L.length) T.brackets = L;
  Object.assign(T, { on: v("s_tax") === "1", method: v("tx_m"), mweExempt: v("tx_mwe") === "1", afterContrib: v("tx_ac") === "1", includeAllowances: v("tx_al") === "1", flatRate: Math.max(0, num(v("tx_fr"))), flatOver: Math.max(0, num(v("tx_fo"))), employerName: v("tx_en").trim(), employerTin: v("tx_et").trim(), rdo: v("tx_rdo").trim() });
}

/* >>>>>>>>>> js/settings/extras.js >>>>>>>>>> */
/* ============================================================
   SETTINGS: extra settings blocks and how they are collected on Save.
   File: js/settings/extras.js
   ============================================================ */

function setExtras() {
  otfInit();
  const rows = () => [...document.querySelectorAll("[data-hr]")].map((r) => ({ date: $(".hd", r).value, label: $(".hl", r).value.trim(), type: $(".ht", r).value })).filter((h) => h.date);
  $("#add_dd").onclick = () => $("#ddt").insertAdjacentHTML("beforeend", ddRow("", {}));
  $("#ddt").onclick = (e) => { const b = e.target.closest("[data-ddx]"); if (b) b.closest("tr").remove(); };
  const shRefresh = () => { const L = shCollect(); document.querySelectorAll(".shw").forEach((s) => { const cur = s.value; s.innerHTML = shOpts(L, cur); }); };
  $("#ash").onclick = () => { $("#sht").insertAdjacentHTML("beforeend", shRow({})); shRefresh(); };
  $("#sht").oninput = shRefresh; $("#sht").onclick = (e) => { const b = e.target.closest("[data-shx]"); if (b) { b.closest("tr").remove(); shRefresh(); } };
  $("#shq").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll("[data-se]").forEach((r) => r.hidden = !!q && !r.dataset.q.includes(q)); };
  $("#ah").onclick = () => $("#htab").insertAdjacentHTML("beforeend", holRow({}));
  $("#aw").onclick = () => $("#wtab").insertAdjacentHTML("beforeend", wfhRow({}));
  $("#wtab").onclick = (e) => { const b = e.target.closest("[data-wx]"); if (b) b.closest("tr").remove(); };
  $("#alt").onclick = () => $("#ltab").insertAdjacentHTML("beforeend", lvRow({ paid: true }));
  $("#lvreset").onclick = async () => { if (!confirm("Reset the leave types to the default list (Personal, Birthday, Emergency, Sick - 7 days in total; Maternity 105; Paternity 7; Leave Without Pay)?")) return; ST.settings.leaveTypes = null; ST.settings.leaveTotal = 7; await api("saveSettings", ST.settings); ST.setView = "lv"; toast("Leave types reset to default."); set(); };
  $("#ltab").onclick = (e) => { const b = e.target.closest("[data-lx]"); if (b) b.closest("tr").remove(); };
  $("#htab").onclick = (e) => { const b = e.target.closest("[data-hx]"); if (b) b.closest("tr").remove(); };
  $("#ahd").onclick = () => {
    const y = +$("#hy").value, r = phHolidays(y), L = rows(), have = new Set(L.map((h) => h.date)), add = r.list.filter((h) => !have.has(h.date)), D = ST.settings.dtr;
    $("#htab").innerHTML = "<tr><th>Date</th><th>Holiday</th><th>Type</th><th></th></tr>" + [...L, ...add].sort((a, b) => a.date < b.date ? -1 : 1).map(holRow).join("");
    D.holAuto = [...new Set([...(D.holAuto || []), y])];
    $("#hn").textContent = `${add.length} holiday(s) added for ${y}. ${r.note} Press Save settings to keep them.`; toast(`${add.length} holiday(s) added for ${y}.`);
  };
}

function collectExtras() {
  const S = ST.settings, v = (id) => $("#" + id).value, nz = (id) => (v(id) === "" || isNaN(+v(id)) ? "" : Math.max(0, +v(id)));   // nz: a money box; blank = not set
  S.dtr.holidays = [...document.querySelectorAll("[data-hr]")].map((r) => ({ date: $(".hd", r).value, label: $(".hl", r).value.trim(), type: $(".ht", r).value })).filter((h) => h.date);
  S.dtr.wfhDays = [...document.querySelectorAll("[data-wr]")].map((r) => ({ date: $(".wd", r).value, label: $(".wl", r).value.trim(), type: $(".wt", r).value, hours: $(".wh", r).value === "" ? null : +$(".wh", r).value })).filter((h) => h.date);
  S.wfh = { staffPaid: v("wf1") === "1", staffPct: isNaN(+v("wf2")) ? 100 : +v("wf2"), teachersPaid: v("wf3") === "1", teacherBasis: v("wf6") || "rate", teacherHours: isNaN(+v("wf4")) || v("wf4") === "" ? 8 : +v("wf4"), teacherPct: isNaN(+v("wf5")) ? 100 : +v("wf5"), teacherFixed: nz("wf7") };
  S.holiday = { regular: { notWorked: +v("hp1"), worked: +v("hp2") }, special: { notWorked: +v("hp3"), worked: +v("hp4") }, teachersPaid: v("hp5") === "1", tFixed: { regNot: nz("hp6"), regWork: nz("hp7"), spNot: nz("hp8"), spWork: nz("hp9") } };
  Object.assign(S.dtr, { start: v("dt1") || "08:00", end: v("dt2") || "17:00", teacherStart: v("dt1t") || "", teacherEnd: v("dt2t") || "", lunchMin: +v("dt3"), 
    workDays: [...document.querySelectorAll(".wdc")].filter((c) => c.checked).map((c) => +c.value), restDayAsOt: v("dt6") === "1", attOt: !!document.getElementById("dt10") && document.getElementById("dt10").checked, holPunch: !!document.getElementById("dt11") && document.getElementById("dt11").checked, noInRule: v("dt7"), noOutRule: v("dt8"), halfDayAbs: Math.min(1, Math.max(0, isNaN(+v("dt9")) ? 0.5 : +v("dt9"))), daysV: 2 });
  if (!S.dtr.workDays.length) S.dtr.workDays = [1, 2, 3, 4, 5, 6];
  S.dtr.deptTimes = {}; document.querySelectorAll("[data-dd]").forEach((r) => { const n = $(".ddn", r).value.trim(), a = $(".dds", r).value, b = $(".dde", r).value; if (n && (a || b)) S.dtr.deptTimes[n.toLowerCase()] = { label: n, start: a, end: b }; });
  S.dtr.shifts = shCollect().map((s) => ({ ...s, name: shName(s) })); S.dtr.empShift = {}; document.querySelectorAll(".shw").forEach((s) => { if (s.value) S.dtr.empShift[s.dataset.id] = s.value; }); S.dtr.minV = 1;
  const gr = { staff: {}, teacher: {}, admin: {} }; document.querySelectorAll(".gri").forEach((x) => { gr[x.dataset.g][x.dataset.d] = Math.max(0, +x.value || 0); });
  S.dtr.grace = gr; S.dtr.graceStaff = gr.staff[1]; S.dtr.graceMin = gr.staff[1]; S.dtr.graceTeacher = gr.teacher[1];
  const og = {}, op = {}; document.querySelectorAll(".otg").forEach((x) => { og[x.dataset.g] = x.checked; }); document.querySelectorAll("[data-oe]").forEach((r) => { const k = $(".otw", r).value; if (k) op[r.dataset.oe] = k; });
  S.dtr.ot = { groups: og, people: op, startMin: Math.max(0, +v("ot1") || 0), blockMin: Math.max(1, +v("ot2") || 60), roundFrom: v("ot6") === "" || isNaN(+v("ot6")) ? 30 : Math.max(0, +v("ot6")), minMin: Math.max(0, +v("ot3") || 0), maxHrs: Math.max(0, +v("ot4") || 0), auto: $("#ot5").checked };
  S.dtr.late = { countFrom: "beyond", round: v("lt2"), blockMin: Math.max(1, +v("lt3") || 1), deduct: $("#lt4").checked, hourOn: !$("#lt5") || $("#lt5").value !== "0", fromStaff: $("#lt6") && v("lt6") !== "" && !isNaN(+v("lt6")) ? Math.max(0, +v("lt6")) : 30, fromTeacher: $("#lt7") && v("lt7") !== "" && !isNaN(+v("lt7")) ? Math.max(0, +v("lt7")) : 16 };
  S.dtr.hrsBlock = document.getElementById("hb1") ? Math.max(0, +v("hb1") || 0) : 30;
  S.dtr.early = { on: !document.getElementById("ea1") || document.getElementById("ea1").checked, inMin: Math.max(1, +v("ea2") || 1), outMin: Math.max(1, +v("ea3") || 1) };
  S.dtr.teacher = { lateDeduct: !document.getElementById("tl1") || document.getElementById("tl1").checked, earlyOutDeduct: !document.getElementById("tl2") || document.getElementById("tl2").checked };
  S.leaveTypes = [...document.querySelectorAll("[data-lt]")].map((r) => ({ name: $(".ln", r).value.trim(), paid: $(".lp", r).value === "1", days: +$(".ld", r).value || 0, pool: $(".lpool", r).checked })).filter((x) => x.name); S.leaveTotal = isNaN(+v("lv_tot")) || v("lv_tot") === "" ? 7 : +v("lv_tot"); S.unpaidLeave = v("lv_ded") === "1";
}

