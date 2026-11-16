/* ============================================================
   EMPLOYEES tab - list, add/edit, upload, photo, group buttons.
   File: js/pages/employees.js
   ============================================================ */

/* ---------- Employees: add, edit, upload ---------- */
const OPT = { gender: ["", "Male", "Female"], civil: ["", "Single", "Married", "Widowed", "Separated"], etype: ["", "Regular", "Probationary", "Contractual", "Part-time", "Casual", "Project-based"], status: ["Active", "Inactive", "On leave", "Resigned", "Terminated"], category: [["", "Automatic (from position)"], ["staff", "Employee staff"], ["teacher", "Teacher (paid per hour)"], ["admin", "School admin"]] };

const EF = [["no", "Employee No. *"], ["last", "Last name *"], ["first", "First name *"], ["mi", "M.I."], ["birthday", "Birthday *", "date"], ["gender", "Gender", OPT.gender], ["civil", "Civil status", OPT.civil], ["position", "Position", "dyn"], ["dept", "Department", "dyn"], ["etype", "Employment type", OPT.etype], ["hired", "Date hired", "date"], ["status", "Status *", OPT.status]];

const GF = [["sssNo", "SSS No."], ["philhealthNo", "PhilHealth No."], ["pagibigNo", "Pag-IBIG No."], ["tin", "TIN"]];

const PF = [["basicMonthly", "Monthly basic (\u20B1)"], ["dailyRate", "Daily rate (optional)"], ["hourlyRate", "Hourly rate (teachers)"], ["email", "Email"], ["category", "Payroll group", OPT.category]];

const nameOf = (e) => e.name || [e.last, [e.first, e.mi ? String(e.mi).replace(/\.?$/, ".") : ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/* Position and Department are dropdowns: what is already used by employees, a starting list, and "+ Add new". */
const DEF_POS = ["Teacher", "Head Teacher", "Principal", "Assistant Principal", "School Administrator", "Registrar", "Cashier", "Accountant", "HR Officer", "Guidance Counselor", "Librarian", "IT Staff", "Nurse", "Secretary", "Clerk", "Maintenance Staff", "Security Guard", "Driver"];

const DEF_DEPT = ["Elementary", "Junior High School", "Senior High School", "College", "Administration", "Registrar", "Accounting / Finance", "Human Resources", "IT", "Guidance", "Library", "Clinic", "Maintenance", "Security"];

const dynOpts = (k, cur) => { const seen = new Map(); [cur, ...ST.employees.map((x) => x[k]), ...(k === "position" ? DEF_POS : DEF_DEPT)].forEach((v) => { v = String(v || "").trim(); if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v); }); return [...seen.values()].sort((a, b) => a.localeCompare(b)); };

document.addEventListener("change", (ev) => {
  const el = ev.target; if (!el || el.value !== "__new__" || !/^f_(position|dept)$/.test(el.id)) return;
  const nm = (prompt("Enter the new " + (el.id === "f_dept" ? "department" : "position") + ":") || "").trim();
  if (!nm) { el.value = el.dataset.prev || ""; return; }
  let o = [...el.options].find((x) => x.value.toLowerCase() === nm.toLowerCase());
  if (!o) { o = new Option(nm, nm); el.insertBefore(o, el.querySelector('option[value="__new__"]')); }
  el.value = o.value; el.dataset.prev = o.value;
});

const fld = (f, e) => { const [k, l, t] = f, v = e[k] ?? (k === "status" ? "Active" : ""); if (t === "dyn") { const cur = String(v || "").trim(); return `<div><label>${l}</label><select id="f_${k}" data-prev="${esc(cur)}"><option value="">-</option>${dynOpts(k, cur).map((o) => `<option value="${esc(o)}" ${o.toLowerCase() === cur.toLowerCase() ? "selected" : ""}>${esc(o)}</option>`).join("")}<option value="__new__">+ Add new ${k === "dept" ? "department" : "position"}...</option></select></div>`; } if (Array.isArray(t)) return `<div><label>${l}</label><select id="f_${k}">${t.map((o) => { const [ov, ol] = Array.isArray(o) ? o : [o, o || "-"]; return `<option value="${esc(ov)}" ${String(v) === String(ov) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select></div>`; return `<div><label>${l}</label><input id="f_${k}" type="${t === "date" ? "date" : "text"}" value="${esc(v)}"></div>`; };

function emp(edit) {
  const e = edit || {}; if (edit) ST.empView = "add";
  V(`${empTabs()}<div class="card" data-pane="add" ${paneHide("add")}><h3>${edit ? "Edit" : "Add"} employee information</h3>${photoBox(e)}<div class="form">${EF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Government benefit numbers</h3><div class="form">${GF.map((f) => fld(f, e)).join("")}</div>
  <h3 style="margin-top:1rem">Pay information</h3><div class="form">${PF.map((f) => fld(f, e)).join("")}
  ${[["sss", "SSS"], ["philhealth", "PhilHealth"], ["pagibig", "Pag-IBIG"], ["tax", "Withholding tax"]].map(([k, l]) => `<div><label>${l} deduction</label><select id="f_${k}"><option value="1">Deduct</option><option value="0" ${e[k] === false ? "selected" : ""}>Do not deduct</option></select></div>`).join("")}</div>
  <p class="muted">Cash advances, loans and allowances each have their own menu button: <b>Cash Advance</b>, <b>Loans</b> and <b>Allowances</b>.</p>
  <p class="row"><button class="btn p" id="sv">${edit ? "Save changes" : "Add employee"}</button>${edit ? '<button class="btn" id="cn">Cancel</button>' : ""}</p></div>
  <div class="card noprint" data-pane="upload" ${paneHide("upload")}><h3>Upload employees (Excel / CSV)</h3><p class="muted">Use the template columns: Employee No., Last name, First name, M.I., Birthday, Gender, Civil status, Position, Department, Employment type, Date hired, Status, SSS No., PhilHealth No., Pag-IBIG No., TIN, Monthly basic, Daily rate, Hourly rate, Email, Group. Existing employees (same Employee No.) are updated.</p>
  <div class="row"><input type="file" id="up" accept=".xlsx,.xls,.csv"><button class="btn" id="tpl">Download template</button></div></div>
  ${empFilter()}<div class="card" data-pane="list" ${paneHide("list")}><h3>Employees (${empList().length})</h3><div class="tw"><table><tr><th>No.</th><th>Name</th><th>Birthday</th><th>Position</th><th>Department</th><th>Type</th><th>Status</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>TIN</th><th></th></tr>
  ${empList().map((x) => `<tr><td>${esc(x.no)}</td><td>${thumb(x)}${esc(nameOf(x))}</td><td>${esc(x.birthday)}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${esc(x.etype)}</td><td>${esc(x.status)}</td><td>${esc(x.sssNo)}</td><td>${esc(x.philhealthNo)}</td><td>${esc(x.pagibigNo)}</td><td>${esc(x.tin)}</td><td><button class="btn sm" data-e="${x.id}">Edit</button> <button class="btn sm d" data-x="${x.id}">Delete</button></td></tr>`).join("")}</table></div></div>`);
  $("#sv").onclick = async () => {
    const o = { ...e }; if (ST.photoDraft !== undefined) o.photo = ST.photoDraft; [...EF, ...GF, ...PF].forEach(([k]) => o[k] = $("#f_" + k).value.trim()); if (o.position === "__new__") o.position = ""; if (o.dept === "__new__") o.dept = "";
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

/* ---------- Employees page: one section at a time ---------- */
const EMP_VIEWS = [["list", "Employees"], ["add", "Add employee information"], ["upload", "Upload employees (Excel / CSV)"]];

const empTabs = () => `<div class="chips noprint" id="evs">${EMP_VIEWS.map(([k, l]) => `<button data-ev="${k}" class="${(ST.empView || "list") === k ? "on" : ""}">${l}${k === "list" ? " (" + ST.employees.length + ")" : ""}</button>`).join("")}</div>`;

const paneHide = (k) => ((ST.empView || "list") === k ? "" : "hidden");

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-ev]"); if (!b) return; ST.empView = b.dataset.ev; document.querySelectorAll("#evs [data-ev]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-pane]").forEach((p) => p.hidden = p.dataset.pane !== ST.empView); if (ST.empView === "add") scrollTo(0, 0); });

/* ---------- Employee 2x2 picture ---------- */
const thumb = (x) => x.photo ? `<img class="thumb" src="${x.photo}" alt="">` : "";

const photoBox = (e) => { ST.photoDraft = undefined; return `<div class="photo"><div class="ph2" id="phv">${e.photo ? `<img src="${e.photo}" alt="">` : "<span>2x2<br>photo</span>"}</div><div><label>Picture (2x2)</label><input type="file" id="phf" accept="image/*"><p><button class="btn sm d" type="button" id="phx">Remove picture</button></p><p class="muted">Square 2x2 picture. It is cropped to the centre and made smaller automatically. Press Save to keep it.</p></div></div>`; };

function squarePhoto(file) {
  return new Promise((ok, no) => { const im = new Image(), fr = new FileReader(); fr.onerror = no; fr.onload = () => { im.src = fr.result; }; im.onerror = () => no(new Error("That file is not a picture.")); im.onload = () => { const s = Math.min(im.width, im.height), c = document.createElement("canvas"); c.width = c.height = 240; c.getContext("2d").drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 240, 240); let q = .8, u = c.toDataURL("image/jpeg", q); while (u.length > 40000 && q > .3) { q -= .1; u = c.toDataURL("image/jpeg", q); } ok(u); }; fr.readAsDataURL(file); });
}

document.addEventListener("change", async (ev) => { if (ev.target.id !== "phf" || !ev.target.files[0]) return; try { ST.photoDraft = await squarePhoto(ev.target.files[0]); $("#phv").innerHTML = `<img src="${ST.photoDraft}" alt="">`; } catch (e) { toast(e.message, true); } });

document.addEventListener("click", (ev) => { if (ev.target.id === "phx") { ST.photoDraft = ""; $("#phv").innerHTML = "<span>2x2<br>photo</span>"; $("#phf").value = ""; } });

/* ---------- Employees: Admins | Staff (per department) | Teachers buttons, like the Payroll tab ---------- */
function empList() {
  const ES = ST.empSec || "all", depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  if (ES === "staff" && ST.empDept && !depts.includes(ST.empDept)) ST.empDept = "";
  const so = ST.empSort || "az";   // Sort filter: Name A - Z (default), Name Z - A, Employee no.
  return ST.employees.filter((x) => (ES === "all" || categoryOf(x) === ES) && (ES !== "staff" || !ST.empDept || (x.dept || "No department") === ST.empDept)).sort((a, b) => so === "no" ? String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) : so === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
}

function empFilter() {
  const ES = ST.empSec || "all", cnt = (k) => ST.employees.filter((x) => k === "all" || categoryOf(x) === k).length, depts = [...new Set(ST.employees.filter((x) => categoryOf(x) === "staff").map((x) => x.dept || "No department"))].sort();
  const cards = [["all", "All employees", "Admins, staff and teachers"], ...SECS];
  return `<div data-pane="list" ${paneHide("list")}><div class="seg noprint">${cards.map(([k, l, s]) => `<button class="${ES === k ? "on" : ""}" data-es="${k}"><b>${l}</b><small>${cnt(k)} employees &middot; ${s}</small></button>`).join("")}</div>
  <div class="row noprint" style="margin:.4rem 0"><div><label>Sort names</label><select id="esort">${[["az", "Name A - Z"], ["za", "Name Z - A"], ["no", "Employee no."]].map(([v, l]) => `<option value="${v}" ${(ST.empSort || "az") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div>
  ${ES === "staff" ? `<div class="chips noprint"><button class="${ST.empDept ? "" : "on"}" data-ed="">All departments</button>${depts.map((d) => `<button class="${ST.empDept === d ? "on" : ""}" data-ed="${esc(d)}">${esc(d)}</button>`).join("")}</div>` : ""}</div>`;
}

document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "esort") { ST.empSort = ev.target.value; emp(); } });

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-es],[data-ed]"); if (!b) return; if (b.dataset.es !== undefined) { ST.empSec = b.dataset.es; ST.empDept = ""; } else ST.empDept = b.dataset.ed; emp(); });

