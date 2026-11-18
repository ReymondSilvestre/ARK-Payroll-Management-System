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
  const list = [...names.values()].sort((a, b) => a.localeCompare(b)), isOn = (n) => (H.depts || []).some((x) => deptLike(n, x));
  const people = emps.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return `<div data-sp="sat" ${spHide("sat")}><h3>Saturday half day</h3>
  <p class="muted">Some departments only work half a day on Saturday, but the pay is still <b>one full day</b> (the monthly pay already includes it, so nothing is deducted). On those Saturdays the DTR uses the time below instead of the usual time in / out: late, early out and absent are checked against it.</p>
  <div class="swgrid">${swRow("sat_on", H.on !== false, "Saturday half day", "Employees of the departments ticked below work the Saturday hours set here.", "ON - the half-day Saturday rule is used.", "OFF - Saturday is a normal full work day for everybody.")}</div>
  <div class="form"><div><label>Saturday time in</label><input type="time" id="sat_s" value="${esc(H.start || "08:00")}"></div><div><label>Saturday time out (half day)</label><input type="time" id="sat_e" value="${esc(H.end || "12:00")}"></div>
  <div><label>Overtime starts from (lunch 12:00 - 1:00 is not counted)</label><input type="time" id="sat_o" value="${esc(H.otFrom || "13:00")}"></div>
  <div><label>Saturday overtime</label><select id="sat_m"><option value="filed">Only when allowed that day (filed in the Overtime File)</option><option value="auto" ${H.otMode === "auto" ? "selected" : ""}>Automatic from the biometric (people allowed overtime)</option></select></div></div>
  <p class="muted">Overtime on a half-day Saturday is counted only for the time worked <b>after the "Overtime starts from" time</b>. With the first choice nothing is paid unless the hours are filed for that date in the <a href="#" data-go="otf">Overtime File</a> (that is how you allow overtime for a certain Saturday). With the second choice the biometric time out is used for the people who are allowed overtime (<a href="#" data-go="ot">Overtime rules</a>).</p>
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
  S.dtr.satHalf = { on: $("#sat_on").checked, start: v("sat_s") || "08:00", end: v("sat_e") || "12:00", otFrom: v("sat_o") || "13:00", otMode: v("sat_m") === "auto" ? "auto" : "filed", depts: [...document.querySelectorAll(".satd")].filter((c) => c.checked).map((c) => c.value), people };
}
