const API_URL = "https://script.google.com/macros/s/AKfycbziiRmj072ytw_7bT42ia3EGimasoL74xoXwZJFttyyqZbuLeL4KQng8OUUVRbon_Fc/exec";
const $ = (s, r = document) => r.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const A = $("#app"); let ST = { user: null, settings: DEFAULT_SETTINGS, employees: [], runs: [], tab: "dash", sheet: "", users: [], run: null };
let token = localStorage.getItem("pms.token") || "";

function toast(t, err) { const m = document.createElement("div"); m.className = "msg" + (err ? " err" : ""); m.textContent = t; document.body.append(m); setTimeout(() => m.remove(), 3500); }
async function api(action, data) {
  $("#busy").style.display = "flex";
  try {
    let r, t, j;
    try { r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, token, data, ...(action === "login" ? data : {}) }) }); t = await r.text(); }
    catch (e) { throw new Error("Cannot reach the server. In Apps Script deploy a NEW VERSION as Web app with 'Who has access: Anyone', then reload."); }
    try { j = JSON.parse(t); } catch (e) { throw new Error("The server did not return data. Set 'Who has access' to Anyone and deploy a New version of Code.gs."); }
    if (!j.ok) { const m = typeof j.error === "string" ? j.error : (j.error && j.error.message) || "Server error"; if (m === "unauthenticated") { logout(); throw new Error("Session expired. Please sign in again."); } if (j.error && typeof j.error === "object") throw new Error("The deployed script is the old one (not this Payroll Code.gs). Paste the new Code.gs and deploy a New version."); throw new Error(m); }
    return j.data;
  } catch (e) { toast(e.message || "No connection.", true); throw e; } finally { $("#busy").style.display = "none"; }
}
async function checkApi() {
  const el = $("#st"); if (!el) return;
  try { const r = await fetch(API_URL), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    if (j && j.ok && /Payroll Management System/.test(j.data)) { el.textContent = "Server connected."; el.style.color = "#1a7f37"; }
    else if (j) { el.textContent = "Server answers but it is NOT the Payroll Code.gs. Paste the new Code.gs and deploy a New version."; el.style.color = "#7a0c14"; }
    else { el.textContent = "Server not public. Deploy as Web app, Who has access: Anyone."; el.style.color = "#7a0c14"; }
  } catch (e) { el.textContent = "Cannot reach the server. Check the URL / deployment access (Anyone)."; el.style.color = "#7a0c14"; }
}
function logout() { token = ""; localStorage.removeItem("pms.token"); ST.user = null; showLogin(); }

function showLogin() {
  A.innerHTML = `<div id="login"><h1>ARK-Payroll Management System</h1><p class="muted">Sign in with your payroll account.</p>
  <label>Email</label><input id="em" type="email" autocomplete="username"><label>Password</label><input id="pw" type="password" autocomplete="current-password">
  <p><button class="btn p" id="go" style="width:100%">Sign in</button></p><p id="st" class="muted" style="font-size:.85rem">Checking server...</p></div>`; checkApi();
  const go = async () => { try { const r = await api("login", { email: $("#em").value, password: $("#pw").value }); token = r.token; localStorage.setItem("pms.token", token); ST.user = r.user; await load(); } catch { } };
  $("#go").onclick = go; $("#pw").onkeydown = (e) => { if (e.key === "Enter") go(); };
}
async function load() {
  const b = await api("bootstrap"); ST.settings = mergeSettings(b.settings); daysMigrate(); phAutoFill(); ST.employees = b.employees; ST.runs = b.runs; ST.sheet = ""; ST.leaves = b.leaves || [];
  if (!ST.user) ST.user = JSON.parse(localStorage.getItem("pms.user") || "null"); else localStorage.setItem("pms.user", JSON.stringify(ST.user));
  shell();
}
const TABS = [["dash", "Dashboard"], ["emp", "Employees"], ["run", "Payroll"], ["slips", "Payslips"], ["loans", "Cash Loan"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]];
function shell() {
  A.innerHTML = `<header><b>Payroll Management System</b><span>${esc(ST.user?.name || "")} &middot; <a href="#" id="lo" style="color:#fff">Sign out</a></span></header>
  <nav class="noprint">${TABS.map(([k, l]) => `<button class="btn ${ST.tab === k ? "on" : ""}" data-t="${k}">${l}</button>`).join("")}</nav><main id="v"></main>`;
  $("#lo").onclick = (e) => { e.preventDefault(); logout(); };
  document.querySelectorAll("nav [data-t]").forEach((b) => b.onclick = () => { ST.tab = b.dataset.t; shell(); });
  ({ dash, emp, loans, run, slips, rep, set, usr })[ST.tab]();
}
const V = (h) => ($("#v").innerHTML = h);

/* ---------- Dashboard ---------- */
function dash() {
  const cat = (k) => ST.employees.filter((e) => categoryOf(e) === k).length, last = ST.runs[ST.runs.length - 1];
  V(`<div class="grid"><div class="card stat">Employees<b>${ST.employees.length}</b></div><div class="card stat">Staff / Teachers / Admins<b>${cat("staff")} / ${cat("teacher")} / ${cat("admin")}</b></div>
  <div class="card stat">Payroll runs saved<b>${ST.runs.length}</b></div><div class="card stat">Last net pay<b>${last ? "PHP " + money(last.net) : "-"}</b></div></div>
  <div class="card"><h3>Recent payroll runs</h3>${runsTable(ST.runs.slice(-5).reverse())}</div>`);
}
const runsTable = (rs) => rs.length ? `<div class="tw"><table><tr><th>Period</th><th>Pay date</th><th class="n">Employees</th><th class="n">Gross</th><th class="n">Deductions</th><th class="n">Net</th><th>Saved by</th></tr>${rs.map((r) => `<tr><td>${esc(r.period)}</td><td>${esc(String(r.payDate).slice(0, 10))}</td><td class="n">${r.count}</td><td class="n">${money(r.gross)}</td><td class="n">${money(r.ded)}</td><td class="n">${money(r.net)}</td><td>${esc(r.by)}</td></tr>`).join("")}</table></div>` : `<p class="muted">No payroll saved yet.</p>`;

/* ---------- Employees: add, edit, upload ---------- */
const OPT = { gender: ["", "Male", "Female"], civil: ["", "Single", "Married", "Widowed", "Separated"], etype: ["", "Regular", "Probationary", "Contractual", "Part-time", "Casual", "Project-based"], status: ["Active", "Inactive", "On leave", "Resigned", "Terminated"], category: [["", "Automatic (from position)"], ["staff", "Employee staff"], ["teacher", "Teacher (paid per hour)"], ["admin", "School admin"]] };
const EF = [["no", "Employee No. *"], ["last", "Last name *"], ["first", "First name *"], ["mi", "M.I."], ["birthday", "Birthday *", "date"], ["gender", "Gender", OPT.gender], ["civil", "Civil status", OPT.civil], ["position", "Position"], ["dept", "Department"], ["etype", "Employment type", OPT.etype], ["hired", "Date hired", "date"], ["status", "Status *", OPT.status]];
const GF = [["sssNo", "SSS No."], ["philhealthNo", "PhilHealth No."], ["pagibigNo", "Pag-IBIG No."], ["tin", "TIN"]];
const PF = [["basicMonthly", "Monthly basic (PHP)"], ["dailyRate", "Daily rate (optional)"], ["hourlyRate", "Hourly rate (teachers)"], ["email", "Email"], ["category", "Payroll group", OPT.category]];
const nameOf = (e) => e.name || [e.last, [e.first, e.mi ? String(e.mi).replace(/\.?$/, ".") : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
const fld = (f, e) => { const [k, l, t] = f, v = e[k] ?? (k === "status" ? "Active" : ""); if (Array.isArray(t)) return `<div><label>${l}</label><select id="f_${k}">${t.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o || "-"]; return `<option value="${esc(ov)}" ${String(v) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select></div>`; return `<div><label>${l}</label><input id="f_${k}" type="${t === "date" ? "date" : "text"}" value="${esc(v)}"></div>`; };
function emp(edit) {
  const e = edit || {}; if (edit) ST.empView = "add";
  V(`${empTabs()}<div class="card" data-pane="add" ${paneHide("add")}><h3>${edit ? "Edit" : "Add"} employee information</h3>${photoBox(e)}<div class="form">${EF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Government benefit numbers</h3><div class="form">${GF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Pay information</h3><div class="form">${PF.map((f) => fld(f, e)).join("")}
  ${[["sss", "SSS"], ["philhealth", "PhilHealth"], ["pagibig", "Pag-IBIG"], ["tax", "Withholding tax"]].map(([k, l]) => `<div><label>${l} deduction</label><select id="f_${k}"><option value="1">Deduct</option><option value="0" ${e[k] === false ? "selected" : ""}>Do not deduct</option></select></div>`).join("")}</div>
  <p class="muted">Cash advances, loans and allowances are under the <b>Loans / CA</b> tab.</p>
  <p class="row"><button class="btn p" id="sv">${edit ? "Save changes" : "Add employee"}</button>${edit ? '<button class="btn" id="cn">Cancel</button>' : ""}</p></div>
  <div class="card noprint" data-pane="upload" ${paneHide("upload")}><h3>Upload employees (Excel / CSV)</h3><p class="muted">Use the template columns: Employee No., Last name, First name, M.I., Birthday, Gender, Civil status, Position, Department, Employment type, Date hired, Status, SSS No., PhilHealth No., Pag-IBIG No., TIN, Monthly basic, Daily rate, Hourly rate, Email, Group. Existing employees (same Employee No.) are updated.</p>
  <div class="row"><input type="file" id="up" accept=".xlsx,.xls,.csv"><button class="btn" id="tpl">Download template</button></div></div>
  ${empFilter()}<div class="card" data-pane="list" ${paneHide("list")}><h3>Employees (${empList().length})</h3><div class="tw"><table><tr><th>No.</th><th>Name</th><th>Birthday</th><th>Position</th><th>Department</th><th>Type</th><th>Status</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>TIN</th><th></th></tr>
  ${empList().map((x) => `<tr><td>${esc(x.no)}</td><td>${thumb(x)}${esc(nameOf(x))}</td><td>${esc(x.birthday)}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${esc(x.etype)}</td><td>${esc(x.status)}</td><td>${esc(x.sssNo)}</td><td>${esc(x.philhealthNo)}</td><td>${esc(x.pagibigNo)}</td><td>${esc(x.tin)}</td><td><button class="btn sm" data-e="${x.id}">Edit</button> <button class="btn sm d" data-x="${x.id}">Delete</button></td></tr>`).join("")}</table></div></div>`);
  $("#sv").onclick = async () => {
    const o = { ...e }; if (ST.photoDraft !== undefined) o.photo = ST.photoDraft; [...EF, ...GF, ...PF].forEach(([k]) => o[k] = $("#f_" + k).value.trim());
    ["sss", "philhealth", "pagibig", "tax"].forEach((k) => o[k] = $("#f_" + k).value === "1");
    for (const [k, l] of [["no", "Employee No."], ["last", "Last name"], ["first", "First name"], ["birthday", "Birthday"], ["status", "Status"]]) if (!o[k]) return toast(l + " is required.", true);
    const r = await api("saveEmployees", { list: [o] }); ST.employees = r.employees; ST.empView = "list"; toast("Saved."); emp();
  };
  if (edit) $("#cn").onclick = () => { ST.empView = "list"; emp(); };
  document.querySelectorAll("[data-e]").forEach((b) => b.onclick = () => { emp(ST.employees.find((x) => x.id === b.dataset.e)); scrollTo(0, 0); });
  document.querySelectorAll("[data-x]").forEach((b) => b.onclick = async () => { if (confirm("Delete this employee?")) { await api("deleteEmployee", { id: b.dataset.x }); ST.employees = ST.employees.filter((x) => x.id !== b.dataset.x); emp(); } });
  $("#tpl").onclick = () => { const H = ["Employee No.", "Last name", "First name", "M.I.", "Birthday", "Gender", "Civil status", "Position", "Department", "Employment type", "Date hired", "Status", "SSS No.", "PhilHealth No.", "Pag-IBIG No.", "TIN", "Monthly basic", "Daily rate", "Hourly rate", "Email", "Group"], ws = XLSX.utils.aoa_to_sheet([H, ["E-001", "Dela Cruz", "Juan", "S", "1990-05-20", "Male", "Single", "Cashier", "Finance", "Regular", "2022-06-01", "Active", "33-1234567-8", "12-345678901-2", "1234-5678-9012", "123-456-789-000", 18000, "", "", "juan@example.com", "staff"]]), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Employees"); XLSX.writeFile(wb, "employee-template.xlsx"); };
  $("#up").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });
    const AL = { no: ["employeeno", "employeenumber", "empno"], last: ["lastname", "surname"], first: ["firstname", "givenname"], mi: ["mi", "middleinitial"], birthday: ["birthday", "birthdate", "dateofbirth"], gender: ["gender", "sex"], civil: ["civilstatus"], position: ["position"], dept: ["department"], etype: ["employmenttype"], hired: ["datehired", "datehire"], status: ["status"], sssNo: ["sssno", "sssnumber", "sss"], philhealthNo: ["philhealthno", "philhealthnumber", "philhealth"], pagibigNo: ["pagibigno", "pagibignumber", "pagibig", "hdmfno"], tin: ["tin", "tinno", "tinnumber"], basicMonthly: ["monthlybasic", "monthlysalary", "basicmonthly", "salary"], dailyRate: ["dailyrate"], hourlyRate: ["hourlyrate"], email: ["email"], category: ["group", "category"] };
    const map = {}; for (const k in AL) AL[k].forEach((a) => map[a] = k);
    const dt = (v) => v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v).trim();
    const list = [], bad = [];
    rows.forEach((r, i) => { const o = {}; for (const h in r) { const k = map[String(h).toLowerCase().replace(/[^a-z]/g, "")]; if (k) o[k] = ["birthday", "hired"].includes(k) ? dt(r[h]) : typeof r[h] === "string" ? r[h].trim() : r[h]; }
      if (!Object.values(o).some((v) => v !== "")) return; if (!o.no || !o.last || !o.first) { bad.push(i + 2); return; }
      o.no = String(o.no); o.status = o.status || "Active"; if (o.category && !["staff", "teacher", "admin"].includes(o.category)) o.category = /teach/i.test(o.category) ? "teacher" : /admin/i.test(o.category) ? "admin" : "staff";
      const old = ST.employees.find((x) => x.no === o.no); list.push(old ? { ...old, ...o } : o); });
    if (!list.length) return toast("No valid employees found. Employee No., Last name and First name are required.", true);
    if (!confirm(`Import ${list.length} employee(s)?${bad.length ? `\n${bad.length} row(s) skipped (missing Employee No./name): row ${bad.slice(0, 10).join(", ")}` : ""}`)) return;
    const r = await api("saveEmployees", { list }); ST.employees = r.employees; ST.empView = "list"; toast(`${r.added} added, ${r.updated} updated.`); emp();
  };
}

/* ---------- Loans, cash advances and allowances ---------- */
const LOAN_TYPES = ["Salary Loan", "SSS Loan", "Pag-IBIG Loan", "PhilHealth", "Company Loan", "Emergency Loan", "Other"];
function loans(selId) {
  const E = ST.employees; if (!E.length) return V('<div class="card"><p class="muted">Add employees first.</p></div>');
  const e = E.find((x) => x.id === selId) || E[0]; let W = { ca: { ...(e.ca || {}) }, deductions: (e.deductions || []).map((x) => ({ ...x })), allowances: (e.allowances || []).map((x) => ({ ...x })) };
  const collect = () => ({ ca: { balance: +$("#cab").value || 0, perPay: +$("#cap").value || 0 },
    deductions: [...document.querySelectorAll("[data-ln]")].map((r) => ({ id: r.dataset.id, type: $(".lt", r).value, label: $(".ll", r).value.trim() || $(".lt", r).value, amount: +$(".la", r).value || 0, balance: $(".lb", r).value === "" ? "" : +$(".lb", r).value })),
    allowances: [...document.querySelectorAll("[data-an]")].map((r) => ({ label: $(".al", r).value.trim(), amount: +$(".aa", r).value || 0, perDay: $(".ap", r).value === "1", taxable: $(".at", r).value === "1" })).filter((a) => a.label || a.amount) });
  const draw = () => {
    V(`${loanHead(e, E)}
    <div class="card"><h3>Cash advance</h3><div class="form"><div><label>Outstanding balance (PHP)</label><input type="number" step="any" id="cab" value="${W.ca.balance ?? 0}"></div><div><label>Deduct each payday (PHP)</label><input type="number" step="any" id="cap" value="${W.ca.perPay ?? 0}"></div></div>
    <p class="muted">To give a new cash advance, add it to the balance. Each payroll deducts the amount per payday (never more than the balance) and the balance goes down when the payroll is saved.</p></div>
    <div class="card"><h3>Loans (Salary Loan, SSS Loan, Pag-IBIG Loan, etc.)</h3><div class="tw"><table><tr><th>Type</th><th>Description</th><th>Amount per month</th><th>Outstanding balance</th><th></th></tr>
    ${W.deductions.map((d, i) => `<tr data-ln data-id="${esc(d.id || "L" + Date.now() + i)}"><td><select class="lt">${LOAN_TYPES.map((t) => `<option ${d.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></td><td><input class="ll" value="${esc(d.label || "")}"></td><td><input class="in la" type="number" step="any" value="${d.amount ?? ""}"></td><td><input class="in lb" type="number" step="any" value="${d.balance ?? ""}" placeholder="no limit"></td><td><button class="btn sm d" data-rl="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No loans.</td></tr>'}</table></div>
    <p class="muted">The monthly amount is split between the two cut-offs. When a balance is entered, the loan stops once it is fully paid.</p><p><button class="btn" id="al">+ Add loan</button></p></div>
    <div class="card"><h3>Allowances</h3><div class="tw"><table><tr><th>Name</th><th>Amount</th><th>Per</th><th>Taxable</th><th></th></tr>
    ${W.allowances.map((a, i) => `<tr data-an><td><input class="al" value="${esc(a.label || "")}"></td><td><input class="in aa" type="number" step="any" value="${a.amount ?? ""}"></td><td><select class="ap"><option value="0">Month</option><option value="1" ${a.perDay ? "selected" : ""}>Working day</option></select></td><td><select class="at"><option value="1">Yes</option><option value="0" ${a.taxable === false ? "selected" : ""}>No</option></select></td><td><button class="btn sm d" data-ra="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No allowances.</td></tr>'}</table></div><p><button class="btn" id="aa">+ Add allowance</button></p></div>
    <p><button class="btn p" id="sl">Save loans, cash advance and allowances</button></p>`);
    $("#le").onchange = (ev) => loans(ev.target.value);
    $("#al").onclick = () => { W = collect(); W.deductions.push({ id: "L" + Date.now(), type: "Salary Loan", label: "", amount: "", balance: "" }); draw(); };
    $("#aa").onclick = () => { W = collect(); W.allowances.push({ label: "", amount: "", perDay: false, taxable: true }); draw(); };
    document.querySelectorAll("[data-rl]").forEach((b) => b.onclick = () => { W = collect(); W.deductions.splice(+b.dataset.rl, 1); draw(); });
    document.querySelectorAll("[data-ra]").forEach((b) => b.onclick = () => { W = collect(); W.allowances.splice(+b.dataset.ra, 1); draw(); });
    $("#sl").onclick = async () => { Object.assign(e, collect()); const r = await api("saveEmployees", { list: [e] }); ST.employees = r.employees; toast("Saved."); loans(e.id); };
  };
  draw();
}

/* ---------- Payroll run ---------- */
const activeEmps = () => ST.employees.filter((e) => (e.status || "Active") === "Active");
function run() {
  const S = ST.settings, now = new Date(), m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, R = ST.run || { month: m, cut: S.cutoffPair === "A" ? "c11_25" : "c1_15", inp: {} };
  ST.run = R;
  const per = () => cutoffPeriod(R.month, R.cut);
  const calc = (e) => computeSlip(e, R.inp[e.id] || {}, S, per());
  const head = `<div class="card noprint"><div class="row"><div><label>Month</label><input type="month" id="rm" value="${R.month}"></div><div><label>Cut-off</label><select id="rc">${CUTOFFS.map((c) => `<option value="${c.key}" ${R.cut === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="pd" value="${R.payDate || payDateOf(R.month, per().half, S.period)}"></div><button class="btn p" id="sr">Save ${(SECS.find((x) => x[0] === R.sec) || [])[1]} payroll run</button></div><p class="muted">Period: <b>${per().label}</b>. Enter absences, late minutes, overtime and (teachers) hours worked; the amounts compute automatically.</p></div>`;
  const rowH = (e) => { const c = calc(e), i = R.inp[e.id] || {}, hr = c.perHour, f = (k, w) => `<td><input class="in" data-id="${e.id}" data-k="${k}" value="${i[k] ?? ""}" ${w ? "disabled" : ""}></td>`;
    return `<tr><td>${esc(e.name)}<br><small class="muted">${esc(e.position)}</small></td>${f("hoursWorked", !hr)}${f("absentDays", hr)}${f("lateMin", hr)}${f("otHours")}${f("otherEarn")}${f("otherDed")}<td class="n">${money(c.gross)}</td><td class="n">${money(c.sssEe + c.phicEe + c.hdmfEe)}</td><td class="n">${money(c.tax)}</td><td class="n">${money(c.totalDed)}</td><td class="n"><b>${money(c.net)}</b></td></tr>`; };
  V(head + `<div class="card"><div class="tw"><table><tr><th>Employee</th><th>Hours (teacher)</th><th>Absent days</th><th>Late min</th><th>OT hours</th><th>Other earn</th><th>Other ded</th><th class="n">Gross</th><th class="n">SSS+PHIC+HDMF</th><th class="n">Tax</th><th class="n">Total ded</th><th class="n">Net pay</th></tr>
  ${activeEmps().map(rowH).join("") || '<tr><td colspan="12">Add employees first.</td></tr>'}</table></div></div>`);
  $("#rm").onchange = (e) => { R.month = e.target.value; R.payDate = ""; run(); }; $("#rc").onchange = (e) => { R.cut = e.target.value; R.payDate = ""; run(); }; $("#pd").onchange = (e) => R.payDate = e.target.value;
  document.querySelectorAll("input.in").forEach((el) => el.onchange = () => { (R.inp[el.dataset.id] ||= {})[el.dataset.k] = el.value; const f = document.activeElement; run(); });
  $("#sr").onclick = async () => {
    const L = activeEmps(), slips = L.map((e) => ({ no: e.no, name: nameOf(e), position: e.position, calc: calc(e) })), sum = (k) => slips.reduce((n, x) => n + x.calc[k], 0), first = !R.id;
    if (!slips.length) return toast("No active employees.", true);
    const r = await api("saveRun", { id: R.id, period: per().label, payDate: $("#pd").value, slips, gross: r2(sum("gross")), ded: r2(sum("totalDed")), net: r2(sum("net")) });
    R.id = r.id;
    if (first) {   // a new payroll lowers the cash advance and loan balances by what was deducted (done once per run)
      const upd = []; L.forEach((e, i) => { const c = slips[i].calc; let ch = false;
        if (c.caDed > 0) { e.ca = { ...(e.ca || {}), balance: c.caAfter }; ch = true; }
        (c.dedList || []).forEach((d) => { const x = (e.deductions || []).find((y) => y.id === d.id); if (x && d.balanceAfter !== null && d.amount > 0) { x.balance = d.balanceAfter; ch = true; } });
        if (ch) upd.push(e); });
      if (upd.length) await api("saveEmployees", { list: upd });
    }
    ST.runs = (await api("bootstrap")).runs; ST.run = null; ST.tab = "slips"; toast("Payroll saved to the spreadsheet."); shell();
  };
}

/* ---------- Payslips ---------- */
async function slips() {
  V(`<div class="card noprint"><div class="row"><div><label>Payroll run</label><select id="sr">${ST.runs.slice().reverse().map((r) => `<option value="${r.id}">${esc((SECS.find((x) => x[0] === r.group) || [0, "All"])[1])} - ${esc(r.period)} (${esc(r.id)})</option>`).join("")}</select></div><button class="btn p" id="ld">Show payslips</button><button class="btn" id="pr">Print</button><button class="btn d" id="dr">Delete run</button></div></div><div id="ps"></div>`);
  $("#pr").onclick = () => print();
  $("#dr").onclick = async () => { const id = $("#sr").value; if (id && confirm("Delete this payroll run?")) { await api("deleteRun", { id }); ST.runs = ST.runs.filter((r) => r.id !== id); slips(); } };
  $("#ld").onclick = async () => {
    const id = $("#sr").value; if (!id) return; const run = ST.runs.find((r) => r.id === id), L = await api("getRun", { id }), sg = ST.settings.signatories || [];
    $("#ps").innerHTML = L.map((s) => slipHTML(s, run, sg)).join("");
  };
}

/* ---------- Reports ---------- */
function rep() {
  V(`<div class="card"><h3>Reports</h3><div class="row"><div><label>Payroll run</label><select id="sr">${ST.runs.slice().reverse().map((r) => `<option value="${r.id}">${esc(r.period)}</option>`).join("")}</select></div><button class="btn p" id="ld">Show</button><button class="btn" id="xl">Download Excel</button></div></div><div class="card" id="rb"><p class="muted">Pick a run.</p></div>`);
  let L = [];
  $("#ld").onclick = async () => { const id = $("#sr").value; if (!id) return; L = await api("getRun", { id }); const k = ["basic", "allow", "ot", "gross", "sssEe", "phicEe", "hdmfEe", "tax", "totalDed", "net"], t = {}; k.forEach((x) => t[x] = L.reduce((n, s) => n + s.calc[x], 0));
    $("#rb").innerHTML = `<div class="tw"><table><tr><th>Employee</th>${k.map((x) => `<th class="n">${x}</th>`).join("")}</tr>${L.map((s) => `<tr><td>${esc(s.name)}</td>${k.map((x) => `<td class="n">${money(s.calc[x])}</td>`).join("")}</tr>`).join("")}<tr class="tot"><td>TOTAL</td>${k.map((x) => `<td class="n">${money(t[x])}</td>`).join("")}</tr></table></div>`; };
  $("#xl").onclick = () => { if (!L.length) return toast("Show a run first.", true); const ws = XLSX.utils.json_to_sheet(L.map((s) => ({ "Employee No": s.no, Name: s.name, Position: s.position, Basic: s.calc.basic, Allowances: s.calc.allow, Overtime: s.calc.ot, Gross: s.calc.gross, SSS: s.calc.sssEe, PhilHealth: s.calc.phicEe, "Pag-IBIG": s.calc.hdmfEe, Tax: s.calc.tax, "Total deductions": s.calc.totalDed, "Net pay": s.calc.net }))), wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Payroll"); XLSX.writeFile(wb, "payroll-report.xlsx"); };
}

/* ---------- Settings ---------- */
function set() {
  const S = ST.settings, n = (id, l, v, step) => `<div><label>${l}</label><input type="number" step="${step || "any"}" id="${id}" value="${v}"></div>`, on = (id, l, v) => `<div><label>${l}</label><select id="${id}"><option value="1">On</option><option value="0" ${v === false ? "selected" : ""}>Off</option></select></div>`;
  V(`${setTabs()}<div class="card"><div data-sp="pay" ${spHide("pay")}><h3>Payroll settings</h3><div class="form">
  <div><label>Pay frequency</label><select id="s_freq"><option value="semi">Twice a month</option><option value="monthly" ${S.frequency === "monthly" ? "selected" : ""}>Monthly</option></select></div>
  ${n("s_wd", "Working days per month", S.workDays)}${n("s_hpd", "Hours per day", S.hoursPerDay)}${n("s_ot", "Overtime multiplier", S.otRate)}
  ${on("s_sss", "SSS", S.sss.on)}${n("s_sssEe", "SSS employee share / month (fixed)", S.sss.fixedEe)}${on("s_phic", "PhilHealth", S.phic.on)}${n("s_phicEe", "PhilHealth employee share / month", S.phic.fixedEe)}
  ${on("s_hdmf", "Pag-IBIG", S.hdmf.on)}${n("s_hdmfEe", "Pag-IBIG employee share / month", S.hdmf.fixedEe)}${on("s_tax", "Withholding tax (TRAIN brackets)", S.tax.on)}</div>
  </div><div data-sp="sal" ${spHide("sal")}><h3>Salary range</h3><div class="form">${n("s_mw", "Employee minimum wage (PHP / day)", S.minWage.daily)}${n("s_mwa", "Admin minimum wage (PHP / day)", S.minWage.admin)}${n("s_mwt", "Teacher minimum rate (PHP / hour)", S.minWage.teacherHour)}</div><p class="muted">Nobody is paid below the minimum of their group: Staff and Admins per day, Teachers per hour.</p></div>${holHTML(S)}<div data-sp="sig" ${spHide("sig")}><h3>Signatories printed on payslips</h3><div class="form">${[0, 1].map((i) => { const g = S.signatories[i] || { label: "", name: "", position: "" }; return `<div><label>Label</label><input id="g${i}l" value="${esc(g.label)}"></div><div><label>Name</label><input id="g${i}n" value="${esc(g.name)}"></div><div><label>Position</label><input id="g${i}p" value="${esc(g.position)}"></div>`; }).join("")}</div>
  </div><p><button class="btn p" id="ss">Save settings</button></p></div>`);
  setExtras(); $("#ss").onclick = async () => { collectExtras();
    const v = (id) => $("#" + id).value, b = (id) => v(id) === "1";
    Object.assign(S, { frequency: v("s_freq"), workDays: +v("s_wd"), hoursPerDay: +v("s_hpd"), otRate: +v("s_ot") });
    S.minWage.daily = +v("s_mw"); S.minWage.admin = +v("s_mwa"); S.minWage.teacherHour = +v("s_mwt"); S.sss.on = b("s_sss"); S.sss.fixedEe = +v("s_sssEe"); S.phic.on = b("s_phic"); S.phic.fixedEe = +v("s_phicEe"); S.hdmf.on = b("s_hdmf"); S.hdmf.fixedEe = +v("s_hdmfEe"); S.tax.on = b("s_tax");
    S.signatories = [0, 1].map((i) => ({ label: v(`g${i}l`), name: v(`g${i}n`), position: v(`g${i}p`) })).filter((g) => g.label);
    await api("saveSettings", S); toast("Settings saved.");
  };
}

/* ---------- Users: every payroll user can create accounts ---------- */
async function usr() {
  ST.users = await api("listUsers");
  const ed = ST.users.find((u) => u.id === ST.editUser) || null;
  V(`<div class="card"><h3>${ed ? "Edit" : "Create"} user account</h3>${photoBox({ photo: ed ? ed.photo : "" })}<div class="form"><div><label>Full name</label><input id="un" value="${esc(ed ? ed.name : "")}"></div><div><label>Email</label><input id="ue" type="email" value="${esc(ed ? ed.email : "")}"></div><div><label>Department</label><input id="ud" value="${esc(ed ? ed.dept : "")}"></div>${ed ? "" : `<div><label>Password (min 6)</label><input id="up" type="text"></div>`}</div>
  <p><button class="btn p" id="au">${ed ? "Save changes" : "Create account"}</button> ${ed ? `<button class="btn" id="cu">Cancel</button>` : ""}</p>${ed ? `<p class="muted">To change the password use Reset password in the list below.</p>` : ""}</div>
  <div class="card"><h3>Payroll users</h3><div class="tw"><table><tr><th>Name</th><th>Email</th><th>Department</th><th>Status</th><th></th></tr>${ST.users.map((u) => `<tr><td>${thumb(u)}${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.dept || "-")}</td><td>${u.active ? "Active" : "Disabled"}</td><td><button class="btn sm" data-e="${u.id}">Edit</button> <button class="btn sm" data-p="${u.id}">Reset password</button> <button class="btn sm" data-a="${u.id}" data-v="${u.active ? 0 : 1}">${u.active ? "Disable" : "Enable"}</button> <button class="btn sm d" data-d="${u.id}">Delete</button></td></tr>`).join("")}</table></div></div>`);
  const small = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 160; c.getContext("2d").drawImage(im, 0, 0, 160, 160); ok(c.toDataURL("image/jpeg", .75)); }; im.onerror = () => ok(""); im.src = u; });
  $("#au").onclick = async () => {
    const photo = ST.photoDraft === undefined ? undefined : (ST.photoDraft ? await small(ST.photoDraft) : "");
    if (ed) {
      const r = await api("updateUser", { id: ed.id, name: $("#un").value, email: $("#ue").value, dept: $("#ud").value, photo });
      if (ST.user && ST.user.email && String(ST.user.email).toLowerCase() === String(ed.email).toLowerCase()) { ST.user = { ...ST.user, name: r.name, email: r.email, dept: r.dept, photo: r.photo }; localStorage.setItem("pms.user", JSON.stringify(ST.user)); }
      ST.editUser = null; toast("Account updated."); shell();
    } else { await api("addUser", { name: $("#un").value, email: $("#ue").value, dept: $("#ud").value, password: $("#up").value, photo: photo || "", role: "payroll" }); toast("Account created."); usr(); }
  };
  if ($("#cu")) $("#cu").onclick = () => { ST.editUser = null; usr(); };
  document.querySelectorAll("[data-e]").forEach((b) => b.onclick = () => { ST.editUser = b.dataset.e; usr(); scrollTo(0, 0); });
  document.querySelectorAll("[data-p]").forEach((b) => b.onclick = async () => { const p = prompt("New password (min 6 characters):"); if (p) { await api("setPassword", { id: b.dataset.p, password: p }); toast("Password changed."); } });
  document.querySelectorAll("[data-a]").forEach((b) => b.onclick = async () => { await api("toggleUser", { id: b.dataset.a, active: b.dataset.v === "1" }); usr(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = async () => { if (confirm("Delete this account?")) { await api("deleteUser", { id: b.dataset.d }); usr(); } });
}

/* ===== v2: loading animations, 3 payroll sections, cash loan, holidays, biometric DTR ===== */
const BUSY = { login: "Signing in", bootstrap: "Loading your data", getRun: "Loading payslips", saveRun: "Saving payroll", saveEmployees: "Saving", saveSettings: "Saving settings", deleteRun: "Deleting payroll", deleteEmployee: "Deleting employee", saveLeave: "Saving leave", deleteLeave: "Deleting leave" };
const _api = api;
api = async (a, d) => { const w = BUSY[a] || (/^(save|add|set|toggle)/.test(a) ? "Saving" : "Loading"); $("#busy").innerHTML = `<div class="bx"><div class="spin"></div><b>${w}</b><div class="bar"><i></i></div></div>`; return _api(a, d); };
function toast(t, err) { const m = document.createElement("div"); m.className = "msg" + (err ? " err" : ""); m.innerHTML = (err ? '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.01"/></svg>' : '<svg viewBox="0 0 24 24"><path class="ck" d="M5 12.5l4.5 4.5L19 7.5"/></svg>') + "<span>" + esc(t) + "</span>"; document.body.append(m); setTimeout(() => { m.classList.add("out"); setTimeout(() => m.remove(), 250); }, 3200); }

TABS.splice(0, TABS.length, ["dash", "Dashboard"], ["emp", "Employees"], ["dtr", "DTR / Biometric"], ["leave", "Leave"], ["run", "Payroll"], ["slips", "Payslips"], ["loans", "Cash Loan"], ["rep", "Reports"], ["set", "Settings"], ["usr", "Users"]);
const SCHOOL = { name: "ARK Technological Institute Education System Inc.", address: "J-Seven Bldg. Magallanes Cor. Granja St. Brgy 7 Lucena City", contact: "717-65-10 or at 0907-365-6617" };
const LOGO = "logo.png";
function whoAmI() {   // the signed-in user's 2x2 picture, full name and department (from the matching employee record when the e-mail matches)
  const u = ST.user || {}, em = String(u.email || "").toLowerCase(), e = (em && (ST.employees || []).find((x) => String(x.email || "").toLowerCase() === em)) || {};
  return { name: u.name || nameOf(e) || "User", dept: u.dept || e.dept || "Finance - Payroll", photo: u.photo || e.photo || "" };
}
function shell() {
  const w = whoAmI(), cur = (TABS.find((t) => t[0] === ST.tab) || [])[1] || "";
  A.innerHTML = `<div class="layout"><aside class="side noprint"><div class="sbrand"><img src="${LOGO}" alt=""><b>ARK-Payroll Management System</b></div>
  <div class="prof">${w.photo ? `<img class="pic" src="${w.photo}" alt="">` : `<div class="pic">${esc(String(w.name).charAt(0).toUpperCase() || "?")}</div>`}<div class="pn">${esc(w.name)}</div><div class="pd">${esc(w.dept)}</div></div>
  <div class="smenu">${TABS.map(([k, l]) => `<button data-t="${k}" class="${ST.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
  <div class="sfoot"><a href="#" id="lo">Sign out</a></div></aside>
  <div class="content"><div class="top noprint"><b>${esc(cur)}</b></div><main id="v"></main></div></div>`;
  $("#lo").onclick = (e) => { e.preventDefault(); logout(); };
  document.querySelectorAll(".smenu [data-t]").forEach((b) => b.onclick = () => { ST.tab = b.dataset.t; shell(); });
  ({ dash, emp, dtr, leave, loans, run, slips, rep, set, usr })[ST.tab]();
}
function slipHTML(s, run, sg) {
  const c = s.calc, e = (ST.employees || []).find((x) => String(x.no) === String(s.no)) || {}, P = (n) => "\u20B1" + money(n), dash = (v) => (v === undefined || v === null || v === "" ? "-" : esc(v));
  const hpd = +(ST.settings && ST.settings.hoursPerDay) || 8, rate = c.perHour ? c.rate : (c.dailyRate ? c.dailyRate / hpd : 0);
  let pd = run.payDate || ""; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(pd)); pd = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(pd); pd = isNaN(pd) ? esc(run.payDate || "-") : pd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const E = [[c.perHour ? `Teaching pay (${c.hours} hrs x ${P(c.rate)})` : "Basic pay", c.basic]];
  if ((c.allowList || []).length) c.allowList.forEach((a) => a.amount && E.push([a.label || "Allowance", a.amount])); else if (c.allow) E.push(["Allowances", c.allow]);
  if (c.ot) E.push(["Overtime", c.ot]); if (c.otherEarn) E.push(["Other earnings", c.otherEarn]); if (c.holPay) E.push(["Holiday pay", c.holPay]);
  const D = []; if (c.absent) D.push(["Absences", c.absent]); if (c.late) D.push(["Late", c.late]); if (c.holDed) D.push(["Holiday deduction", c.holDed]);
  D.push(["SSS", c.sssEe], ["PhilHealth", c.phicEe], ["Pag-IBIG", c.hdmfEe], ["Withholding tax", c.tax]); if (c.other) D.push(["Loans / other", c.other]); if (c.caDed) D.push(["Cash advance", c.caDed]);
  const n = Math.max(E.length, D.length, 6); let body = "";
  for (let i = 0; i < n; i++) { const a = E[i], b = D[i]; body += `<tr><td colspan="4">${a ? esc(a[0]) : "&nbsp;"}</td><td colspan="2" class="n">${a ? P(a[1]) : ""}</td><td colspan="4">${b ? esc(b[0]) : ""}</td><td colspan="2" class="n">${b ? P(b[1]) : ""}</td></tr>`; }
  const RL = c.perHour ? ["Rate per hour", "Hours worked", "Days present", "Days absent", "No. of holidays", "Overtime (hrs)"] : ["Rate per day", "Paid days", "Days present", "Days absent", "No. of holidays", "Overtime (hrs)"];
  const pres = c.presentDays === null || c.presentDays === undefined ? "-" : c.presentDays;
  const RV = c.perHour ? [P(c.rate), c.hours, pres, "-", c.holidays || 0, c.otHours || 0] : [P(c.dailyRate), c.paidDays, pres, c.absentDays, c.holidays || 0, c.otHours || 0];
  const cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">EMPLOYEE COPY</b></small></div></div>
  <h2>PAYSLIP</h2>
  <table><tr>${cell("Employee", esc(s.name), 5)}${cell("Employee No.", esc(s.no), 4)}${cell("Pay period", esc(run.period), 3)}</tr>
  <tr>${cell("Position", dash(s.position || e.position), 5)}${cell("Department", dash(e.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr>${cell("SSS No.", dash(e.sssNo), 3)}${cell("PhilHealth No.", dash(e.philhealthNo), 3)}${cell("Pag-IBIG No.", dash(e.pagibigNo), 3)}${cell("TIN", dash(e.tin), 3)}</tr>
  <tr>${RL.map((x) => `<th colspan="2">${x}</th>`).join("")}</tr>
  <tr>${RV.map((x) => `<td colspan="2" class="c">${x}</td>`).join("")}</tr>
  <tr><th colspan="4">EARNINGS</th><th colspan="2">Amount</th><th colspan="4">DEDUCTIONS</th><th colspan="2">Amount</th></tr>${body}
  <tr class="tot"><td colspan="4">GROSS PAY</td><td colspan="2" class="n">${P(c.gross)}</td><td colspan="4">TOTAL DEDUCTIONS</td><td colspan="2" class="n">${P(c.totalDed)}</td></tr></table>
  <div class="net">NET PAY: ${P(c.net)}</div>
  <div class="sg"><div>Received by<i>Employee</i></div>${sg.map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div>
  <div class="dr">DRAFT - not final. Generated ${new Date().toLocaleString("en-US")}</div></div>`;
}

/* ---------- Cash Loan: employee number + information ---------- */
function loanHead(e, E) {
  setTimeout(() => { if ($("#lbody")) $("#lbody").innerHTML = loanRows(E, e.id); }, 0);
  const g = CATEGORIES.find((c) => c.key === categoryOf(e)), rate = (x) => isHourly(x) ? money(Math.max(+x.hourlyRate || 0, minHourly(ST.settings))) + " / hr" : money(dailyRateOf(x, ST.settings)) + " / day";
  return `<div class="card noprint"><div class="who">${e.photo ? `<img class="av" src="${e.photo}" alt="">` : `<div class="av">${esc(String(e.first || e.name || "?")[0])}</div>`}<div><label>Employee ID</label><select id="le">${E.map((x) => `<option value="${x.id}" ${x.id === e.id ? "selected" : ""}>${esc(x.no)} - ${esc(nameOf(x))}</option>`).join("")}</select></div>
  <div style="flex:1;min-width:14rem"><label>Search employee</label><input id="lq" type="search" placeholder="Employee no., name, position or department" value="${esc(ST.loanQ || "")}" style="width:100%"></div></div>
  <div class="facts"><span><small>Employee No.</small><b>${esc(e.no)}</b></span><span><small>Name</small><b>${esc(nameOf(e))}</b></span><span><small>Position</small><b>${esc(e.position || "-")}</b></span><span><small>Department</small><b>${esc(e.dept || "-")}</b></span><span><small>Payroll group</small><b>${g.short}</b></span><span><small>Rate</small><b>${rate(e)}</b></span></div></div>
  <div class="card noprint"><p class="muted" id="lhint"></p><div class="tw"><table><tr><th>No.</th><th>Name</th><th>Position</th><th>Department</th><th>Group</th><th class="n">Cash advance</th><th class="n">Loan balances</th></tr><tbody id="lbody"></tbody></table></div></div>`;
}
const loanFind = (E, q) => E.filter((x) => [x.no, nameOf(x), x.position, x.dept].join(" ").toLowerCase().includes(q));
/** Rows of the cash loan list: the people found by the search box, or (no search) the 10 with the biggest cash advance. */
function loanRows(E, selId) {
  const q = (ST.loanQ || "").trim().toLowerCase(), bal = (x) => (x.deductions || []).reduce((n, d) => n + (+d.balance || 0), 0);
  let L = q ? loanFind(E, q) : E.filter((x) => +(x.ca || {}).balance > 0).sort((a, b) => b.ca.balance - a.ca.balance).slice(0, 10);
  const more = q && L.length > 30; if (more) L = L.slice(0, 30);
  const h = $("#lhint"); if (h) h.textContent = q ? (L.length ? `${L.length} found${more ? " (showing the first 30, type more to narrow down)" : ""}.` : "No employee found.") : `Top 10 employees with a cash advance. Search to find anyone else.`;
  return L.map((x) => `<tr class="pick ${x.id === selId ? "sel" : ""}" data-pick="${x.id}"><td>${esc(x.no)}</td><td>${esc(nameOf(x))}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${CATEGORIES.find((c) => c.key === categoryOf(x)).short}</td><td class="n">${money((x.ca || {}).balance)}</td><td class="n">${money(bal(x))}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">${q ? "No employee matches your search." : "Nobody has a cash advance."}</td></tr>`;
}
document.addEventListener("input", (ev) => { if (ev.target.id === "lq") { ST.loanQ = ev.target.value; const sel = $("#le"); const cur = sel ? sel.value : "", q = ST.loanQ.trim().toLowerCase(); $("#lbody").innerHTML = loanRows(ST.employees, cur);
  if (sel) { let L = q ? loanFind(ST.employees, q) : ST.employees; if (!L.some((x) => x.id === cur)) L = [ST.employees.find((x) => x.id === cur), ...L].filter(Boolean); sel.innerHTML = L.map((x) => `<option value="${x.id}" ${x.id === cur ? "selected" : ""}>${esc(x.no)} - ${esc(nameOf(x))}</option>`).join(""); } } });
document.addEventListener("click", (ev) => { const r = ev.target.closest("tr[data-pick]"); if (r) loans(r.dataset.pick); });

/* ---------- Philippine holidays: detected automatically (no internet needed) ----------
   Fixed holidays, Holy Week and National Heroes Day are worked out for ANY year.
   Dates that Malacañang declares year by year (Chinese New Year, Eid'l Fitr / Eid'l Adha, All Souls' Day, Christmas Eve)
   are listed per year below. When next year's proclamation is out, add one more line to PH_PROCLAIMED. */
const PH_PROCLAIMED = {
  2026: { src: "Proclamation No. 1006 s. 2025, No. 1189 (Eid'l Fitr) and No. 1264 (Eid'l Adha)", list: [["02-17", "Chinese New Year", "special"], ["03-20", "Eid'l Fitr", "regular"], ["05-27", "Eid'l Adha", "regular"], ["11-02", "All Souls' Day", "special"], ["12-24", "Christmas Eve", "special"]] },
  2027: { src: "Proclamation No. 1427 s. 2026", pending: "Eid'l Fitr and Eid'l Adha 2027", list: [["02-06", "Chinese New Year", "special"], ["11-02", "All Souls' Day", "special"], ["12-24", "Christmas Eve", "special"]] }
};
function phEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), t = h + l - 7 * m + 114;
  return new Date(y, Math.floor(t / 31) - 1, (t % 31) + 1, 12);
}
function phHolidays(y) {
  const L = [], add = (date, label, type) => L.push({ date, label, type });
  [["01-01", "New Year's Day"], ["04-09", "Araw ng Kagitingan (Day of Valor)"], ["05-01", "Labor Day"], ["06-12", "Independence Day"], ["11-30", "Bonifacio Day"], ["12-25", "Christmas Day"], ["12-30", "Rizal Day"]].forEach(([md, n]) => add(`${y}-${md}`, n, "regular"));
  const h = new Date(y, 7, 31, 12); while (h.getDay() !== 1) h.setDate(h.getDate() - 1); add(ymd(h), "National Heroes Day", "regular");   // last Monday of August
  const E = phEaster(y), off = (n) => { const x = new Date(E); x.setDate(x.getDate() + n); return ymd(x); };
  add(off(-3), "Maundy Thursday", "regular"); add(off(-2), "Good Friday", "regular"); add(off(-1), "Black Saturday", "special");
  [["08-21", "Ninoy Aquino Day"], ["11-01", "All Saints' Day"], ["12-08", "Feast of the Immaculate Conception"], ["12-31", "Last Day of the Year"]].forEach(([md, n]) => add(`${y}-${md}`, n, "special"));
  const P = PH_PROCLAIMED[y]; if (P) P.list.forEach(([md, n, t]) => add(`${y}-${md}`, n, t));
  L.sort((a, b) => a.date < b.date ? -1 : 1);
  const note = P ? `Source: ${P.src}.${P.pending ? ` ${P.pending} will be proclaimed separately - add them when announced.` : ""}` : `No yearly proclamation is loaded for ${y}. Fixed holidays, Holy Week and National Heroes Day were filled in. Chinese New Year, Eid'l Fitr, Eid'l Adha, All Souls' Day and Christmas Eve are declared each year, so add them when announced.`;
  return { list: L, note };
}
/** Adds the detected holidays of a year to Settings once (never overwrites a date you already have, never re-adds one you removed and saved). */
function phEnsure(y, force) {
  const D = ST.settings.dtr; D.holidays ||= []; D.holAuto ||= [];
  if (!force && D.holAuto.includes(y)) return 0;
  const have = new Set(D.holidays.map((h) => h.date)); let n = 0;
  for (const h of phHolidays(y).list) if (!have.has(h.date)) { D.holidays.push({ ...h }); n++; }
  if (!D.holAuto.includes(y)) D.holAuto.push(y);
  return n;
}
function phAutoFill() { const y = new Date().getFullYear(); phEnsure(y); phEnsure(y + 1); }

/* ---------- Settings: holidays, holiday pay, DTR hours ---------- */
const holRow = (h) => `<tr data-hr><td><input type="date" class="hd" value="${esc(h.date || "")}"></td><td><input class="hl" value="${esc(h.label || "")}"></td><td><select class="ht"><option value="regular">Regular holiday</option><option value="special" ${h.type === "special" ? "selected" : ""}>Special non-working day</option></select></td><td><button class="btn sm d" data-hx>Remove</button></td></tr>`;
function holHTML(S) {
  const H = S.holiday, D = S.dtr, yr = new Date().getFullYear(), p = (id, l, v) => `<div><label>${l}</label><input type="number" step="any" id="${id}" value="${v}"></div>`;
  return `<div data-sp="hol" ${spHide("hol")}><h3>Holidays</h3><div class="row noprint"><div><label>Year</label><select id="hy">${[yr - 1, yr, yr + 1, yr + 2].map((y) => `<option value="${y}" ${y === yr ? "selected" : ""}>${y}</option>`).join("")}</select></div><button class="btn p" id="ahd">Auto-detect Philippine holidays</button></div><p class="muted" id="hn">Philippine holidays for ${yr} and ${yr + 1} are added automatically. Choose a year and press the button to add another year. Remove or edit any line that does not apply to your school.</p><div class="tw"><table id="htab"><tr><th>Date</th><th>Holiday</th><th>Type</th><th></th></tr>${(D.holidays || []).slice().sort((a, b) => a.date < b.date ? -1 : 1).map(holRow).join("")}</table></div><p><button class="btn" id="ah">+ Add holiday</button></p></div>
  <div data-sp="hp" ${spHide("hp")}><h3>Holiday pay (% of the daily rate)</h3><div class="form">${p("hp1", "Regular holiday, not worked", H.regular.notWorked)}${p("hp2", "Regular holiday, worked", H.regular.worked)}${p("hp3", "Special day, not worked", H.special.notWorked)}${p("hp4", "Special day, worked", H.special.worked)}<div><label>Teachers paid on holidays</label><select id="hp5"><option value="1">Yes</option><option value="0" ${H.teachersPaid === false ? "selected" : ""}>No</option></select></div></div></div>
  <div data-sp="dtr" ${spHide("dtr")}><h3>Work days, hours and attendance rules (DTR and payroll)</h3><div class="form"><div><label>Time in</label><input type="time" id="dt1" value="${D.start}"></div><div><label>Time out</label><input type="time" id="dt2" value="${D.end}"></div>${p("dt3", "Lunch break (minutes)", D.lunchMin)}${p("dt4", "Grace period for late - Staff (minutes)", D.graceStaff ?? D.graceMin ?? 30)}${p("dt5", "Grace period for late - Teachers (minutes)", D.graceTeacher ?? 15)}</div><p class="muted">Arriving within the grace period is not late. Arriving after it is counted late from the official time in. Admins use the Staff grace period.</p>
  <h4 style="margin:1rem 0 .3rem">Working days</h4><div>${[[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]].map(([n, l]) => `<label style="display:inline-flex;gap:.3rem;align-items:center;margin-right:1rem"><input type="checkbox" class="wdc" value="${n}" ${(D.workDays || [1, 2, 3, 4, 5, 6]).includes(n) ? "checked" : ""}>${l}</label>`).join("")}</div>
  <p class="muted">Days not ticked are rest days: nobody is marked absent on them, and a rest day is not paid unless it is worked. The payroll's <b>Working days per month</b> (Payroll settings, now ${S.workDays}) sets the daily rate = monthly pay &divide; that number; use 26 for Monday to Saturday.</p>
  <h4 style="margin:1rem 0 .3rem">Attendance rules</h4><div class="form">
  <div><label>Work on a rest day (Sunday)</label><select id="dt6"><option value="1">Counts as overtime</option><option value="0" ${D.restDayAsOt === false ? "selected" : ""}>Not counted</option></select></div>
  <div><label>No time in (only a time out)</label><select id="dt7">${[["absent", "Absent (whole day)"], ["half", "Half day"], ["none", "Not counted (present)"]].map(([k, l]) => `<option value="${k}" ${(D.noInRule || "absent") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div><label>No time out (only a time in)</label><select id="dt8">${[["half", "Half day"], ["absent", "Absent (whole day)"], ["none", "Not counted (present)"]].map(([k, l]) => `<option value="${k}" ${(D.noOutRule || "half") === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  ${p("dt9", "Half day counts as (days absent)", D.halfDayAbs ?? 0.5)}</div>
  <p class="muted">No punch at all on a working day is always absent. A half day is deducted from the salary as the number of absent days above (0.5 = half a day's pay) and shows in the payslip's days absent. Work on a rest day is added to the overtime hours of the payroll (overtime multiplier is in Payroll settings).</p></div>
  <div data-sp="lv" ${spHide("lv")}><h3>Leave types</h3><p class="muted">Choose which leave is <b>with pay</b> (no salary deduction) or <b>without pay</b> (deducted). Days per year: 0 = no limit.</p><div class="tw"><table id="ltab"><tr><th>Leave type</th><th>Pay</th><th>Days per year</th><th></th></tr>${leaveTypes(S).map(lvRow).join("")}</table></div><p><button class="btn" id="alt">+ Add leave type</button></p><div class="form"><div><label>Deduct approved leave without pay automatically</label><select id="lv_ded"><option value="1">Yes</option><option value="0" ${S.unpaidLeave === false ? "selected" : ""}>No</option></select></div></div></div>`;
}
function setExtras() {
  const rows = () => [...document.querySelectorAll("[data-hr]")].map((r) => ({ date: $(".hd", r).value, label: $(".hl", r).value.trim(), type: $(".ht", r).value })).filter((h) => h.date);
  $("#ah").onclick = () => $("#htab").insertAdjacentHTML("beforeend", holRow({}));
  $("#alt").onclick = () => $("#ltab").insertAdjacentHTML("beforeend", lvRow({ paid: true }));
  $("#ltab").onclick = (e) => { const b = e.target.closest("[data-lx]"); if (b) b.closest("tr").remove(); };
  $("#htab").onclick = (e) => { const b = e.target.closest("[data-hx]"); if (b) b.closest("tr").remove(); };
  $("#ahd").onclick = () => {
    const y = +$("#hy").value, r = phHolidays(y), L = rows(), have = new Set(L.map((h) => h.date)), add = r.list.filter((h) => !have.has(h.date)), D = ST.settings.dtr;
    $("#htab").innerHTML = "<tr><th>Date</th><th>Holiday</th><th>Type</th><th></th></tr>" + [...L, ...add].sort((a, b) => a.date < b.date ? -1 : 1).map(holRow).join("");
    D.holAuto = [...new Set([...(D.holAuto || []), y])];
    $("#hn").textContent = `${add.length} holiday(s) added for ${y}. ${r.note} Press Save settings to keep them.`; toast(`${add.length} holiday(s) added for ${y}.`);
  };
}
function collectExtras() {
  const S = ST.settings, v = (id) => $("#" + id).value;
  S.dtr.holidays = [...document.querySelectorAll("[data-hr]")].map((r) => ({ date: $(".hd", r).value, label: $(".hl", r).value.trim(), type: $(".ht", r).value })).filter((h) => h.date);
  S.holiday = { regular: { notWorked: +v("hp1"), worked: +v("hp2") }, special: { notWorked: +v("hp3"), worked: +v("hp4") }, teachersPaid: v("hp5") === "1" };
  Object.assign(S.dtr, { start: v("dt1") || "08:00", end: v("dt2") || "17:00", lunchMin: +v("dt3"), graceStaff: +v("dt4") || 0, graceTeacher: +v("dt5") || 0, graceMin: +v("dt4") || 0,
    workDays: [...document.querySelectorAll(".wdc")].filter((c) => c.checked).map((c) => +c.value), restDayAsOt: v("dt6") === "1", noInRule: v("dt7"), noOutRule: v("dt8"), halfDayAbs: Math.min(1, Math.max(0, isNaN(+v("dt9")) ? 0.5 : +v("dt9"))), daysV: 2 });
  if (!S.dtr.workDays.length) S.dtr.workDays = [1, 2, 3, 4, 5, 6];
  S.leaveTypes = [...document.querySelectorAll("[data-lt]")].map((r) => ({ name: $(".ln", r).value.trim(), paid: $(".lp", r).value === "1", days: +$(".ld", r).value || 0 })).filter((x) => x.name); S.unpaidLeave = v("lv_ded") === "1";
}

/* ---------- Biometric files -> DTR ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDay = (s, n = 1) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); };
const normNo = (s) => String(s ?? "").trim().replace(/^0+(?=.)/, "").toLowerCase();
const hm = (n) => n == null ? "" : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
/* ---------- Biometric record -> employee, matched by NAME (Last name, First name, Initial) ----------
   The Biometric ID does not have to equal the Employee ID. Order of trust: manual link > name in the file > same ID number. */
const nameNorm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9,\s]/g, " ").replace(/\s+/g, " ").trim();
const SUFFIX = new Set(["JR", "SR", "II", "III", "IV"]);
const words = (s) => nameNorm(s).replace(/,/g, " ").split(" ").filter((t) => t && !SUFFIX.has(t));
function empParts(e) {
  let last = e.last, first = e.first;
  if (!last && !first && e.name) { const [a, ...b] = String(e.name).split(","); if (b.length) { last = a; first = b.join(" "); } else first = a; }
  const F = words(first), ini = nameNorm(e.mi).charAt(0) || (F.length > 1 && F[F.length - 1].length === 1 ? F[F.length - 1] : "");
  return { L: words(last), F: F.filter((t) => t.length > 1), mi: ini };
}
function bioParts(raw) {
  const s = nameNorm(raw); if (!s) return null;
  const sp = (x) => x.split(" ").filter((t) => t && !SUFFIX.has(t));
  if (s.includes(",")) { const [a, ...b] = s.split(","), L = sp(a), R = sp(b.join(" ")); return { flat: false, L, ini: R.filter((t) => t.length === 1), all: [...L, ...R.filter((t) => t.length > 1)] }; }
  const T = sp(s); return { flat: true, L: [], ini: T.filter((t) => t.length === 1), all: T.filter((t) => t.length > 1) };
}
const lev = (a, b) => { const m = a.length, n = b.length; let p = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; };
const tokEq = (a, b) => a === b || (a.length > 4 && b.length > 4 && lev(a, b) <= 1) || (a === "MA" && b.startsWith("MA")) || (b === "MA" && a.startsWith("MA"));
function nameScore(bp, ep) {
  const E = [...ep.L, ...ep.F]; if (!bp || !bp.all.length || !E.length) return 0;
  const cb = bp.all.join(""), Lc = ep.L.join(""), Fc = ep.F.join(""); let sc;
  if (cb === Lc + Fc || cb === Fc + Lc) sc = 1;
  else {
    const toks = bp.all.slice(), used = new Set(); let fh = 0;
    if (ep.L.length > 1) { const i = toks.findIndex((t) => tokEq(t, Lc)); if (i >= 0) { toks.splice(i, 1); ep.L.forEach((_, j) => used.add(j)); } }   // "DELACRUZ" = "Dela Cruz"
    for (const t of toks) { const k = E.findIndex((x, i) => !used.has(i) && tokEq(t, x)); if (k < 0) return 0; used.add(k); if (k >= ep.L.length) fh++; }
    if (!fh || [...used].filter((i) => i < ep.L.length).length !== ep.L.length) return 0;   // the whole surname AND at least one given name must be there
    if (!bp.flat && !bp.L.every((t) => ep.L.some((x) => tokEq(t, x)) || tokEq(t, Lc))) return 0; // "LAST, First" must agree on the surname side
    sc = 0.6 + 0.4 * used.size / E.length;
  }
  if (bp.ini.length && ep.mi) { if (!bp.ini.includes(ep.mi)) return 0; sc += 0.05; }   // a different middle initial = probably another person: link it by hand
  return Math.min(1, sc);
}
function matchName(name, P) {
  const bp = bioParts(name); if (!bp) return null;
  const r = P.map(([e, ep]) => [e, nameScore(bp, ep)]).filter((x) => x[1] >= 0.7).sort((a, b) => b[1] - a[1]);
  if (!r.length) return null;
  return r[1] && r[0][1] - r[1][1] < 0.1 ? { amb: r.filter((x) => r[0][1] - x[1] < 0.1).map((x) => x[0]) } : { e: r[0][0] };
}
/** Which employee does each biometric record belong to? Cached; reset with ST._dm = null. */
function dtrMap() {
  if (ST._dm) return ST._dm;
  const D = ST.dtr, emps = ST.employees; D.names ||= {}; D.link ||= {};
  const P = emps.map((e) => [e, empParts(e)]), byNo = new Map(emps.map((e) => [normNo(e.no), e])), byEmp = {}, unmatched = [];
  for (const k of Object.keys(D.days)) {
    const nm = D.names[k] || "", man = D.link[k] && emps.find((e) => e.id === D.link[k]), m = !man && nm ? matchName(nm, P) : null, idE = byNo.get(k);
    let e = null, by = "", warn = "";
    if (man) { e = man; by = "manual"; }
    else if (m && m.e) { e = m.e; by = "name"; }
    else if (m && m.amb && idE && m.amb.includes(idE)) { e = idE; by = "name + ID"; }
    else if (!(m && m.amb) && idE) { e = idE; by = "ID"; if (nm) warn = "name in file: " + nm; }
    if (e) { const x = (byEmp[e.id] ||= { keys: [], by: [], warn: [] }); x.keys.push(k); if (!x.by.includes(by)) x.by.push(by); if (warn) x.warn.push(warn); }
    else unmatched.push({ key: k, name: nm, amb: m && m.amb ? m.amb : null });
  }
  return (ST._dm = { byEmp, unmatched });
}
/** All punches of one employee (several biometric IDs of the same person are merged). */
function daysOf(e) {
  const m = dtrMap().byEmp[e.id]; if (!m) return null;
  if (m.keys.length === 1) return ST.dtr.days[m.keys[0]];
  const out = {}; for (const k of m.keys) for (const [d, a] of Object.entries(ST.dtr.days[k])) out[d] = [...new Set([...(out[d] || []), ...a])];
  return out;
}

ST.dtr = (() => { try { return JSON.parse(localStorage.getItem("pms.dtr")) || { days: {} }; } catch { return { days: {} }; } })();
const saveDtr = () => { try { localStorage.setItem("pms.dtr", JSON.stringify(ST.dtr)); } catch { } };
function parseStamp(v) {
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes());
  const s = String(v ?? "").trim(); let y, mo, d, h, mi, ap, m;
  if (m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { [, y, mo, d, h, mi, ap] = m; }
  else if (m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { y = +m[3] < 100 ? 2000 + (+m[3]) : m[3]; [mo, d] = ST.settings.dtr.dateOrder === "DMY" ? [m[2], m[1]] : [m[1], m[2]]; h = m[4]; mi = m[5]; ap = m[6]; }
  else return null;
  h = +h; if (ap) { ap = ap.toUpperCase(); if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0; }
  return new Date(+y, +mo - 1, +d, h, +mi);
}
/* ===== BIOMETRIC READER (any layout) ===== */
/* Reads Excel (.xlsx/.xls/.ods), CSV and text/DAT exports in these layouts:
   1) one row per day with Time In / Time Out (and break) columns   2) one punch per row (ID + date/time)
   3) separate Date and Time columns   4) calendar grid (days 1-31 across the page)   5) plain text lines.
   The header row can be anywhere, column names can be anything reasonable, and times can be 24h, AM/PM, text or Excel time cells. */
const BIO = (() => {
  const MONS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", mon = (s) => MONS.split("|").indexOf(String(s).slice(0, 3).toLowerCase()) + 1;
  const ok = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null);
  const order = () => (ST.settings && ST.settings.dtr && ST.settings.dtr.dateOrder) || "MDY";
  const ab = (a, b, y) => { a = +a; b = +b; y = +y; if (y < 100) y += 2000; return a > 12 ? ok(y, b, a) : b > 12 ? ok(y, a, b) : order() === "DMY" ? ok(y, b, a) : ok(y, a, b); };
  const blank = (v) => v === "" || v === null || v === undefined || (typeof v === "string" && !v.trim());

  /* ---- dates ---- */
  function dateIn(s) {   // first date written inside a string -> {y,m,d,i,n}
    const find = (rx, f) => { const m = rx.exec(s); if (!m) return null; const x = f(m); return x && { ...x, i: m.index + (m[1] || "").length, n: m[0].length - (m[1] || "").length }; };
    return find(/(^|\D)(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/, (m) => ok(+m[2], +m[3], +m[4]))
      || find(new RegExp("(^|\\D)(\\d{1,2})[\\s\\-\\/.]*(" + MONS + ")[a-z]*\\.?[\\s\\-,\\/.]*(\\d{4}|\\d{2})(?!\\d)", "i"), (m) => ok(+m[4] < 100 ? 2000 + +m[4] : +m[4], mon(m[3]), +m[2]))
      || find(new RegExp("(^|[^A-Za-z])(" + MONS + ")[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})(?!\\d)", "i"), (m) => ok(+m[4], mon(m[2]), +m[3]))
      || find(/(^|\D)(\d{1,2})[-\/](\d{1,2})[-\/](\d{4}|\d{2})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/(^|\D)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/^\s*()(\d{4})(\d{2})(\d{2})(?:\d{4,6})?\s*$/, (m) => ok(+m[2], +m[3], +m[4]));
  }
  function dateOf(v) {
    if (v instanceof Date) return isNaN(v) ? null : ok(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === "number") {
      if (v >= 30000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
      return Number.isInteger(v) && v >= 19900101 && v <= 21001231 ? dateIn(String(v)) : null;
    }
    return typeof v === "string" ? dateIn(v) : null;
  }

  /* ---- times (minutes after midnight) ---- */
  const TRX = /(^|[^\d:.])(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?(?![\d:])/g;
  function timesIn(s) {
    const out = []; let m; TRX.lastIndex = 0;
    while ((m = TRX.exec(s))) { let h = +m[2]; const mi = +m[3]; let ap = m[5]; if (mi > 59) continue; if (ap) { if (h < 1 || h > 12) continue; ap = ap.toUpperCase(); if (ap === "P" && h < 12) h += 12; if (ap === "A" && h === 12) h = 0; } else if (h > 23) continue; out.push(h * 60 + mi); }
    return out;
  }
  function timesOf(v, loose) {   // loose: the column is known to hold times, so 0727 / 730 also count
    let r = [];
    if (v instanceof Date) r = isNaN(v) ? [] : [v.getHours() * 60 + v.getMinutes()];
    else if (typeof v === "number") {
      if (v > 0 && v < 1) r = [Math.round(v * 1440) % 1440];
      else if (v >= 30000 && v < 80000 && v % 1) r = [Math.round((v % 1) * 1440) % 1440];
      else if (loose && Number.isInteger(v) && v >= 100 && v <= 2359 && v % 100 < 60) r = [Math.floor(v / 100) * 60 + (v % 100)];
    } else if (typeof v === "string") {
      const s = v.trim(); r = timesIn(s);
      if (!r.length && loose && /^\d{3,4}$/.test(s)) { const n = +s; if (n % 100 < 60 && n < 2400) r = [Math.floor(n / 100) * 60 + (n % 100)]; }
    }
    return r.filter((t) => t > 0);   // 00:00 is how many exports show an empty cell
  }

  /* ---- what is each column? ---- */
  const NOT = /late|under|overtime|hrs|hours?|total|(^|[^a-z])mins?([^a-z]|$)|minutes?|rate|pay|status|leave|type|dept|remark|note|shift|sched|hired|birth|dtr|summary|balance|loan/;
  function roleOf(h) {
    const s = String(h ?? "").toLowerCase().replace(/[\r\n]+/g, " ").trim(); if (!s || s.length > 40) return null;
    if (/^(m\.?\s?i\.?|middle.*)$/.test(s)) return "mi";
    if (/last.?name|surname|family.?name|^l\.?name$/.test(s)) return "last";
    if (/first.?name|given.?name|^f\.?name$/.test(s)) return "first";
    if (/date.?time|time.?stamp|punch|check.?time|log.?time|scan.?time|clock.?time/.test(s)) return "tm";
    if (/name/.test(s) && !/file|machine|device|company|branch|position|group|type|shift|leave|dept|department|sheet/.test(s)) return "name";
    if (/^(employee|emp|person|staff)$/.test(s)) return "name";
    if ((/(^|[^a-z])(id|no|num|number|code)\.?$/.test(s) || /^(id|no|userid|user id|badge|pin)\b/.test(s)) && !/type|dept|department|status|note|device|machine|terminal|leave|work|verify|event|mode|rate|rank|sss|tin|philhealth|pag|account|bank/.test(s)) return "id";
    if (/date/.test(s) && !/hired|birth|end|start|from|expir|period|created|(^|[^a-z])to$/.test(s)) return "date";
    if (/(^|[^a-z])(time|in|out|am|pm|break|lunch|check|clock|arriv|depart|punch|scan|log)([^a-z]|$)/.test(s) && !NOT.test(s) && !/(^|[^a-z])ot([^a-z]|$)|code/.test(s)) return "tm";
    return NOT.test(s) || /(^|[^a-z])ot([^a-z]|$)/.test(s) ? "x" : null;
  }
  function findHeader(rows) {
    let best = -1, bs = 1;
    rows.slice(0, 40).forEach((r, i) => { let sc = 0, t = false, d = false; for (const c of r || []) { if (typeof c !== "string") continue; const ro = roleOf(c); if (ro && ro !== "x") { sc++; if (ro === "tm") t = true; if (ro === "date") d = true; } } if ((t || d) && sc > bs) { best = i; bs = sc; } });
    return best;
  }

  /* ---- layout A: a table (one row per day, or one punch per row) ---- */
  function table(rows, push) {
    const hi = findHeader(rows), start = hi + 1; let N = 0; rows.slice(0, 300).forEach((r) => { N = Math.max(N, (r || []).length); });
    const role = new Array(N).fill(null), blankHead = new Array(N).fill(true);
    if (hi >= 0) rows[hi].forEach((h, j) => { if (!blank(h)) blankHead[j] = false; role[j] = roleOf(h); });
    const sample = rows.slice(start, start + 80);
    for (let j = 0; j < N; j++) {      // columns the header could not explain: look at the data itself
      if (role[j] && role[j] !== "x") continue; if (role[j] === "x") continue;
      const v = sample.map((r) => (r || [])[j]).filter((x) => !blank(x)); if (v.length < 2) continue;
      const share = (f) => v.filter(f).length / v.length;
      if (share((x) => timesOf(x, false).length > 0) >= 0.7) role[j] = "tm";
      else if (share((x) => !!dateOf(x)) >= 0.7) role[j] = "date";
      else if (blankHead[j]) {
        const idLike = (x) => /^[A-Za-z]{0,6}[-_ ]?\d{1,12}$/.test(String(x).trim()), nameLike = (x) => typeof x === "string" && /[A-Za-z]{3,}/.test(x) && !timesOf(x, false).length && !dateOf(x);
        if (!role.includes("id") && share(idLike) >= 0.8) role[j] = "id";
        else if (!role.includes("name") && share(nameLike) >= 0.8 && new Set(v.map((x) => String(x).trim().toLowerCase())).size >= 3) role[j] = "name";
      }
    }
    const idx = (k) => role.map((r, j) => (r === k ? j : -1)).filter((j) => j >= 0), C = { id: idx("id"), name: idx("name"), date: idx("date"), tm: idx("tm"), last: idx("last")[0] ?? -1, first: idx("first")[0] ?? -1, mi: idx("mi")[0] ?? -1 };
    if (!C.tm.length && !C.date.length) return;
    if (!C.id.length && !C.name.length && !(C.last >= 0 && C.first >= 0)) return;
    let cur = null;
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]; if (!r || !r.some((x) => !blank(x))) continue;
      const cell = (j) => (blank(r[j]) ? "" : r[j]);
      let id = ""; for (const j of C.id) { const v = String(cell(j)).trim(); if (v) { id = v; break; } }
      let nm = ""; if (C.last >= 0 && C.first >= 0) nm = `${cell(C.last)}, ${cell(C.first)} ${C.mi >= 0 ? cell(C.mi) : ""}`.replace(/^[\s,]+|[\s,]+$/g, ""); else for (const j of C.name) { const v = String(cell(j)).trim(); if (v) { nm = v; break; } }
      let date = null; for (const j of C.date) { date = dateOf(cell(j)); if (date) break; }
      const ts = [];
      for (const j of C.tm) { const v = cell(j); if (v === "") continue; const t = timesOf(v, true); if (!t.length) continue; const cd = dateOf(v); t.forEach((m) => ts.push([m, cd])); }
      if (!ts.length) for (const j of C.date) for (const m of timesOf(cell(j), false)) ts.push([m, null]);   // a "Date" column that also holds the time
      if (!id && !nm) { if (date && !ts.length) cur = date; continue; }   // a line like "Date: 11/11/2026" above a group of rows
      if (!ts.length) continue;
      for (const [m, cd] of ts) { const d = cd || date || cur; if (d) push(id, new Date(d.y, d.m - 1, d.d, Math.floor(m / 60), m % 60), nm); }
    }
  }

  /* ---- layout B: calendar grid, days 1-31 (or dates) across the top, several times in each cell ---- */
  let warn = "";
  function grid(rows, push) {
    let hi = -1, cols = [];
    for (let i = 0; i < Math.min(rows.length, 40) && hi < 0; i++) {
      const r = rows[i] || [], dt = [], dn = [];
      r.forEach((c, j) => {
        const s = String(c ?? "").trim(), m = /^(\d{1,2})(?:[\s\r\n]+[A-Za-z]{2,9}\.?)?$/.exec(s);
        if (m && +m[1] >= 1 && +m[1] <= 31) dn.push([j, +m[1]]);
        else if (!timesOf(c, false).length && !blank(c)) { const d = dateOf(c); if (d && (typeof c !== "string" || dateIn(c).n >= s.length - 1)) dt.push([j, d]); }
      });
      const asc = (a) => a.length >= 7 && a.slice(1).filter((x, k) => x[1] > a[k][1]).length >= (a.length - 1) * 0.8;
      if (dt.length >= 5) { hi = i; cols = dt.map(([j, d]) => ({ j, d })); }
      else if (asc(dn)) { hi = i; cols = dn.map(([j, d]) => ({ j, day: d })); }
    }
    if (hi < 0) return;
    if (cols[0].day !== undefined) {   // only day numbers: the month comes from the title lines
      const txt = rows.slice(0, hi + 3).flat().filter((x) => x !== "" && x != null).map((x) => (typeof x === "number" && x >= 30000 && x < 80000 ? (() => { const d = dateOf(x); return d ? `${d.y}-${d.m}-${d.d}` : ""; })() : String(x))).join(" | ");
      let y = 0, mo = 0, m;
      if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      else if ((m = new RegExp("(" + MONS + ")[a-z]*\\.?[\\s,\\-]*(\\d{4})", "i").exec(txt))) { y = +m[2]; mo = mon(m[1]); }
      else if ((m = new RegExp("(\\d{4})[\\s,\\-]*(" + MONS + ")", "i").exec(txt))) { y = +m[1]; mo = mon(m[2]); }
      else if ((m = /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(txt))) { const d = ab(m[1], m[2], m[3]); if (d) { y = d.y; mo = d.m; } }
      else if ((m = /(\d{4})[-\/.](\d{1,2})(?![\d])/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      if (!y || mo < 1 || mo > 12) { warn = "This looks like a calendar-style report (days 1-31 across the page) but the month and year could not be found. Type the month, for example 2026-11, in a cell above the table and upload again."; return; }
      let prev = 0; for (const c of cols) { if (c.day < prev) { mo++; if (mo > 12) { mo = 1; y++; } } prev = c.day; c.d = ok(y, mo, c.day); }
    }
    const first = Math.min(...cols.map((c) => c.j)), left = {}; (rows[hi] || []).forEach((h, j) => { if (j < first) { const ro = roleOf(h); if (ro === "id" || ro === "name") left[j] = ro; } });
    const LI = /^\s*(?:user\s*)?(?:id|no\.?|emp(?:loyee)?\s*(?:id|no\.?)|badge(?:\s*(?:id|no\.?))?)\s*[:\uFF1A]\s*(.*)$/i, LN = /^\s*(?:emp(?:loyee)?\s*)?name\s*[:\uFF1A]\s*(.*)$/i;
    const nextNZ = (r, j) => { for (let k = j + 1; k < r.length; k++) { const s = String(r[k] ?? "").trim(); if (s) return LI.test(s) || LN.test(s) ? "" : s; } return ""; };
    let cur = { id: "", nm: "" };
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || []; let id = "", nm = "";
      for (let j = 0; j < r.length; j++) { const s = String(r[j] ?? "").trim(); let m; if ((m = LI.exec(s))) id = m[1].trim() || nextNZ(r, j); else if ((m = LN.exec(s))) nm = m[1].trim() || nextNZ(r, j); }
      for (const j in left) { const v = String(r[j] ?? "").trim(); if (!v) continue; if (left[j] === "id" && !id) id = v; if (left[j] === "name" && !nm) nm = v; }
      if (id) cur = { id, nm }; else if (nm) cur = { id: cur.id, nm };
      if (!cur.id && !cur.nm) continue;
      for (const c of cols) { if (!c.d) continue; for (const m of timesOf(r[c.j], false)) push(cur.id, new Date(c.d.y, c.d.m - 1, c.d.d, Math.floor(m / 60), m % 60), cur.nm); }
    }
  }

  /* ---- layout C: text / DAT / CSV ---- */
  function splitLine(l, d) { const out = []; let c = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === d && !q) { out.push(c.trim()); c = ""; } else c += ch; } out.push(c.trim()); return out; }
  const STOP = /^(in|out|check|(check|clock|time)[-_]?(in|out)|c\/(in|out)|fp|face|card|pw|normal|ot|am|pm|i|o)$/i;
  function scanLine(ln, push) {
    const dm = dateIn(ln); if (!dm) return;
    const rest0 = ln.slice(0, dm.i) + " " + ln.slice(dm.i + dm.n), ts = timesIn(rest0); if (!ts.length) return;
    const toks = rest0.replace(TRX, " ").split(/[\s|;]+/).filter(Boolean), id = toks.find((t) => /^[A-Za-z]{0,6}[-_]?\d{1,12}$/.test(t)) || "";
    const nm = toks.filter((t) => t !== id && /[A-Za-z]{2,}/.test(t) && !STOP.test(t)).join(" ");
    if (!id && !nm) return;
    ts.forEach((m) => { if (m > 0) push(id, new Date(dm.y, dm.m - 1, dm.d, Math.floor(m / 60), m % 60), nm); });
  }
  function text(txt, push) {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return;
    const smp = lines.slice(0, 12), delim = ["\t", ";", "|", ","].find((d) => smp.filter((l) => l.includes(d)).length >= Math.ceil(smp.length * 0.8));
    const rows = delim ? lines.map((l) => splitLine(l, delim)) : null;
    let n = 0; const counted = (...x) => { n++; push(...x); };
    const viaRows = () => { if (rows) sheet(rows, counted); }, viaLines = () => lines.forEach((l) => scanLine(l, counted));
    const [a, b] = rows && (delim === "\t" || findHeader(rows) >= 0) ? [viaRows, viaLines] : [viaLines, viaRows];
    a(); if (!n) b();
  }
  function sheet(rows, push) { let n = 0; const p = (...x) => { n++; push(...x); }; grid(rows, p); if (!n) table(rows, p); }

  async function readText(f) {
    const b = new Uint8Array(await f.arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
    return new TextDecoder("utf-8").decode(b).replace(/^\uFEFF/, "");
  }
  return { sheet, text, readText, take: () => { const w = warn; warn = ""; return w; } };
})();

async function readPunches(f) {
  const out = [], push = (id, dt, nm) => {
    nm = String(nm ?? "").replace(/\s+/g, " ").trim(); if (!/[A-Za-z]/.test(nm)) nm = "";
    const has = id !== "" && id != null && String(id).trim() !== "", k = has ? normNo(id) : (nm ? "n:" + nameNorm(nm).replace(/,/g, " ").replace(/\s+/g, " ") : "");
    if (k && dt && !isNaN(dt)) out.push([k, dt, nm]);
  };
  BIO.take();
  const buf = await f.arrayBuffer(), h = new Uint8Array(buf.slice(0, 8)), isZip = h[0] === 0x50 && h[1] === 0x4b, isOle = h[0] === 0xd0 && h[1] === 0xcf;
  if (isZip || isOle) {
    const wb = XLSX.read(buf, { type: "array", raw: true });
    for (const n of wb.SheetNames) BIO.sheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }), push);
  } else BIO.text(await BIO.readText({ arrayBuffer: async () => buf }), push);
  const w = BIO.take(); if (!out.length && w) throw new Error(w);
  return out;
}
/* ===== END BIOMETRIC READER ===== */
/** One employee's DTR between two dates from the punches. Rules (working days that are not holidays; all set in Settings):
    - time in after the grace period (staff 30 min = 8:30, teachers 15 min) = Late, counted from the official time in
    - no punch at all = Absent; no time in / no time out = Absent, Half day or not counted, as chosen in Settings
    - work on a non-working day (Sunday) = overtime for the whole time worked (when Settings says so) */
function dtrCalc(e, from, to) {
  const D = ST.settings.dtr, days = daysOf(e) || {}, hol = (D.holidays || []).map((h) => h.date), [sh, sm] = D.start.split(":").map(Number), [eh, em] = D.end.split(":").map(Number), S0 = sh * 60 + sm, E0 = eh * 60 + em, MID = Math.round((S0 + E0) / 2);   // MID = 12:30 PM: a lone punch before it is a time in, after it a time out
  const o = { present: 0, absent: 0, half: 0, late: 0, lateDays: 0, ot: 0, hrs: 0, rows: [] };
  for (let d = from; d <= to; d = addDay(d)) {
    const p = (days[d] || []).slice().sort((a, b) => a - b), wd = (D.workDays || [1, 2, 3, 4, 5]).includes(new Date(d + "T12:00").getDay()), isH = hol.includes(d), lv = wd && !isH ? lvOn(e, d) : null, r = { d, wd, isH, inn: null, out: null, hrs: 0, late: 0, ot: 0, note: "", st: "" };
    if (p.length) {
      if (p.length > 1 && p[p.length - 1] - p[0] >= 10) { r.inn = p[0]; r.out = p[p.length - 1]; }   // two scans a few minutes apart are one scan
      else if (p[0] < MID) r.inn = p[0]; else r.out = p[0];
      if (wd && r.inn !== null && !lv) r.late = r.inn > S0 + graceOf(e) ? r.inn - S0 : 0;
      if (r.inn !== null && r.out !== null) {
        const span = r.out - r.inn, mins = span - (span > 300 ? +D.lunchMin || 0 : 0); r.hrs = Math.max(0, mins) / 60;
        if (wd) { const x = r.out - E0; r.ot = x >= (+D.otStartMin || 0) ? Math.floor(x / (+D.otBlockMin || 30)) * (+D.otBlockMin || 30) : 0; } else if (D.restDayAsOt !== false) { r.ot = Math.round(r.hrs * 60); r.note = "Rest day - overtime"; } else r.note = "Rest day - not counted";
      } else if (wd && !isH && !lv) {   // a missing punch: Settings decides if it means absent, half day or nothing
        const miss = r.inn === null ? "no time in" : "no time out", rule = (r.inn === null ? D.noInRule : D.noOutRule) || (r.inn === null ? "absent" : "half"), W = { absent: "Absent", half: "Half day" };
        r.why = miss; r.note = miss.charAt(0).toUpperCase() + miss.slice(1);
        if (W[rule]) { r.st = rule; r.note += " - " + W[rule]; }
      } else r.note = r.inn === null ? "No time in" : "No time out";
      if (r.late) r.note = (r.note ? r.note + "; " : "") + "Late";
      if (r.st === "absent") o.absent++;
      else if (r.st === "half") { const hv = +(D.halfDayAbs ?? 0.5); o.absent += hv; o.present += 1 - hv; o.half++; }
      else if (wd) o.present++;
      o.late += r.late; if (r.late) o.lateDays++; o.ot += r.ot; o.hrs += r.hrs;
    } else if (wd && !isH) { if (lv) { r.note = lv.type + (lv.paid ? " (with pay)" : " (without pay)"); r.leave = true; } else { o.absent++; r.st = "absent"; r.why = "no punch"; r.note = "No punch - Absent"; } }
    else if (isH) r.note = "Holiday";
    o.rows.push(r);
  }
  o.ot = Math.round(o.ot / 60 * 100) / 100; o.hrs = Math.round(o.hrs * 100) / 100; return o;
}
function dtr(selNo) {
  const D = ST.dtr, ids = Object.keys(D.days), dates = ids.flatMap((i) => Object.keys(D.days[i])).sort(), from = D.from || dates[0] || "", to = D.to || dates[dates.length - 1] || "", M = (ST._dm = null, dtrMap()), un = M.unmatched, list = ST.employees.filter((e) => M.byEmp[e.id]);
  const sel = list.find((e) => e.id === selNo);
  const lkOpts = (u) => { const bp = bioParts(u.name), cand = new Set((u.amb || []).map((e) => e.id)), sc = (e) => { const ep = empParts(e); return bp ? bp.all.filter((t) => [...ep.L, ...ep.F].some((x) => tokEq(t, x))).length : 0; }; return ST.employees.slice().sort((a, b) => (cand.has(b.id) - cand.has(a.id)) || (sc(b) - sc(a)) || nameOf(a).localeCompare(nameOf(b))).map((e) => `<option value="${e.id}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join(""); };
  const unCard = un.length ? `<div class="card noprint"><h3>Not matched to an employee (${un.length})</h3><p class="muted">No employee has this name, or the file has no name for it. Choose the employee for each record; the link is remembered for the next upload.</p><div class="tw"><table><tr><th>Biometric ID</th><th>Name in the file</th><th class="n">Punches</th><th>Link to employee</th></tr>${un.map((u) => `<tr><td>${esc(u.key.startsWith("n:") ? "(none)" : u.key)}</td><td>${esc(u.name || "-")}${u.amb ? ` <small class="muted">fits several: ${u.amb.map((e) => esc(nameOf(e))).join(" / ")}</small>` : ""}</td><td class="n">${Object.values(D.days[u.key]).reduce((n, a) => n + a.length, 0)}</td><td><select data-lk="${esc(u.key)}"><option value="">Choose employee...</option>${lkOpts(u)}</select></td></tr>`).join("")}</table></div></div>` : "";
  const emptyCard = '<div class="card empty"><b>No punches yet</b><p class="muted">Upload a biometric file under <b>Biometric files</b> to build the DTR of every employee.</p></div>';
  V(`${dtrTabs(un.length, ids.length)}<div data-dp="files" ${dpHide("files", ids.length)}><div class="card noprint"><h3>Biometric files</h3><p class="muted">Upload one or more biometric exports (Excel, CSV, or the text / DAT file from the device). Each punch needs a date and time plus the employee's name or number. Employees are matched by <b>name</b> (Last name, First name, Initial) first, so the Biometric ID does not have to be the same as the Employee ID; the ID number is used only when the file has no name. The first punch of a day is time in, the last is time out.</p>
  <div class="row"><div><label>Files</label><input type="file" id="bf" multiple accept=".xlsx,.xls,.csv,.txt,.dat,.log"></div><div><label>Date format in the file</label><select id="bo"><option value="MDY">Month / Day / Year</option><option value="DMY" ${ST.settings.dtr.dateOrder === "DMY" ? "selected" : ""}>Day / Month / Year</option></select></div>${ids.length ? '<button class="btn d" id="bc">Clear punches</button>' : ""}</div></div>
  ${unCard}</div>
  <div data-dp="att" ${dpHide("att", ids.length)}>${ids.length ? attendHTML(list, from, to) : emptyCard}</div>
  <div data-dp="pay" ${dpHide("pay", ids.length)}>${ids.length ? `<div class="card"><h3>Use in payroll</h3><div class="row noprint"><div><label>From</label><input type="date" id="df" value="${from}"></div><div><label>To</label><input type="date" id="dto" value="${to}"></div><button class="btn p" id="gp">Use in payroll</button></div>
  <p class="muted">${ids.length} biometric record(s) with punches (${list.length} matched to employees), ${dates[0]} to ${dates[dates.length - 1]}. The Payroll tab fills in absences, late minutes, overtime and teacher hours from this DTR; you can still type over them.${un.length ? ` <b>${un.length} not matched - see Biometric files.</b>` : ""}</p>
  <div class="tw"><table><tr><th>No.</th><th>Name</th><th>Biometric ID</th><th>Matched by</th><th>Group</th><th class="n">Days present</th><th class="n">Absent</th><th class="n">Half day</th><th class="n">Late (days)</th><th class="n">Late (min)</th><th class="n">Overtime (h)</th><th class="n">Hours worked</th><th></th></tr>${list.map((e) => { const c = dtrCalc(e, from, to), x = M.byEmp[e.id]; return `<tr class="${sel && sel.id === e.id ? "sel" : ""}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(x.keys.map((k) => k.startsWith("n:") ? "(name only)" : k).join(", "))}</td><td>${esc(x.by.join(", "))}${x.warn.length ? ` <small style="color:#7a0c14">${esc(x.warn[0])}</small>` : ""}${x.by.includes("manual") ? ` <button class="btn sm noprint" data-ul="${e.id}">Unlink</button>` : ""}</td><td>${CATEGORIES.find((z) => z.key === categoryOf(e)).short}</td><td class="n">${c.present}</td><td class="n">${c.absent}</td><td class="n">${c.half}</td><td class="n">${c.lateDays}</td><td class="n">${c.late}</td><td class="n">${c.ot}</td><td class="n">${c.hrs}</td><td><button class="btn sm" data-dv="${e.id}">View DTR</button></td></tr>`; }).join("")}</table></div></div>` : emptyCard}
  ${sel ? (() => { const c = dtrCalc(sel, from, to); return `<div class="card ps dtrsheet"><h2>DAILY TIME RECORD</h2><p style="text-align:center;margin:0">${from} to ${to}</p><p><b>${esc(nameOf(sel))}</b> &middot; ${esc(sel.position)} &middot; No. ${esc(sel.no)}</p><table><tr><th>Date</th><th>Day</th><th>Time in</th><th>Time out</th><th class="n">Hours</th><th class="n">Late</th><th class="n">OT (min)</th><th>Remarks</th></tr>${c.rows.map((r) => `<tr><td>${r.d}</td><td>${new Date(r.d + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</td><td>${hm(r.inn)}</td><td>${hm(r.out)}</td><td class="n">${r.hrs ? r.hrs.toFixed(2) : ""}</td><td class="n">${r.late || ""}</td><td class="n">${r.ot || ""}</td><td>${r.note}</td></tr>`).join("")}<tr class="tot"><td colspan="4">Total</td><td class="n">${c.hrs}</td><td class="n">${c.late}</td><td class="n">${Math.round(c.ot * 60)}</td><td>Absent: ${c.absent}</td></tr></table><div class="sg"><div>Employee</div><div>Verified by</div></div><p class="noprint"><button class="btn" onclick="print()">Print DTR</button></p></div>`; })() : ""}</div>`);
  $("#bf").onchange = async (ev) => {
    const fs = [...ev.target.files]; if (!fs.length) return; ST.settings.dtr.dateOrder = $("#bo").value; let n = 0;
    $("#busy").innerHTML = '<div class="bx"><div class="spin"></div><b>Reading biometric files</b><div class="bar"><i></i></div></div>'; $("#busy").style.display = "flex";
    try { for (const f of fs) for (const [id, dt, nm] of await readPunches(f)) { const d = ymd(dt), a = ((D.days[id] ||= {})[d] ||= []), t = dt.getHours() * 60 + dt.getMinutes(); if (!a.includes(t)) { a.push(t); n++; } if (nm) { D.names ||= {}; if (!D.names[id] || nm.length > D.names[id].length) D.names[id] = nm; } } }
    catch (e) { $("#busy").style.display = "none"; return toast("Could not read the file: " + e.message, true); }
    $("#busy").style.display = "none"; D.from = D.to = ""; saveDtr(); ST._dm = null; const MM = dtrMap(); n ? toast(`${n} punches added from ${fs.length} file(s). ${Object.keys(MM.byEmp).length} employee(s) matched${MM.unmatched.length ? `, ${MM.unmatched.length} still need linking` : ""}.`) : toast("No punches found. Each row needs a date with time and an employee name or number.", true); if (n) ST.dtrView = "att"; dtr();
  };
  if (ids.length) {
    $("#bc").onclick = () => { if (confirm("Remove all uploaded punches?")) { ST.dtr = { days: {}, names: {}, link: D.link || {} }; saveDtr(); ST.dtrView = "files"; dtr(); } };
    $("#df").onchange = (e) => { D.from = e.target.value; dtr(selNo); }; $("#dto").onchange = (e) => { D.to = e.target.value; dtr(selNo); };
    $("#gp").onclick = () => { ST.tab = "run"; shell(); };
    if ($("#ld")) $("#ld").onchange = (e) => { ST.lateDate = e.target.value; dtr(selNo); };
    if ($("#lf")) $("#lf").onchange = (e) => { ST.attF = e.target.value; ST.lateDate = ""; dtr(selNo); };
    if ($("#aq")) { $("#aq").oninput = (e) => { ST.attQ = e.target.value; attDraw(); }; attDraw(); }
    document.querySelectorAll("[data-dv]").forEach((b) => b.onclick = () => { ST.dtrView = "pay"; dtr(b.dataset.dv); });
    document.querySelectorAll("[data-lk]").forEach((x) => x.onchange = () => { if (!x.value) return; (D.link ||= {})[x.dataset.lk] = x.value; saveDtr(); toast("Linked."); dtr(selNo); });
    document.querySelectorAll("[data-ul]").forEach((b) => b.onclick = () => { for (const k of Object.keys(D.link || {})) if (D.link[k] === b.dataset.ul) delete D.link[k]; saveDtr(); dtr(selNo); });
  }
}

/* ---------- Payroll: Admins | Staff (per department) | Teachers (Faculty) ---------- */
const SECS = [["admin", "Admins", "School admins"], ["staff", "Staff", "Employees per department"], ["teacher", "Teachers", "Faculty, paid per hour"]];
function run() {
  ST._dm = null;
  const S = ST.settings, now = new Date(), m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, R = ST.run || { month: m, cut: S.cutoffPair === "A" ? "c11_25" : "c1_15", inp: {}, sec: "staff", dept: "" };
  ST.run = R; R.sec ||= "staff"; R.dept ||= "";
  const per = () => cutoffPeriod(R.month, R.cut);
  const eff = (e) => {
    const p = per(), i = { ...(R.inp[e.id] || {}) }, dt = (phEnsure(+p.start.slice(0, 4)), phEnsure(+p.end.slice(0, 4)), daysOf(e)) ? dtrCalc(e, p.start, p.end) : null, fill = (k, v) => { if (i[k] === undefined || i[k] === "") i[k] = v; };
    if (dt) { fill("absentDays", dt.absent); fill("lateMin", dt.late); fill("otHours", dt.ot); fill("hoursWorked", dt.hrs); i.dtr = { present: dt.present }; }
    const lv = lvInPeriod(e, p.start, p.end); i.leavePaid = lv.paid; if (S.unpaidLeave !== false && !isHourly(e)) i.leaveDays = lv.unpaid;
    i.hol = (S.dtr.holidays || []).filter((h) => h.date >= p.start && h.date <= p.end && (S.dtr.workDays || [1, 2, 3, 4, 5]).includes(new Date(h.date + "T12:00").getDay())).map((h) => { const r = dt && dt.rows.find((x) => x.d === h.date); return { date: h.date, label: h.label, type: h.type, worked: !!(r && r.inn !== null), hours: r ? r.hrs : 0 }; });
    return i;
  };
  const calc = (e) => computeSlip(e, eff(e), S, per()), all = activeEmps(), inSec = (e) => categoryOf(e) === R.sec;
  const depts = [...new Set(all.filter((e) => categoryOf(e) === "staff").map((e) => e.dept || "No department"))].sort();
  if (R.sec === "staff" && R.dept && !depts.includes(R.dept)) R.dept = "";
  const rows = all.filter((e) => inSec(e) && (R.sec !== "staff" || !R.dept || (e.dept || "No department") === R.dept));
  const when = (k, l) => `<div><label>${l}</label><select data-w="${k}"><option value="split">Split in both cut-offs</option><option value="first" ${S[k].when === "first" ? "selected" : ""}>1st cut-off</option><option value="second" ${S[k].when === "second" ? "selected" : ""}>2nd cut-off</option></select></div>`;
  const head = `<div class="card noprint"><div class="row"><div><label>Month</label><input type="month" id="rm" value="${R.month}"></div><div><label>Cut-off</label><select id="rc">${CUTOFFS.map((c) => `<option value="${c.key}" ${R.cut === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="pd" value="${R.payDate || payDateOf(R.month, per().half, S.period)}"></div><button class="btn p" id="sr">Save payroll run</button></div>
  <p class="muted">Period: <b>${per().label}</b>. Admins, Staff and Teachers are each saved as their own payroll run.${S.dtr.holidays.some((h) => h.date >= per().start && h.date <= per().end) ? " Holidays in this period are added automatically." : ""}</p>
  <div class="row benefits"><b>Government benefits are deducted on:</b>${when("sss", "SSS")}${when("phic", "PhilHealth")}${when("hdmf", "Pag-IBIG")}</div></div>
  <div class="seg noprint">${SECS.map(([k, l, s]) => `<button class="${R.sec === k ? "on" : ""}" data-s="${k}"><b>${l}</b><small>${all.filter((e) => categoryOf(e) === k).length} employees &middot; ${s}</small></button>`).join("")}</div>
  ${R.sec === "staff" ? `<div class="chips noprint"><button class="${R.dept ? "" : "on"}" data-d="">All departments</button>${depts.map((d) => `<button class="${R.dept === d ? "on" : ""}" data-d="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}`;
  const hr = R.sec === "teacher", f = (e, k, off) => `<td><input class="in" data-id="${e.id}" data-k="${k}" value="${(R.inp[e.id] || {})[k] ?? (off ? "" : eff(e)[k] ?? "")}" ${off ? "disabled" : ""}></td>`;
  const body = rows.map((e) => { const c = calc(e); return `<tr><td>${esc(e.no)}</td><td>${esc(nameOf(e))}<br><small class="muted">${esc(e.position)}${e.dept ? " &middot; " + esc(e.dept) : ""}</small></td>${hr ? f(e, "hoursWorked") : f(e, "absentDays") + f(e, "lateMin")}${f(e, "otHours")}${f(e, "otherEarn")}${f(e, "otherDed")}<td class="n">${money(c.holPay)}</td><td class="n">${money(c.gross)}</td><td class="n">${money(c.sssEe + c.phicEe + c.hdmfEe)}</td><td class="n">${money(c.tax)}</td><td class="n">${money(c.totalDed)}</td><td class="n"><b>${money(c.net)}</b></td></tr>`; }).join("");
  const tot = (k) => money(rows.reduce((n, e) => n + calc(e)[k], 0));
  V(head + `<div class="card"><div class="tw"><table><tr><th>No.</th><th>Employee</th>${hr ? "<th>Hours taught</th>" : "<th>Absent days</th><th>Late min</th>"}<th>OT hours</th><th>Other earn</th><th>Other ded</th><th class="n">Holiday pay</th><th class="n">Gross</th><th class="n">SSS+PHIC+HDMF</th><th class="n">Tax</th><th class="n">Total ded</th><th class="n">Net pay</th></tr>${body || `<tr><td colspan="13" class="muted">No active ${R.sec === "admin" ? "admins" : R.sec === "teacher" ? "teachers" : "staff"} here. Set the payroll group of an employee under Employees.</td></tr>`}
  ${rows.length ? `<tr class="tot"><td colspan="${hr ? 6 : 7}">Total (${rows.length})</td><td class="n">${tot("holPay")}</td><td class="n">${tot("gross")}</td><td class="n">${money(rows.reduce((n, e) => { const c = calc(e); return n + c.sssEe + c.phicEe + c.hdmfEe; }, 0))}</td><td class="n">${tot("tax")}</td><td class="n">${tot("totalDed")}</td><td class="n">${tot("net")}</td></tr>` : ""}</table></div></div>`);
  $("#rm").onchange = (e) => { R.month = e.target.value; R.payDate = ""; run(); }; $("#rc").onchange = (e) => { R.cut = e.target.value; R.payDate = ""; run(); }; $("#pd").onchange = (e) => R.payDate = e.target.value;
  document.querySelectorAll("[data-s]").forEach((b) => b.onclick = () => { R.sec = b.dataset.s; run(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { R.dept = b.dataset.d; run(); });
  document.querySelectorAll("[data-w]").forEach((b) => b.onchange = async () => { S[b.dataset.w].when = b.value; await api("saveSettings", S); toast("Deduction cut-off saved."); run(); });
  document.querySelectorAll("input.in").forEach((el) => el.onchange = () => { (R.inp[el.dataset.id] ||= {})[el.dataset.k] = el.value; run(); });
  $("#sr").onclick = async () => {
    const sec = R.sec, secL = (SECS.find((x) => x[0] === sec) || [])[1], L = all.filter(inSec), slips = L.map((e) => ({ no: e.no, name: nameOf(e), position: e.position, calc: calc(e) })), sum = (k) => slips.reduce((n, x) => n + x.calc[k], 0);
    if (!slips.length) return toast(`No active ${secL.toLowerCase()}.`, true);
    const ex = (ST.runs || []).find((x) => x.period === per().label && x.group === sec), rid = (R.ids && R.ids[sec]) || (ex && ex.id) || "", first = !rid;   // saving the same group and period again replaces that run
    const r = await api("saveRun", { id: rid, group: sec, period: per().label, payDate: $("#pd").value, slips, gross: r2(sum("gross")), ded: r2(sum("totalDed")), net: r2(sum("net")) });
    (R.ids ||= {})[sec] = r.id;
    if (first) { const upd = []; L.forEach((e, i) => { const c = slips[i].calc; let ch = false; if (c.caDed > 0) { e.ca = { ...(e.ca || {}), balance: c.caAfter }; ch = true; } (c.dedList || []).forEach((d) => { const x = (e.deductions || []).find((y) => y.id === d.id); if (x && d.balanceAfter !== null && d.amount > 0) { x.balance = d.balanceAfter; ch = true; } }); if (ch) upd.push(e); }); if (upd.length) await api("saveEmployees", { list: upd }); }
    ST.runs = (await api("bootstrap")).runs; ST.run = null; ST.tab = "slips"; toast(`${secL} payroll saved to the spreadsheet.`); shell();
  };
}


/* ---------- Employees page: one section at a time ---------- */
const EMP_VIEWS = [["list", "Employees"], ["add", "Add employee information"], ["upload", "Upload employees (Excel / CSV)"]];
const empTabs = () => `<div class="chips noprint" id="evs">${EMP_VIEWS.map(([k, l]) => `<button data-ev="${k}" class="${(ST.empView || "list") === k ? "on" : ""}">${l}${k === "list" ? " (" + ST.employees.length + ")" : ""}</button>`).join("")}</div>`;
const paneHide = (k) => ((ST.empView || "list") === k ? "" : "hidden");
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ev]"); if (!b) return; ST.empView = b.dataset.ev; document.querySelectorAll("#evs [data-ev]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== ST.empView); if (ST.empView === "add") scrollTo(0, 0); });

/* ---------- Settings page: one section at a time ---------- */
const SET_VIEWS = [["pay", "Payroll settings"], ["sal", "Salary range"], ["hol", "Holidays"], ["hp", "Holiday pay (% of the daily rate)"], ["dtr", "Work days & hours (DTR)"], ["lv", "Leave types"], ["sig", "Signatories printed on payslips"]];
const setTabs = () => `<div class="chips noprint" id="svs">${SET_VIEWS.map(([k, l]) => `<button data-sv="${k}" class="${(ST.setView || "pay") === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
const spHide = (k) => ((ST.setView || "pay") === k ? "" : "hidden");
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-sv]"); if (!b) return; ST.setView = b.dataset.sv; document.querySelectorAll("#svs [data-sv]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-sp]").forEach((p) => p.hidden = p.dataset.sp !== ST.setView); });

/* ---------- Employee 2x2 picture ---------- */
const thumb = (x) => x.photo ? `<img class="thumb" src="${x.photo}" alt="">` : "";
const photoBox = (e) => { ST.photoDraft = undefined; return `<div class="photo"><div class="ph2" id="phv">${e.photo ? `<img src="${e.photo}" alt="">` : "<span>2x2<br>photo</span>"}</div><div><label>Picture (2x2)</label><input type="file" id="phf" accept="image/*"><p><button class="btn sm d" type="button" id="phx">Remove picture</button></p><p class="muted">Square 2x2 picture. It is cropped to the centre and made smaller automatically. Press Save to keep it.</p></div></div>`; };
function squarePhoto(file) {
  return new Promise((ok, no) => { const im = new Image(), fr = new FileReader(); fr.onerror = no; fr.onload = () => { im.src = fr.result; }; im.onerror = () => no(new Error("That file is not a picture.")); im.onload = () => { const s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 240; c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 240, 240); let q = .8, u = c.toDataURL("image/jpeg", q); while (u.length > 40000 && q > .3) { q -= .1; u = c.toDataURL("image/jpeg", q); } ok(u); }; fr.readAsDataURL(file); });
}
document.addEventListener("change", async (ev) => { if (ev.target.id !== "phf" || !ev.target.files[0]) return; try { ST.photoDraft = await squarePhoto(ev.target.files[0]); $("#phv").innerHTML = `<img src="${ST.photoDraft}" alt="">`; } catch (e) { toast(e.message, true); } });
document.addEventListener("click", (ev) => { if (ev.target.id === "phx") { ST.photoDraft = ""; $("#phv").innerHTML = "<span>2x2<br>photo</span>"; $("#phf").value = ""; } });


/* ---------- Leave (with pay / without pay) + grace period per group ---------- */
const LEAVE_DEFAULT = [
  { name: "Vacation Leave", paid: true, days: 0 }, { name: "Sick Leave", paid: true, days: 0 }, { name: "Emergency Leave", paid: true, days: 0 },
  { name: "Service Incentive Leave", paid: true, days: 5 }, { name: "Maternity Leave", paid: true, days: 105 }, { name: "Paternity Leave", paid: true, days: 7 },
  { name: "Solo Parent Leave", paid: true, days: 7 }, { name: "Leave without Pay", paid: false, days: 0 },
];
const leaveTypes = (S) => (Array.isArray(S && S.leaveTypes) && S.leaveTypes.length ? S.leaveTypes : LEAVE_DEFAULT);
const lvRow = (t) => `<tr data-lt><td><input class="ln" value="${esc(t.name || "")}"></td><td><select class="lp"><option value="1">With pay</option><option value="0" ${t.paid === false ? "selected" : ""}>Without pay</option></select></td><td><input type="number" min="0" step="any" class="ld" value="${+t.days || 0}"></td><td><button class="btn sm d" data-lx>Remove</button></td></tr>`;

/** Grace period (minutes) before an employee counts as late: teachers have their own, everybody else (staff, admins) uses the staff one. */
function graceOf(e) {
  const D = ST.settings.dtr, t = categoryOf(e) === "teacher", v = t ? D.graceTeacher : D.graceStaff;
  return +(v ?? (t ? 15 : (D.graceMin ?? 30))) || 0;
}

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
  const used = (empId, type, y, skip) => (ST.leaves || []).filter((x) => x.empId === empId && x.type === type && x.status !== "Rejected" && x.from.slice(0, 4) === String(y) && x.id !== skip).reduce((n, x) => n + (+x.days || 0), 0);
  const mine = (ST.leaves || []).filter((x) => x.status === "Approved" && x.from.slice(0, 4) === yr), sum = (p) => mine.filter((x) => !!x.paid === p).reduce((n, x) => n + (+x.days || 0), 0), pend = (ST.leaves || []).filter((x) => x.status === "Pending").length;
  V(`<div class="card noprint"><h3>${ed ? "Edit leave" : "File a leave"}</h3><div class="form">
    <div><label>Employee</label><select id="lv_e"><option value="">Choose employee...</option>${emps.map((e) => `<option value="${e.id}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
    <div><label>Leave type</label><select id="lv_t">${T.map((t) => `<option value="${esc(t.name)}">${esc(t.name)} (${t.paid ? "with pay" : "without pay"})</option>`).join("")}</select></div>
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
    if (id && t.days > 0) { const u = used(id, t.name, f.slice(0, 4), ed && ed.id); m += ` ${t.name}: ${u} of ${t.days} day(s) used in ${f.slice(0, 4)}, ${Math.max(0, t.days - u - n)} left after this.`; }
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
    if (t.days > 0 && st !== "Rejected") { const u = used(id, t.name, f.slice(0, 4), ed && ed.id); if (u + days > t.days && !confirm(`${t.name} allows ${t.days} day(s) a year; this makes ${u + days}. Save anyway?`)) return; }
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

token ? load().catch(showLogin) : showLogin();

/* ---------- Employees: Admins | Staff (per department) | Teachers buttons, like the Payroll tab ---------- */
function empList() {
  const ES = ST.empSec || "all", depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  if (ES === "staff" && ST.empDept && !depts.includes(ST.empDept)) ST.empDept = "";
  return ST.employees.filter((x) => (ES === "all" || categoryOf(x) === ES) && (ES !== "staff" || !ST.empDept || (x.dept || "No department") === ST.empDept));
}
function empFilter() {
  const ES = ST.empSec || "all", cnt = (k) => ST.employees.filter((x) => k === "all" || categoryOf(x) === k).length, depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  const cards = [["all", "All employees", "Admins, staff and teachers"], ...SECS];
  return `<div data-pane="list" ${paneHide("list")}><div class="seg noprint">${cards.map(([k, l, s]) => `<button class="${ES === k ? "on" : ""}" data-es="${k}"><b>${l}</b><small>${cnt(k)} employees &middot; ${s}</small></button>`).join("")}</div>
  ${ES === "staff" ? `<div class="chips noprint"><button class="${ST.empDept ? "" : "on"}" data-ed="">All departments</button>${depts.map((d) => `<button class="${ST.empDept === d ? "on" : ""}" data-ed="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}</div>`;
}
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-es],[data-ed]"); if (!b) return; if (b.dataset.es !== undefined) { ST.empSec = b.dataset.es; ST.empDept = ""; } else ST.empDept = b.dataset.ed; emp(); });


/* ---------- DTR page sections: Biometric files | Attendance check | Use in payroll ---------- */
const DTR_VIEWS = [["files", "Biometric files"], ["att", "Attendance check"], ["pay", "Use in payroll"]];
const dtrView = (has) => ST.dtrView || (has ? "att" : "files");
const dpHide = (k, has) => (dtrView(has) === k ? "" : "hidden");
const dtrTabs = (nUn, has) => `<div class="chips noprint" id="dtv">${DTR_VIEWS.map(([k, l]) => `<button data-dtv="${k}" class="${dtrView(has) === k ? "on" : ""}">${l}${k === "files" && nUn ? ` (${nUn} to link)` : ""}</button>`).join("")}</div>`;
document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-dtv]"); if (!b) return; ST.dtrView = b.dataset.dtv; document.querySelectorAll("#dtv [data-dtv]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-dp]").forEach((p) => p.hidden = p.dataset.dp !== ST.dtrView); });

/* ---------- Attendance check read from the uploaded biometrics: who is late, absent (no time in) or half day (no time out) ---------- */
function attRows() {
  const C = ST._att, F = ST.attF || "all", q = (ST.attQ || "").trim().toLowerCase(), is = { late: (x) => x.r.late > 0, absent: (x) => x.r.st === "absent", half: (x) => x.r.st === "half", all: () => true };
  const kind = C.rows.filter(is[F]), dates = [...new Set(kind.map((x) => x.r.d))].sort().reverse(), cur = dates.includes(ST.lateDate) ? ST.lateDate : "";
  const shown = kind.filter((x) => (!cur || x.r.d === cur) && (!q || [x.e.no, nameOf(x.e), x.e.dept, x.e.position].join(" ").toLowerCase().includes(q)))
    .sort((a, b) => (a.r.d < b.r.d ? 1 : a.r.d > b.r.d ? -1 : nameOf(a.e).localeCompare(nameOf(b.e))));
  return { shown, dates, cur, is };
}
function attDraw() {
  const el = $("#att_body"); if (!el || !ST._att) return;
  const { shown, is } = attRows(), n = (f) => shown.filter(is[f]).length;
  const tag = (t, bg) => `<span style="display:inline-block;background:${bg};border-radius:10px;padding:1px 8px;font-size:.8rem;margin-right:4px">${t}</span>`;
  const st = ({ r }) => (r.st === "absent" ? tag(`Absent (${r.why})`, "#f8d7da") : r.st === "half" ? tag(`Half day (${r.why})`, "#ffe9c7") : "") + (r.late ? tag(`Late ${r.late} min`, "#fff3b0") : "");
  const dn = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" });
  el.innerHTML = `<p><b>${shown.length ? `${n("late")} late &middot; ${n("absent")} absent &middot; ${n("half")} half day` : "Nothing to report."}</b> <small class="muted">${shown.length} row(s)</small></p>`
    + (shown.length ? `<div class="tw"><table><tr><th>Date</th><th>Day</th><th>No.</th><th>Name</th><th>Department</th><th>Time in</th><th>Time out</th><th>Status</th></tr>${shown.map((x) => `<tr><td>${x.r.d}</td><td>${dn(x.r.d)}</td><td>${esc(x.e.no)}</td><td>${esc(nameOf(x.e))}</td><td>${esc(x.e.dept || "-")}</td><td>${hm(x.r.inn) || '<span class="muted">none</span>'}</td><td>${hm(x.r.out) || '<span class="muted">none</span>'}</td><td>${st(x)}</td></tr>`).join("")}</table></div>` : "");
}
function attendHTML(list, from, to) {
  const D = ST.settings.dtr, S0 = D.start.split(":").map(Number).reduce((h, m) => h * 60 + m), E0 = D.end.split(":").map(Number).reduce((h, m) => h * 60 + m), gs = D.graceStaff ?? D.graceMin ?? 30, gt = D.graceTeacher ?? 15, MID = Math.round((S0 + E0) / 2), rows = [];
  list.forEach((e) => dtrCalc(e, from, to).rows.forEach((r) => { if (r.late > 0 || r.st) rows.push({ e, r }); }));
  ST._att = { rows };
  const { dates, cur } = attRows(), F = ST.attF || "all";
  return `<div class="card"><h3>Attendance check</h3>
  <p class="muted">Read from the uploaded biometrics, ${from} to ${to}. Regular hours <b>${hm(S0)} to ${D.end}</b>, staff on time until <b>${hm(S0 + gs)}</b>.</p>
  <details class="noprint"><summary class="muted" style="cursor:pointer">How it is read</summary><p class="muted"><b>Late</b>: a time in after the grace period (staff ${gs} minutes, teachers ${gt}), counted from ${D.start}. <b>No punch</b> on a working day is absent. <b>No time in</b> is ${({ absent: "absent", half: "a half day", none: "not counted" })[D.noInRule || "absent"]} and <b>no time out</b> is ${({ absent: "absent", half: "a half day", none: "not counted" })[D.noOutRule || "half"]}. A single punch before ${hm(MID)} is read as a time in, after it as a time out. Approved leave, non-working days and holidays are not flagged. Change the days, hours, grace periods and these rules in Settings &rarr; Work days &amp; hours.</p></details>
  <div class="row noprint"><div><label>Show</label><select id="lf">${[["all", "Late, absent and half day"], ["late", "Late only"], ["absent", "Absent only"], ["half", "Half day only"]].map(([k, l]) => `<option value="${k}" ${F === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div><label>Date</label><select id="ld"><option value="">All dates (${dates.length})</option>${dates.map((d) => `<option value="${d}" ${d === cur ? "selected" : ""}>${d} (${new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" })})</option>`).join("")}</select></div>
  <div style="flex:1;min-width:14rem"><label>Search</label><input id="aq" type="search" placeholder="Name, employee no. or department" value="${esc(ST.attQ || "")}" style="width:100%"></div></div>
  <div id="att_body"></div></div>`;
}

/** Settings saved before the work-days setting existed: Monday to Saturday are work days, Sunday work is overtime, and a month has 26 working days (only if it still has the old default of 22). Saving the settings keeps whatever you then choose. */
function daysMigrate() {
  const S = ST.settings, D = S.dtr; if (D.daysV >= 2) return;
  D.workDays = [1, 2, 3, 4, 5, 6]; D.restDayAsOt = true; D.daysV = 2; if (+S.workDays === 22) S.workDays = 26;
}
