/* ============================================================
   LEAVE tab - leave with pay / without pay.
   File: js/pages/leave.js
   ============================================================ */

/* ---------- Leave (with pay / without pay) + grace period per group ---------- */
const LEAVE_DEFAULT = [
  { name: "Personal Leave", paid: true, days: 0, pool: true }, { name: "Birthday Leave", paid: true, days: 0, pool: true }, { name: "Emergency Leave", paid: true, days: 0, pool: true }, { name: "Sick Leave", paid: true, days: 0, pool: true },
  { name: "Maternity Leave", paid: true, days: 105 }, { name: "Paternity Leave", paid: true, days: 7 }, { name: "Leave Without Pay", paid: false, days: 0 },
];

   // Personal + Birthday + Emergency + Sick share ONE total of 7 days a year (Settings > Leave types)
const OLD_LEAVE_NAMES = "Vacation Leave|Sick Leave|Emergency Leave|Service Incentive Leave|Maternity Leave|Paternity Leave|Solo Parent Leave|Leave without Pay";

const leaveTypes = (S) => { const L = S && S.leaveTypes; return Array.isArray(L) && L.length && L.map((t) => t.name).join("|") !== OLD_LEAVE_NAMES ? L : LEAVE_DEFAULT; };

   // the old built-in list is replaced by the new default
const leaveTotal = (S) => (S && S.leaveTotal !== undefined && S.leaveTotal !== null && S.leaveTotal !== "" && !isNaN(+S.leaveTotal) ? +S.leaveTotal : 7);

const lvRow = (t) => `<tr data-lt><td><input class="ln" value="${esc(t.name || "")}"></td><td><select class="lp"><option value="1">With pay</option><option value="0" ${t.paid === false ? "selected" : ""}>Without pay</option></select></td><td><input type="number" min="0" step="any" class="ld" value="${+t.days || 0}"></td><td style="text-align:center"><input type="checkbox" class="lpool" ${t.pool ? "checked" : ""}></td><td><button class="btn sm d" data-lx>Remove</button></td></tr>`;

/** Working days (not rest days, not holidays) from..to: the days a leave really covers. */
function lvDates(S, from, to) {
  const hol = (S.dtr.holidays || []).map((h) => h.date), wk = S.dtr.workDays || [1, 2, 3, 4, 5], o = [];
  for (let d = from, n = 0; d && to && d <= to && n < 400; d = addDay(d), n++) if (wk.includes(new Date(d + "T12:00").getDay()) && !hol.includes(d)) o.push(d);
  return o;
}

const lvOf = (e) => (ST.leaves || []).filter((x) => x.status === "Approved" && x.empId === e.id);

const lvOn = (e, d) => lvOf(e).find((x) => x.from <= d && d <= x.to) || null;

/** Approved leave days inside a pay period, split into with pay / without pay. */
function lvInPeriod(e, a, b) {
  const o = { paid: 0, unpaid: 0 };
  lvOf(e).forEach((x) => { const n = lvDates(ST.settings, x.from > a ? x.from : a, x.to < b ? x.to : b).length; if (x.paid) o.paid += n; else o.unpaid += n; });
  return o;
}

function leave() {
  const S = ST.settings, emps = activeEmps().slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b))), today = ymd(new Date()), yr = String(new Date().getFullYear());
  const F = ST.leaveF || (ST.leaveF = { st: "all", q: "" }), ed = (ST.leaves || []).find((x) => x.id === ST.leaveEdit) || null;
  let T = leaveTypes(S); if (ed && !T.some((t) => t.name === ed.type)) T = [...T, { name: ed.type, paid: ed.paid, days: 0 }];
  const tOf = (n) => T.find((t) => t.name === n) || { name: n, paid: false, days: 0 };
  const capOf = (t) => (t.pool ? leaveTotal(S) : +t.days || 0), poolNames = T.filter((t) => t.pool).map((t) => t.name);
  const used = (empId, type, y, skip) => { const names = tOf(type).pool ? poolNames : [type]; return (ST.leaves || []).filter((x) => x.empId === empId && names.includes(x.type) && x.status !== "Rejected" && x.from.slice(0, 4) === String(y) && x.id !== skip).reduce((n, x) => n + (+x.days || 0), 0); };
  const mine = (ST.leaves || []).filter((x) => x.status === "Approved" && x.from.slice(0, 4) === yr), sum = (p) => mine.filter((x) => !!x.paid === p).reduce((n, x) => n + (+x.days || 0), 0), pend = (ST.leaves || []).filter((x) => x.status === "Pending").length;
  V(`<div class="card noprint"><h3>${ed ? "Edit leave" : "File a leave"}</h3><div class="form">
    <div><label>Employee</label><select id="lv_e"><option value="">Choose employee...</option>${emps.map((e) => `<option value="${e.id}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
    <div><label>Leave type</label><select id="lv_t">${T.map((t) => `<option value="${esc(t.name)}">${esc(t.name)} (${t.paid ? "with pay" : "without pay"}${t.pool ? ", shared total " + leaveTotal(S) + " days" : t.days > 0 ? ", " + t.days + " days a year" : ""})</option>`).join("")}</select></div>
    <div><label>From</label><input type="date" id="lv_f"></div><div><label>To</label><input type="date" id="lv_to"></div>
    <div><label>Status</label><select id="lv_s"><option>Approved</option><option>Pending</option><option>Rejected</option></select></div>
    <div><label>Reason / remarks</label><input id="lv_r"></div></div>
    <p class="muted" id="lv_i"></p>
    <p><button class="btn p" id="lv_save">Save leave</button> <button class="btn" id="lv_cancel" ${ed ? "" : "hidden"}>Cancel edit</button></p></div>
  <div class="card"><h3>Leave records</h3><p class="muted">${yr}: <b>${sum(true)}</b> day(s) approved with pay, <b>${sum(false)}</b> day(s) approved without pay, <b>${pend}</b> waiting for approval. Only <b>Approved</b> leave counts in the DTR and the payroll: leave with pay is not deducted, leave without pay is deducted from the salary${S.unpaidLeave === false ? " (automatic deduction is turned off in Settings &rarr; Leave types)" : ""}.</p>
  <div class="row noprint"><div><label>Status</label><select id="lv_fs">${["all", "Pending", "Approved", "Rejected"].map((k) => `<option value="${k}" ${F.st === k ? "selected" : ""}>${k === "all" ? "All" : k}</option>`).join("")}</select></div><div><label>Search</label><input id="lv_fq" placeholder="Name, number or leave type" value="${esc(F.q)}"></div></div>
  <div class="tw"><table><tr><th>No.</th><th>Employee</th><th>Leave type</th><th>Pay</th><th>Dates</th><th class="n">Days</th><th>Status</th><th>Remarks</th><th class="noprint"></th></tr><tbody id="lv_tb"></tbody></table></div></div>`);

  const info = () => {
    const id = $("#lv_e").value, f = $("#lv_f").value, to = $("#lv_to").value || f, t = tOf($("#lv_t").value), emp = ST.employees.find((x) => x.id === id);
    if (!f) return ($("#lv_i").textContent = "Pick the dates. Only working days are counted (rest days and holidays are skipped).");
    const n = lvDates(S, f, to).length; let m = `${n} working day(s), ${t.paid ? "with pay: no salary deduction." : "without pay: deducted from the salary."}`;
    if (id && capOf(t) > 0) { const u = used(id, t.name, f.slice(0, 4), ed && ed.id), cap = capOf(t); m += t.pool ? ` Personal, Birthday, Emergency and Sick leave share ${cap} day(s) a year: ${u} used in ${f.slice(0, 4)}, ${Math.max(0, cap - u - n)} left after this.` : ` ${t.name}: ${u} of ${cap} day(s) used in ${f.slice(0, 4)}, ${Math.max(0, cap - u - n)} left after this.`; }
    if (emp && isHourly(emp)) m += " Teachers are paid by the hours taught, so for a teacher this is recorded only.";
    $("#lv_i").textContent = m;
  };
  ["lv_e", "lv_t", "lv_f", "lv_to"].forEach((k) => $("#" + k).onchange = info);
  if (ed) { $("#lv_e").value = ed.empId; $("#lv_t").value = ed.type; $("#lv_f").value = ed.from; $("#lv_to").value = ed.to; $("#lv_s").value = ed.status; $("#lv_r").value = ed.reason || ""; }
  info();
  $("#lv_cancel").onclick = () => { ST.leaveEdit = null; leave(); };

  $("#lv_save").onclick = async () => {
    const id = $("#lv_e").value, emp = ST.employees.find((x) => x.id === id), t = tOf($("#lv_t").value), f = $("#lv_f").value, to = $("#lv_to").value || f, st = $("#lv_s").value;
    if (!emp) return toast("Choose the employee.", true);
    if (!f) return toast("Choose the first day of the leave.", true);
    if (to < f) return toast("The last day is before the first day.", true);
    const days = lvDates(S, f, to).length; if (!days) return toast("That range has no working day (rest days and holidays are not counted).", true);
    const clash = (ST.leaves || []).find((x) => x.empId === id && x.status !== "Rejected" && st !== "Rejected" && x.id !== (ed && ed.id) && x.from <= to && f <= x.to);
    if (clash) return toast(`${nameOf(emp)} already has ${clash.type} from ${clash.from} to ${clash.to}.`, true);
    if (capOf(t) > 0 && st !== "Rejected") { const u = used(id, t.name, f.slice(0, 4), ed && ed.id), cap = capOf(t); if (u + days > cap && !confirm(`${t.pool ? "Personal, Birthday, Emergency and Sick leave together allow" : t.name + " allows"} ${cap} day(s) a year; this makes ${u + days}. Save anyway?`)) return; }
    const rec = { id: ed ? ed.id : "", empId: id, no: emp.no || "", name: nameOf(emp), type: t.name, paid: !!t.paid, from: f, to, days, reason: $("#lv_r").value.trim(), status: st };
    const saved = await api("saveLeave", rec), L = ST.leaves || (ST.leaves = []), i = L.findIndex((x) => x.id === saved.id);
    if (i >= 0) L[i] = saved; else L.push(saved);
    ST.leaveEdit = null; toast("Leave saved."); leave();
  };

  const rowsOf = () => (ST.leaves || []).filter((x) => (F.st === "all" || x.status === F.st) && (!F.q || `${x.name} ${x.no} ${x.type}`.toLowerCase().includes(F.q.toLowerCase()))).sort((a, b) => (a.from < b.from ? 1 : -1));
  const draw = () => {
    const L = rowsOf();
    $("#lv_tb").innerHTML = L.length ? L.map((x) => `<tr><td>${esc(x.no)}</td><td>${esc(x.name)}</td><td>${esc(x.type)}</td><td>${x.paid ? "With pay" : "Without pay"}</td><td>${esc(x.from)}${x.to !== x.from ? " to " + esc(x.to) : ""}</td><td class="n">${x.days}</td><td><b>${esc(x.status)}</b></td><td>${esc(x.reason || "")}</td><td class="noprint">${x.status === "Pending" ? `<button class="btn sm" data-la="ok" data-id="${x.id}">Approve</button> <button class="btn sm d" data-la="no" data-id="${x.id}">Reject</button> ` : ""}<button class="btn sm" data-la="ed" data-id="${x.id}">Edit</button> <button class="btn sm d" data-la="del" data-id="${x.id}">Delete</button></td></tr>`).join("") : `<tr><td colspan="9" class="muted">No leave records yet.</td></tr>`;
  };
  draw();
  $("#lv_fs").onchange = () => { F.st = $("#lv_fs").value; draw(); };
  $("#lv_fq").oninput = () => { F.q = $("#lv_fq").value; draw(); };
  $("#lv_tb").onclick = async (ev) => {
    const b = ev.target.closest("[data-la]"); if (!b) return; const x = (ST.leaves || []).find((r) => r.id === b.dataset.id); if (!x) return;
    if (b.dataset.la === "ed") { ST.leaveEdit = x.id; leave(); scrollTo(0, 0); }
    else if (b.dataset.la === "del") { if (!confirm("Delete this leave record?")) return; await api("deleteLeave", { id: x.id }); ST.leaves = ST.leaves.filter((r) => r.id !== x.id); if (ST.leaveEdit === x.id) ST.leaveEdit = null; toast("Leave deleted."); leave(); }
    else { const saved = await api("saveLeave", { ...x, status: b.dataset.la === "ok" ? "Approved" : "Rejected" }); ST.leaves[ST.leaves.findIndex((r) => r.id === x.id)] = saved; toast(`Leave ${saved.status.toLowerCase()}.`); leave(); }
  };
}

