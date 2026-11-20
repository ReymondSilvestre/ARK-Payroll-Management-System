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

