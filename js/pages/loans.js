/* ============================================================
   LOANS / CASH ADVANCE / CASH LOAN tab.
   File: js/pages/loans.js
   ============================================================ */

/* ---------- Loans, cash advances and allowances ---------- */
const LOAN_TYPES = ["Salary Loan", "SSS Loan", "Pag-IBIG Loan", "PhilHealth", "Company Loan", "Emergency Loan", "Other"];

function loans(selId) {
  const E = ST.employees; if (!E.length) return V('<div class="card"><p class="muted">Add employees first.</p></div>');
  const M = ST.tab === "ca" ? "ca" : ST.tab === "allow" ? "allow" : "loan", e = E.find((x) => x.id === selId) || E[0]; let W = { ca: { ...(e.ca || {}) }, deductions: (e.deductions || []).map((x) => ({ ...x })), allowances: (e.allowances || []).map((x) => ({ ...x })) };
  const collect = () => ({
    ca: M === "ca" ? { ...W.ca, perPay: +$("#cap").value || 0 } : W.ca,   // the outstanding balance is never typed: it only changes through Add cash advance and the payroll
    deductions: M === "loan" ? [...document.querySelectorAll("[data-ln]")].map((r) => ({ id: r.dataset.id, type: $(".lt", r).value, label: $(".ll", r).value.trim() || $(".lt", r).value, amount: +$(".la", r).value || 0, balance: $(".lb", r).value === "" ? "" : +$(".lb", r).value })) : W.deductions,
    allowances: M === "allow" ? [...document.querySelectorAll("[data-an]")].map((r) => ({ label: $(".al", r).value.trim(), amount: +$(".aa", r).value || 0, perDay: $(".ap", r).value === "1", taxable: $(".at", r).value === "1" })).filter((a) => a.label || a.amount) : W.allowances });
  const draw = () => {
    const hist = (W.ca.history || []).slice().reverse(), today = new Date().toISOString().slice(0, 10);
    const caCard = `<div class="card"><h3>Cash advance</h3><div class="form"><div><label>Outstanding balance (\u20B1) - automatic</label><input type="text" id="cab" value="${money(+W.ca.balance || 0)}" readonly disabled style="font-weight:700"></div><div><label>Deduct each payday (\u20B1)</label><input type="number" step="any" id="cap" value="${W.ca.perPay ?? 0}"></div></div>
    <p class="muted">The balance cannot be edited. A new cash advance is added to it automatically, and each payroll deducts the amount per payday (never more than the balance) when the payroll is saved.</p>
    <h4 style="margin:1rem 0 .3rem">Add cash advance</h4><div class="form"><div><label>Amount (\u20B1)</label><input type="number" step="any" min="0" id="ca_amt" placeholder="0.00"></div><div><label>Date</label><input type="date" id="ca_date" value="${today}"></div><div><label>Reason / note</label><input id="ca_note" placeholder="optional"></div></div>
    <p><button class="btn p" id="ca_add" type="button">+ Add cash advance</button></p>
    <h4 style="margin:1rem 0 .3rem">Cash advances given</h4><div class="tw"><table><tr><th>Date</th><th>Amount</th><th>Note</th></tr>${hist.map((h) => `<tr><td>${esc(h.date || "")}</td><td class="n">${money(h.amount)}</td><td>${esc(h.note || "")}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">No cash advance recorded yet.</td></tr>'}</table></div></div>`;
    const loanCard = `<div class="card"><h3>Loans (Salary Loan, SSS Loan, Pag-IBIG Loan, etc.)</h3><div class="tw"><table><tr><th>Type</th><th>Description</th><th>Amount per month</th><th>Outstanding balance</th><th></th></tr>
    ${W.deductions.map((d, i) => `<tr data-ln data-id="${esc(d.id || "L" + Date.now() + i)}"><td><select class="lt">${LOAN_TYPES.map((t) => `<option ${d.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></td><td><input class="ll" value="${esc(d.label || "")}"></td><td><input class="in la" type="number" step="any" value="${d.amount ?? ""}"></td><td><input class="in lb" type="number" step="any" value="${d.balance ?? ""}" placeholder="no limit"></td><td><button class="btn sm d" data-rl="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No loans.</td></tr>'}</table></div>
    <p class="muted">The monthly amount is split between the two cut-offs. When a balance is entered, the loan stops once it is fully paid.</p><p><button class="btn" id="al">+ Add loan</button></p></div>`;
    const allowCard = `<div class="card"><h3>Allowances</h3><div class="tw"><table><tr><th>Name</th><th>Amount</th><th>Per</th><th>Taxable</th><th></th></tr>
    ${W.allowances.map((a, i) => `<tr data-an><td><input class="al" value="${esc(a.label || "")}"></td><td><input class="in aa" type="number" step="any" value="${a.amount ?? ""}"></td><td><select class="ap"><option value="0">Month</option><option value="1" ${a.perDay ? "selected" : ""}>Working day</option></select></td><td><select class="at"><option value="1">Yes</option><option value="0" ${a.taxable === false ? "selected" : ""}>No</option></select></td><td><button class="btn sm d" data-ra="${i}">Remove</button></td></tr>`).join("") || '<tr><td colspan="5" class="muted">No allowances.</td></tr>'}</table></div><p><button class="btn" id="aa">+ Add allowance</button></p></div>`;
    V(`${loanHead(e, E)}${M === "ca" ? caCard : M === "loan" ? loanCard : allowCard}<p><button class="btn p" id="sl">Save ${M === "ca" ? "cash advance" : M === "loan" ? "loans" : "allowances"}</button></p>`);
    $("#lq").onkeydown = (ev) => { if (ev.key === "Enter") { const m = loanSug($("#lq").value); if (m.length) { ev.preventDefault(); ST.loanQ = ""; loans(m[0].id); } } else if (ev.key === "Escape") $("#lsug").hidden = true; };
    if ($("#al")) $("#al").onclick = () => { W = collect(); W.deductions.push({ id: "L" + Date.now(), type: "Salary Loan", label: "", amount: "", balance: "" }); draw(); };
    if ($("#aa")) $("#aa").onclick = () => { W = collect(); W.allowances.push({ label: "", amount: "", perDay: false, taxable: true }); draw(); };
    document.querySelectorAll("[data-rl]").forEach((b) => b.onclick = () => { W = collect(); W.deductions.splice(+b.dataset.rl, 1); draw(); });
    document.querySelectorAll("[data-ra]").forEach((b) => b.onclick = () => { W = collect(); W.allowances.splice(+b.dataset.ra, 1); draw(); });
    if ($("#ca_add")) $("#ca_add").onclick = async () => {
      const amt = r2($("#ca_amt").value); if (!(amt > 0)) return toast("Enter the cash advance amount.", true);
      const c = collect().ca, h = [...(c.history || []), { id: "C" + Date.now(), date: $("#ca_date").value || new Date().toISOString().slice(0, 10), amount: amt, note: $("#ca_note").value.trim() }];
      e.ca = { ...c, balance: r2((+c.balance || 0) + amt), history: h };
      const r = await api("saveEmployees", { list: [e] }); ST.employees = r.employees; toast("Cash advance added. New balance " + money(e.ca.balance) + "."); loans(e.id);
    };
    $("#sl").onclick = async () => { Object.assign(e, collect()); const r = await api("saveEmployees", { list: [e] }); ST.employees = r.employees; toast("Saved."); loans(e.id); };
  };
  draw();
}

/* ---------- Cash Loan: employee number + information ---------- */
function loanHead(e, E) {
  setTimeout(() => { if ($("#lbody")) $("#lbody").innerHTML = loanRows(E, e.id); }, 0);
  const g = CATEGORIES.find((c) => c.key === categoryOf(e)), rate = (x) => isHourly(x) ? money(Math.max(+x.hourlyRate || 0, minHourly(ST.settings))) + " / hr" : money(dailyRateOf(x, ST.settings)) + " / day";
  return `<div class="card noprint"><div class="who">${e.photo ? `<img class="av" src="${e.photo}" alt="">` : `<div class="av">${esc(String(e.first || e.name || "?")[0])}</div>`}<div style="flex:1;min-width:16rem;position:relative"><label>Search employee</label><input id="lq" type="search" autocomplete="off" placeholder="Type employee no. or name" value="" style="width:100%"><div id="lsug" class="noprint" hidden style="position:absolute;left:0;right:0;top:100%;z-index:30;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.14);max-height:16rem;overflow:auto"></div></div></div>
  <div class="facts"><span><small>Employee No.</small><b>${esc(e.no)}</b></span><span><small>Name</small><b>${esc(nameOf(e))}</b></span><span><small>Position</small><b>${esc(e.position || "-")}</b></span><span><small>Department</small><b>${esc(e.dept || "-")}</b></span><span><small>Payroll group</small><b>${g.short}</b></span><span><small>Rate</small><b>${rate(e)}</b></span></div></div>`;
}

const loanFind = (E, q) => E.filter((x) => [x.no, nameOf(x), x.position, x.dept].join(" ").toLowerCase().includes(q));

/** Rows of the cash advance / loans / allowances list: only the employees who have one (biggest first); the search box narrows that list. */
function loanRows(E, selId) {
  const q = (ST.loanQ || "").trim().toLowerCase(), T = ST.tab, bal = (x) => (x.deductions || []).reduce((n, d) => n + (+d.balance || 0), 0), alw = (x) => (x.allowances || []).reduce((n, a) => n + allowMonthly(a, ST.settings), 0);
  const val = (x) => (T === "ca" ? +(x.ca || {}).balance || 0 : T === "allow" ? alw(x) : bal(x)), what = T === "ca" ? "a cash advance" : T === "allow" ? "an allowance" : "a loan";
  let L = E.filter((x) => val(x) > 0).sort((a, b) => val(b) - val(a));
  if (q) L = loanFind(L, q);
  const h = $("#lhint"); if (h) { h.textContent = ""; h.style.display = "none"; }
  return L.map((x) => `<tr class="pick ${x.id === selId ? "sel" : ""}" data-pick="${x.id}"><td>${esc(x.no)}</td><td>${esc(nameOf(x))}</td><td>${esc(x.position)}</td><td>${esc(x.dept)}</td><td>${CATEGORIES.find((c) => c.key === categoryOf(x)).short}</td><td class="n">${money(val(x))}</td></tr>`).join("") || `<tr><td colspan="6" class="muted">${q ? "No employee with " + what + " matches your search." : "Nobody has " + what + "."}</td></tr>`;
}

/** Employees that match what was typed in the search box (employee no., name, position or department): at most 8. */
const loanSug = (q) => { q = String(q || "").trim().toLowerCase(); return q ? loanFind(ST.employees, q).slice(0, 8) : []; };

document.addEventListener("input", (ev) => { if (ev.target.id !== "lq") return; ST.loanQ = ev.target.value; const box = $("#lsug"), L = loanSug(ev.target.value); if (!box) return;
  box.innerHTML = L.map((x) => `<div data-sg="${x.id}" style="padding:.5rem .8rem;cursor:pointer;border-bottom:1px solid var(--line)"><b>${esc(x.no)}</b> - ${esc(nameOf(x))}<br><small class="muted">${esc(x.position || "")}${x.dept ? " &middot; " + esc(x.dept) : ""}</small></div>`).join("") || `<div class="muted" style="padding:.6rem .8rem">No employee found.</div>`;
  box.hidden = !ev.target.value.trim(); });

document.addEventListener("click", (ev) => { const g = ev.target.closest("[data-sg]"); if (g && ["ca", "loans", "allow"].includes(ST.tab)) { ST.loanQ = ""; loans(g.dataset.sg); return; } if (!ev.target.closest("#lsug") && ev.target.id !== "lq") { const b = $("#lsug"); if (b) b.hidden = true; } });

document.addEventListener("click", (ev) => { const r = ev.target.closest("tr[data-pick]"); if (r && ["ca", "loans", "allow"].includes(ST.tab)) loans(r.dataset.pick); });

