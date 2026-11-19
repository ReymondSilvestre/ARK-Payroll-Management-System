/* ============================================================
   SETTINGS tab - the page itself and its section buttons. (The sections live in js/settings/.)
   File: js/pages/settings.js
   ============================================================ */

/* ---------- Settings ---------- */
function set() {
  const S = ST.settings, n = (id, l, v, step) => `<div><label>${l}</label><input type="number" step="${step || "any"}" id="${id}" value="${v}"></div>`, on = (id, l, v) => `<div><label>${l}</label><select id="${id}"><option value="1">On</option><option value="0" ${v === false ? "selected" : ""}>Off</option></select></div>`;
  V(`${setTabs()}<div class="card"><div data-sp="pay" ${spHide("pay")}><h3>Payroll settings</h3><div class="form">
  <div><label>Pay frequency</label><select id="s_freq"><option value="semi">Twice a month</option><option value="monthly" ${S.frequency === "monthly" ? "selected" : ""}>Monthly</option></select></div>
  ${n("s_wd", "Working days per month", S.workDays)}${n("s_hpd", "Hours per day", S.hoursPerDay)}${n("s_ot", "Overtime multiplier", S.otRate)}${on("s_pbc", "Pay by days of the cut-off (paid days x daily rate)", S.payByCutoff)}
  ${on("s_sss", "SSS", S.sss.on)}${n("s_sssEe", "SSS employee share / month (fixed)", S.sss.fixedEe)}${on("s_phic", "PhilHealth", S.phic.on)}${n("s_phicEe", "PhilHealth employee share / month", S.phic.fixedEe)}
  ${on("s_hdmf", "Pag-IBIG", S.hdmf.on)}${n("s_hdmfEe", "Pag-IBIG employee share / month", S.hdmf.fixedEe)}</div>
  </div><div data-sp="sal" ${spHide("sal")}><h3>Salary range</h3><div class="form">${n("s_mw", "Employee minimum wage (\u20B1 / day)", S.minWage.daily)}${n("s_mwa", "Admin minimum wage (\u20B1 / day)", S.minWage.admin)}${n("s_mwt", "Teacher minimum rate (\u20B1 / hour)", S.minWage.teacherHour)}</div><p class="muted">Nobody is paid below the minimum of their group: Staff and Admins per day, Teachers per hour.</p></div>${taxHTML(S)}${holHTML(S)}${satHTML(S)}<div data-sp="sig" ${spHide("sig")}><h3>Signatories printed on payslips</h3><div class="form">${[0, 1].map((i) => { const g = S.signatories[i] || { label: "", name: "", position: "" }; return `<div><label>Label</label><input id="g${i}l" value="${esc(g.label)}"></div><div><label>Name</label><input id="g${i}n" value="${esc(g.name)}"></div><div><label>Position</label><input id="g${i}p" value="${esc(g.position)}"></div>`; }).join("")}</div>
  </div><p><button class="btn p" id="ss">Save settings</button></p></div>`);
  setExtras(); taxInit(); $("#ss").onclick = async () => { collectExtras(); taxCollect(); satCollect();
    const v = (id) => $("#" + id).value, b = (id) => v(id) === "1";
    Object.assign(S, { frequency: v("s_freq"), workDays: +v("s_wd"), hoursPerDay: +v("s_hpd"), otRate: +v("s_ot") });
    S.payByCutoff = b("s_pbc"); S.minWage.daily = +v("s_mw"); S.minWage.admin = +v("s_mwa"); S.minWage.teacherHour = +v("s_mwt"); S.sss.on = b("s_sss"); S.sss.fixedEe = +v("s_sssEe"); S.phic.on = b("s_phic"); S.phic.fixedEe = +v("s_phicEe"); S.hdmf.on = b("s_hdmf"); S.hdmf.fixedEe = +v("s_hdmfEe"); 
    S.signatories = [0, 1].map((i) => ({ label: v(`g${i}l`), name: v(`g${i}n`), position: v(`g${i}p`) })).filter((g) => g.label);
    await api("saveSettings", S); toast("Settings saved.");
  };
}

/* ---------- Settings page: one section at a time ---------- */
const SET_VIEWS = [["pay", "Payroll settings"], ["sal", "Salary range"], ["tax", "TIN / Tax computation (PH)"], ["hol", "Holidays"], ["wfh", "WFH / Asynchronous class"], ["hp", "Holiday pay (% of the daily rate)"], ["dtr", "Work days & hours (DTR)"], ["sat", "Saturday half day"], ["sh", "Shifts (per department / employee)"], ["gr", "Grace periods"], ["auto", "Auto late & overtime"], ["ot", "Overtime"], ["lt", "Late computation"], ["lv", "Leave types"], ["sig", "Signatories printed on payslips"]];

const setTabs = () => `<div class="chips noprint" id="svs">${SET_VIEWS.map(([k, l]) => `<button data-sv="${k}" class="${(ST.setView || "pay") === k ? "on" : ""}">${l}</button>`).join("")}</div>`;

const spHide = (k) => ((ST.setView || "pay") === k ? "" : "hidden");

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-sv]"); if (!b) return; ST.setView = b.dataset.sv; document.querySelectorAll("#svs [data-sv]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-sp]").forEach((p) => p.hidden = p.dataset.sp !== ST.setView); });

