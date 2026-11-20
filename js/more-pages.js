/* ============================================================
   MORE PAGES - users, DTR, teacher hours, class monitor, class DTR, attendance check, leave, spreadsheets, backup, 13th month
   Combined file. Each section below is one of the former separate files (kept in the same order).
   ============================================================ */

/* >>>>>>>>>> js/pages/users.js >>>>>>>>>> */
/* ============================================================
   USERS tab - accounts.
   File: js/pages/users.js
   ============================================================ */

/* ---------- Users: every payroll user can create accounts ---------- */
async function usr() {
  ST.users = await api("listUsers");
  const ed = ST.users.find((u) => u.id === ST.editUser) || null;
  V(`<div class="card"><h3>${ed ? "Edit" : "Create"} user account</h3>${photoBox({ photo: ed ? ed.photo : "" })}<div class="form"><div><label>Full name</label><input id="un" value="${esc(ed ? ed.name : "")}"></div><div><label>Email</label><input id="ue" type="email" value="${esc(ed ? ed.email : "")}"></div><div><label>Department</label><input id="ud" value="${esc(ed ? ed.dept : "")}"></div><div><label>Role</label><select id="ur" ${ed && (ed.role === "admin" || String(ed.email).toLowerCase() === String((ST.user || {}).email || "").toLowerCase()) ? "disabled" : ""}><option value="payroll" ${!ed || ed.role === "payroll" || !ed.role ? "selected" : ""}>Payroll (all menus)</option><option value="hr" ${ed && ed.role === "hr" ? "selected" : ""}>HR (Leave and Overtime File only)</option><option value="monitor" ${ed && ed.role === "monitor" ? "selected" : ""}>Teacher Class Monitor (Class Monitor menu only)</option>${ed && ed.role === "admin" ? '<option value="admin" selected>Owner</option>' : ""}</select></div>${ed ? "" : `<div><label>Password (min 6)</label><input id="up" type="text"></div>`}</div>
  <p><button class="btn p" id="au">${ed ? "Save changes" : "Create account"}</button> ${ed ? `<button class="btn" id="cu">Cancel</button>` : ""}</p>${ed ? `<p class="muted">To change the password use Reset password in the list below.</p>` : ""}</div>
  <div class="card"><h3>Users</h3><div class="tw"><table><tr><th>Name</th><th>Email</th><th>Department</th><th>Role</th><th>Status</th><th></th></tr>${ST.users.map((u) => `<tr><td>${thumb(u)}${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.dept || "-")}</td><td>${u.role === "hr" ? "HR" : u.role === "monitor" ? "Class Monitor" : u.role === "admin" ? "Owner" : "Payroll"}</td><td>${u.active ? "Active" : "Disabled"}</td><td><button class="btn sm" data-e="${u.id}">Edit</button> <button class="btn sm" data-p="${u.id}">Reset password</button> <button class="btn sm" data-a="${u.id}" data-v="${u.active ? 0 : 1}">${u.active ? "Disable" : "Enable"}</button> <button class="btn sm d" data-d="${u.id}">Delete</button></td></tr>`).join("")}</table></div></div>${ST.user && ST.user.isOwner ? dbCard() : ""}`);
  dbInit();
  const small = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 160; c.getContext("2d").drawImage(im, 0, 0, 160, 160); ok(c.toDataURL("image/jpeg", .75)); }; im.onerror = () => ok(""); im.src = u; });
  $("#au").onclick = async () => {
    const photo = ST.photoDraft === undefined ? undefined : (ST.photoDraft ? await small(ST.photoDraft) : "");
    if (ed) {
      const r = await api("updateUser", { id: ed.id, name: $("#un").value, email: $("#ue").value, dept: $("#ud").value, role: $("#ur").value, photo });
      if (ST.user && ST.user.email && String(ST.user.email).toLowerCase() === String(ed.email).toLowerCase()) { ST.user = { ...ST.user, name: r.name, email: r.email, dept: r.dept, photo: r.photo }; localStorage.setItem("pms.user", JSON.stringify(ST.user)); }
      ST.editUser = null; toast("Account updated."); shell();
    } else { await api("addUser", { name: $("#un").value, email: $("#ue").value, dept: $("#ud").value, password: $("#up").value, photo: photo || "", role: $("#ur").value }); toast("Account created."); usr(); }
  };
  if ($("#cu")) $("#cu").onclick = () => { ST.editUser = null; usr(); };
  document.querySelectorAll("[data-e]").forEach((b) => b.onclick = () => { ST.editUser = b.dataset.e; usr(); scrollTo(0, 0); });
  document.querySelectorAll("[data-p]").forEach((b) => b.onclick = async () => { const p = prompt("New password (min 6 characters):"); if (p) { await api("setPassword", { id: b.dataset.p, password: p }); toast("Password changed."); } });
  document.querySelectorAll("[data-a]").forEach((b) => b.onclick = async () => { await api("toggleUser", { id: b.dataset.a, active: b.dataset.v === "1" }); usr(); });
  document.querySelectorAll("[data-d]").forEach((b) => b.onclick = async () => { if (confirm("Delete this account?")) { await api("deleteUser", { id: b.dataset.d }); usr(); } });
}


/* >>>>>>>>>> js/pages/dtr.js >>>>>>>>>> */
/* ============================================================
   DTR / BIOMETRIC tab - the page and its three sections. (Calculation is in js/dtr/dtr-calc.js.)
   File: js/pages/dtr.js
   ============================================================ */

function dtr(selNo) {
  if (isMon() || ST.dtrView === "cdtr") return cdtrPage();   // the class-check DTR (the Class Monitor account only has this one)
  const D = ST.dtr, ids = Object.keys(D.days), dates = ids.flatMap((i) => Object.keys(D.days[i])).sort(), from = D.from || dates[0] || "", to = D.to || dates[dates.length - 1] || "", M = (ST._dm = null, dtrMap(), ST.dtrSel = selNo, dtrMap()), un = M.unmatched, list = ST.employees.filter((e) => M.byEmp[e.id]);
  const sel = list.find((e) => e.id === selNo);
  const sugOf = (u) => { const bp = bioParts(u.name); if (!bp || u.amb) return null; const r = ST.employees.map((e) => { const ep = empParts(e); return [e, bp.all.filter((t) => [...ep.L, ...ep.F].some((x) => tokEq(t, x))).length]; }).sort((a, b) => b[1] - a[1]); return r[0] && r[0][1] >= 2 && (!r[1] || r[0][1] > r[1][1]) ? r[0][0] : null; };   // best guess for a record the automatic match could not decide: 2+ name parts agree and nobody else fits as well
  const lkOpts = (u) => { const sg = sugOf(u); const bp = bioParts(u.name), cand = new Set((u.amb || []).map((e) => e.id)), sc = (e) => { const ep = empParts(e); return bp ? bp.all.filter((t) => [...ep.L, ...ep.F].some((x) => tokEq(t, x))).length : 0; }; return ST.employees.slice().sort((a, b) => (cand.has(b.id) - cand.has(a.id)) || (sc(b) - sc(a)) || nameOf(a).localeCompare(nameOf(b))).map((e) => `<option value="${e.id}" ${sg && sg.id === e.id ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))}${sg && sg.id === e.id ? " (suggested)" : ""}</option>`).join(""); };
  const unCard = un.length ? `<div class="card noprint"><h3>Not matched to an employee (${un.length}) ${un.some((u) => sugOf(u)) ? '<button class="btn sm" id="lkall">Link all suggested</button>' : ""}</h3><p class="muted">No employee has this name, or the file has no name for it. Choose the employee for each record; the link is remembered for the next upload.</p><div class="tw"><table><tr><th>Biometric ID</th><th>Name in the file</th><th class="n">Punches</th><th>Link to employee</th></tr>${un.map((u) => `<tr><td>${esc(keyId(u.key).startsWith("n:") ? "(none)" : keyId(u.key))}${keyDev(u.key) ? ` <small class="muted">${esc(keyDev(u.key))}</small>` : ""}</td><td>${esc(u.name || "-")}${u.amb ? ` <small class="muted">fits several: ${u.amb.map((e) => esc(nameOf(e))).join(" / ")}</small>` : ""}</td><td class="n">${Object.values(D.days[u.key]).reduce((n, a) => n + a.length, 0)}</td><td><select data-lk="${esc(u.key)}"><option value="">Choose employee...</option>${lkOpts(u)}</select></td></tr>`).join("")}</table></div></div>` : "";
  const emptyCard = '<div class="card empty"><b>No punches yet</b><p class="muted">Upload a biometric file under <b>Biometric files</b> to build the DTR of every employee.</p></div>';
  V(`${dtrTabs(un.length, ids.length)}<div data-dp="files" ${dpHide("files", ids.length)}><div class="card noprint"><h3>Biometric files</h3><p class="muted">Upload one or more biometric exports (Excel, CSV, or the text / DAT file from the device). Each punch needs a date and time plus the employee's name or number. Two buildings with two devices? Upload each device's file with its own <b>device / building</b> (Main Building or Annex Building): the same person is joined by name, so a time in from one building and a time out from the other make one DTR line. Employees are matched by <b>name</b> (Last name, First name, Initial) first, so the Biometric ID does not have to be the same as the Employee ID; the ID number is used only when the file has no name. The first punch of a day is time in, the last is time out.</p>
  <div class="row"><div><label>Files</label><input type="file" id="bf" multiple accept=".xlsx,.xls,.csv,.txt,.dat,.log"></div><div><label>Biometric device / building</label><select id="bdv">${["Main Building", "Annex Building"].map((b) => `<option ${ST.dtrDev === b ? "selected" : ""}>${b}</option>`).join("")}</select></div><div><label>Date format in the file</label><select id="bo"><option value="MDY">Month / Day / Year</option><option value="DMY" ${ST.settings.dtr.dateOrder === "DMY" ? "selected" : ""}>Day / Month / Year</option></select></div>${ids.length ? '<button class="btn d" id="bc">Clear punches</button>' : ""}</div></div>
  ${unCard}</div>
  <div data-dp="att" ${dpHide("att", ids.length)}>${ids.length ? attendHTML(list, from, to) : emptyCard}</div>
  <div data-dp="pay" ${dpHide("pay", ids.length)}>${ids.length ? `<div class="card"><h3>Use in payroll</h3><div class="row noprint"><div><label>From</label><input type="date" id="df" value="${from}"></div><div><label>To</label><input type="date" id="dto" value="${to}"></div><button class="btn p" id="gp">Use in payroll</button></div>
  <p class="muted noprint"><button class="btn sm" id="lksync">Save matches to database</button> Sends every match (linked by hand or matched by the app) to the main database and the backup report.</p><p class="muted">${ids.length} biometric record(s) with punches (${list.length} matched to employees), ${dates[0]} to ${dates[dates.length - 1]}. The Payroll tab fills in absences, late minutes, overtime and teacher hours from this DTR; you can still type over them.${un.length ? ` <b>${un.length} not matched - see Biometric files.</b>` : ""}</p>
  <div class="tw"><table><tr><th>No.</th><th>Name</th><th>Biometric ID</th><th>Matched by</th><th>Group</th><th class="n">Days present</th><th class="n">Absent</th><th class="n">Half day</th><th class="n">Late (days)</th><th class="n">Late</th><th class="n">Overtime</th><th class="n">Hours worked</th><th>Shift</th><th></th></tr>${list.map((e) => { const c = dtrCalc(e, from, to), x = M.byEmp[e.id]; return `<tr class="${sel && sel.id === e.id ? "sel" : ""}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(x.keys.map(keyLabel).join(", "))}</td><td>${esc(x.by.join(", "))}${x.warn.length ? ` <small style="color:#7a0c14">${esc(x.warn[0])}</small>` : ""}${x.by.includes("manual") ? ` <button class="btn sm noprint" data-ul="${e.id}">Unlink</button>` : ""}</td><td>${CATEGORIES.find((z) => z.key === categoryOf(e)).short}</td><td class="n">${c.present}</td><td class="n">${c.absent}</td><td class="n">${c.half}</td><td class="n">${c.lateDays}</td><td class="n">${fmtHM0(c.late)}</td><td class="n">${fmtHM0(c.otMin)}</td><td class="n">${fmtHM0(c.hrsMin)}</td><td>${esc([...c.scheds].join(" / "))}</td><td><button class="btn sm" data-dv="${e.id}">View DTR</button></td></tr>`; }).join("")}</table></div></div>` : emptyCard}
  ${sel ? (() => { const c = dtrCalc(sel, from, to); return `<div class="card ps dtrsheet"><h2>DAILY TIME RECORD</h2><p style="text-align:center;margin:0">${from} to ${to}</p><p><b>${esc(nameOf(sel))}</b> &middot; ${esc(sel.position)} &middot; No. ${esc(sel.no)}</p><table><tr><th>Date</th><th>Day</th><th>Shift</th><th>Time in</th><th>Time out</th><th class="n">Hours</th><th class="n">Late</th><th class="n">Overtime</th><th>Remarks</th></tr>${c.rows.map((r) => `<tr><td>${r.d}</td><td>${new Date(r.d + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</td><td>${esc(r.sched || "")}</td>${dtrTc(r, "in")}${dtrTc(r, "out")}<td class="n">${r.hrs ? fmtHM(Math.round(r.hrs * 60)) : ""}</td><td class="n">${fmtHM0(r.late)}</td><td class="n">${fmtHM0(r.ot)}</td><td>${r.note}${dtrRst(r)}</td></tr>`).join("")}<tr class="tot"><td colspan="5">Total</td><td class="n">${fmtHM(c.hrsMin)}</td><td class="n">${fmtHM(c.late)}</td><td class="n">${fmtHM(c.otMin)}</td><td>Absent: ${c.absent}</td></tr></table><div class="sg"><div>Employee</div><div>Verified by</div></div><p class="noprint">${dtrBar(sel.id)} <button class="btn" onclick="print()">Print DTR</button></p></div>`; })() : ""}</div>`);
  $("#bf").onchange = async (ev) => {
    const fs = [...ev.target.files]; if (!fs.length) return; ST.settings.dtr.dateOrder = $("#bo").value; const dev = $("#bdv").value; ST.dtrDev = dev; let n = 0;
    $("#busy").innerHTML = '<div class="bx"><div class="spin"></div><b>Reading biometric files</b><div class="bar"><i></i></div></div>'; $("#busy").style.display = "flex";
    try { for (const f of fs) for (const [id0, dt, nm] of await readPunches(f)) { const id = devKey(dev, id0), d = ymd(dt), a = ((D.days[id] ||= {})[d] ||= []), t = dt.getHours() * 60 + dt.getMinutes() + Math.round(dt.getSeconds() / 60 * 1e4) / 1e4; if (!a.includes(t)) { a.push(t); n++; } if (nm) { D.names ||= {}; if (!D.names[id] || nm.length > D.names[id].length) D.names[id] = nm; } } }
    catch (e) { $("#busy").style.display = "none"; return toast("Could not read the file: " + e.message, true); }
    $("#busy").style.display = "none"; D.from = D.to = ""; saveDtr(); ST._dm = null; const MM = dtrMap(); const saved = n ? await saveLinks() : true; n ? toast(`${n} punches added from ${fs.length} file(s). ${Object.keys(MM.byEmp).length} employee(s) matched${MM.unmatched.length ? `, ${MM.unmatched.length} still need linking` : ""}.` + (saved ? " Matches saved to the database." : " The matches could NOT be saved to the database (deploy the new Code.gs)."), !saved) : toast("No punches found. Each row needs a date with time and an employee name or number.", true); if (n) ST.dtrView = "att"; dtr();
  };
  if (ids.length) {
    $("#bc").onclick = () => { if (confirm("Remove all uploaded punches?")) { ST.dtr = { days: {}, names: {}, link: D.link || {} }; saveDtr(); ST.dtrView = "files"; dtr(); } };
    $("#df").onchange = (e) => { D.from = e.target.value; dtr(selNo); }; $("#dto").onchange = (e) => { D.to = e.target.value; dtr(selNo); };
    $("#gp").onclick = () => { ST.tab = "run"; shell(); };
    if ($("#ld")) $("#ld").onchange = (e) => { ST.lateDate = e.target.value; dtr(selNo); };
    if ($("#lg")) $("#lg").onchange = (e) => { ST.attG = e.target.value; ST.lateDate = ""; dtr(selNo); };
    if ($("#lf")) $("#lf").onchange = (e) => { ST.attF = e.target.value; ST.lateDate = ""; dtr(selNo); };
    if ($("#aq")) { $("#aq").oninput = (e) => { ST.attQ = e.target.value; attDraw(); }; attDraw(); }
    document.querySelectorAll("[data-dv]").forEach((b) => b.onclick = () => { ST.dtrEdit = false; ST.dtrView = "pay"; dtr(b.dataset.dv); });
    if ($("#lksync")) $("#lksync").onclick = async () => { const ok = await saveLinks(); toast(ok ? dtrLinkList().length + " match(es) saved to the database." : "NOT saved to the database. Deploy the new Code.gs (New version) and try again.", !ok); };
    if ($("#lkall")) $("#lkall").onclick = async () => { let n = 0; un.forEach((u) => { const g = sugOf(u); if (g) { (D.link ||= {})[u.key] = g.id; n++; } }); saveDtr(); const ok = await saveLinks(); toast(ok ? n + " record(s) linked and saved to the database." : n + " record(s) linked on this computer only - NOT saved to the database. Deploy the new Code.gs (New version) and link again.", !ok); dtr(selNo); };
    document.querySelectorAll("[data-lk]").forEach((x) => x.onchange = async () => { if (!x.value) return; (D.link ||= {})[x.dataset.lk] = x.value; saveDtr(); const ok = await saveLinks(); toast(ok ? "Linked and saved to the database." : "Linked on this computer only - NOT saved to the database. Deploy the new Code.gs (New version) and link again.", !ok); dtr(selNo); });
    document.querySelectorAll("[data-ul]").forEach((b) => b.onclick = async () => { for (const k of Object.keys(D.link || {})) if (D.link[k] === b.dataset.ul) delete D.link[k]; saveDtr(); if (!(await saveLinks())) toast("Unlinked on this computer only - NOT saved to the database. Deploy the new Code.gs (New version).", true); dtr(selNo); });
  }
}

/* ---------- DTR page sections: Biometric files | Attendance check | Use in payroll ---------- */
const DTR_VIEWS = [["files", "Biometric files"], ["att", "Attendance check"], ["pay", "Use in payroll"], ["cdtr", "Class check DTR"]];

const dtrView = (has) => ST.dtrView || (has ? "att" : "files");

const dpHide = (k, has) => (dtrView(has) === k ? "" : "hidden");

const dtrTabs = (nUn, has) => `<div class="chips noprint" id="dtv">${DTR_VIEWS.map(([k, l]) => `<button data-dtv="${k}" class="${dtrView(has) === k ? "on" : ""}">${l}${k === "files" && nUn ? ` (${nUn} to link)` : ""}</button>`).join("")}</div>`;

document.addEventListener("click", (ev) => { const b = ev.target.closest("[data-dtv]"); if (!b) return; const wasC = ST.dtrView === "cdtr"; ST.dtrView = b.dataset.dtv; if (wasC || ST.dtrView === "cdtr") return dtr(ST.dtrSel); document.querySelectorAll("#dtv [data-dtv]").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll("[data-dp]").forEach((p) => p.hidden = p.dataset.dp !== ST.dtrView); });


/* >>>>>>>>>> js/pages/teacher-hours.js >>>>>>>>>> */
/* ============================================================
   TEACHER HOURS tab - ONE teacher at a time, with a time in / time out for EACH day.
   Saved in Settings:
     dtr.teacherDayTimes[id][weekday] = { start, end }   (different time every day)
     dtr.teacherHrs[id].h[weekday]    = hours of that day (worked out from the times, or typed)
   Used by the DTR (js/dtr/rules.js, js/dtr/dtr-calc.js) and the Payroll tab.
   File: js/pages/teacher-hours.js
   ============================================================ */

const TH_DAYS = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]];

/** Hours between two "HH:MM" times, minus the lunch break when the span is longer than 5 hours. */
function thSpanHrs(a, b, lunch) {
  const mm = (x) => { const [h, i] = String(x).split(":").map(Number); return h * 60 + (i || 0); };
  if (!a || !b || mm(b) <= mm(a)) return 0;
  const sp = mm(b) - mm(a); return Math.max(0, sp - (sp > 300 ? +lunch || 0 : 0)) / 60;
}
const thFmt12 = (x) => { if (!x) return ""; const [h, i] = x.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(i || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

function teacherHours() {
  const S = ST.settings, D = S.dtr, saved = D.teacherHrs || {}, dayT = D.teacherDayTimes || {}, wk = D.workDays || [1, 2, 3, 4, 5, 6], days = TH_DAYS.filter(([n]) => wk.includes(n)), mode = D.teacherHrMode === "cap" ? "cap" : "sched";
  const list = activeEmps().filter((e) => categoryOf(e) === "teacher").sort((a, b) => ST.thSort === "no" ? String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) : ST.thSort === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
  const rate = (e) => Math.max(+e.hourlyRate || 0, minHourly(S));
  ST.thDraft = ST.thDraft || {};                                   // unsaved changes of teachers already visited
  if (!list.find((e) => e.id === ST.thSel)) ST.thSel = list.length ? list[0].id : null;
  const emp = list.find((e) => e.id === ST.thSel), idx = list.findIndex((e) => e.id === ST.thSel);

  /* ---------- one day row ---------- */
  const dayRow = (e, n, lbl) => {
    const dr = (ST.thDraft[e.id] || {}), t = (dr.t || {})[n] || dayT[e.id]?.[n] || {}, hv = dr.h && n in dr.h ? dr.h[n] : ((saved[e.id] || {}).h || {})[n];
    return `<tr data-day="${n}"><td><b>${lbl}</b></td>
      <td><input class="thin" type="time" data-k="start" value="${esc(t.start || "")}"></td>
      <td><input class="thin" type="time" data-k="end" value="${esc(t.end || "")}"></td>
      <td><input class="thin" type="number" min="0" max="24" step="0.25" data-k="h" placeholder="auto" value="${hv === undefined || hv === null ? "" : esc(hv)}" style="width:5rem"></td>
      <td class="n"><b class="dh">0</b></td><td class="dp muted"></td><td class="noprint"><button class="btn sm d" type="button" data-off="${n}" title="No classes this day">Day off</button></td></tr>`;
  };

  const fixV = (k) => { const dr = emp && (ST.thDraft[emp.id] || {}).f; if (dr && k in dr) return dr[k]; const v = emp && ((D.teacherFixed || {})[emp.id] || {})[k]; return v === undefined || v === null ? "" : v; };
  const opts = list.map((e) => `<option value="${esc(e.id)}" ${e.id === ST.thSel ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("");
  const header = `<div class="row noprint" style="align-items:flex-end;gap:.7rem;flex-wrap:wrap">
      <div><label>Sort</label><select id="thsort"><option value="az">Name A - Z</option><option value="za">Name Z - A</option><option value="no">Employee no.</option></select></div>
      <button class="btn" id="thprev" type="button" title="Previous teacher" ${idx <= 0 ? "disabled" : ""}>&larr;</button>
      <div style="flex:1;min-width:16rem"><label>Teacher</label><select id="thsel" style="width:100%;font-weight:600">${opts}</select></div>
      <button class="btn" id="thnext" type="button" title="Next teacher" ${idx < 0 || idx >= list.length - 1 ? "disabled" : ""}>&rarr;</button>
      <span class="muted" style="padding-bottom:.55rem">${list.length ? `${idx + 1} of ${list.length}` : ""}</span></div>`;

  const body = emp ? `
    <div class="th-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.8rem;margin:1rem 0 .6rem;padding:.9rem 1.1rem;border:1px solid var(--line,#e4e7ec);border-radius:12px;background:#f8fafc">
      <div><div style="font-size:1.15rem;font-weight:800">${esc(nameOf(emp))}</div><div class="muted">No. ${esc(emp.no)}${emp.position ? " &middot; " + esc(emp.position) : ""}${emp.dept ? " &middot; " + esc(emp.dept) : ""}</div></div>
      <div style="display:flex;gap:1.6rem;text-align:right"><div><div class="muted" style="font-size:.75rem">Hourly rate</div><b>${money(rate(emp))}</b></div><div><div class="muted" style="font-size:.75rem">Hours / week</div><b id="twk">0</b></div><div><div class="muted" style="font-size:.75rem">Pay / week</div><b id="tpw">0.00</b></div></div></div>
    <div class="tw"><table id="tht"><tr><th>Day</th><th>Time in</th><th>Time out</th><th>Hours <small class="muted">(optional)</small></th><th class="n">Paid hrs</th><th>Pay</th><th class="noprint"></th></tr>${days.map(([n, l]) => dayRow(emp, n, l)).join("")}</table></div>
    <div class="noprint" style="margin-top:1rem;padding:.8rem 1.1rem;border:1px solid var(--line,#e4e7ec);border-radius:12px"><b>Fixed pay (optional, not per hour)</b>
      <div class="row" style="margin-top:.5rem;gap:1rem;flex-wrap:wrap"><div><label>Holiday pay, holiday not worked (&#8369; per day)</label><input id="thfh" type="number" min="0" step="any" placeholder="${esc(((S.holiday || {}).tFixed || {}).regNot ?? "per hour")}" value="${esc(fixV("hol"))}" style="width:11rem"></div>
      <div><label>WFH / Async class pay (&#8369; per day)</label><input id="thfw" type="number" min="0" step="any" placeholder="${esc((S.wfh || {}).teacherFixed || "per hour")}" value="${esc(fixV("wfh"))}" style="width:11rem"></div></div>
      <p class="muted" style="margin:.4rem 0 0">Type the exact amount this teacher gets for each holiday not worked and each WFH / asynchronous day. Leave blank to use the school-wide setting (Settings &rarr; Holiday pay / WFH), or the hourly pay when that is blank too.</p></div>
    <div class="row noprint" style="margin-top:.7rem;gap:.5rem;flex-wrap:wrap">
      <button class="btn" id="thmon" type="button" title="Copy Monday's time in / out to Tuesday - Friday">Copy Monday &rarr; Tue-Fri</button>
      <button class="btn" id="thall" type="button" title="Copy Monday's time in / out to every work day">Copy Monday &rarr; all days</button>
      <button class="btn d" id="thclr" type="button">Clear this teacher</button>
      <span style="flex:1"></span><button class="btn p" id="ths" type="button">Save teacher hours</button></div>
    <p class="muted" style="margin-top:.6rem">Every day can have its own time, for example Monday 6:00 AM - 3:00 PM, Tuesday 8:00 AM - 12:00 PM. Paid hours are time out minus time in, less the lunch break (${+D.lunchMin || 0} min) when the day is longer than 5 hours. Type <b>Hours</b> only to override that. <b>Day off</b> (0 hrs, no times) = no classes, not counted absent. A day with no time and no hours uses the teacher's default time / hours.</p>`
    : `<p class="muted" style="margin-top:1rem">No active teachers. Set the payroll group of an employee to Teachers under Employees.</p>`;

  V(`<div class="card"><h3>Teacher hours per day</h3>${header}${body}
    <details class="noprint" style="margin-top:1.2rem"><summary style="cursor:pointer;font-weight:700">General settings (apply to all teachers)</summary>
      <div class="row" style="margin-top:.7rem;gap:.8rem;flex-wrap:wrap"><div><label>Default hours per day</label><input id="thd" type="number" min="0" max="24" step="0.25" value="${D.teacherDefHrs ?? 8}" style="width:6rem"></div>
      <div style="flex:2;min-width:18rem"><label>How the hours are paid</label><select id="thm"><option value="sched">Scheduled hours of the day, when the teacher is present (time in and time out)</option><option value="cap" ${mode === "cap" ? "selected" : ""}>Biometric hours, but never more than the scheduled hours</option></select></div></div></details></div>`);
  $("#thsort").value = ST.thSort || "az";

  /* ---------- live totals ---------- */
  const rows = () => [...document.querySelectorAll("#tht tr[data-day]")];
  const dayHrs = (tr) => { const a = tr.querySelector('[data-k="start"]').value, b = tr.querySelector('[data-k="end"]').value, h = tr.querySelector('[data-k="h"]').value; return h !== "" && !isNaN(+h) ? Math.min(24, Math.max(0, +h)) : thSpanHrs(a, b, D.lunchMin); };
  const refresh = () => {
    if (!emp) return; let tot = 0, any = false;
    rows().forEach((tr) => { const a = tr.querySelector('[data-k="start"]').value, b = tr.querySelector('[data-k="end"]').value, h = tr.querySelector('[data-k="h"]').value, set = a || b || h !== "", v = dayHrs(tr), df = +(D.teacherDefHrs ?? 8) || 0, use = set ? v : 0;
      if (set) any = true; tot += use; tr.querySelector(".dh").textContent = set ? Math.round(v * 100) / 100 : "-"; tr.querySelector(".dp").textContent = set ? money(v * rate(emp)) : (df > 0 ? `default ${df} hrs` : "biometric"); });
    if (!any) tot = (+(D.teacherDefHrs ?? 8) || 0) * rows().length;
    $("#twk").textContent = Math.round(tot * 100) / 100; $("#tpw").textContent = money(tot * rate(emp));
  };
  const stash = () => {                                           // remember the screen so switching teacher does not lose typing
    if (!emp) return; const t = {}, h = {};
    rows().forEach((tr) => { const n = tr.dataset.day, a = tr.querySelector('[data-k="start"]').value, b = tr.querySelector('[data-k="end"]').value, hv = tr.querySelector('[data-k="h"]').value; t[n] = { start: a, end: b }; if (hv !== "") h[n] = hv; });
    ST.thDraft[emp.id] = { t, h, hSet: true, f: { hol: $("#thfh").value, wfh: $("#thfw").value } };
  };
  refresh();
  if (emp) {
    $("#tht").oninput = () => refresh();
    $("#tht").onclick = (ev) => { const b = ev.target.closest("[data-off]"); if (!b) return; const tr = document.querySelector(`#tht tr[data-day="${b.dataset.off}"]`); tr.querySelector('[data-k="start"]').value = ""; tr.querySelector('[data-k="end"]').value = ""; tr.querySelector('[data-k="h"]').value = "0"; refresh(); };
    const copyMon = (only) => { const m = document.querySelector('#tht tr[data-day="1"]'); if (!m) return toast("Monday is not a work day.", true); const a = m.querySelector('[data-k="start"]').value, b = m.querySelector('[data-k="end"]').value; if (!a || !b) return toast("Type the Monday time in and time out first.", true); rows().forEach((tr) => { const n = +tr.dataset.day; if (n === 1 || (only && ![2, 3, 4, 5].includes(n))) return; tr.querySelector('[data-k="start"]').value = a; tr.querySelector('[data-k="end"]').value = b; tr.querySelector('[data-k="h"]').value = ""; }); refresh(); };
    $("#thmon").onclick = () => copyMon(true); $("#thall").onclick = () => copyMon(false);
    $("#thclr").onclick = () => { rows().forEach((tr) => tr.querySelectorAll("input").forEach((i) => i.value = "")); refresh(); };
  }
  $("#thsort").onchange = (ev) => { stash(); ST.thSort = ev.target.value; teacherHours(); };
  const go = (id) => { stash(); ST.thSel = id; teacherHours(); };
  if ($("#thsel")) $("#thsel").onchange = (ev) => go(ev.target.value);
  if ($("#thprev")) $("#thprev").onclick = () => idx > 0 && go(list[idx - 1].id);
  if ($("#thnext")) $("#thnext").onclick = () => idx < list.length - 1 && go(list[idx + 1].id);

  /* ---------- save (every teacher edited in this visit) ---------- */
  if ($("#ths")) $("#ths").onclick = async () => {
    stash();
    const hrs = { ...(D.teacherHrs || {}) }, tms = { ...(D.teacherDayTimes || {}) }, fxd = { ...(D.teacherFixed || {}) };
    Object.entries(ST.thDraft).forEach(([id, dr]) => {
      const h = { ...((hrs[id] || {}).h || {}) }, t = { ...(tms[id] || {}) };   // days hidden by Work days (Settings) keep what was saved
      Object.entries(dr.t || {}).forEach(([n, v]) => {
        const hv = (dr.h || {})[n], full = v.start && v.end && thSpanHrs(v.start, v.end, 0) > 0;
        if (full) t[n] = { start: v.start, end: v.end }; else delete t[n];
        if (hv !== undefined && hv !== "" && !isNaN(+hv)) h[n] = Math.min(24, Math.max(0, +hv));
        else if (full) h[n] = Math.round(thSpanHrs(v.start, v.end, D.lunchMin) * 100) / 100;
        else delete h[n];
      });
      if (dr.f) { const f = {}; ["hol", "wfh"].forEach((k) => { if (dr.f[k] !== "" && dr.f[k] !== undefined && !isNaN(+dr.f[k]) && +dr.f[k] >= 0) f[k] = +dr.f[k]; }); if (Object.keys(f).length) fxd[id] = f; else delete fxd[id]; }
      if (Object.keys(h).length) hrs[id] = { h }; else delete hrs[id];
      if (Object.keys(t).length) tms[id] = t; else delete tms[id];
    });
    D.teacherHrs = hrs; D.teacherDayTimes = tms; D.teacherFixed = fxd; ST.thDraft = {};
    if ($("#thm")) D.teacherHrMode = $("#thm").value;
    if ($("#thd")) D.teacherDefHrs = $("#thd").value === "" || isNaN(+$("#thd").value) ? 8 : Math.min(24, Math.max(0, +$("#thd").value));
    await api("saveSettings", S); toast("Teacher hours saved."); teacherHours();
  };
}

/* >>>>>>>>>> js/pages/class-monitor.js >>>>>>>>>> */
/* ============================================================
   CLASS MONITOR tab - checks, class by class and hour by hour, that each teacher is in the classroom.
   - Class Monitor account (role "monitor"): sees ONLY this menu. Today's classes, clock the teacher in / out per class.
   - Payroll / owner: the same check for any date + the Class Schedule editor + a Report.
   Saved in the database tabs "Class Schedule" and "Class Attendance" (backend/Code.gs: clsGet, clsMark, clsSave, clsReport).
   File: js/pages/class-monitor.js
   ============================================================ */

Object.assign(BUSY, { clsGet: "Loading the classes", clsMark: "Saving", clsSave: "Saving the class schedule", clsReport: "Loading the report" });

const CM_DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const cmMin = (x) => { const [h, i] = String(x || "0:0").split(":").map(Number); return (h || 0) * 60 + (i || 0); };
const cmT12 = (x) => { if (!x) return ""; const [h, i] = String(x).split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(i || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const cmYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const cmNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const cmDow = (ymd) => new Date(ymd + "T12:00").getDay();
const cmTeachers = () => activeEmps().filter((e) => categoryOf(e) === "teacher").sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
const isMonitor = () => !!(ST.user && ST.user.role === "monitor");

/** Late, present, absent or pending of one class, from what was recorded. The teacher's grace minutes (Settings) are allowed. */
function cmStatus(c, rec, date) {
  if (!rec) return "Pending";
  if (rec.status === "Absent") return "Absent";
  if (!rec.in) return "Pending";
  const e = (ST.employees || []).find((x) => String(x.id) === String(c.empId)), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0;
  return cmMin(rec.in) > cmMin(c.start) + grace ? "Late" : "Present";
}
const cmLate = (c, rec, date) => { const e = (ST.employees || []).find((x) => String(x.id) === String(c.empId)), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0; return rec && rec.in ? Math.max(0, cmMin(rec.in) - cmMin(c.start) - grace) : 0; };
const CM_COLOR = { Present: "#1a7f37", Late: "#b45309", Absent: "#b3121f", Pending: "#667085" };
const cmBadge = (s) => `<span style="display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.75rem;font-weight:700;color:#fff;background:${CM_COLOR[s] || "#667085"}">${s}</span>`;

/* ===== CLASS CHECK = the teacher's biometric for payroll =====
   Hours paid for one class = from the later of (class start, time in) to the earlier of (class end, time out).
   Time in within the teacher's grace minutes counts from the class start. Absent / not clocked in = 0 hours.
   No clock-out: counted to the class end (Settings below) or not counted. Records keep their own start / end, so a later change of the schedule never changes past pay. */
const clsBioOn = (S) => ((S && S.dtr || {}).classBio || {}).on !== false;
function cmCounted(rec, e, date) {
  const cb = ((ST.settings.dtr || {}).classBio || {}), s = cmMin(rec.start), en = cmMin(rec.end), grace = e ? +graceOf(e, cmDow(date)) || 0 : 0, inn = cmMin(rec.in);
  const T = tchOpt(), lateMin = Math.max(0, inn - s - grace), lateDed = T.lateDeduct && lateMin > 0 ? Math.ceil(lateMin / 60) * 60 : 0, from = s; let to, noOut = false;   // teacher: late is counted AFTER the grace period and deducted per whole hour (any late = 1 hr, over 1 hr = 2 hrs ...); late switch OFF = nothing deducted; early out not deducted = paid to the class end
  if (rec.out) to = T.earlyOutDeduct ? Math.min(cmMin(rec.out), en) : en; else { noOut = true; to = cb.noOut === "none" ? from : en; }
  return { mins: Math.max(0, to - from - lateDed), late: lateMin, lateDed, noOut, earlyIn: Math.max(0, s - inn), earlyOut: rec.out ? Math.max(0, en - cmMin(rec.out)) : 0 };
}
/** Hours of one teacher between two dates from the class check. has = the teacher has classes in the Class schedule (otherwise the DTR hours are used). */
function clsHoursOf(e, from, to, classes, att) {
  const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), wfh = new Set((D.wfhDays || []).map((h) => h.date)), today = cmYmd(new Date());
  const mine = (classes || []).filter((c) => String(c.empId) === String(e.id)), recs = (att || []).filter((a) => String(a.empId) === String(e.id) && a.date >= from && a.date <= to);
  const o = { lateOn: tchOpt().lateDeduct, earlyOutOn: tchOpt().earlyOutDeduct, has: mine.some((c) => c.active) || recs.length > 0, mins: 0, schedMin: 0, lateMin: 0, lateDedMin: 0, lateList: [], earlyInMin: 0, earlyInList: [], earlyOutMin: 0, earlyOutList: [], absent: 0, noRecord: 0, noOut: 0, held: 0, presentDates: [] }, by = {}, pd = new Set();
  recs.forEach((a) => { by[a.date + "|" + a.classId] = a; if (hol.has(a.date) && D.holPunch !== true) return; if (a.status === "Absent") { o.absent++; return; } if (!a.in) return;
    const r = cmCounted(a, e, a.date); o.mins += r.mins; o.lateMin += r.late; o.lateDedMin += r.lateDed; if (r.late > 0) o.lateList.push({ d: a.date, start: a.start, inn: a.in, min: r.late, ded: r.lateDed }); if (r.earlyIn > 0) { o.earlyInMin += r.earlyIn; o.earlyInList.push({ d: a.date, start: a.start, inn: a.in, min: r.earlyIn }); } if (r.earlyOut > 0) { o.earlyOutMin += r.earlyOut; o.earlyOutList.push({ d: a.date, end: a.end, out: a.out, min: r.earlyOut }); } if (r.noOut) o.noOut++; o.held++; pd.add(a.date); });
  for (let d = from; d <= to && d <= today; d = addDay(d)) { if (hol.has(d)) continue; const dow = cmDow(d);
    mine.filter((c) => c.active && c.days.includes(dow)).forEach((c) => { const r = by[d + "|" + c.id], wf = wfh.has(d) && !(r && r.in); if (wf) return; o.schedMin += Math.max(0, cmMin(c.end) - cmMin(c.start)); if (!r || (!r.in && r.status !== "Absent")) o.noRecord++; }); }
  o.presentDates = [...pd].sort(); return o;
}

async function cmLoad(date) {
  const r = await api("clsGet", { date });
  ST.cls.classes = r.classes || []; ST.cls.att = {}; (r.att || []).forEach((a) => { ST.cls.att[a.classId] = a; });
}

function classMonitor() {
  const C = (ST.cls ||= { view: "monitor", date: cmYmd(new Date()), hour: "now", status: "all", q: "", classes: null, att: {}, sel: null, from: cmYmd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: cmYmd(new Date()) });
  if (isMonitor()) { if (C.view !== "schedule") C.view = "monitor"; C.date = cmYmd(new Date()); }
  clearInterval(C.timer);
  if (C.classes === null) { V('<div class="card muted">Loading the classes...</div>'); cmLoad(C.date).then(classMonitor).catch(() => { C.classes = []; classMonitor(); }); return; }
  const tabs = `<div class="chips noprint" style="display:inline-flex;margin-bottom:1rem"><button data-cv="monitor" class="${C.view === "monitor" ? "on" : ""}">Class check</button><button data-cv="schedule" class="${C.view === "schedule" ? "on" : ""}">Class schedule</button>${isMonitor() ? "" : `<button data-cv="report" class="${C.view === "report" ? "on" : ""}">Report</button>`}</div>`;
  V(`${tabs}<div id="cmv"></div>`);
  document.querySelectorAll("[data-cv]").forEach((b) => b.onclick = () => { C.view = b.dataset.cv; classMonitor(); });
  ({ monitor: cmCheck, schedule: cmSchedule, report: cmReport })[C.view]();
}

/* ======================= 1. CLASS CHECK (the Class Monitor) ======================= */
function cmCheck() {
  const C = ST.cls, S = ST.settings, D = S.dtr || {}, date = C.date, dow = cmDow(date), mon = isMonitor(), att = C.att, today = cmYmd(new Date());
  const hol = (D.holidays || []).find((h) => h.date === date), wfh = (D.wfhDays || []).find((w) => w.date === date);
  const all = (C.classes || []).filter((c) => c.active && !String(c.id).startsWith("n") && c.days.includes(dow)).sort((a, b) => cmMin(a.start) - cmMin(b.start) || String(a.name).localeCompare(String(b.name)));
  const nowM = cmMin(cmNow()), live = date === today, inSession = (c) => cmMin(c.start) <= nowM && nowM < cmMin(c.end);
  const hours = [...new Set(all.flatMap((c) => { const o = []; for (let h = Math.floor(cmMin(c.start) / 60); h * 60 < cmMin(c.end); h++) o.push(h); return o; }))].sort((a, b) => a - b);
  const q = C.q.trim().toLowerCase();
  const rows = all.filter((c) => (C.hour === "all" || (C.hour === "now" ? (live ? inSession(c) : true) : (cmMin(c.start) < (+C.hour + 1) * 60 && cmMin(c.end) > +C.hour * 60))) && (C.status === "all" || cmStatus(c, att[c.id], date) === C.status) && (!q || [c.name, c.subject, c.room, c.no].join(" ").toLowerCase().includes(q)));
  const cnt = { Present: 0, Late: 0, Absent: 0, Pending: 0 }; all.forEach((c) => cnt[cmStatus(c, att[c.id], date)]++);
  const chip = (l, v, k) => `<div style="flex:1;min-width:7rem;padding:.7rem 1rem;border:1px solid var(--line,#e4e7ec);border-radius:12px;background:#fff"><div class="muted" style="font-size:.75rem">${l}</div><div style="font-size:1.4rem;font-weight:800;color:${CM_COLOR[k] || "#1d2433"}">${v}</div></div>`;
  const line = (c) => {
    const r = att[c.id] || {}, st = cmStatus(c, r, date), now = live && inSession(c), lm = cmLate(c, r, date), early = r.out && cmMin(r.out) < cmMin(c.end) - 5;
    return `<tr data-c="${esc(c.id)}" style="${now ? "background:#fff8e1" : ""}"><td style="white-space:nowrap"><b>${cmT12(c.start)}</b> - ${cmT12(c.end)}${now ? '<br><small style="color:#b45309;font-weight:700">IN SESSION NOW</small>' : ""}</td>
      <td><b>${esc(c.name)}</b><br><small class="muted">No. ${esc(c.no)}</small></td><td>${esc(c.subject)}${c.room ? `<br><small class="muted">${esc(c.room)}</small>` : ""}</td>
      <td><input class="thin ci" type="time" value="${esc(r.in || "")}" style="width:6.6rem"><br><button class="btn sm p" data-nowin>Clock in now</button></td>
      <td><input class="thin co" type="time" value="${esc(r.out || "")}" style="width:6.6rem"><br><button class="btn sm" data-nowout>Clock out now</button></td>
      <td>${cmBadge(st)}${lm ? `<br><small class="muted">${lm} min late</small>` : ""}${early ? '<br><small class="muted">left early</small>' : ""}${r.by ? `<br><small class="muted">${esc(r.by)}</small>` : ""}</td>
      <td><input class="thin cr" placeholder="Remarks" value="${esc(r.remarks || "")}" style="width:9rem"><br><button class="btn sm p" data-save style="margin-right:.3rem">Save</button><button class="btn sm d" data-abs>${st === "Absent" ? "Undo absent" : "Absent"}</button></td></tr>`;
  };
  $("#cmv").innerHTML = `<div class="card"><h3>Class check &middot; ${new Date(date + "T12:00").toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
    ${hol ? `<p style="background:#fff4ce;padding:.5rem .8rem;border-radius:8px"><b>Holiday:</b> ${esc(hol.label || "")}. Classes may be suspended.</p>` : ""}${wfh ? `<p style="background:#e7f1ff;padding:.5rem .8rem;border-radius:8px"><b>${esc(wfh.type === "async" ? "Asynchronous" : "WFH")} day:</b> ${esc(wfh.label || "")}</p>` : ""}
    <div style="display:flex;gap:.7rem;flex-wrap:wrap;margin-bottom:.9rem">${chip("Classes today", all.length)}${chip("Present", cnt.Present, "Present")}${chip("Late", cnt.Late, "Late")}${chip("Absent", cnt.Absent, "Absent")}${chip("Not yet checked", cnt.Pending, "Pending")}</div>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div><label>Date</label><input type="date" id="cmd" value="${date}" ${mon ? "disabled" : ""}></div>
      <div><label>Hour</label><select id="cmh"><option value="now">${live ? "Now (in session)" : "All hours"}</option><option value="all">All day</option>${hours.map((h) => `<option value="${h}">${cmT12(h + ":00")} - ${cmT12(h + 1 + ":00")}</option>`).join("")}</select></div>
      <div><label>Status</label><select id="cms"><option value="all">All</option><option>Pending</option><option>Present</option><option>Late</option><option>Absent</option></select></div>
      <div style="flex:1;min-width:12rem"><label>Search teacher / subject</label><input id="cmq" type="search" value="${esc(C.q)}" style="width:100%"></div><button class="btn" id="cmr">Refresh</button></div>
    <div class="tw" style="margin-top:.7rem"><table><tr><th>Class time</th><th>Teacher</th><th>Subject / Section</th><th>Time in</th><th>Time out</th><th>Status</th><th></th></tr>${rows.map(line).join("") || `<tr><td colspan="7" class="muted">${all.length ? "No class matches the filters." : "No classes scheduled for this day."}</td></tr>`}</table></div>
    <p class="muted">Check every hour: press <b>Clock in now</b> when the teacher is in the classroom and <b>Clock out now</b> when the class ends. You can also type the time. A teacher who arrives after the class start (plus the grace minutes in Settings) is marked <b>Late</b>. Press <b>Absent</b> when the teacher did not come. Press <b>Save</b> on the row to keep the times (nothing is saved until then); <b>Absent</b> saves at once.</p></div>${cuCard()}`;
  $("#cmh").value = C.hour; $("#cms").value = C.status; cuInit();
  $("#cmd").onchange = async (e) => { C.date = e.target.value; await cmLoad(C.date); cmCheck(); };
  $("#cmh").onchange = (e) => { C.hour = e.target.value; cmCheck(); };
  $("#cms").onchange = (e) => { C.status = e.target.value; cmCheck(); };
  $("#cmq").oninput = (e) => { C.q = e.target.value; const pos = e.target.selectionStart; cmCheck(); const n = $("#cmq"); n.focus(); n.setSelectionRange(pos, pos); };
  $("#cmr").onclick = async () => { await cmLoad(C.date); cmCheck(); };
  const save = async (tr, patch) => {
    const id = tr.dataset.c, old = att[id] || {}, rec = { in: tr.querySelector(".ci").value, out: tr.querySelector(".co").value, remarks: tr.querySelector(".cr").value.trim(), status: old.status === "Absent" ? "Absent" : "", ...patch };
    const c = C.classes.find((x) => x.id === id); if (rec.status !== "Absent") rec.status = cmStatus(c, rec, date);
    if (rec.out && rec.in && cmMin(rec.out) < cmMin(rec.in)) return toast("The time out is earlier than the time in.", true);
    try { const r = await api("clsMark", { date, items: [{ classId: id, in: rec.in, out: rec.out, status: rec.status === "Pending" ? "" : rec.status, remarks: rec.remarks }] }); (r || []).forEach((a) => { att[a.classId] = a; }); } catch (e) { return; }
    ST.clsPay = null; C.dirty = false; toast("Saved."); cmCheck();
  };
  document.querySelectorAll("#cmv tr[data-c]").forEach((tr) => {
    const dirty = () => { C.dirty = true; tr.style.outline = "2px solid #b45309"; tr.querySelector("[data-save]").textContent = "Save *"; };
    tr.querySelector("[data-nowin]").onclick = () => { tr.querySelector(".ci").value = cmNow(); dirty(); };   // fills the time only: press Save to keep it
    tr.querySelector("[data-nowout]").onclick = () => { if (!tr.querySelector(".ci").value) return toast("Clock in the teacher first.", true); tr.querySelector(".co").value = cmNow(); dirty(); };
    tr.querySelector("[data-save]").onclick = () => { C.dirty = false; save(tr, {}); };
    tr.querySelector("[data-abs]").onclick = () => { const a = (att[tr.dataset.c] || {}).status === "Absent"; save(tr, a ? { status: "" } : { status: "Absent", in: "", out: "" }); };
    [".ci", ".co", ".cr"].forEach((k) => tr.querySelector(k).oninput = dirty);   // no auto-save: the Save button saves the row
  });
  if (live) C.timer = setInterval(() => { if (!$("#cmv") || ST.tab !== "cls" || C.view !== "monitor") return clearInterval(C.timer); const a = document.activeElement; if (C.dirty || C.cimp || (a && a.closest && a.closest("#cmv") && /INPUT|SELECT/.test(a.tagName))) return; cmCheck(); }, 60000);   // the "in session" highlight follows the clock
}

/* ======================= 2. CLASS SCHEDULE (payroll / owner) ======================= */
function cmSchedule() {
  const C = ST.cls, list = cmTeachers(); if (!list.find((e) => e.id === C.sel)) C.sel = list.length ? list[0].id : null;
  const mine = (C.classes || []).filter((c) => c.active && String(c.empId) === String(C.sel)).sort((a, b) => cmMin(a.start) - cmMin(b.start));
  const row = (c) => `<tr data-c="${esc(c.id)}"><td><input class="thin cs" placeholder="Subject" value="${esc(c.subject)}" style="width:11rem"></td><td><input class="thin cm" placeholder="Section / Room" value="${esc(c.room)}" style="width:9rem"></td>
    <td style="white-space:nowrap">${CM_DAYS.map(([n, l]) => `<label style="display:inline-flex;gap:.15rem;margin-right:.35rem;font-weight:500"><input type="checkbox" class="cd" value="${n}" ${c.days.includes(n) ? "checked" : ""}>${l}</label>`).join("")}</td>
    <td><input class="thin ca" type="time" value="${esc(c.start)}"></td><td><input class="thin cb" type="time" value="${esc(c.end)}"></td><td><button class="btn sm d" data-del>Remove</button></td></tr>`;
  const grid = () => { const q = ST.cls.classes.filter((c) => c.active); return q.length; };
  $("#cmv").innerHTML = `${cmImportCard()}<div class="card"><h3>Class schedule of the teachers</h3><p class="muted">Type each class of the teacher: the subject, the section or room, the days and the time, for example <b>Mathematics &middot; Grade 7 - Rizal &middot; Mon Wed Fri &middot; 6:00 AM - 8:00 AM</b>. The Class Monitor then clocks the teacher in and out of each class.</p>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div style="flex:1;min-width:16rem"><label>Teacher</label><select id="cst" style="width:100%;font-weight:600">${list.map((e) => `<option value="${esc(e.id)}" ${e.id === C.sel ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))} (${(C.classes || []).filter((c) => c.active && String(c.empId) === String(e.id)).length} classes)</option>`).join("")}</select></div>
      <button class="btn" id="csa">+ Add class</button><button class="btn p" id="css">Save class schedule</button></div>
    <div class="tw" style="margin-top:.7rem"><table id="cstab"><tr><th>Subject</th><th>Section / Room</th><th>Days</th><th>Start</th><th>End</th><th></th></tr>${mine.map(row).join("") || '<tr><td colspan="6" class="muted">No class yet for this teacher. Press + Add class.</td></tr>'}</table></div>
    <p class="muted">Changes are kept on this screen when you switch teacher; press <b>Save class schedule</b> to save everybody's classes. ${grid()} class(es) in total.</p></div>`;
  cmImportInit();
  const pull = () => document.querySelectorAll("#cstab tr[data-c]").forEach((tr) => { const c = C.classes.find((x) => x.id === tr.dataset.c); if (!c) return; c.subject = tr.querySelector(".cs").value.trim(); c.room = tr.querySelector(".cm").value.trim(); c.days = [...tr.querySelectorAll(".cd")].filter((x) => x.checked).map((x) => +x.value); c.start = tr.querySelector(".ca").value; c.end = tr.querySelector(".cb").value; });
  $("#cst").onchange = (e) => { pull(); C.sel = e.target.value; cmSchedule(); };
  $("#csa").onclick = () => { pull(); if (!C.sel) return toast("No teacher.", true); const e = list.find((x) => x.id === C.sel); C.classes.push({ id: "n" + Math.random().toString(36).slice(2, 9), empId: C.sel, no: e.no, name: nameOf(e), subject: "", room: "", days: [1, 2, 3, 4, 5], start: "", end: "", active: true }); cmSchedule(); };
  $("#cstab").onclick = (ev) => { const b = ev.target.closest("[data-del]"); if (!b) return; pull(); const id = b.closest("tr").dataset.c; C.classes = String(id).startsWith("n") ? C.classes.filter((c) => c.id !== id) : C.classes.map((c) => (c.id === id ? { ...c, active: false } : c)); cmSchedule(); };   // a saved class is switched off, not erased: its past class checks keep counting in the payroll
  $("#css").onclick = async () => {
    pull(); const bad = C.classes.filter((c) => c.active).find((c) => !c.subject || !c.start || !c.end || cmMin(c.end) <= cmMin(c.start) || !c.days.length);
    if (bad) { C.sel = bad.empId; cmSchedule(); return toast(`Complete the class of ${bad.name}: subject, days, start and end (the end must be after the start).`, true); }
    const act = C.classes.filter((c) => c.active); for (const c of act) for (const o of act) if (c.id < o.id && c.empId === o.empId && c.days.some((d) => o.days.includes(d)) && cmMin(c.start) < cmMin(o.end) && cmMin(o.start) < cmMin(c.end)) { C.sel = c.empId; cmSchedule(); return toast(`${c.name}: "${c.subject}" and "${o.subject}" overlap on the same day.`, true); }
    ST.clsPay = null; const r = await api("clsSave", { classes: C.classes.map((c) => ({ id: String(c.id).startsWith("n") ? "" : c.id, empId: c.empId, subject: c.subject, room: c.room, days: c.days, start: c.start, end: c.end, active: c.active })) });
    C.classes = r || []; toast("Class schedule saved."); cmSchedule();
  };
}

/* ======================= 3. REPORT (payroll / owner) ======================= */
async function cmReport() {
  const C = ST.cls, list = cmTeachers();
  $("#cmv").innerHTML = `<div class="card"><h3>Class attendance report</h3><div class="row noprint" style="gap:.7rem;flex-wrap:wrap"><div><label>From</label><input type="date" id="rf" value="${C.from}"></div><div><label>To</label><input type="date" id="rt" value="${C.to}"></div>
    <div style="min-width:15rem"><label>Teacher</label><select id="rtc"><option value="">All teachers</option>${list.map((e) => `<option value="${esc(e.id)}" ${C.rteacher === e.id ? "selected" : ""}>${esc(nameOf(e))}</option>`).join("")}</select></div><button class="btn p" id="rg">Show report</button><button class="btn" id="rx">Download Excel</button><button class="btn" id="rp">Print</button></div><div id="rb" style="margin-top:.8rem" class="muted">Press Show report.</div></div>`;
  let data = null;
  const draw = () => {
    const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), by = {}, det = [];
    const att = {}; data.att.forEach((a) => { att[a.date + "|" + a.classId] = a; });
    for (let d = new Date(C.from + "T12:00"); cmYmd(d) <= C.to; d.setDate(d.getDate() + 1)) {
      const ymd = cmYmd(d); if (hol.has(ymd)) continue;
      data.classes.filter((c) => c.active && c.days.includes(d.getDay()) && (!C.rteacher || String(c.empId) === String(C.rteacher))).forEach((c) => {
        const r = att[ymd + "|" + c.id], st = cmStatus(c, r, ymd), x = (by[c.empId] ||= { no: c.no, name: c.name, total: 0, present: 0, late: 0, absent: 0, none: 0, mins: 0, lateMin: 0 });
        x.total++; if (st === "Present") x.present++; else if (st === "Late") { x.late++; x.lateMin += cmLate(c, r, ymd); } else if (st === "Absent") x.absent++; else x.none++;
        if (r && r.in) { const e0 = (ST.employees || []).find((z) => String(z.id) === String(c.empId)); x.mins += cmCounted({ ...r, start: r.start || c.start, end: r.end || c.end }, e0, ymd).mins; }
        det.push([ymd, c.no, c.name, c.subject, c.room, cmT12(c.start), cmT12(c.end), r ? cmT12(r.in) : "", r ? cmT12(r.out) : "", st === "Pending" ? "No record" : st, r ? r.remarks : "", r ? r.by : ""]);
      });
    }
    const sum = Object.values(by).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
    data.sum = sum; data.det = det;
    $("#rb").innerHTML = sum.length ? `<div class="tw"><table><tr><th>No.</th><th>Teacher</th><th class="n">Classes</th><th class="n">Present</th><th class="n">Late</th><th class="n">Late (min)</th><th class="n">Absent</th><th class="n">No record</th><th class="n">Hours counted for pay</th><th class="n">Attendance %</th></tr>${sum.map((x) => `<tr><td>${esc(x.no)}</td><td>${esc(x.name)}</td><td class="n">${x.total}</td><td class="n">${x.present}</td><td class="n">${x.late}</td><td class="n">${x.lateMin}</td><td class="n">${x.absent}</td><td class="n">${x.none}</td><td class="n">${(x.mins / 60).toFixed(2)}</td><td class="n"><b>${x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0}%</b></td></tr>`).join("")}</table></div><p class="muted">Holidays are left out. "No record" = the class was scheduled but nobody clocked the teacher. \"Hours counted for pay\" is what the Payroll uses for teachers (Class schedule tab > Payroll rule).</p>` : '<p class="muted">No class in this range.</p>';
  };
  const run = async () => { C.from = $("#rf").value; C.to = $("#rt").value; C.rteacher = $("#rtc").value; if (!C.from || !C.to || C.from > C.to) return toast("Choose the From and To dates.", true); data = await api("clsReport", { from: C.from, to: C.to }); data.classes = data.classes || []; draw(); };
  $("#rg").onclick = run;
  $("#rx").onclick = () => { if (!data || !data.det) return toast("Press Show report first.", true); xlsxBook([{ name: "Class Summary", header: ["Employee No", "Teacher", "Classes", "Present", "Late", "Late (min)", "Absent", "No record", "Hours counted for pay", "Attendance %"], rows: data.sum.map((x) => [x.no, x.name, x.total, x.present, x.late, x.lateMin, x.absent, x.none, +(x.mins / 60).toFixed(2), x.total ? Math.round(((x.present + x.late) / x.total) * 100) : 0]) }, { name: "Class Attendance", header: ["Date", "Employee No", "Teacher", "Subject", "Section / Room", "Class start", "Class end", "Time in", "Time out", "Status", "Remarks", "Checked by"], rows: data.det }], `ARK-Class-Attendance-${C.from}_to_${C.to}.xlsx`); };
  $("#rp").onclick = () => { if (!data) return toast("Press Show report first.", true); print(); };
}


/* ======================= 4. UPLOAD A FILE OF TEACHERS' SCHEDULES + TEMPLATES ======================= */
const CM_HEAD = ["Employee No", "Teacher name", "Subject", "Section / Room", "Days", "Start", "End"];
const CM_DMAP = { sun: 0, sunday: 0, su: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, th: 4, fri: 5, friday: 5, sat: 6, saturday: 6, sa: 6 };
const cmPad = (n) => String(n).padStart(2, "0");
const cmDaysTxt = (days) => [1, 2, 3, 4, 5, 6, 0].filter((d) => (days || []).includes(d)).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");

/** "Mon, Wed, Fri" | "MWF" | "TTh" | "Mon-Fri" | "weekdays" -> [1,3,5]; null = not understood */
function cmParseDays(v) {
  let t = String(v ?? "").trim().toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\./g, ""); if (!t) return null;
  if (/^(weekdays?|mon\s*-\s*fri|monday\s*-\s*friday)$/.test(t)) return [1, 2, 3, 4, 5];
  const out = new Set(), tok = t.split(/[,\s/&+;]+/).filter(Boolean);
  for (const k of tok) {
    if (/^[a-z]+-[a-z]+$/.test(k) && CM_DMAP[k.split("-")[0]] !== undefined && CM_DMAP[k.split("-")[1]] !== undefined) { let a = CM_DMAP[k.split("-")[0]], b = CM_DMAP[k.split("-")[1]]; for (let n = 0; n < 7; n++) { out.add(a); if (a === b) break; a = (a + 1) % 7; } continue; }
    if (CM_DMAP[k] !== undefined) { out.add(CM_DMAP[k]); continue; }
    let i = 0; while (i < k.length) { const two = k.slice(i, i + 2); if (two === "th") { out.add(4); i += 2; } else if (two === "su") { out.add(0); i += 2; } else if (two === "sa") { out.add(6); i += 2; } else { const m = { m: 1, t: 2, w: 3, h: 4, f: 5, s: 6 }[k[i]]; if (m === undefined) return null; out.add(m); i++; } }
  }
  return out.size ? [...out].sort((a, b) => a - b) : null;
}
/** "6:00 AM" | "06:00" | "18:00" | 0.25 (Excel time) -> { t: "06:00", assumed: bool }; null = not understood. Without AM/PM, 1:00-6:59 is taken as PM (flagged). */
function cmParseTime(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 24) v = String(v);
  if (typeof v === "number") { const m = Math.round((v % 1) * 1440); return isNaN(m) ? null : { t: cmPad(Math.floor(m / 60) % 24) + ":" + cmPad(m % 60), assumed: false }; }
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*([ap])?m?$/.exec(String(v).trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").replace(/\s?([ap]m)$/, "$1")); if (!m) return null;
  let h = +m[1], mi = +(m[2] || 0), ap = m[3], assumed = false; if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; h = (h % 12) + (ap === "p" ? 12 : 0); } else { if (h > 23) return null; if (h >= 1 && h <= 6) { h += 12; assumed = true; } }
  return { t: cmPad(h) + ":" + cmPad(mi), assumed };
}
const cmNorm = (x) => String(x ?? "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");

function cmTemplateRows(kind) {
  if (kind === "export") return (ST.cls.classes || []).filter((c) => c.active).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) || cmMin(a.start) - cmMin(b.start)).map((c) => [String(c.no), c.name, c.subject, c.room, cmDaysTxt(c.days), cmT12(c.start), cmT12(c.end)]);
  if (kind === "mine") return cmTeachers().map((e) => [String(e.no), nameOf(e), "", "", "", "", ""]);
  return [["e.g. 1001", "e.g. Juan Dela Cruz", "Mathematics", "Grade 7 - Rizal", "Mon, Wed, Fri", "6:00 AM", "7:00 AM"], ["e.g. 1001", "e.g. Juan Dela Cruz", "Science", "Grade 8 - Bonifacio", "Tue, Thu", "8:00 AM", "9:30 AM"], ["e.g. 1002", "e.g. Maria Santos", "English", "Grade 7 - Rizal", "Mon-Fri", "1:00 PM", "2:00 PM"]];
}
const CM_HELP = [["HOW TO FILL IN THE CLASS SCHEDULE TEMPLATE"], [""], ["One row = one class of one teacher. A teacher with many classes has many rows."], ["Employee No  - the employee number in the Employees tab (best). If it is empty, the Teacher name is used."], ["Teacher name - used only when the Employee No is empty. Any order (Juan Dela Cruz = Dela Cruz, Juan)."], ["Subject      - required."], ["Section / Room - optional, e.g. Grade 7 - Rizal."], ["Days         - Mon, Wed, Fri  |  MWF  |  TTh  |  Mon-Fri  |  weekdays   (M T W Th F S Su)"], ["Start / End  - 6:00 AM, 6:30 PM or 18:30. Without AM / PM, 1:00 to 6:59 is read as PM."], ["Rows starting with \"e.g.\" and rows with nothing in Subject / Days / Start / End are skipped."], ["A teacher cannot have two classes at the same time on the same day."], ["Upload the file in Attendance > Class check > Class schedule > Upload schedule file. You see a preview first; nothing is saved until you press Import."]];

function cmDownloadTemplate(kind, csv) {
  const rows = cmTemplateRows(kind), name = kind === "export" ? "ARK-Class-Schedule-Current" : kind === "mine" ? "ARK-Class-Schedule-Template-My-Teachers" : "ARK-Class-Schedule-Template";
  if (csv) { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, txt = "\ufeff" + [CM_HEAD, ...rows].map((r) => r.map(q).join(",")).join("\r\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
  const sheets = [{ name: "Schedule", header: CM_HEAD, rows }, { name: "How to fill in", header: CM_HELP[0], rows: CM_HELP.slice(1) }];
  if (kind === "mine" || kind === "blank") sheets.push({ name: "Teachers", header: ["Employee No", "Teacher name"], rows: cmTeachers().map((e) => [String(e.no), nameOf(e)]) });
  xlsxBook(sheets, name + ".xlsx");
}

/** Read the uploaded file into rows with errors / warnings. */
function cmReadFile(buf) {
  const wb = XLSX.read(buf, { type: "array" }), sh = wb.Sheets[wb.SheetNames.find((n) => /^schedule$/i.test(n)) || wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: "" });
  const key = (x) => String(x).toLowerCase().replace(/[^a-z]/g, ""), find = (names) => (r) => r.findIndex((c) => names.includes(key(c)));
  let hi = A.findIndex((r) => r.some((c) => key(c) === "subject") && r.some((c) => ["start", "starttime", "from", "timestart"].includes(key(c))));
  if (hi < 0) throw new Error("The header row was not found. Use the template: Employee No, Teacher name, Subject, Section / Room, Days, Start, End.");
  const H = A[hi], col = { no: find(["employeeno", "empno", "no", "teacherno", "id", "employeenumber"])(H), name: find(["teachername", "teacher", "name", "employeename"])(H), subject: find(["subject"])(H), room: find(["sectionroom", "section", "room", "sectionorroom"])(H), days: find(["days", "day"])(H), start: find(["start", "starttime", "from", "timestart"])(H), end: find(["end", "endtime", "to", "timeend"])(H) };
  const emps = activeEmps(), byNo = {}, byName = {}; emps.forEach((e) => { byNo[String(e.no).trim().toLowerCase()] = e; byName[cmNorm(nameOf(e))] = e; });
  const out = [];
  for (let i = hi + 1; i < A.length; i++) {
    const r = A[i], g = (k) => (col[k] >= 0 ? r[col[k]] : ""), no = String(g("no")).trim(), nm = String(g("name")).trim(), subj = String(g("subject")).trim();
    if (/^e\.?g\.?/i.test(no) || /^e\.?g\.?/i.test(nm)) continue;
    if (!subj && !String(g("days")).trim() && !String(g("start")).trim() && !String(g("end")).trim()) continue;
    const row = { line: i + 1, no, name: nm, subject: subj, room: String(g("room")).trim(), errors: [], warns: [] };
    let e = no ? byNo[no.toLowerCase()] : null; if (!e && nm) e = byName[cmNorm(nm)];
    if (!e) row.errors.push(no || nm ? `Teacher not found (${no || nm}). Check the Employee No in the Employees tab.` : "No Employee No or Teacher name.");
    else if (categoryOf(e) !== "teacher") row.errors.push(`${nameOf(e)} is not in the Teachers payroll group (change it under Employees).`);
    else { row.empId = e.id; row.no = e.no; row.name = nameOf(e); if (no && nm && cmNorm(nm) !== cmNorm(nameOf(e))) row.warns.push(`Employee No ${no} is ${nameOf(e)} (the file says ${nm}).`); }
    if (!subj) row.errors.push("Subject is empty.");
    row.days = cmParseDays(g("days")); if (!row.days) row.errors.push(`Days not understood ("${g("days")}"). Use Mon, Wed, Fri or MWF.`);
    const a = cmParseTime(g("start")), b = cmParseTime(g("end")); if (!a) row.errors.push(`Start time not understood ("${g("start")}").`); if (!b) row.errors.push(`End time not understood ("${g("end")}").`);
    if (a && b) { row.start = a.t; row.end = b.t; if (cmMin(b.t) <= cmMin(a.t) && b.assumed === false && !a.assumed) row.errors.push("End must be after Start."); else if (cmMin(b.t) <= cmMin(a.t)) row.errors.push("End must be after Start."); if (a.assumed || b.assumed) row.warns.push("No AM/PM: read as " + cmT12(a.t) + " - " + cmT12(b.t) + "."); }
    out.push(row);
  }
  return out;
}
const cmSame = (c, r) => String(c.empId) === String(r.empId) && c.subject.trim().toLowerCase() === r.subject.trim().toLowerCase() && String(c.room || "").trim().toLowerCase() === String(r.room || "").trim().toLowerCase() && c.start === r.start && c.end === r.end && [...c.days].sort().join() === [...r.days].sort().join();

/** Which imported rows overlap each other (or an existing class that stays) - marks them as errors. */
function cmImportCheck(imp) {
  const C = ST.cls, mode = imp.mode, ok = imp.rows.filter((r) => !r.errors.length), touched = new Set(ok.map((r) => String(r.empId)));
  const kept = (C.classes || []).filter((c) => c.active && (mode === "add" ? true : mode === "replace" ? !touched.has(String(c.empId)) : false));
  imp.rows.forEach((r) => { r.dup = false; r.errors = r.errors.filter((m) => !m.startsWith("Overlaps")); });
  const seen = [];
  imp.rows.filter((r) => !r.errors.length).forEach((r) => {
    if (mode === "add" && kept.some((c) => cmSame(c, r))) { r.dup = true; return; }
    const clash = [...kept.filter((c) => String(c.empId) === String(r.empId)), ...seen.filter((x) => String(x.empId) === String(r.empId))].find((c) => c.days.some((d) => r.days.includes(d)) && cmMin(c.start) < cmMin(r.end) && cmMin(r.start) < cmMin(c.end));
    if (clash) r.errors.push(`Overlaps "${clash.subject}" (${cmT12(clash.start)} - ${cmT12(clash.end)}) on the same day.`); else seen.push(r);
  });
}
function cmImportApply() {
  const C = ST.cls, imp = C.imp; cmImportCheck(imp);
  const good = imp.rows.filter((r) => !r.errors.length && !r.dup), touched = new Set(imp.rows.filter((r) => !r.errors.length).map((r) => String(r.empId)));
  const old = (C.classes || []).filter((c) => c.active), keepIds = new Set(), fresh = [];
  good.forEach((r) => { const ex = old.find((c) => cmSame(c, r) && !keepIds.has(c.id)); if (ex) keepIds.add(ex.id); else fresh.push({ id: "n" + Math.random().toString(36).slice(2, 9), empId: r.empId, no: r.no, name: r.name, subject: r.subject, room: r.room, days: r.days, start: r.start, end: r.end, active: true }); });
  const next = (C.classes || []).map((c) => { if (!c.active) return c; const drop = imp.mode === "all" ? !keepIds.has(c.id) : imp.mode === "replace" ? touched.has(String(c.empId)) && !keepIds.has(c.id) : false; return drop ? { ...c, active: false } : c; });   // removed classes are switched off, never erased
  return { classes: [...next, ...fresh], added: fresh.length, kept: keepIds.size, off: next.filter((c, i) => !c.active && (C.classes[i] || {}).active).length };
}

function cmImportCard() {
  const C = ST.cls, imp = C.imp, bio = ((ST.settings.dtr || {}).classBio || {}), on = clsBioOn(ST.settings);
  const rule = `<div class="card"><h3>Payroll rule: the Class check is the teacher's biometric</h3><div class="row noprint" style="gap:.7rem;flex-wrap:wrap;align-items:end"><div><label>Teachers' hours in the payroll come from</label><select id="cbOn"><option value="1">Class check (hours the teacher was in the classroom)</option><option value="0" ${on ? "" : "selected"}>DTR biometric (old way)</option></select></div><div><label>Time in but no time out</label><select id="cbOut"><option value="sched">Count until the class end</option><option value="none" ${bio.noOut === "none" ? "selected" : ""}>Do not count the class</option></select></div><button class="btn p" id="cbSave">Save rule</button></div>
    <p class="muted">Paid time of a class = from the later of the class start and the time in, to the earlier of the class end and the time out (time in within the grace minutes counts from the class start). Absent or not checked = not paid. A teacher with no class in the schedule keeps using the DTR hours. Past records keep their own class times, so changing the schedule never changes old pay.</p></div>`;
  const up = `<div class="card"><h3>Upload the teachers' schedules from a file</h3><p class="muted">Download a template, fill it in (one row per class), then upload it. You will see a preview and any problems before anything is saved.</p>
    <div class="row noprint" style="gap:.5rem;flex-wrap:wrap"><button class="btn" id="tpB">Template (Excel, with examples)</button><button class="btn" id="tpM">Template with my teachers' names</button><button class="btn" id="tpC">Template (CSV)</button><button class="btn" id="tpX">Download current schedule</button></div>
    <div class="row noprint" style="gap:.7rem;flex-wrap:wrap;align-items:end;margin-top:.8rem"><div><label>Schedule file (.xlsx, .xls or .csv)</label><input type="file" id="upF" accept=".xlsx,.xls,.csv"></div><div><label>When importing</label><select id="upM"><option value="replace" ${!imp || imp.mode === "replace" ? "selected" : ""}>Replace the classes of the teachers in the file</option><option value="add" ${imp && imp.mode === "add" ? "selected" : ""}>Add to the existing classes</option><option value="all" ${imp && imp.mode === "all" ? "selected" : ""}>Replace the whole school schedule</option></select></div></div>
    <div id="upP">${imp ? cmImportPreview() : ""}</div></div>`;
  return (isMonitor() ? "" : rule) + up;
}
function cmImportPreview() {
  const imp = ST.cls.imp; cmImportCheck(imp);
  const bad = imp.rows.filter((r) => r.errors.length), good = imp.rows.filter((r) => !r.errors.length), dup = good.filter((r) => r.dup).length, ap = good.length ? cmImportApply() : null;
  return `<div style="margin-top:.9rem"><p><b>${esc(imp.file)}</b>: ${imp.rows.length} row(s) read &middot; <b style="color:#1a7f37">${good.length - dup} ready</b>${dup ? ` &middot; ${dup} already in the schedule` : ""} &middot; <b style="color:${bad.length ? "#b3121f" : "#667085"}">${bad.length} with problems (not imported)</b></p>
  ${ap ? `<p class="muted">Result: ${ap.added} class(es) added, ${ap.kept} unchanged, ${ap.off} switched off (their past class checks still count in the payroll).</p>` : ""}
  <div class="tw"><table><tr><th>Row</th><th>Teacher</th><th>Subject / Section</th><th>Days</th><th>Time</th><th>Check</th></tr>${imp.rows.map((r) => `<tr style="${r.errors.length ? "background:#fdecec" : r.dup ? "color:#667085" : ""}"><td>${r.line}</td><td>${esc(r.name || r.no || "")}</td><td>${esc(r.subject)}${r.room ? `<br><small class="muted">${esc(r.room)}</small>` : ""}</td><td>${r.days ? cmDaysTxt(r.days) : ""}</td><td>${r.start && r.end ? cmT12(r.start) + " - " + cmT12(r.end) : ""}</td><td>${r.errors.length ? r.errors.map((m) => `<span style="color:#b3121f">${esc(m)}</span>`).join("<br>") : r.dup ? "Already in the schedule" : '<span style="color:#1a7f37">OK</span>'}${r.warns.map((m) => `<br><small style="color:#b45309">${esc(m)}</small>`).join("")}</td></tr>`).join("")}</table></div>
  <div class="row noprint" style="margin-top:.7rem"><button class="btn p" id="upGo" ${good.length - dup ? "" : "disabled"}>Import ${good.length - dup} class(es)</button><button class="btn" id="upX">Cancel</button></div></div>`;
}
function cmImportInit() {
  const C = ST.cls, bind = (id, fn) => { const n = $("#" + id); if (n) n.onclick = fn; };
  bind("tpB", () => cmDownloadTemplate("blank")); bind("tpM", () => cmDownloadTemplate("mine")); bind("tpC", () => cmDownloadTemplate("blank", true)); bind("tpX", () => cmDownloadTemplate("export"));
  bind("cbSave", async () => { const D = (ST.settings.dtr ||= {}); D.classBio = { on: $("#cbOn").value === "1", noOut: $("#cbOut").value }; ST.clsPay = null; await api("saveSettings", ST.settings); toast("Payroll rule saved."); cmSchedule(); });
  $("#upF").onchange = (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { C.imp = { file: f.name, mode: $("#upM").value, rows: cmReadFile(new Uint8Array(rd.result)) }; if (!C.imp.rows.length) { C.imp = null; toast("No class rows found in the file.", true); } } catch (e) { C.imp = null; toast(e.message || "The file could not be read.", true); } $("#upP").innerHTML = C.imp ? cmImportPreview() : ""; cmImportInit2(); };
    rd.readAsArrayBuffer(f); };
  $("#upM").onchange = (ev) => { if (C.imp) { C.imp.mode = ev.target.value; $("#upP").innerHTML = cmImportPreview(); cmImportInit2(); } };
  cmImportInit2();
}
function cmImportInit2() {
  const C = ST.cls, go = $("#upGo"), x = $("#upX");
  if (x) x.onclick = () => { C.imp = null; cmSchedule(); };
  if (go) go.onclick = async () => {
    const ap = cmImportApply(); const act = ap.classes.filter((c) => c.active);
    const r = await api("clsSave", { classes: ap.classes.map((c) => ({ id: String(c.id).startsWith("n") ? "" : c.id, empId: c.empId, subject: c.subject, room: c.room, days: c.days, start: c.start, end: c.end, active: c.active })) });
    ST.clsPay = null; C.classes = r || act; C.imp = null; toast(`Schedule imported: ${ap.added} added, ${ap.kept} unchanged.`); cmSchedule();
  };
}


/* ======================= 5. UPLOAD THE CLASS CHECK FROM A FILE (payroll / owner) ======================= */
const CU_HEAD = ["Date", "Employee No", "Teacher name", "Subject", "Section / Room", "Class start", "Class end", "Time in", "Time out", "Status", "Remarks"];
function cuParseDate(v) {
  if (typeof v === "number" && v > 30000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const t = String(v ?? "").trim(); let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t); if (m) return `${m[1]}-${cmPad(m[2])}-${cmPad(m[3])}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t); if (m) return `${m[3]}-${cmPad(m[1])}-${cmPad(m[2])}`;
  const d = new Date(t + " 12:00"); return t && !isNaN(d) ? cmYmd(d) : null;
}
function cuTemplate(kind, csv) {
  const C = ST.cls, ex = [["e.g. 2026-11-18", "e.g. Juan Dela Cruz", "Mathematics", "Grade 7 - Rizal", "6:00 AM", "7:00 AM", "6:05 AM", "7:00 AM", "Present", ""], ["e.g. 2026-11-18", "e.g. Maria Santos", "English", "Grade 7 - Rizal", "1:00 PM", "2:00 PM", "", "", "Absent", "Sick"]];
  const dow = cmDow(C.date), rows = kind === "day" ? (C.classes || []).filter((c) => c.active && c.days.includes(dow)).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) || cmMin(a.start) - cmMin(b.start)).map((c) => { const r = (C.att || {})[c.id] || {}; return [C.date, String(c.no), c.name, c.subject, c.room, cmT12(c.start), cmT12(c.end), r.in ? cmT12(r.in) : "", r.out ? cmT12(r.out) : "", r.status === "Absent" ? "Absent" : "", r.remarks || ""]; }) : ex.map((r) => [r[0], r[1].replace("e.g. Juan Dela Cruz", "1001").replace("e.g. Maria Santos", "1002"), ...r.slice(1)]).map((r, i) => [ex[i][0], "e.g. " + (i ? "1002" : "1001"), ex[i][1], ...ex[i].slice(2)]);
  const name = kind === "day" ? `ARK-Class-Check-${C.date}` : "ARK-Class-Check-Template";
  if (csv) { const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`, a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + [CU_HEAD, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" })); a.download = name + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); return; }
  xlsxBook([{ name: "Class check", header: CU_HEAD, rows }, { name: "How to fill in", header: ["HOW TO FILL IN THE CLASS CHECK TEMPLATE"], rows: [[""], ["One row = one class on one date."], ["Date         - 2026-11-18 or 11/18/2026."], ["Employee No - from the Employees tab (best). If empty, the Teacher name is used."], ["Subject / Class start - used to find the right class when a teacher has several classes that day."], ["Time in / Time out - 6:05 AM or 06:05. Without AM/PM, 1:00 to 6:59 is read as PM. Time out can stay empty."], ["Status      - Absent for a teacher who did not come. Leave empty (or Present / Late) when the teacher came; Late is worked out from the time in."], ["Remarks     - optional."], ["Rows starting with \"e.g.\" and empty rows are skipped. A class already checked on that date is replaced by the file."], ["Upload it under Class check > Upload class check. You see a preview first; nothing is saved until you press Import."]] }], name + ".xlsx");
}
function cuRead(buf) {
  const wb = XLSX.read(buf, { type: "array" }), sh = wb.Sheets[wb.SheetNames.find((n) => /class\s*check/i.test(n)) || wb.SheetNames[0]], A = XLSX.utils.sheet_to_json(sh, { header: 1, raw: true, defval: "" }), key = (x) => String(x).toLowerCase().replace(/[^a-z]/g, "");
  const hi = A.findIndex((r) => r.some((c) => key(c) === "date") && r.some((c) => ["timein", "in"].includes(key(c)))); if (hi < 0) throw new Error("The header row was not found. Use the template (Date, Employee No, ..., Time in, Time out, Status).");
  const H = A[hi], ix = (n) => H.findIndex((c) => n.includes(key(c))), col = { date: ix(["date"]), no: ix(["employeeno", "empno", "no"]), name: ix(["teachername", "teacher", "name"]), subject: ix(["subject"]), start: ix(["classstart", "start", "scheduledstart"]), inn: ix(["timein", "in"]), out: ix(["timeout", "out"]), st: ix(["status"]), rm: ix(["remarks", "remark"]) };
  const emps = activeEmps(), byNo = {}, byName = {}; emps.forEach((e) => { byNo[String(e.no).trim().toLowerCase()] = e; byName[cmNorm(nameOf(e))] = e; });
  const today = cmYmd(new Date()), out = [];
  for (let i = hi + 1; i < A.length; i++) {
    const r = A[i], g = (k) => (col[k] >= 0 ? r[col[k]] : ""), no = String(g("no")).trim(), nm = String(g("name")).trim();
    if (/^e\.?g\.?/i.test(no) || /^e\.?g\.?/i.test(String(g("date")))) continue;
    if (!String(g("date")).trim() && !no && !nm) continue;
    const row = { line: i + 1, errors: [], warns: [], remarks: String(g("rm")).trim() }, date = cuParseDate(g("date"));
    if (!date) row.errors.push(`Date not understood ("${g("date")}").`); else if (date > today) row.errors.push("The date is in the future."); else if (isMonitor() && date < cmYmd(new Date(Date.now() - 31 * 86400000))) row.errors.push("The Class Monitor can upload the last 31 days only."); row.date = date;
    let e = no ? byNo[no.toLowerCase()] : null; if (!e && nm) e = byName[cmNorm(nm)];
    if (!e) row.errors.push(`Teacher not found (${no || nm || "empty"}).`); else { row.emp = e; row.name = nameOf(e); }
    const stt = String(g("st")).trim().toLowerCase(); row.absent = /^abs/.test(stt);
    const a = cmParseTime(g("inn")), b = cmParseTime(g("out")); if (!row.absent) { if (String(g("inn")).trim() === "") row.errors.push("Time in is empty (or write Absent in Status)."); else if (!a) row.errors.push(`Time in not understood ("${g("inn")}").`); if (String(g("out")).trim() !== "" && !b) row.errors.push(`Time out not understood ("${g("out")}").`); if (a && b && cmMin(b.t) < cmMin(a.t)) row.errors.push("Time out is earlier than the time in."); if ((a && a.assumed) || (b && b.assumed)) row.warns.push("No AM/PM: read as " + (a ? cmT12(a.t) : "") + (b ? " - " + cmT12(b.t) : "") + "."); }
    row.inn = a ? a.t : ""; row.outT = b ? b.t : "";
    if (e && date) {
      const dow = cmDow(date), subj = String(g("subject")).trim().toLowerCase(), st = cmParseTime(g("start")); let cand = (ST.cls.classes || []).filter((c) => c.active && String(c.empId) === String(e.id) && c.days.includes(dow));
      if (st && cand.length > 1) cand = cand.filter((c) => c.start === st.t); if (subj && cand.length > 1) cand = cand.filter((c) => String(c.subject).trim().toLowerCase() === subj);
      if (cand.length === 1) { row.cls = cand[0]; } else row.errors.push(cand.length ? `${cand.length} classes fit: write the Class start or Subject.` : `${nameOf(e)} has no class in the schedule on ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]}.`);
    }
    out.push(row);
  }
  const seen = {}; out.forEach((r) => { if (r.cls && !r.errors.length) { const k = r.date + "|" + r.cls.id; if (seen[k]) r.errors.push(`Same class and date as row ${seen[k]}.`); else seen[k] = r.line; } });
  return out;
}
function cuCard() {
  const C = ST.cls, im = C.cimp;
  return `<div class="card noprint"><h3>Upload class check</h3><p class="muted">Fill in a template with the times of the teachers (for example from paper sheets) and upload it. A preview shows any problem before anything is saved. A class already checked on the same date is replaced by the file.</p>
  <div class="row" style="gap:.5rem;flex-wrap:wrap"><button class="btn" id="cuD">Template of the classes on ${esc(C.date)}</button><button class="btn" id="cuB">Template (blank, with examples)</button><button class="btn" id="cuC">Template (CSV)</button></div>
  <div class="row" style="margin-top:.8rem"><div><label>Class check file (.xlsx, .xls or .csv)</label><input type="file" id="cuF" accept=".xlsx,.xls,.csv"></div></div><div id="cuP">${im ? cuPreview() : ""}</div></div>`;
}
function cuPreview() {
  const im = ST.cls.cimp, good = im.rows.filter((r) => !r.errors.length), bad = im.rows.length - good.length;
  return `<div style="margin-top:.9rem"><p><b>${esc(im.file)}</b>: ${im.rows.length} row(s) &middot; <b style="color:#1a7f37">${good.length} ready</b> &middot; <b style="color:${bad ? "#b3121f" : "#667085"}">${bad} with problems (not imported)</b></p>
  <div class="tw"><table><tr><th>Row</th><th>Date</th><th>Teacher</th><th>Class</th><th>Time in</th><th>Time out</th><th>Status</th><th>Check</th></tr>${im.rows.map((r) => `<tr style="${r.errors.length ? "background:#fdecec" : ""}"><td>${r.line}</td><td>${esc(r.date || "")}</td><td>${esc(r.name || "")}</td><td>${r.cls ? esc(r.cls.subject) + `<br><small class="muted">${cmT12(r.cls.start)} - ${cmT12(r.cls.end)}</small>` : ""}</td><td>${r.inn ? cmT12(r.inn) : ""}</td><td>${r.outT ? cmT12(r.outT) : ""}</td><td>${r.absent ? "Absent" : "Present"}</td><td>${r.errors.length ? r.errors.map((m) => `<span style="color:#b3121f">${esc(m)}</span>`).join("<br>") : '<span style="color:#1a7f37">OK</span>'}${r.warns.map((m) => `<br><small style="color:#b45309">${esc(m)}</small>`).join("")}</td></tr>`).join("")}</table></div>
  <div class="row" style="margin-top:.7rem"><button class="btn p" id="cuGo" ${good.length ? "" : "disabled"}>Import ${good.length} class check(s)</button><button class="btn" id="cuX">Cancel</button></div></div>`;
}
function cuInit() {
  const C = ST.cls, b = (id, f) => { const n = $("#" + id); if (n) n.onclick = f; };
  b("cuD", () => cuTemplate("day")); b("cuB", () => cuTemplate("blank")); b("cuC", () => cuTemplate("blank", true));
  b("cuX", () => { C.cimp = null; cmCheck(); });
  b("cuGo", async () => {
    const good = C.cimp.rows.filter((r) => !r.errors.length), by = {}; good.forEach((r) => (by[r.date] ||= []).push(r));
    for (const [date, L] of Object.entries(by)) {
      const items = L.map((r) => { const rec = { in: r.absent ? "" : r.inn, out: r.absent ? "" : r.outT, remarks: r.remarks, status: r.absent ? "Absent" : "" }; if (!r.absent) rec.status = cmStatus(r.cls, rec, date); if (rec.status === "Pending") rec.status = ""; return { classId: r.cls.id, in: rec.in, out: rec.out, status: rec.status, remarks: rec.remarks }; });
      try { await api("clsMark", { date, items }); } catch (e) { return; }
    }
    ST.clsPay = null; C.cimp = null; await cmLoad(C.date); toast(`Class check imported: ${good.length} class(es).`); cmCheck();
  });
  const f = $("#cuF"); if (f) f.onchange = (ev) => { const file = ev.target.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { C.cimp = { file: file.name, rows: cuRead(new Uint8Array(rd.result)) }; if (!C.cimp.rows.length) { C.cimp = null; toast("No rows found in the file.", true); } } catch (e) { C.cimp = null; toast(e.message || "The file could not be read.", true); } $("#cuP").innerHTML = C.cimp ? cuPreview() : ""; cuInit2(); }; rd.readAsArrayBuffer(file); };
}
function cuInit2() { const C = ST.cls, g = $("#cuGo"), x = $("#cuX"); if (x) x.onclick = () => { C.cimp = null; cmCheck(); }; if (g) g.onclick = () => { cuInit(); g.onclick(); }; }

/* >>>>>>>>>> js/pages/class-dtr.js >>>>>>>>>> */
/* ============================================================
   CLASS CHECK DTR - the daily time record of each teacher built from the class check the Class Monitor encoded.
   - DTR / Biometric tab > "Class check DTR" (payroll / owner), and the DTR / Biometric menu of the Class Monitor account.
   - One row per class: time in / time out / status / remarks can be edited (Edit > Save). Saved with clsMark (same data as the Class check).
   - The Class Monitor can edit only the classes of today (server rule); payroll / owner can edit any date.
   File: js/pages/class-dtr.js
   ============================================================ */

function cdtrState() {
  const t = new Date(), today = cmYmd(t);
  return (ST.cd ||= { from: cmYmd(new Date(t.getFullYear(), t.getMonth(), 1)), to: today, emp: "", edit: false, loaded: false, classes: [], att: [] });
}

/** The class-check DTR of one teacher: one entry per date with its classes and totals. */
function cdtrDays(e, C) {
  const D = ST.settings.dtr || {}, hol = new Set((D.holidays || []).map((h) => h.date)), today = cmYmd(new Date()), att = {}; C.att.forEach((a) => { att[a.date + "|" + a.classId] = a; });
  const mine = C.classes.filter((c) => String(c.empId) === String(e.id)), out = [];
  for (let d = C.from; d <= C.to && d <= today; d = addDay(d)) {
    const dow = cmDow(d), items = [];
    mine.forEach((c) => { const r = att[d + "|" + c.id]; if (r || (c.active && c.days.includes(dow) && !hol.has(d))) items.push({ c, r, s: (r && r.start) || c.start, e: (r && r.end) || c.end }); });
    if (!items.length) continue;
    items.sort((a, b) => cmMin(a.s) - cmMin(b.s));
    const x = { d, items, in: "", out: "", mins: 0, late: 0, absent: 0, none: 0, present: 0 };
    items.forEach((it) => {
      const r = it.r; if (r && r.status === "Absent") { x.absent++; return; }
      if (!r || !r.in) { x.none++; return; }
      const k = cmCounted({ ...r, start: it.s, end: it.e }, e, d); x.mins += k.mins; x.late += k.late; x.present++; it.mins = k.mins; it.late = k.late; it.noOut = k.noOut;
      if (!x.in || cmMin(r.in) < cmMin(x.in)) x.in = r.in; if (r.out && (!x.out || cmMin(r.out) > cmMin(x.out))) x.out = r.out;
    });
    out.push(x);
  }
  return out;
}

function cdtrPage() {
  const mon = isMon(), C = cdtrState(), today = cmYmd(new Date()), tabs = mon ? "" : dtrTabs(0, 0);
  if (!C.loaded) {
    V(tabs + '<div class="card muted">Loading the class check...</div>');
    api("clsReport", { from: C.from, to: C.to }).then((r) => { C.classes = r.classes || []; C.att = r.att || []; C.loaded = true; cdtrPage(); }).catch(() => { C.loaded = true; cdtrPage(); });
    return;
  }
  const list = cmTeachers(), sel = list.find((e) => String(e.id) === String(C.emp)) || null;
  const head = `<div class="card noprint"><h3>Class check DTR</h3><p class="muted">The daily time record of each teacher, built from the class check encoded by the Class Monitor: time in = first class clocked in, time out = last class clocked out, hours = time counted for pay. Press <b>Edit</b> to change a time, then <b>Save</b>.${mon ? " The Class Monitor can edit the last 31 days." : ""}</p>
    <div class="row" style="gap:.7rem;flex-wrap:wrap;align-items:end"><div><label>From</label><input type="date" id="cdf" value="${C.from}"></div><div><label>To</label><input type="date" id="cdt" value="${C.to}"></div>
    <div style="min-width:16rem"><label>Teacher</label><select id="cde"><option value="">All teachers (summary) - choose a teacher to edit</option>${list.map((e) => `<option value="${esc(e.id)}" ${sel && sel.id === e.id ? "selected" : ""}>${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
    <button class="btn" id="cdr">Refresh</button>${sel ? `<button class="btn" id="cdp">Print</button><button class="btn" id="cdx">Download Excel</button>${C.edit ? '<button class="btn p" id="cds">Save</button><button class="btn" id="cdc">Cancel</button>' : '<button class="btn p" id="cde2">Edit</button>'}` : ""}</div></div>`;
  let body = "";
  if (!sel) {
    const rows = list.map((e) => { const D = cdtrDays(e, C), t = D.reduce((n, x) => ({ days: n.days + (x.present ? 1 : 0), cls: n.cls + x.items.length, pres: n.pres + x.present, late: n.late + x.late, abs: n.abs + x.absent, none: n.none + x.none, mins: n.mins + x.mins }), { days: 0, cls: 0, pres: 0, late: 0, abs: 0, none: 0, mins: 0 }); return { e, t, has: D.length }; }).filter((r) => r.has);
    body = `<div class="card"><div class="tw"><table><tr><th>No.</th><th>Teacher</th><th class="n">Days present</th><th class="n">Classes</th><th class="n">Checked in</th><th class="n">Late (min)</th><th class="n">Absent</th><th class="n">Not checked</th><th class="n">Hours counted</th><th></th></tr>${rows.map((r) => `<tr><td>${esc(r.e.no)}</td><td>${esc(nameOf(r.e))}</td><td class="n">${r.t.days}</td><td class="n">${r.t.cls}</td><td class="n">${r.t.pres}</td><td class="n">${r.t.late}</td><td class="n">${r.t.abs}</td><td class="n">${r.t.none}</td><td class="n"><b>${fmtHMc(r.t.mins)}</b></td><td style="white-space:nowrap"><button class="btn sm" data-open="${esc(r.e.id)}">Open DTR</button> <button class="btn sm p" data-edit="${esc(r.e.id)}">Edit</button></td></tr>`).join("") || '<tr><td colspan="10" class="muted">No class or class check in this range.</td></tr>'}</table></div></div>`;
  } else {
    const D = cdtrDays(sel, C), tot = D.reduce((n, x) => ({ mins: n.mins + x.mins, late: n.late + x.late }), { mins: 0, late: 0 }), wd = (d) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short" });
    const rowHTML = (x) => x.items.map((it, i) => {
      const r = it.r || {}, can = !mon || (x.d <= today && x.d >= cmYmd(new Date(Date.now() - 31 * 86400000))), ed = C.edit && can, st = r.status === "Absent" ? "Absent" : cmStatus({ ...it.c, start: it.s }, r.in ? r : null, x.d), k = `data-c="${esc(it.c.id)}" data-d="${x.d}"`;
      const cell = (cls, v) => (ed ? `<input type="time" class="${cls}" ${k} data-o="${esc(v)}" value="${esc(v)}" >` : v ? cmT12(v) : "");
      return `<tr style="${st === "Absent" ? "background:#fdecec" : ""}">${i === 0 ? `<td rowspan="${x.items.length}" style="vertical-align:top;white-space:nowrap"><b>${x.d}</b><br>${wd(x.d)}<br><small class="muted">In ${x.in ? cmT12(x.in) : "-"} &middot; Out ${x.out ? cmT12(x.out) : "-"}<br>Counted ${fmtHMc(x.mins)}</small></td>` : ""}
      <td><b>${esc(it.c.subject)}</b>${it.c.room ? ` &middot; ${esc(it.c.room)}` : ""}<br><small class="muted">${cmT12(it.s)} - ${cmT12(it.e)}</small></td><td>${cell("cdi", r.in || "")}</td><td>${cell("cdo", r.out || "")}</td>
      <td>${ed ? `<select class="cds" ${k} data-o="${st === "Absent" ? "Absent" : ""}"><option value="">Present / Late</option><option ${st === "Absent" ? "selected" : ""} value="Absent">Absent</option></select>` : cmBadge(st)}${it.late ? `<br><small class="muted">${it.late} min late</small>` : ""}${it.noOut ? '<br><small class="muted">no time out</small>' : ""}</td>
      <td class="n">${it.mins ? fmtHMc(it.mins) : ""}</td><td>${ed ? `<input class="cdm" ${k} data-o="${esc(r.remarks || "")}" value="${esc(r.remarks || "")}" placeholder="Remarks">` : esc(r.remarks || "")}</td></tr>`;
    }).join("");
    body = `<style>.cdtr{max-width:100%;overflow:hidden}.cdtr .tw{overflow-x:visible}.cdtr table{width:100%;table-layout:fixed;font-size:.82rem}.cdtr th,.cdtr td{padding:.35rem .4rem;white-space:normal;word-break:break-word;vertical-align:top}.cdtr th:nth-child(1){width:15%}.cdtr th:nth-child(2){width:25%}.cdtr th:nth-child(3),.cdtr th:nth-child(4){width:12%}.cdtr th:nth-child(5){width:13%}.cdtr th:nth-child(6){width:8%}.cdtr th:nth-child(7){width:15%}.cdtr input,.cdtr select{width:100%;min-width:0;box-sizing:border-box;font-size:.8rem;padding:.25rem .3rem}.cdtr input[type=time]{max-width:6.5rem}@media print{.cdtr table{font-size:.72rem}}</style><div class="card ps dtrsheet cdtr"><h2>DAILY TIME RECORD (CLASS CHECK)</h2><p style="text-align:center;margin:0">${C.from} to ${C.to}</p><p><b>${esc(nameOf(sel))}</b> &middot; ${esc(sel.position || "")} &middot; No. ${esc(sel.no)}</p>
      <div class="tw"><table><tr><th>Date</th><th>Class</th><th>Time in</th><th>Time out</th><th>Status</th><th class="n">Hours counted</th><th>Remarks</th></tr>${D.map(rowHTML).join("") || '<tr><td colspan="7" class="muted">No class or class check for this teacher in this range.</td></tr>'}<tr class="tot"><td colspan="5">Total</td><td class="n">${fmtHMc(tot.mins)}</td><td>${tot.late ? tot.late + " min late (not paid)" : ""}</td></tr></table></div></div>`;
  }
  V(tabs + head + body);
  const go = () => { C.loaded = false; C.edit = false; ST.clsPay = null; cdtrPage(); };
  $("#cdf").onchange = (e) => { C.from = e.target.value; go(); }; $("#cdt").onchange = (e) => { C.to = e.target.value; go(); };
  if (C.from > C.to) return toast("The From date is after the To date.", true);
  $("#cde").onchange = (e) => { C.emp = e.target.value; C.edit = false; cdtrPage(); }; $("#cdr").onclick = go;
  document.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { C.emp = b.dataset.open; C.edit = false; cdtrPage(); });
  document.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => { C.emp = b.dataset.edit; C.edit = true; cdtrPage(); });
  if (!sel) return;
  $("#cdp").onclick = () => print();
  $("#cdx").onclick = () => { const D = cdtrDays(sel, C); xlsxBook([{ name: "Class check DTR", header: ["Date", "Class start", "Class end", "Subject", "Section / Room", "Time in", "Time out", "Status", "Hours counted", "Remarks"], rows: D.flatMap((x) => x.items.map((it) => { const r = it.r || {}; return [x.d, cmT12(it.s), cmT12(it.e), it.c.subject, it.c.room, r.in ? cmT12(r.in) : "", r.out ? cmT12(r.out) : "", r.status === "Absent" ? "Absent" : r.in ? "Present" : "No record", it.mins ? +(it.mins / 60).toFixed(2) : 0, r.remarks || ""]; })) }], `ARK-Class-Check-DTR-${sel.no}-${C.from}_${C.to}.xlsx`); };
  if ($("#cde2")) $("#cde2").onclick = () => { C.edit = true; cdtrPage(); };
  if ($("#cdc")) $("#cdc").onclick = () => { C.edit = false; cdtrPage(); };
  if ($("#cds")) $("#cds").onclick = async () => {
    const by = {}, g = (el) => { const o = ((by[el.dataset.d] ||= {})[el.dataset.c] ||= { ch: false }); return o; };
    document.querySelectorAll(".cdi,.cdo,.cds,.cdm").forEach((el) => { const o = g(el), k = el.classList.contains("cdi") ? "in" : el.classList.contains("cdo") ? "out" : el.classList.contains("cds") ? "status" : "remarks"; o[k] = el.value; if (el.value !== el.dataset.o) o.ch = true; });
    const jobs = [];
    for (const [date, m] of Object.entries(by)) { const items = []; for (const [cid, o] of Object.entries(m)) {
      if (!o.ch) continue; const c = C.classes.find((x) => x.id === cid); if (!c) continue;
      if (o.status !== "Absent" && !o.in && o.out) return toast(`${date} ${c.subject}: type the time in too.`, true);
      if (o.in && o.out && cmMin(o.out) < cmMin(o.in)) return toast(`${date} ${c.subject}: the time out is earlier than the time in.`, true);
      const rec = { in: o.status === "Absent" ? "" : o.in, out: o.status === "Absent" ? "" : o.out }; let st = o.status === "Absent" ? "Absent" : cmStatus(c, rec, date); if (st === "Pending") st = "";
      items.push({ classId: cid, in: rec.in, out: rec.out, status: st, remarks: (o.remarks || "").trim() }); }
      if (items.length) jobs.push({ date, items }); }
    if (!jobs.length) { C.edit = false; toast("No changes."); return cdtrPage(); }
    try { for (const j of jobs) await api("clsMark", j); } catch (e) { return; }
    toast(`${jobs.reduce((n, j) => n + j.items.length, 0)} class(es) saved.`); go();
  };
}

/* >>>>>>>>>> js/dtr/attendance-check.js >>>>>>>>>> */
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


/* >>>>>>>>>> js/pages/leave.js >>>>>>>>>> */
/* ============================================================
   LEAVE tab - leave with pay / without pay.
   File: js/pages/leave.js
   ============================================================ */

/* ---------- Leave (with pay / without pay) + grace period per group ---------- */
const LEAVE_DEFAULT = [
  { name: "Personal Leave", paid: true, days: 0, pool: true }, { name: "Birthday Leave", paid: true, days: 0, pool: true }, { name: "Emergency Leave", paid: true, days: 0, pool: true }, { name: "Sick Leave", paid: true, days: 0, pool: true },
  { name: "Maternity Leave", paid: true, days: 105 }, { name: "Paternity Leave", paid: true, days: 7 }, { name: "Leave Without Pay", paid: false, days: 0 },
];

   // Personal + Birthday + Emergency + Sick share ONE total of 7 days a year (Settings > Leave types)
const OLD_LEAVE_NAMES = "Vacation Leave|Sick Leave|Emergency Leave|Service Incentive Leave|Maternity Leave|Paternity Leave|Solo Parent Leave|Leave without Pay";

const leaveTypes = (S) => { const L = S && S.leaveTypes; return Array.isArray(L) && L.length && L.map((t) => t.name).join("|") !== OLD_LEAVE_NAMES ? L : LEAVE_DEFAULT; };

   // the old built-in list is replaced by the new default
const leaveTotal = (S) => (S && S.leaveTotal !== undefined && S.leaveTotal !== null && S.leaveTotal !== "" && !isNaN(+S.leaveTotal) ? +S.leaveTotal : 7);

const lvRow = (t) => `<tr data-lt><td><input class="ln" value="${esc(t.name || "")}"></td><td><select class="lp"><option value="1">With pay</option><option value="0" ${t.paid === false ? "selected" : ""}>Without pay</option></select></td><td><input type="number" min="0" step="any" class="ld" value="${+t.days || 0}"></td><td style="text-align:center"><input type="checkbox" class="lpool" ${t.pool ? "checked" : ""}></td><td><button class="btn sm d" data-lx>Remove</button></td></tr>`;

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
  const capOf = (t) => (t.pool ? leaveTotal(S) : +t.days || 0), poolNames = T.filter((t) => t.pool).map((t) => t.name);
  const used = (empId, type, y, skip) => { const names = tOf(type).pool ? poolNames : [type]; return (ST.leaves || []).filter((x) => x.empId === empId && names.includes(x.type) && x.status !== "Rejected" && x.from.slice(0, 4) === String(y) && x.id !== skip).reduce((n, x) => n + (+x.days || 0), 0); };
  const mine = (ST.leaves || []).filter((x) => x.status === "Approved" && x.from.slice(0, 4) === yr), sum = (p) => mine.filter((x) => !!x.paid === p).reduce((n, x) => n + (+x.days || 0), 0), pend = (ST.leaves || []).filter((x) => x.status === "Pending").length;
  V(`<div class="card noprint"><h3>${ed ? "Edit leave" : "File a leave"}</h3><div class="form">
    <div><label>Employee</label><select id="lv_e"><option value="">Choose employee...</option>${emps.map((e) => `<option value="${e.id}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
    <div><label>Leave type</label><select id="lv_t">${T.map((t) => `<option value="${esc(t.name)}">${esc(t.name)} (${t.paid ? "with pay" : "without pay"}${t.pool ? ", shared total " + leaveTotal(S) + " days" : t.days > 0 ? ", " + t.days + " days a year" : ""})</option>`).join("")}</select></div>
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
    if (id && capOf(t) > 0) { const u = used(id, t.name, f.slice(0, 4), ed && ed.id), cap = capOf(t); m += t.pool ? ` Personal, Birthday, Emergency and Sick leave share ${cap} day(s) a year: ${u} used in ${f.slice(0, 4)}, ${Math.max(0, cap - u - n)} left after this.` : ` ${t.name}: ${u} of ${cap} day(s) used in ${f.slice(0, 4)}, ${Math.max(0, cap - u - n)} left after this.`; }
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
    if (capOf(t) > 0 && st !== "Rejected") { const u = used(id, t.name, f.slice(0, 4), ed && ed.id), cap = capOf(t); if (u + days > cap && !confirm(`${t.pool ? "Personal, Birthday, Emergency and Sick leave together allow" : t.name + " allows"} ${cap} day(s) a year; this makes ${u + days}. Save anyway?`)) return; }
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


/* >>>>>>>>>> js/pages/spreadsheets.js >>>>>>>>>> */
/* ============================================================
   SPREADSHEET EXPORTS - attendance logs, summary, cash advances, cash loans, allowances.
   File: js/pages/spreadsheets.js
   ============================================================ */

/* ===================== Spreadsheet sheets: attendance logs, summary, cash advances, cash loans ===================== */
const SHEET_H = {
  logs: ["Date", "Day", "Employee No", "Name", "Department", "Group", "Time in", "Time out", "Hours worked", "Late (min)", "Early in (min)", "Early out (min)", "Overtime (min)", "Status", "Remarks"],
  sum: ["Employee No", "Name", "Department", "Group", "From", "To", "Schedule", "Days present", "Days absent", "Half days", "Late (days)", "Late (min)", "Early in (days)", "Early in (min)", "Early out (days)", "Overtime (hrs)", "Hours worked", "Overtime allowed"],
  adv: ["Employee No", "Name", "Department", "Group", "Outstanding balance", "Deduct each pay", "As of"],
  loan: ["Employee No", "Name", "Department", "Group", "Loan type", "Description", "Per month", "Balance", "Status", "As of"],
  alw: ["Employee No", "Name", "Department", "Group", "Allowance", "Amount", "Per", "Monthly amount", "Taxable", "As of"],
};

const groupName = (e) => (CATEGORIES.find((c) => c.key === categoryOf(e)) || {}).short || "";

function sheetRange() { const D = ST.dtr || {}, dates = Object.keys(D.days || {}).flatMap((i) => Object.keys(D.days[i])).sort(); return { from: D.from || dates[0] || "", to: D.to || dates[dates.length - 1] || "" }; }

function allSheets(from, to) {
  const logs = [], sum = [], adv = [], loan = [], alw = [], today = new Date().toISOString().slice(0, 10);
  if (from && to) {
    phEnsure(+from.slice(0, 4)); phEnsure(+to.slice(0, 4));
    ST.employees.forEach((e) => {
      if (!daysOf(e)) return; const c = dtrCalc(e, from, to), sc = schedOf(e);
      c.rows.forEach((r) => {
        const has = r.inn !== null || r.out !== null; if (!has && !r.wd && !r.isH) return;
        const st = r.st === "absent" ? "Absent" : r.st === "half" ? "Half day" : r.leave ? "Leave" : r.isH && !has ? "Holiday" : r.isW && !has ? "WFH / Async" : r.late ? "Late" : has ? "Present" : "";
        logs.push([r.d, new Date(r.d + "T12:00").toLocaleDateString("en-US", { weekday: "short" }), e.no, nameOf(e), e.dept || "", groupName(e), hm(r.inn), hm(r.out), Math.round(r.hrs * 100) / 100, r.late || 0, r.early || 0, r.earlyOut || 0, r.ot || 0, st, r.note || ""]);
      });
      sum.push([e.no, nameOf(e), e.dept || "", groupName(e), from, to, ([...c.scheds].join(" / ") || hm(sc.S0) + " - " + hm(sc.E0)), c.present, c.absent, c.half, c.lateDays, c.late, c.earlyDays, c.early, c.earlyOutDays, Math.round(c.ot * 100) / 100, c.hrs, otAllowed(e) ? "Yes" : "No"]);
    });
  }
  ST.employees.forEach((e) => {
    const ca = e.ca || {}; if (+ca.balance > 0 || +ca.perPay > 0) adv.push([e.no, nameOf(e), e.dept || "", groupName(e), +ca.balance || 0, +ca.perPay || 0, today]);
    (e.deductions || []).forEach((d) => { const tr = d.balance !== undefined && d.balance !== "" && d.balance !== null, b = tr ? +d.balance || 0 : ""; loan.push([e.no, nameOf(e), e.dept || "", groupName(e), d.type || "", d.label || "", +d.amount || 0, b, tr ? (b > 0 ? "Active" : "Paid") : "No balance tracked", today]); });
    (e.allowances || []).forEach((a) => { const amt = +a.amount || 0; alw.push([e.no, nameOf(e), e.dept || "", groupName(e), a.label || "", amt, isDowAllow(a) ? "Per day: " + dowLabel(a.days) : a.perDay ? "Per day" : "Per month", allowMonthly(a, ST.settings), a.taxable === false ? "No" : "Yes", today]); });
  });
  return [{ name: "Daily Attendance Logs", header: SHEET_H.logs, rows: logs, text: [0, 2, 6, 7] }, { name: "Summary of Attendance", header: SHEET_H.sum, rows: sum, text: [0, 4, 5, 6] },
    { name: "Cash Advances", header: SHEET_H.adv, rows: adv, text: [0, 6] }, { name: "Cash Loans", header: SHEET_H.loan, rows: loan, text: [0, 9] }, { name: "Allowances", header: SHEET_H.alw, rows: alw, text: [0, 9] }];
}

function xlsxBook(sheets, file) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sh) => { const ws = XLSX.utils.aoa_to_sheet([sh.header, ...sh.rows]); ws["!cols"] = sh.header.map((h, i) => ({ wch: Math.min(38, Math.max(String(h).length + 2, ...sh.rows.slice(0, 300).map((r) => String(r[i] ?? "").length + 2))) })); XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31)); });
  XLSX.writeFile(wb, file);
}

const sendSheets = async (sheets) => { await api("saveSheets", { sheets }); toast("Google Sheet updated: " + sheets.map((x) => x.name).join(", ") + "."); };

function sheetsCard() {
  const R = sheetRange();
  return `<div class="card noprint"><h3>Attendance, cash advances, cash loans and allowances (separate sheets)</h3><p class="muted">Five sheets: Daily Attendance Logs, Summary of Attendance, Cash Advances, Cash Loans and Allowances. The attendance sheets are read from the uploaded biometrics for the dates below.</p>
  <div class="row"><div><label>From</label><input type="date" id="sh_f" value="${R.from}"></div><div><label>To</label><input type="date" id="sh_t" value="${R.to}"></div><button class="btn p" id="sh_x">Download Excel (5 sheets)</button><button class="btn" id="sh_g">Update Google Sheet</button></div></div>`;
}

function sheetsInit() {
  const get = () => { const f = $("#sh_f").value, t = $("#sh_t").value; if (!f || !t || f > t) { toast("Choose the From and To dates.", true); return null; } return allSheets(f, t); };
  $("#sh_x").onclick = () => { const x = get(); if (x) xlsxBook(x, `ARK-Attendance-Cash-${$("#sh_f").value}_to_${$("#sh_t").value}.xlsx`); };
  $("#sh_g").onclick = async () => { const x = get(); if (x) try { await sendSheets(x); } catch (e) { } };
}


/* >>>>>>>>>> js/pages/backup.js >>>>>>>>>> */
/* ============================================================
   BACKUP report and owner-only database access.
   File: js/pages/backup.js
   ============================================================ */

/* ===================== Backup report (separate readable spreadsheet) and owner-only database access ===================== */
BUSY.updateBackup = "Updating backup report";

 BUSY.openDatabase = "Checking password";

function backupCard() {
  return `<div class="card noprint"><h3>Backup report (readable Google Sheet)</h3><p class="muted">A separate spreadsheet with one tab each for EMPLOYEE, EMPLOYEE PAYSLIP, EMPLOYEE CASH ADVANCE RECORD, SSS, PHILHEALTH, PAGIBIG and TAX, plus CASH LOANS, ALLOWANCES, DAILY ATTENDANCE LOGS, SUMMARY OF ATTENDANCE and the 13TH MONTH PAY split into JANUARY - JUNE and JULY - DECEMBER. The payroll tabs refresh by themselves every time a payroll is saved. The attendance tabs (DAILY ATTENDANCE LOGS and SUMMARY OF ATTENDANCE) are read from the biometric files in this browser, so they are updated when you press the button (choose the dates below; empty = all biometric dates). Cash advances, cash loans and allowances come from the employee records and are always current. <b>Download backup (Excel)</b> gives the same five sheets as a file. Anyone opening it needs to be shared on the file in Google Sheets.</p>
  <div class="row"><div><label>Attendance from</label><input type="date" id="bk_f" value="${sheetRange().from}"></div><div><label>Attendance to</label><input type="date" id="bk_t" value="${sheetRange().to}"></div><div><label>13th month year</label><input type="number" id="bk_y" value="${new Date().getFullYear()}" style="max-width:110px"></div><button class="btn p" id="bk_u">Update backup report</button><button class="btn" id="bk_x">Download backup (Excel, 5 sheets)</button>${ST.backup ? `<a class="btn" href="${esc(ST.backup)}" target="_blank" rel="noopener">Open backup report</a>` : ""}</div></div>`;
}

function backupInit() {
  $("#bk_x").onclick = () => { const R = sheetRange(), f = $("#bk_f").value || R.from, t = $("#bk_t").value || R.to; xlsxBook(allSheets(f && t && f <= t ? f : "", f && t && f <= t ? t : ""), `ARK-Backup-${new Date().toISOString().slice(0, 10)}.xlsx`); };
  $("#bk_u").onclick = async () => { try { const R = sheetRange(), f = $("#bk_f").value || R.from, t = $("#bk_t").value || R.to, att = f && t && f <= t ? allSheets(f, t).filter((x) => x.name === "Daily Attendance Logs" || x.name === "Summary of Attendance") : []; if (!att.length) toast("No biometric dates chosen: the attendance tabs keep their last data."); const r = await api("updateBackup", { year: +$("#bk_y").value || 0, sheets: att }); ST.backup = r.url; toast("Backup report updated " + r.at + "."); rep(); } catch (e) { } };
}

function dbCard() {
  return `<div class="card"><h3>Main database (owner only)</h3><p class="muted">The main database spreadsheet is hidden from this system. Only you, the owner, can reveal it, and only with the database password. The file itself stays private to your Google account, so never share it.</p>
  <div class="row"><div><label>Database password</label><input type="password" id="db_p" autocomplete="off"></div><button class="btn p" id="db_o">Open database</button></div><p id="db_l"></p>
  <div class="row"><div><label>Current password (leave empty the first time)</label><input type="password" id="db_c" autocomplete="off"></div><div><label>New database password (min 8)</label><input type="password" id="db_n" autocomplete="off"></div><button class="btn" id="db_s">Set / change password</button></div></div>`;
}

function dbInit() {
  if (!$("#db_o")) return;
  $("#db_o").onclick = async () => { try { const r = await api("openDatabase", { password: $("#db_p").value }); $("#db_p").value = ""; $("#db_l").innerHTML = `<a class="btn p" href="${esc(r.url)}" target="_blank" rel="noopener">Open the database now</a> <span class="muted">This link disappears when you leave this page.</span>`; } catch (e) { } };
  $("#db_s").onclick = async () => { try { await api("setDbPassword", { current: $("#db_c").value, password: $("#db_n").value }); $("#db_c").value = $("#db_n").value = ""; toast("Database password saved."); } catch (e) { } };
}


/* >>>>>>>>>> js/pages/month13.js >>>>>>>>>> */
/* ============================================================
   13TH MONTH PAY tab.
   File: js/pages/month13.js
   ============================================================ */

/* ===================== 13th month pay ===================== */
const MONN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], M13_EXEMPT = 90000;

const runYM = (r) => { const t = String(r.period || ""), ys = t.match(/\b(20\d\d)\b/g), ms = [...t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi)]; return { y: ys ? +ys[ys.length - 1] : 0, m: ms.length ? MONN.findIndex((n) => n.slice(0, 3).toLowerCase() === ms[ms.length - 1][1].toLowerCase()) : -1 }; };

/** Share of a month (0-1) an employee was employed, for an employee hired in that year or later. */
function monthShare(y, i, e) {
  const dim = new Date(y, i + 1, 0).getDate(), h = e && e.hired ? new Date(e.hired + "T12:00") : null; if (!h || isNaN(h) || h.getFullYear() < y) return 1; if (h.getFullYear() > y) return 0;
  const hm_ = h.getMonth(); return i < hm_ ? 0 : i > hm_ ? 1 : (dim - h.getDate() + 1) / dim;
}

/** The 13th month is paid in two releases: 1st = January - June, 2nd = July - December (each = basic earned in those 6 months, less absences and late, divided by 12). "all" = the whole year in one payment. */
const M13_PARTS = { h1: { lo: 0, hi: 5, label: "January - June", title: "1st release (Jan - Jun)" }, h2: { lo: 6, hi: 11, label: "July - December", title: "2nd release (Jul - Dec)" }, all: { lo: 0, hi: 11, label: "January - December", title: "Whole year (Jan - Dec)" } };
const m13Key = (no, part) => String(no) + ((part || ST.m13.part) === "all" ? "" : "|" + (part || ST.m13.part));

/** Numbers of one row for one release: the automatic calculation, replaced by whatever was typed in by hand (ST.m13.edits[employee no | part]). */
function m13Calc(x, part) {
  const P = M13_PARTS[part] || M13_PARTS.all, ed = ((ST.m13.edits || {})[m13Key(x.no, part)]) || {}, has = (k) => ed[k] !== undefined && ed[k] !== null && ed[k] !== "", o = {};
  o.autoBasic = r2(x.m.slice(P.lo, P.hi + 1).reduce((n, v) => n + v, 0)); o.autoDed = part === "all" ? x.dedAll : r2((x.dm || []).slice(P.lo, P.hi + 1).reduce((n, v) => n + v, 0));
  o.basic = has("basic") ? r2(+ed.basic) : o.autoBasic; o.ded = has("ded") ? r2(+ed.ded) : o.autoDed;
  o.net = Math.max(0, r2(o.basic - o.ded)); o.auto = r2(o.net / 12); o.pay = has("pay") ? r2(+ed.pay) : o.auto; o.edited = has("basic") || has("ded") || has("pay");
  return o;
}
function m13Fin(x) {
  const part = ST.m13.part || "all"; Object.assign(x, m13Calc(x, part));
  const tx = (v) => Math.max(0, r2(v - M13_EXEMPT));
  if (part === "h2") { const f = m13Calc(x, "h1").pay; x.taxable = r2(tx(f + x.pay) - tx(f)); } else x.taxable = tx(x.pay);   // the 90,000 tax-free limit is for the whole year: the 2nd release counts the 1st
}

const m13Saved = (y) => JSON.parse(JSON.stringify(((ST.settings && ST.settings.m13Edits) || {})[y] || {}));

async function m13Compute() {
  const M = ST.m13, y = +M.year, S = ST.settings, by = {}, keep = new Map(), find = (no) => ST.employees.find((x) => String(x.no) === String(no));
  const row = (no, name, pos) => (by[no] ||= { no, name, position: pos, e: find(no), m: Array(12).fill(0), dm: Array(12).fill(0), ded: 0 });
  ST.runs.forEach((r) => { if (runYM(r).y === y && r.status !== "Draft") keep.set((r.group || "") + "|" + r.period, r); });   // the same period saved twice counts once
  const hourly = ST.employees.some((e) => isHourly(e));
  if (M.basis === "runs" || hourly) {
    ST._rc = {};
    for (const r of keep.values()) {
      const L = (ST._rc[r.id] ||= await api("getRun", { id: r.id })), q = runYM(r);
      L.forEach((s) => { const c = s.calc || {}, x = row(s.no, s.name, s.position); if (q.m >= 0) x.m[q.m] += +c.basic || 0; const dd = r2((+c.absent || 0) + (+c.late || 0)); x.ded += dd; if (q.m >= 0) x.dm[q.m] += dd; });
    }
  }
  if (M.basis === "salary") ST.employees.filter((e) => !e.status || /^active$/i.test(e.status)).forEach((e) => { if (isHourly(e)) return; const mb = monthlyBasicOf(e, S), x = row(e.no, nameOf(e), e.position); x.m = MONN.map((_, i) => r2(mb * monthShare(y, i, e))); x.ded = 0; x.dm = Array(12).fill(0); });
  M.rows = Object.values(by).map((x) => { x.dedAll = x.ded; x.dept = x.e ? x.e.dept || "" : ""; x.grp = x.e ? groupName(x.e) : ""; x.cat = x.e ? categoryOf(x.e) : ""; x.monthly = x.e && !isHourly(x.e) ? monthlyBasicOf(x.e, S) : null; m13Fin(x); return x; })
    .filter((x) => x.m.some((v) => v > 0)).sort((a, b) => String(a.no).localeCompare(String(b.no), undefined, { numeric: true }));
}

const m13Rows = () => (ST.m13.rows || []).filter((x) => x.autoBasic > 0 && (ST.m13.group === "all" || x.cat === ST.m13.group));

function m13Sheet() {
  const R = m13Rows(), M = ST.m13;
  return { name: M.part === "h1" ? "13th Month Jan-Jun" : M.part === "h2" ? "13th Month Jul-Dec" : "13th Month Pay", header: ["Employee No", "Name", "Department", "Group", "Position", ...MONN, "Release", "Total basic earned", "Less absences and late", "Net basic salary", "13th month pay", "Taxable over 90,000", "Year", "Edited by hand"], text: [0],
    rows: R.map((x) => [x.no, x.name, x.dept, x.grp, x.position || "", ...x.m.map(r2), M13_PARTS[M.part].title, x.basic, x.ded, x.net, x.pay, x.taxable, M.year, x.edited ? "Yes" : ""]) };
}

function m13Slip(x, copy) {
  const P = (n) => "\u20B1" + money(n), M = ST.m13, sg = ST.settings.signatories || [], cell = (k, v, w) => `<td colspan="${w}"><span class="k">${k}</span><span class="v">${v}</span></td>`, dash = (v) => (v ? esc(v) : "-");
  const pd = M.pay ? new Date(M.pay + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";
  const PT = M13_PARTS[M.part], mr = [0, 1].filter((r) => M.part === "all" || (M.part === "h1" ? r === 0 : r === 1)).map((r) => `<tr>${[0, 1, 2, 3, 4, 5].map((i) => `<td colspan="2"><span class="k">${MONN[r * 6 + i]}</span><span class="v">${P(x.m[r * 6 + i])}</span></td>`).join("")}</tr>`).join("");
  const L = (a, b, c) => `<tr${c ? ' class="tot"' : ""}><td colspan="9">${a}</td><td colspan="3" class="n">${b}</td></tr>`;
  return `<div class="slip"><div class="hd"><img src="${LOGO}" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(SCHOOL.address)}<br>Contact: ${esc(SCHOOL.contact)}<br>Finance - Payroll &middot; <b style="display:inline;font-size:10.5px">${copy}</b></small></div></div>
  <h2>13TH MONTH PAY &middot; ${PT.title.toUpperCase()}</h2>
  <table><tr>${cell("Employee", esc(x.name), 5)}${cell("Employee No.", esc(x.no), 4)}${cell("Year", M.year, 3)}</tr><tr>${cell("Position", dash(x.position), 5)}${cell("Department", dash(x.dept), 4)}${cell("Pay date", pd, 3)}</tr>
  <tr><th colspan="12">BASIC SALARY EARNED PER MONTH</th></tr>${mr}
  <tr><th colspan="9">COMPUTATION</th><th colspan="3">Amount</th></tr>${L(`Total basic salary earned (${PT.label} ${M.year})`, P(x.basic))}${L("Less: absences and late", P(x.ded))}${L("Net basic salary earned", P(x.net))}${L(M.part === "all" ? "Divided by 12 months" : `Divided by 12 (13th month pay is always basic earned &divide; 12; this release counts ${PT.label.split(" - ")[0]} to ${PT.label.split(" - ")[1]} only, so it is half of the full year)`, "12")}${L("13TH MONTH PAY", P(x.pay), 1)}${M.part === "h2" ? L("1st release (January - June) already given", P(m13Calc(x, "h1").pay)) + L(`TOTAL 13TH MONTH PAY FOR ${M.year} (1st + 2nd release)`, P(r2(m13Calc(x, "h1").pay + x.pay)), 1) : ""}${x.taxable > 0 ? L(`Taxable part (over ${P(M13_EXEMPT)} for the year)`, P(x.taxable)) : ""}</table>
  <div class="net">13TH MONTH PAY (${PT.title}): ${P(x.pay)}</div>
  <div class="sg"><div>Received by<i>Employee</i></div>${sg.map((g) => `<div><b>${esc(g.name || "")}</b><br>${esc(g.position || "")}<i>${esc(g.label || "")}</i></div>`).join("")}</div></div>`;
}

function m13Draw() {
  const M = ST.m13, R = m13Rows(), el = $("#m13b"), tot = (k) => R.reduce((n, x) => n + x[k], 0), off = (M.off ||= new Set()), nEd = R.filter((x) => x.edited).length;
  if (!M.rows) { el.innerHTML = '<div class="card noprint empty muted">Loading the 13th month pay...</div>'; return; }
  const num = (x, k, v) => `<input class="in m13e" type="number" step="any" min="0" data-no="${esc(x.no)}" data-k="${k}" value="${v}" style="width:7.5rem;text-align:right${x.edited && (((M.edits || {})[m13Key(x.no)] || {})[k] !== undefined) ? ";background:#fff6d6;border-color:#d9a400" : ""}">`;
  el.innerHTML = `<div class="card noprint"><div class="row" style="margin-bottom:.8rem"><button class="btn p" id="m_ps">Show payslips</button><button class="btn" id="m_pr">Print payslips</button><button class="btn" id="m_xl">Download Excel</button><button class="btn" id="m_gs">Update Google Sheet</button><button class="btn p" id="m_sv">Save my edits${M.dirty ? " *" : ""}</button>${nEd ? '<button class="btn d" id="m_ra">Reset all edits</button>' : ""}<span class="muted">${R.length} employee(s), total 13th month (${M13_PARTS[M.part].label}) <b>&#8369;${money(tot("pay"))}</b>${nEd ? ` &middot; ${nEd} edited by hand` : ""}</span></div>
  <p class="muted">The numbers are calculated automatically. <b>You can type over</b> <i>Total basic earned</i>, <i>Less absent &amp; late</i> or the <i>13th month pay</i> itself; edited cells turn yellow and the pay is recalculated (basic less absences &divide; 12) unless you typed the pay yourself. The edits belong to the release chosen above. Press <b>Save my edits</b> to keep them for ${M.year}.</p>
  ${R.length ? `<div class="tw"><table><tr><th><input type="checkbox" id="m_all" ${R.every((x) => !off.has(String(x.no))) ? "checked" : ""}></th><th>No.</th><th>Employee</th><th>Group</th><th class="n">Monthly salary</th><th class="n">Total basic earned</th><th class="n">Less absent &amp; late</th><th class="n">Net basic</th><th class="n">13th month pay</th><th class="n">Taxable (over &#8369;90,000)</th><th></th></tr>${R.map((x) => `<tr><td><input type="checkbox" class="m13c" data-no="${esc(x.no)}" ${off.has(String(x.no)) ? "" : "checked"}></td><td>${esc(x.no)}</td><td>${esc(x.name)}<br><small class="muted">${esc(x.position || "")}${x.dept ? " &middot; " + esc(x.dept) : ""}</small></td><td>${esc(x.grp)}</td><td class="n">${x.monthly === null ? "per hour" : money(x.monthly)}</td><td class="n">${num(x, "basic", x.basic)}<br><small class="muted">auto ${money(x.autoBasic)}</small></td><td class="n">${num(x, "ded", x.ded)}<br><small class="muted">auto ${money(x.autoDed)}</small></td><td class="n">${money(x.net)}</td><td class="n">${num(x, "pay", x.pay)}<br><small class="muted">auto ${money(x.auto)}</small></td><td class="n">${money(x.taxable)}</td><td>${x.edited ? `<button class="btn sm" data-mr="${esc(x.no)}">Reset</button>` : ""}</td></tr>`).join("")}<tr class="tot"><td></td><td colspan="4">TOTAL</td><td class="n">${money(tot("basic"))}</td><td class="n">${money(tot("ded"))}</td><td class="n">${money(tot("net"))}</td><td class="n">${money(tot("pay"))}</td><td class="n">${money(tot("taxable"))}</td><td></td></tr></table></div>` : '<p class="muted">No pay found for this year and group. Finalize payroll runs first (drafts are not counted), or choose "The monthly salary of each employee".</p>'}</div>`;
  const picked = () => R.filter((x) => !off.has(String(x.no)));
  const show = () => { const L = picked(); $("#m13ps").innerHTML = L.map((x) => `<div class="slipset">${m13Slip(x, "EMPLOYEE COPY")}<div class="cut">- - - - - - - - cut here - - - - - - - -</div>${m13Slip(x, "FINANCE COPY")}</div>`).join(""); return L.length; };
  const redraw = () => { $("#m13ps").innerHTML = ""; m13Draw(); };
  if ($("#m_all")) $("#m_all").onchange = (e) => { R.forEach((x) => e.target.checked ? off.delete(String(x.no)) : off.add(String(x.no))); document.querySelectorAll(".m13c").forEach((c) => c.checked = e.target.checked); };
  document.querySelectorAll(".m13c").forEach((c) => c.onchange = () => { c.checked ? off.delete(c.dataset.no) : off.add(c.dataset.no); });
  document.querySelectorAll(".m13e").forEach((inp) => inp.onchange = () => {
    const no = inp.dataset.no, k = inp.dataset.k, x = (M.rows || []).find((r) => String(r.no) === no); if (!x) return;
    const kk = m13Key(no), E = ((M.edits ||= {})[kk] ||= {}), v = inp.value.trim(), auto = k === "basic" ? x.autoBasic : k === "ded" ? x.autoDed : x.auto;
    if (k !== "pay") delete E.pay;   // changing basic / absences recalculates the pay
    if (v === "" || isNaN(+v) || r2(Math.max(0, +v)) === r2(auto)) delete E[k]; else E[k] = r2(Math.max(0, +v));
    if (!Object.keys(E).length) delete M.edits[kk];
    M.dirty = true; m13Fin(x); redraw();
  });
  document.querySelectorAll("[data-mr]").forEach((b) => b.onclick = () => { const x = (M.rows || []).find((r) => String(r.no) === b.dataset.mr); delete (M.edits || {})[m13Key(b.dataset.mr)]; if (x) m13Fin(x); M.dirty = true; redraw(); });
  if ($("#m_ra")) $("#m_ra").onclick = () => { if (!confirm("Remove all manual edits and go back to the automatic calculation?")) return; Object.keys(M.edits || {}).forEach((k) => { if (m13Key(k.split("|")[0]) === k) delete M.edits[k]; }); (M.rows || []).forEach(m13Fin); M.dirty = true; redraw(); };
  $("#m_sv").onclick = async () => { const S = ST.settings; S.m13Edits = { ...(S.m13Edits || {}), [M.year]: JSON.parse(JSON.stringify(M.edits || {})) }; try { await api("saveSettings", S); } catch (e) { return; } M.dirty = false; toast(`13th month edits for ${M.year} saved.`); redraw(); };
  $("#m_ps").onclick = () => { if (!show()) toast("Tick at least one employee.", true); };
  $("#m_pr").onclick = () => { if (show()) print(); else toast("Tick at least one employee.", true); };
  $("#m_xl").onclick = () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to download.", true); xlsxBook([sh], `ARK-13th-Month-${M.year}-${M.part}.xlsx`); };
  $("#m_gs").onclick = async () => { const sh = m13Sheet(); if (!sh.rows.length) return toast("Nothing to send.", true); try { await sendSheets([sh]); } catch (e) { } };
}

async function m13Load() { try { await m13Compute(); } catch (e) { ST.m13.rows = []; } $("#m13ps").innerHTML = ""; m13Draw(); }

function m13() {
  const M = (ST.m13 ||= { year: new Date().getFullYear(), basis: "runs", group: "all", part: new Date().getMonth() < 6 ? "h1" : "h2", pay: "", rows: null }), yr = new Date().getFullYear(), payOf = () => M.part === "h1" ? `${M.year}-06-15` : `${M.year}-12-15`; if (!M.pay) M.pay = payOf(); if (!M.edits) M.edits = m13Saved(M.year);
  V(`<div class="card noprint"><h3>13th month pay</h3><p class="muted">The 13th month pay is paid in <b>two releases</b>: the <b>1st release (January - June)</b> and the <b>2nd release (July - December)</b>. Each release = total basic salary earned in its 6 months, less absences and late, &divide; 12; the two releases together equal the full-year 13th month pay. Overtime, allowances and holiday pay are not included; absences and late are subtracted. Up to &#8369;90,000 is tax-free; the part over it is shown. <b>Choose the year and the pay is shown below automatically</b>; only finalized payrolls are counted.</p>
  <div class="row"><div><label>Year</label><select id="m_y">${[yr - 2, yr - 1, yr, yr + 1].map((y) => `<option ${y === +M.year ? "selected" : ""}>${y}</option>`).join("")}</select></div>
  <div><label>Release</label><select id="m_p">${Object.entries(M13_PARTS).map(([k, v]) => `<option value="${k}" ${M.part === k ? "selected" : ""}>${v.title}</option>`).join("")}</select></div>
  <div><label>Salary taken from</label><select id="m_b"><option value="runs">Saved payroll runs (salary actually earned)</option><option value="salary" ${M.basis === "salary" ? "selected" : ""}>The monthly salary of each employee</option></select></div>
  <div><label>Group</label><select id="m_g"><option value="all">Everybody</option>${CATEGORIES.map((c) => `<option value="${c.key}" ${M.group === c.key ? "selected" : ""}>${c.label}</option>`).join("")}</select></div>
  <div><label>Pay date</label><input type="date" id="m_d" value="${M.pay}"></div><button class="btn" id="m_c">Refresh</button></div></div><div id="m13b"></div><div id="m13ps"></div>`);
  $("#m_y").onchange = (e) => { if (M.dirty && !confirm("You have edits that are not saved. Change the year anyway?")) { e.target.value = M.year; return; } M.year = +e.target.value; M.pay = payOf(); $("#m_d").value = M.pay; M.edits = m13Saved(M.year); M.dirty = false; M.off = new Set(); M.rows = null; m13Draw(); m13Load(); };
  $("#m_p").onchange = (e) => { M.part = e.target.value; M.pay = payOf(); $("#m_d").value = M.pay; (M.rows || []).forEach(m13Fin); $("#m13ps").innerHTML = ""; m13Draw(); };
  $("#m_b").onchange = (e) => { M.basis = e.target.value; M.rows = null; m13Draw(); m13Load(); };
  $("#m_g").onchange = (e) => { M.group = e.target.value; $("#m13ps").innerHTML = ""; m13Draw(); };
  $("#m_d").onchange = (e) => { M.pay = e.target.value; };
  $("#m_c").onclick = () => { M.rows = null; m13Draw(); m13Load(); };
  m13Draw(); if (!M.rows) m13Load();
}

