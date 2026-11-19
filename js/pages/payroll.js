/* ============================================================
   PAYROLL tab - Admins | Staff | Teachers payroll run.
   File: js/pages/payroll.js
   ============================================================ */

/* ---------- Payroll run ---------- */
const activeEmps = () => ST.employees.filter((e) => (e.status || "Active") === "Active");

/* ---------- Payroll: Admins | Staff (per department) | Teachers (Faculty) ---------- */
const SECS = [["admin", "Admins", "School admins"], ["staff", "Staff", "Employees per department"], ["teacher", "Teachers", "Faculty, paid per hour"]];

function run() {
  ST._dm = null;
  const S = ST.settings, showLate = (S.dtr.late || {}).deduct !== false, now = new Date(), m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, R = ST.run || { month: m, cut: S.cutoffPair === "A" ? "c11_25" : "c1_15", inp: {}, sec: "staff", dept: "" };
  ST.run = R; R.sec ||= "staff"; R.dept ||= "";
  const per = () => cutoffPeriod(R.month, R.cut);
  /* Teachers: hours come from the CLASS CHECK (acts as the teacher's biometric). Load it for this cut-off first. */
  const clsOn = clsBioOn(S), ckey = per().start + "|" + per().end;
  if (R.sec === "teacher" && clsOn && (!ST.clsPay || ST.clsPay.key !== ckey)) {
    V('<div class="card muted">Loading the class check of this cut-off...</div>');
    api("clsReport", { from: per().start, to: per().end }).then((r) => { ST.clsPay = { key: ckey, classes: r.classes || [], att: r.att || [] }; run(); }).catch(() => { ST.clsPay = { key: ckey, classes: [], att: [], failed: true }; run(); });
    return;
  }
  const eff = (e) => {
    const p = per(), i = { ...(R.inp[e.id] || {}) }, dt = (phEnsure(+p.start.slice(0, 4)), phEnsure(+p.end.slice(0, 4)), daysOf(e)) ? dtrCalc(e, p.start, p.end) : null, fill = (k, v) => { if (i[k] === undefined || i[k] === "") i[k] = v; };
    const cl = R.sec === "teacher" || isHourly(e) ? (clsOn && ST.clsPay && ST.clsPay.key === ckey ? clsHoursOf(e, p.start, p.end, ST.clsPay.classes, ST.clsPay.att) : null) : null, typed = (k) => { const v = (R.inp[e.id] || {})[k]; return v !== undefined && v !== ""; };
    if (dt) { fill("absentDays", dt.absent); fill("lateMin", lateOn(e) ? dt.late : 0); fill("otHours", dt.ot); if (!(cl && cl.has)) fill("hoursWorked", Math.round(dt.hrsMin / 60 * 10000) / 10000); i.dtr = { present: dt.present }; i.presentDates = dt.presentDates;
      i.absentList = typed("absentDays") ? null : dt.rows.filter((r) => r.st === "absent" || r.st === "half").map((r) => ({ d: r.d, why: r.st === "half" ? "half day" : r.why || "absent" }));
      if (!(R.sec === "teacher" || isHourly(e))) { i.halfList = dt.rows.filter((r) => r.st === "half").map((r) => ({ d: r.d, why: r.why || "half day" })); i.underList = dt.rows.filter((r) => r.earlyOut > 0).map((r) => ({ d: r.d, min: r.earlyOut, out: r.out })); }   // shown on the payslip of employees: half days and undertime (early time out)
      i.lateDays = dt.rows.filter((r) => r.late > 0).length; i.lateList = typed("lateMin") ? null : dt.rows.filter((r) => r.late > 0).map((r) => ({ d: r.d, min: r.late, act: r.lateRaw })); }
    if (cl && cl.has) { fill("hoursWorked", Math.round(cl.mins / 60 * 10000) / 10000); i.presentDates = [...new Set([...(i.presentDates || []), ...cl.presentDates])].sort(); i.dtr = { present: cl.presentDates.length }; i.classInfo = { lateOn: cl.lateOn, earlyOutOn: cl.earlyOutOn, schedMin: cl.schedMin, mins: cl.mins, lateMin: cl.lateMin, lateDedMin: cl.lateDedMin, lateList: cl.lateList, earlyInMin: cl.earlyInMin, earlyInList: cl.earlyInList, earlyOutMin: cl.earlyOutMin, earlyOutList: cl.earlyOutList, absent: cl.absent, noRecord: cl.noRecord, noOut: cl.noOut, classes: cl.held }; }
    const lv = lvInPeriod(e, p.start, p.end); i.leavePaid = lv.paid; i.leaveList = lvOf(e).filter((x) => !x.paid && x.from <= p.end && x.to >= p.start).map((x) => ({ type: x.type, from: x.from > p.start ? x.from : p.start, to: x.to < p.end ? x.to : p.end })); if (S.unpaidLeave !== false && !isHourly(e)) i.leaveDays = lv.unpaid;
    i.hol = (S.dtr.holidays || []).filter((h) => h.date >= p.start && h.date <= p.end && (S.dtr.workDays || [1, 2, 3, 4, 5]).includes(new Date(h.date + "T12:00").getDay())).map((h) => { const r = dt && dt.rows.find((x) => x.d === h.date); return { date: h.date, label: h.label, type: h.type, worked: !!(r && r.inn !== null), hours: r ? r.hrs : 0, sched: tHrs(e, new Date(h.date + "T12:00").getDay()) }; });
    const holD = (S.dtr.holidays || []).map((h) => h.date);
    i.wfh = (S.dtr.wfhDays || []).filter((w) => w.date >= p.start && w.date <= p.end && !holD.includes(w.date) && (S.dtr.workDays || [1, 2, 3, 4, 5]).includes(new Date(w.date + "T12:00").getDay())).map((w) => { const r = dt && dt.rows.find((x) => x.d === w.date); return { date: w.date, label: w.label, type: w.type, hours: (w.hours !== null && w.hours !== undefined && w.hours !== "") ? w.hours : (tHrs(e, new Date(w.date + "T12:00").getDay()) ?? w.hours), worked: !!(r && r.inn !== null) }; });
    return i;
  };
  const calc = (e) => computeSlip(e, eff(e), S, per()), all = activeEmps(), inSec = (e) => categoryOf(e) === R.sec;
  const depts = [...new Set(all.filter((e) => categoryOf(e) === "staff").map((e) => e.dept || "No department"))].sort();
  if (R.sec === "staff" && R.dept && !depts.includes(R.dept)) R.dept = "";
  R.sort ||= "az";   // Sort filter: Name A - Z (default), Name Z - A, Employee no.
  const byNo = (a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }), rows = all.filter((e) => inSec(e) && (R.sec !== "staff" || !R.dept || (e.dept || "No department") === R.dept)).sort((a, b) => R.sort === "no" ? byNo(a, b) : R.sort === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
  const exRun = (ST.runs || []).find((x) => x.period === per().label && x.group === R.sec), isFin = !!exRun && exRun.status !== "Draft", isDraft = !!exRun && exRun.status === "Draft";
  const when = (k, l) => `<div><label>${l}</label><select data-w="${k}"><option value="split">Split in both cut-offs</option><option value="first" ${S[k].when === "first" ? "selected" : ""}>1st cut-off</option><option value="second" ${S[k].when === "second" ? "selected" : ""}>2nd cut-off</option></select></div>`;
  const head = `<div class="card noprint"><div class="row"><div><label>Month</label><input type="month" id="rm" value="${R.month}"></div><div><label>Cut-off</label><select id="rc">${CUTOFFS.map((c) => `<option value="${c.key}" ${R.cut === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="pd" value="${R.payDate || payDateOf(R.month, per().half, S.period)}"></div><button class="btn" id="sd" ${isFin ? "disabled" : ""}>Save as draft</button><button class="btn p" id="sr" ${isFin ? "disabled" : ""}>Finalize</button></div>
  ${isFin ? `<p class="muted" style="color:#1a7f37"><b>&#10004; This payroll is FINALIZED and locked.</b> To redo it, delete the run under Payslips first.</p>` : isDraft ? `<p class="muted" style="color:#8a5a00"><b>A DRAFT of this payroll is saved.</b> <button class="btn sm" id="ldd">Load saved draft</button> Drafts are not final: balances are not reduced and they are left out of reports and 13th month pay until you press Finalize.</p>` : `<p class="muted"><b>Save as draft</b> keeps your work so you can come back and change it. <b>Finalize</b> locks the payroll, reduces cash advance / loan balances and counts it in reports and 13th month pay.</p>`}
  <p class="muted">Period: <b>${per().label}</b>. Admins, Staff and Teachers are each saved as their own payroll run.${S.dtr.holidays.some((h) => h.date >= per().start && h.date <= per().end) ? " Holidays in this period are added automatically." : ""}${(S.dtr.wfhDays || []).some((h) => h.date >= per().start && h.date <= per().end) ? " WFH / asynchronous class days in this period are paid automatically." : ""}</p>
  <div class="row benefits"><b>Government benefits are deducted on:</b>${when("sss", "SSS")}${when("phic", "PhilHealth")}${when("hdmf", "Pag-IBIG")}</div></div>
  <div class="seg noprint">${SECS.map(([k, l, s]) => `<button class="${R.sec === k ? "on" : ""}" data-s="${k}"><b>${l}</b><small>${all.filter((e) => categoryOf(e) === k).length} employees &middot; ${s}</small></button>`).join("")}</div>
  <div class="row noprint" style="margin:.4rem 0"><div><label>Sort names</label><select id="rsort"><option value="az" ${R.sort === "az" ? "selected" : ""}>Name A - Z</option><option value="za" ${R.sort === "za" ? "selected" : ""}>Name Z - A</option><option value="no" ${R.sort === "no" ? "selected" : ""}>Employee no.</option></select></div></div>
  ${R.sec === "staff" ? `<div class="chips noprint"><button class="${R.dept ? "" : "on"}" data-d="">All departments</button>${depts.map((d) => `<button class="${R.dept === d ? "on" : ""}" data-d="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}`;
  const showOt = (S.dtr.ot || {}).auto !== false || (S.otFile || []).some((x) => x.date >= per().start && x.date <= per().end), hr = R.sec === "teacher", f = (e, k, off) => { const v = (R.inp[e.id] || {})[k] ?? (off ? "" : eff(e)[k] ?? ""), mm = k === "lateMin" ? +v : k === "otHours" || k === "hoursWorked" ? Math.round(+v * 60) : 0; const shown = (k === "hoursWorked" || k === "otHours") && v !== "" && !isNaN(+v) ? fmtHMc(Math.round(+v * 60)) : v, ci = k === "hoursWorked" ? calc(e).classInfo : null; return `<td><input class="in" data-id="${e.id}" data-k="${k}" value="${shown}" ${k === "hoursWorked" || k === "otHours" ? 'placeholder="H:MM" title="Hours:Minutes, e.g. 2:00" ' : ""}${off ? "disabled" : ""}>${mm > 0 && k !== "hoursWorked" && k !== "otHours" ? `<br><small class="muted">${fmtHM(mm)}</small>` : ""}${ci ? `<br><small class="muted" title="From the class check">Class check: ${fmtHMc(ci.mins)} of ${fmtHMc(ci.schedMin)} scheduled${ci.absent ? ` &middot; <b style="color:#b3121f">${ci.absent} absent</b>` : ""}${ci.noRecord ? ` &middot; <b style="color:#b45309">${ci.noRecord} not checked</b>` : ""}${ci.noOut ? ` &middot; ${ci.noOut} no clock-out` : ""}</small>` : ""}</td>`; };
  /* Teachers: late deduction shown beside Hours taught. Same figure as the Late line on the payslip: the late hours already taken out of Hours taught (class check, counted per whole hour after the grace period), or the late minutes of the DTR when the teacher has no class schedule. */
  const lateDedCell = (c) => { const ci = c.classInfo; let lm = 0, real = 0; if (ci && ci.lateOn !== false && (+(ci.lateDedMin ?? ci.lateMin) || 0) > 0) { lm = +(ci.lateDedMin ?? ci.lateMin) || 0; real = +ci.lateMin || 0; } else if (c.lateMin > 0) { lm = +c.lateMin || 0; real = lm; } return `<td class="n">${lm > 0 ? `<b>${fmtHMc(lm)}</b><br><small class="muted" title="Late deduction = late hours x hourly rate">${money(lm / 60 * c.rate)}${ci && ci.lateList && ci.lateList.length ? ` &middot; ${ci.lateList.length} late day${ci.lateList.length === 1 ? "" : "s"}` : ""}${real && real !== lm ? ` &middot; ${fmtHMc(real)} late after grace` : ""}</small>` : '<span class="muted">-</span>'}</td>`; };
  const body = rows.map((e) => { const c = calc(e); return `<tr><td>${esc(e.no)}</td><td>${esc(nameOf(e))}<br><small class="muted">${esc(e.position)}${e.dept ? " &middot; " + esc(e.dept) : ""}</small></td>${hr ? f(e, "hoursWorked") + lateDedCell(c) : f(e, "absentDays") + (showLate ? f(e, "lateMin") + `<td class="n">${eff(e).lateDays || 0}</td>` : "")}${showOt ? f(e, "otHours") : ""}${f(e, "otherEarn")}${f(e, "otherDed")}<td><input class="in" data-id="${e.id}" data-k="otherDedNote" value="${esc((R.inp[e.id] || {}).otherDedNote || "")}" placeholder="Reason of other deduction" style="min-width:11rem"></td><td class="n"><input class="in" data-id="${e.id}" data-k="caDed" value="${c.caDed}" title="Cash advance deducted this pay (balance ${money(c.caBal)})">${c.caBal > 0 ? `<br><small class="muted">Balance ${money(c.caBal)}</small>` : ""}</td><td class="n">${money(c.holPay + (c.wfhPay || 0))}</td><td class="n">${money(c.gross)}</td><td class="n">${money(c.sssEe + c.phicEe + c.hdmfEe)}</td><td class="n">${money(c.tax)}</td><td class="n">${money(c.totalDed)}</td><td class="n"><b>${money(c.net)}</b></td></tr>`; }).join("");
  const tot = (k) => money(rows.reduce((n, e) => n + calc(e)[k], 0));
  V(head + `<div class="card"><div class="tw"><table><tr><th>No.</th><th>Employee</th>${hr ? "<th>Hours taught</th><th class=\"n\">Late hours deducted</th>" : "<th>Absent days</th>" + (showLate ? "<th>Late min</th><th class=\"n\">Late days</th>" : "")}${showOt ? "<th>OT hours (H:MM)</th>" : ""}<th>Other earn</th><th>Other ded</th><th>Reason (other ded)</th><th class="n">Cash advance</th><th class="n">Holiday / WFH pay</th><th class="n">Gross</th><th class="n">SSS+PHIC+HDMF</th><th class="n">Tax</th><th class="n">Total ded</th><th class="n">Net pay</th></tr>${body || `<tr><td colspan="${2 + (hr ? 2 : 1 + (showLate ? 2 : 0)) + (showOt ? 1 : 0) + 10}" class="muted">No active ${R.sec === "admin" ? "admins" : R.sec === "teacher" ? "teachers" : "staff"} here. Set the payroll group of an employee under Employees.</td></tr>`}
  ${rows.length ? `<tr class="tot"><td colspan="${2 + (hr ? 2 : 1 + (showLate ? 2 : 0)) + (showOt ? 1 : 0) + 3}">Total (${rows.length})</td><td class="n">${tot("caDed")}</td><td class="n">${money(rows.reduce((n, e) => { const c = calc(e); return n + c.holPay + (c.wfhPay || 0); }, 0))}</td><td class="n">${tot("gross")}</td><td class="n">${money(rows.reduce((n, e) => { const c = calc(e); return n + c.sssEe + c.phicEe + c.hdmfEe; }, 0))}</td><td class="n">${tot("tax")}</td><td class="n">${tot("totalDed")}</td><td class="n">${tot("net")}</td></tr>` : ""}</table></div></div>`);
  $("#rm").onchange = (e) => { R.month = e.target.value; R.payDate = ""; run(); }; $("#rc").onchange = (e) => { R.cut = e.target.value; R.payDate = ""; run(); }; $("#pd").onchange = (e) => R.payDate = e.target.value;
  $("#rsort").onchange = (e) => { R.sort = e.target.value; run(); };
  document.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { R.sec = b.dataset.s; run(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { R.dept = b.dataset.d; run(); });
  document.querySelectorAll("[data-w]").forEach((b) => b.onchange = async () => { S[b.dataset.w].when = b.value; await api("saveSettings", S); toast("Deduction cut-off saved."); run(); });
  document.querySelectorAll("input.in").forEach((el) => el.onchange = () => { let v = el.value; if (el.dataset.k === "hoursWorked" || el.dataset.k === "otHours") { v = hmParse(v); if (v === null) { toast("Type the hours as Hours:Minutes, e.g. 8:30.", true); return run(); } } (R.inp[el.dataset.id] ||= {})[el.dataset.k] = v; run(); });
  if (R.sec === "teacher" && clsOn) { const b = document.createElement("p"); b.className = "muted noprint"; b.innerHTML = `Teachers' hours are counted from the <b>Class check</b> (it works as the teacher's biometric). A teacher with no class in the Class schedule uses the DTR hours instead. Typing a time in the Hours taught box overrides it. <button class="btn sm" id="clsrf">Reload class check</button>`; const tw = document.querySelector(".tw"); if (tw && tw.parentElement) tw.parentElement.appendChild(b); $("#clsrf").onclick = () => { ST.clsPay = null; run(); }; }
  const save = async (status) => {
    const sec = R.sec, secL = (SECS.find((x) => x[0] === sec) || [])[1], L = all.filter(inSec), slips = L.map((e) => ({ no: e.no, name: nameOf(e), position: e.position, calc: { ...calc(e), _inp: R.inp[e.id] || {} } })), sum = (k) => slips.reduce((n, x) => n + x.calc[k], 0);
    if (!slips.length) return toast(`No active ${secL.toLowerCase()}.`, true);
    const ex = (ST.runs || []).find((x) => x.period === per().label && x.group === sec);
    if (ex && ex.status !== "Draft") return toast("This payroll is already finalized and locked. Delete it under Payslips if you must redo it.", true);
    const noWhy = L.filter((e) => +((R.inp[e.id] || {}).otherDed) > 0 && !String((R.inp[e.id] || {}).otherDedNote || "").trim());
    if (status === "Finalized" && noWhy.length && !confirm(`${noWhy.length} employee(s) have an "Other deduction" without a reason:\n${noWhy.slice(0, 8).map((e) => "- " + nameOf(e)).join("\n")}\n\nThe payslip will say "reason not stated". Finalize anyway?`)) return;
    if (status === "Finalized" && !confirm(`Finalize the ${secL} payroll for ${per().label}?\n\nIt will be locked, cash advance and loan balances will be reduced, and it will be counted in reports and 13th month pay.`)) return;
    const rid = (R.ids && R.ids[sec]) || (ex && ex.id) || "";
    const r = await api("saveRun", { id: rid, group: sec, period: per().label, payDate: $("#pd").value, slips, gross: r2(sum("gross")), ded: r2(sum("totalDed")), net: r2(sum("net")), status });
    (R.ids ||= {})[sec] = r.id;
    if (status === "Finalized") {   // only a finalized payroll lowers the cash advance and loan balances (a draft never does)
      const upd = []; L.forEach((e, i) => { const c = slips[i].calc; let ch = false; if (c.caDed > 0) { e.ca = { ...(e.ca || {}), balance: c.caAfter }; ch = true; } (c.dedList || []).forEach((d) => { const x = (e.deductions || []).find((y) => y.id === d.id); if (x && d.balanceAfter !== null && d.amount > 0) { x.balance = d.balanceAfter; ch = true; } }); if (ch) upd.push(e); }); if (upd.length) await api("saveEmployees", { list: upd });
    }
    ST.runs = r.runs || (await api("listRuns"));
    if (status === "Draft") { toast(`${secL} payroll saved as DRAFT. You can keep editing it and finalize later.`); run(); }
    else { ST.run = null; ST.tab = "slips"; ST.slipRun = r.id; toast(`${secL} payroll FINALIZED and saved to the spreadsheet.`); shell(); }
  };
  $("#sd").onclick = () => save("Draft"); $("#sr").onclick = () => save("Finalized");
  if ($("#ldd")) $("#ldd").onclick = async () => {
    const L = await api("getRun", { id: exRun.id }); R.inp = {};
    L.forEach((s) => { const e = all.find((x) => String(x.no) === String(s.no)); if (e && s.calc && s.calc._inp) R.inp[e.id] = { ...s.calc._inp }; });
    R.payDate = String(exRun.payDate || "").slice(0, 10); (R.ids ||= {})[R.sec] = exRun.id; toast("Draft loaded."); run();
  };
}

