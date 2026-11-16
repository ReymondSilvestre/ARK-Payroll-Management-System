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

