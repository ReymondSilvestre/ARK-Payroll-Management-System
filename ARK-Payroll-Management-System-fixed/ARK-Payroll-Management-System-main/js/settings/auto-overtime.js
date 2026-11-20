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

