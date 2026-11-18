/* ============================================================
   ATTENDANCE CHECK - late / absent / half-day review and the DTR pop-up.
   File: js/dtr/attendance-check.js
   ============================================================ */

/* ---------- Attendance check read from the uploaded biometrics: who is late, absent (no time in) or half day (no time out) ---------- */
/** A working day with a complete time in and time out (late is still present). */

/* ---------- Edit time in / time out by hand (DTR pop-up and "Use in payroll" DTR sheet) ----------
   Saved per employee + date in ST.dtr.edits, so uploading the biometric file again does not erase it. */
const dtrTc = (r, k) => { const v = hm(k === "in" ? r.inn : r.out); return ST.dtrEdit ? `<td><input type="time" class="ded" style="width:7.2rem" data-d="${r.d}" data-k="${k}" data-o="${v}" value="${v}"></td>` : `<td>${v}</td>`; };

const dtrRst = (r) => (ST.dtrEdit && r.edited ? ` <button type="button" class="btn sm noprint" data-er="${r.d}">Reset</button>` : "");

const dtrBar = (id) => `<span class="noprint" data-emp="${esc(id)}">${ST.dtrEdit ? `<button type="button" class="btn p" data-eb="save">Save times</button> <button type="button" class="btn" data-eb="cancel">Cancel</button> <small class="muted">Change the Time in / Time out, then Save. Empty = no punch. Press Reset on a row to go back to the biometric time.</small>` : `<button type="button" class="btn" data-eb="edit">Edit time</button>`}</span>`;

function dtrRefresh(id) { const m = !!$("#dtrmodal"); if ($("#dtv")) dtr(ST.dtrSel); if (m) openDtr(id); }

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-eb],[data-er]"); if (!b) return;
  const box = b.closest("[data-emp]") || b.closest("#dtrmodal, .dtrsheet"), id = (box && (box.dataset.emp || (box.querySelector("[data-emp]") || {}).dataset?.emp)) || ST.dtrEmp; if (!id) return;
  if (b.dataset.er) { const E = (ST.dtr.edits || {})[id]; if (E) { delete E[b.dataset.er]; if (!Object.keys(E).length) delete ST.dtr.edits[id]; } saveDtr(); toast("Back to the biometric time."); return dtrRefresh(id); }
  const k = b.dataset.eb;
  if (k === "edit") { ST.dtrEdit = true; return dtrRefresh(id); }
  if (k === "cancel") { ST.dtrEdit = false; return dtrRefresh(id); }
  if (k === "save") {
    const root = b.closest("#dtrmodal") || b.closest(".dtrsheet") || document, by = {}, tm = (v) => { if (!v) return null; const [h, m] = v.split(":").map(Number); return h * 60 + m; };
    root.querySelectorAll(".ded").forEach((x) => { const o = (by[x.dataset.d] ||= { ch: false }); o[x.dataset.k] = tm(x.value); if (x.value !== x.dataset.o) o.ch = true; });
    const bad = Object.entries(by).find(([, o]) => o.ch && o.in !== null && o.out !== null && o.out <= o.in);
    if (bad) return toast(`${bad[0]}: time out must be later than time in.`, true);
    let n = 0; const E = ((ST.dtr.edits ||= {})[id] ||= {});
    for (const [d, o] of Object.entries(by)) if (o.ch) { E[d] = { in: o.in, out: o.out }; n++; }
    if (!Object.keys(E).length) delete ST.dtr.edits[id];
    ST.dtrEdit = false; saveDtr(); toast(n ? `${n} day(s) saved.` : "No changes."); dtrRefresh(id);
  }
});

/* ---------- Attendance check: DTR of one employee in a window ---------- */
function dtrRange() { const D = ST.dtr || { days: {} }, dates = Object.keys(D.days || {}).flatMap((i) => Object.keys(D.days[i])).sort(); return { from: D.from || dates[0] || "", to: D.to || dates[dates.length - 1] || "" }; }

function closeDtr() { ST.dtrEdit = false; const m = $("#dtrmodal"); if (m) m.remove(); document.body.classList.remove("mopen"); }

function openDtr(id) {
  const e = ST.employees.find((x) => x.id === id); if (!e) return;
  const { from, to } = dtrRange(), c = dtrCalc(e, from, to); ST.dtrEmp = id; { const keep = ST.dtrEdit; closeDtr(); ST.dtrEdit = keep; }
  const dn = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" }), cls = (r) => (r.st === "absent" ? "rA" : r.st === "half" ? "rH" : r.late ? "rL" : r.leave ? "rV" : !r.wd || r.isH ? "rX" : "");
  const kp = (k, v, t) => `<div class="kp ${t || ""}"><small>${k}</small><b>${v}</b></div>`;
  const m = document.createElement("div"); m.id = "dtrmodal"; m.innerHTML = `<div class="mbox" role="dialog" aria-modal="true">
  <div class="mbar noprint"><div><b>Daily Time Record</b><small>${esc(nameOf(e))}</small></div><div class="mact">${dtrBar(id)}<button class="btn p" id="dm_pr">Print DTR</button><button class="btn" id="dm_x">Close</button></div></div>
  <div class="msheet"><div class="mhead"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}</small></div></div>
  <h2>DAILY TIME RECORD</h2><p class="mper">${from} to ${to}</p>
  <div class="mwho"><div><small>Employee</small><b>${esc(nameOf(e))}</b></div><div><small>Employee No.</small><b>${esc(e.no)}</b></div><div><small>Position</small><b>${esc(e.position || "-")}</b></div><div><small>Department</small><b>${esc(e.dept || "-")}</b></div></div>
  <div class="mkp">${kp("Days present", +(+c.present).toFixed(2))}${kp("Absent", +(+c.absent).toFixed(2), c.absent ? "bad" : "")}${kp("Late", fmtHMd(c.late), c.late ? "warn" : "")}${kp("Overtime", fmtHMd(c.otMin), c.otMin ? "ok" : "")}${kp("Hours worked", fmtHMd(c.hrsMin))}</div>
  <div class="tw"><table class="mt"><tr><th>Date</th><th>Day</th><th>Shift</th><th>Time in</th><th>Time out</th><th class="n">Hours</th><th class="n">Late</th><th class="n">Overtime</th><th>Remarks</th></tr>${c.rows.map((r) => `<tr class="${cls(r)}"><td>${r.d}</td><td>${dn(r.d)}</td><td>${esc(r.sched || "")}</td>${dtrTc(r, "in")}${dtrTc(r, "out")}<td class="n">${r.hrs ? fmtHM(Math.round(r.hrs * 60)) : ""}</td><td class="n">${fmtHM0(r.late)}</td><td class="n">${fmtHM0(r.ot)}</td><td>${esc(r.note || "")}${dtrRst(r)}</td></tr>`).join("")}<tr class="tot"><td colspan="5">Total</td><td class="n">${fmtHM(c.hrsMin)}</td><td class="n">${fmtHM(c.late)}</td><td class="n">${fmtHM(c.otMin)}</td><td>Absent: ${+(+c.absent).toFixed(2)}</td></tr></table></div>
  <div class="msg2"><div>Employee</div><div>Verified by</div></div></div></div>`;
  document.body.append(m); document.body.classList.add("mopen");
  m.onclick = (ev) => { if (ev.target === m) closeDtr(); }; $("#dm_x").onclick = closeDtr; $("#dm_pr").onclick = () => print();
}

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-adtr]"); if (b) openDtr(b.dataset.adtr); });

document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeDtr(); });

const isPresent = (r) => !!r.wd && !r.isH && !r.leave && r.inn !== null && r.out !== null && !r.st;

function attRows() {
  const C = ST._att, F = ST.attF || "all", q = (ST.attQ || "").trim().toLowerCase(), is = { late: (x) => x.r.late > 0, absent: (x) => x.r.st === "absent", half: (x) => x.r.st === "half", present: (x) => isPresent(x.r), early: (x) => x.r.early > 0 || x.r.earlyOut > 0, all: (x) => x.r.late > 0 || !!x.r.st };
  const G = ST.attG || "", kind = C.rows.filter(is[F]).filter((x) => !G || categoryOf(x.e) === G), dates = [...new Set(kind.map((x) => x.r.d))].sort().reverse(), cur = dates.includes(ST.lateDate) ? ST.lateDate : "";
  const shown = kind.filter((x) => (!cur || x.r.d === cur) && (!q || [x.e.no, nameOf(x.e), x.e.dept, x.e.position].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (a.r.d < b.r.d ? 1 : a.r.d > b.r.d ? -1 : nameOf(a.e).localeCompare(nameOf(b.e))));
  return { shown, dates, cur, is };
}

function attDraw() {
  const el = $("#att_body"); if (!el || !ST._att) return;
  const { shown, is } = attRows(), n = (f) => shown.filter(is[f]).length;
  const tag = (t, bg) => `<span style="display:inline-block;background:${bg};border-radius:10px;padding:1px 8px;font-size:.8rem;margin-right:4px">${t}</span>`;
  const st = ({ r }) => (isPresent(r) ? tag("Present", "#d4f4dd") : "") + (r.st === "absent" ? tag(`Absent (${r.why})`, "#f8d7da") : r.st === "half" ? tag(`Half day (${r.why})`, "#ffe9c7") : "") + (r.late ? tag(`Late ${fmtHM(r.late)}`, "#fff3b0") : "") + (r.early ? tag(`Early in ${fmtHM(r.early)}`, "#d6e9ff") : "") + (r.earlyOut ? tag(`Early out ${fmtHM(r.earlyOut)}`, "#e7dcff") : "");
  const dn = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" });
  el.innerHTML = `<p><b>${shown.length ? `${n("present")} present &middot; ${n("late")} late &middot; ${n("absent")} absent &middot; ${n("half")} half day &middot; ${shown.filter((x) => x.r.early > 0).length} early in &middot; ${shown.filter((x) => x.r.earlyOut > 0).length} early out` : "Nothing to report."}</b> <small class="muted">${shown.length} row(s)</small></p>`
    + (shown.length ? `<div class="tw"><table><tr><th>Date</th><th>Day</th><th>No.</th><th>Name</th><th>Department</th><th>Shift</th><th>Time in</th><th>Time out</th><th>Status</th><th class="noprint">DTR</th></tr>${shown.map((x) => `<tr><td>${x.r.d}</td><td>${dn(x.r.d)}</td><td>${esc(x.e.no)}</td><td>${esc(nameOf(x.e))}</td><td>${esc(x.e.dept || "-")}</td><td>${esc(x.r.sched || "")}</td><td>${hm(x.r.inn) || '<span class="muted">none</span>'}</td><td>${hm(x.r.out) || '<span class="muted">none</span>'}</td><td>${st(x)}</td><td class="noprint"><button type="button" class="btn sm" data-adtr="${esc(x.e.id)}">DTR</button></td></tr>`).join("")}</table></div>` : "");
}

function attendHTML(list, from, to) {
  const D = ST.settings.dtr, S0 = D.start.split(":").map(Number).reduce((h, m) => h * 60 + m), E0 = D.end.split(":").map(Number).reduce((h, m) => h * 60 + m), gs = graceFor("staff", 1), gt = graceFor("teacher", 1), gss = graceFor("staff", 6), MID = Math.round((S0 + E0) / 2), rows = [];
  list.forEach((e) => dtrCalc(e, from, to).rows.forEach((r) => { if (r.late > 0 || r.st || isPresent(r) || r.early > 0 || r.earlyOut > 0) rows.push({ e, r }); }));
  ST._att = { rows };
  const { dates, cur } = attRows(), F = ST.attF || "all";
  return `<div class="card"><h3>Attendance check</h3>
  <p class="muted">Read from the uploaded biometrics, ${from} to ${to}. Regular hours <b>${hm(S0)} to ${D.end}</b> (default; shifts per department or employee are set in Settings &rarr; Shifts; late and overtime are counted in exact minutes), staff on time until <b>${hm(S0 + gs)}</b> (Saturday <b>${hm(S0 + gss)}</b>).</p>
  <details class="noprint"><summary class="muted" style="cursor:pointer">How it is read</summary><p class="muted"><b>Late</b>: a time in after the grace period (staff ${gs} minutes Mon-Fri and ${gss} on Saturday, teachers ${gt}; exactly on the limit is on time, one second over is late), counted from the end of the grace period. <b>No punch</b> on a working day is absent. <b>No time in</b> is ${({ absent: "absent", half: "a half day", none: "not counted" })[D.noInRule || "absent"]} and <b>no time out</b> is ${({ absent: "absent", half: "a half day", none: "not counted" })[D.noOutRule || "half"]}. A single punch before ${hm(MID)} is read as a time in, after it as a time out. <b>Early in</b> is a time in before the scheduled time in and <b>early out</b> a time out before the scheduled time out (a teacher's own Time in / Time out from the Teacher Hours menu counts first); it is only reported, nothing is deducted (Settings &rarr; Auto late &amp; overtime). Approved leave, non-working days and holidays are not flagged. Change the days, hours, grace periods and these rules in Settings &rarr; Work days &amp; hours.</p></details>
  <div class="row noprint"><div><label>Show</label><select id="lf">${[["all", "Late, absent and half day"], ["present", "Present"], ["late", "Late only"], ["absent", "Absent only"], ["half", "Half day only"], ["early", "Early in / early out"]].map(([k, l]) => `<option value="${k}" ${F === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div><label>Who</label><select id="lg">${[["", "Everybody"], ["teacher", "Teachers"], ["staff", "Staff"], ["admin", "School admins"]].map(([k, l]) => `<option value="${k}" ${(ST.attG || "") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div><div><label>Date</label><select id="ld"><option value="">All dates (${dates.length})</option>${dates.map((d) => `<option value="${d}" ${d === cur ? "selected" : ""}>${d} (${new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" })})</option>`).join("")}</select></div>
  <div style="flex:1;min-width:14rem"><label>Search</label><input id="aq" type="search" placeholder="Name, employee no. or department" value="${esc(ST.attQ || "")}" style="width:100%"></div></div>
  <div id="att_body"></div></div>`;
}

