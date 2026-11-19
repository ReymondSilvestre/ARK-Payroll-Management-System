/* ============================================================
   LOGIN / LOGOUT and first data load.
   File: js/app/auth.js
   ============================================================ */

function logout() { token = ""; localStorage.removeItem("pms.token"); ST.user = null; showLogin(); }

function showLogin() {
  const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  A.innerHTML = `<div class="lgw"><section class="lgh"><div class="lgh-in"><div class="lgb"><img src="${LOGO}" alt=""><div><b>ARK Technological Institute</b><small>Education System Inc.</small></div></div>
  <h1>Payroll Management<br>System</h1><p class="lgt">One secure place for attendance, payroll, payslips and employee records.</p>
  <ul class="lgf"><li>${ic('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')}<div><b>Biometric DTR &amp; attendance</b><span>Late, absent and overtime read straight from the punches.</span></div></li>
  <li>${ic('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>')}<div><b>Accurate payroll &amp; payslips</b><span>SSS, PhilHealth, Pag-IBIG, tax and 13th month pay.</span></div></li>
  <li>${ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>')}<div><b>Secure &amp; centralised</b><span>Every record is saved to one database spreadsheet.</span></div></li></ul>
  <div class="lgc">${esc(SCHOOL.address)}<br>${esc(SCHOOL.contact)}</div></div></section>
  <section class="lgp"><form class="lgcard" id="lgform" autocomplete="on" novalidate><div class="lgm"><img src="${LOGO}" alt=""><b>ARK-Payroll</b></div><h2>Welcome back</h2><p class="lgs">Sign in to your payroll account to continue.</p>
  <label for="em">Email address</label><div class="fld">${ic('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>')}<input id="em" type="email" name="email" placeholder="name@school.edu.ph" autocomplete="username" autofocus></div>
  <label for="pw">Password</label><div class="fld">${ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>')}<input id="pw" type="password" name="password" placeholder="Enter your password" autocomplete="current-password"><button type="button" class="eye" id="eye" aria-label="Show password" title="Show / hide password">${ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>')}</button></div>
  <button type="submit" class="btn p lgbtn" id="go">Sign in ${ic('<path d="M5 12h14M13 6l6 6-6 6"/>')}</button>
  <p id="st" class="lgst">Checking server...</p><p class="lgfoot">&copy; ${new Date().getFullYear()} ARK Technological Institute Education System Inc.</p></form></section></div>`; checkApi();
  $("#eye").onclick = () => { const p = $("#pw"); p.type = p.type === "password" ? "text" : "password"; $("#eye").classList.toggle("on", p.type === "text"); };
  $("#lgform").onsubmit = (e) => { e.preventDefault(); go(); };
  const go = async () => { try { const r = await api("login", { email: $("#em").value, password: $("#pw").value }); token = r.token; localStorage.setItem("pms.token", token); ST.user = r.user; await load(); } catch { } };
}

async function load() {
  const b = await api("bootstrap"); ST.settings = mergeSettings(b.settings); daysMigrate(); minutesMigrate(); otHourMigrate(); phAutoFill(); ST.employees = b.employees; ST.runs = b.runs; ST.sheet = ""; ST.backup = b.backup || ""; ST.leaves = b.leaves || [];
  if (!ST.user) ST.user = JSON.parse(localStorage.getItem("pms.user") || "null"); else localStorage.setItem("pms.user", JSON.stringify(ST.user));
  shell();
}

