/* ============================================================
   LAYOUT - toast messages, tabs (menu), sidebar, shell(), logo.
   File: js/app/layout.js
   ============================================================ */

const TABS = [["dash", "Dashboard"], ["emp", "Employees"], ["run", "Payroll"], ["slips", "Payslips"], ["m13", "13th Month Pay"], ["loans", "Cash Loan"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]];

const V = (h) => ($("#v").innerHTML = h);

function toast(t, err) { const m = document.createElement("div"); m.className = "msg" + (err ? " err" : ""); m.innerHTML = (err ? '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.01"/></svg>' : '<svg viewBox="0 0 24 24"><path class="ck" d="M5 12.5l4.5 4.5L19 7.5"/></svg>') + "<span>" + esc(t) + "</span>"; document.body.append(m); setTimeout(() => { m.classList.add("out"); setTimeout(() => m.remove(), 250); }, 3200); }

TABS.splice(0, TABS.length, ["dash", "Dashboard"], ["emp", "Employees"], ["dtr", "DTR / Biometric"], ["th", "Teacher Hours"], ["cls", "Class Monitor"], ["leave", "Leave"], ["otf", "Overtime File"], ["run", "Payroll"], ["slips", "Payslips"], ["m13", "13th Month Pay"], ["ca", "Cash Advance"], ["loans", "Loans"], ["allow", "Allowances"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]);

/** HR accounts (role "hr") only see Leave and the Overtime File. The server refuses every other request from an HR account too. */
const isHR = () => !!(ST.user && ST.user.role === "hr");

const HR_TABS = ["leave", "otf"];

/** Class Monitor accounts (role "monitor") only see the Class Monitor menu. The server refuses every other request from them too. */
const isMon = () => !!(ST.user && ST.user.role === "monitor");

const MON_TABS = ["cls"];

const visibleTabs = () => (isHR() ? TABS.filter((t) => HR_TABS.includes(t[0])) : isMon() ? TABS.filter((t) => MON_TABS.includes(t[0])) : TABS);

const LOGO = "assets/logo.png";   // the school logo (assets/logo.png)

const NAVICON = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  emp: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dtr: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  th: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M4 4l2 2M20 4l-2 2"/>',
  leave: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  run: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  slips: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  m13: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  loans: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  rep: '<path d="M3 3v18h18"/><path d="M8 17V9M13 17V5M18 17v-6"/>',
  set: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  cls: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M7 9h4M7 13h10"/><circle cx="16" cy="9" r="1.5"/>',
  otf: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M19 5l1.5 1.5"/>',
  ca: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9v6M14.5 10.5c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.7-2.5 1.7 0 2.2 5 1 5 3.2 0 1-1.1 1.7-2.5 1.7-1.1 0-2-.4-2.5-1.2"/>',
  allow: '<path d="M12 2v20M17 6.5C16 5 14.2 4 12 4 9.2 4 7 5.3 7 7.5c0 4.5 10 2.5 10 7 0 2.2-2.2 3.5-5 3.5-2.2 0-4-1-5-2.5"/>',
  usr: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>' };

const NAVSUB = { dash: "Overview of your payroll", emp: "Manage employee records, groups and pictures", dtr: "Biometric punches, attendance check and daily time records", th: "Hours of each teacher per day, from the teacher's schedule", cls: "Check that each teacher is in class, every hour, and clock the teacher in and out per class", leave: "Leave requests and balances", run: "Compute and finalize payroll per cut-off", slips: "Saved payroll runs and printable payslips", m13: "13th month pay per employee", loans: "Company, SSS (salary / calamity) and HDMF (MPL / calamity) loans per employee", ca: "Cash advance balance and deduction per payday", allow: "Monthly or per-day allowances per employee", otf: "Overtime hours filed per employee and date", rep: "Payroll reports and exports", set: "Payroll rules, late and overtime, holidays and signatories", usr: "Accounts that can sign in" };

function whoAmI() {   // the signed-in user's 2x2 picture, full name and department (from the matching employee record when the e-mail matches)
  const u = ST.user || {}, em = String(u.email || "").toLowerCase(), e = (em && (ST.employees || []).find((x) => String(x.email || "").toLowerCase() === em)) || {};
  return { name: u.name || nameOf(e) || "User", dept: u.dept || e.dept || "Finance - Payroll", position: u.position || e.position || "", photo: u.photo || e.photo || "" };
}

function shell() {
  if (isHR() && !HR_TABS.includes(ST.tab)) ST.tab = "leave";
  if (isMon() && !MON_TABS.includes(ST.tab)) ST.tab = "cls";
  const w = whoAmI(), cur = (TABS.find((t) => t[0] === ST.tab) || [])[1] || "";
  A.innerHTML = `<div class="layout"><aside class="side noprint"><div class="sbrand"><img src="${LOGO}" alt=""><b>ARK-Payroll Management System</b></div>
  <div class="prof">${w.photo ? `<img class="pic" src="${w.photo}" alt="">` : `<div class="pic">${esc(String(w.name).charAt(0).toUpperCase() || "?")}</div>`}<div class="pn">${esc(w.name)}</div><div class="pd">${esc(w.position || w.dept)}</div></div>
  <div class="slab">Menu</div><div class="smenu">${visibleTabs().map(([k, l]) => `<button data-t="${k}" class="${ST.tab === k ? "on" : ""}"><svg viewBox="0 0 24 24" aria-hidden="true">${NAVICON[k] || ""}</svg><span>${l}</span></button>`).join("")}</div>
  <div class="sfoot"><a href="#" id="lo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>Sign out</a></div></aside>
  <div class="content"><div class="top noprint"><div class="tt"><h1>${esc(cur)}</h1><p>${esc(NAVSUB[ST.tab] || "")}</p></div><div class="tdate"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div></div><main id="v"></main></div></div>`;
  $("#lo").onclick = (e) => { e.preventDefault(); logout(); };
  document.querySelectorAll(".smenu [data-t]").forEach((b) => b.onclick = () => { ST.tab = b.dataset.t; shell(); });
  ({ dash, emp, dtr, th: teacherHours, cls: classMonitor, leave, otf: otfPage, ca: loans, loans, allow: loans, run, slips, m13, rep, set, usr })[ST.tab]();
}

