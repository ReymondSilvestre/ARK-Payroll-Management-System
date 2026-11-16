/* ============================================================
   SETTINGS: automatic late deduction / automatic overtime switches.
   File: js/settings/auto-overtime.js
   ============================================================ */

/* ---------- Settings: automatic late deduction / automatic overtime ---------- */
const swRow = (id, on, title, sub, onTxt, offTxt) => `<label class="sw"><input type="checkbox" id="${id}" ${on ? "checked" : ""}><span class="trk"></span><span class="swt"><b>${title}</b><small>${sub}</small><em class="sws" data-on="${onTxt}" data-off="${offTxt}"></em></span></label>`;

function autoHTML(S) {
  const L = (S.dtr && S.dtr.late) || {}, O = (S.dtr && S.dtr.ot) || {};
  return `<div data-sp="auto" ${spHide("auto")}><h3>Automatic late deduction &amp; overtime</h3><p class="muted">Choose what the system does by itself when it reads the biometric DTR. You can still type over any number in the Payroll tab.</p>
  <div class="swgrid">${swRow("lt4", L.deduct !== false, "Deduct late automatically", "Late minutes from the DTR are taken off the salary of the payroll.", "ON - late is deducted from the salary.", "OFF - late is only reported, nothing is deducted.")}
  ${swRow("ot5", O.auto !== false, "Add overtime automatically", "Overtime read from the biometric (late time out, rest-day work) is added to the payroll for the people allowed to take overtime.", "ON - overtime is added by itself.", "OFF - only hours in the Overtime file are paid.")}</div>
  <p class="muted">Related settings: <a href="#" data-go="gr">Grace periods</a> &middot; <a href="#" data-go="lt">Late computation</a> &middot; <a href="#" data-go="ot">Overtime rules</a> &middot; <a href="#" data-go="otf">Overtime File page</a>. Press <b>Save settings</b> to keep the change.</p></div>`;
}

document.addEventListener("change", (ev) => { if (ev.target.closest && ev.target.closest(".sw")) swSync(); });

function swSync() { document.querySelectorAll(".sw").forEach((w) => { const c = w.querySelector("input").checked, s = w.querySelector(".sws"); if (s) { s.textContent = c ? s.dataset.on : s.dataset.off; s.className = "sws " + (c ? "on" : "off"); } }); }

