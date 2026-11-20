/* ============================================================
   SETTINGS + PAGE: Overtime file (filed overtime per employee).
   File: js/settings/overtime-file.js
   ============================================================ */

/* ---------- Settings: Overtime file ---------- */
const parseHrs = (t) => { t = String(t ?? "").trim(); if (!t) return 0; if (t.includes(":")) { const [h, m] = t.split(":").map(Number); return (h || 0) + (m || 0) / 60; } return +t || 0; };

function otfHTML() {
  const q = (ST.otfQ || "").trim().toLowerCase(), L = (ST.settings.otFile || []).map((x) => ({ x, e: ST.employees.find((e) => e.id === x.empId) })).filter((r) => r.e && (!q || [r.e.no, nameOf(r.e), r.e.dept, r.x.date].join(" ").toLowerCase().includes(q))).sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : nameOf(a.e).localeCompare(nameOf(b.e))));
  const tot = L.reduce((n, r) => n + (+r.x.hours || 0), 0);
  return L.length ? `<div class="tw" style="max-height:26rem;overflow:auto"><table><tr><th>Date</th><th>No.</th><th>Employee</th><th>Group</th><th class="n">Overtime hours</th><th>Reason</th><th></th></tr>${L.map(({ x, e }) => `<tr><td>${esc(x.date)} <small class="muted">${new Date(x.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</small></td><td>${esc(e.no)}</td><td>${esc(nameOf(e))}</td><td>${esc(groupName(e))}</td><td class="n"><b>${fmtHM(Math.round((+x.hours || 0) * 60))}</b> <small class="muted">(${+(+x.hours).toFixed(2)} h)</small></td><td>${esc(x.reason || "")}</td><td><button type="button" class="btn sm d" data-otx="${esc(x.id)}">Remove</button></td></tr>`).join("")}<tr class="tot"><td colspan="4">Total (${L.length} entries)</td><td class="n">${fmtHM(Math.round(tot * 60))}</td><td colspan="2"></td></tr></table></div>` : `<div class="empty"><b>No overtime filed yet</b><p class="muted">Add the first overtime hours above, or upload an Excel / CSV file.</p></div>`;
}

function otfPage() { V(`<div class="card">${otFileHTML()}</div>`); otfInit(); }

function otFileHTML() {
  const today = ymd(new Date()), emps = ST.employees.slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return `<div><h3>Overtime file</h3><p class="muted">Record the overtime hours of each employee here. Hours filed for a date are paid as overtime for that date <b>and replace</b> whatever the biometric gave for that day, so nothing is counted twice. They are paid even if the person is not on the &ldquo;Who can take overtime&rdquo; list, and also when ${isHR() ? "Add overtime automatically (Settings)" : '<a href="#" data-go="auto">Add overtime automatically</a> (Settings)'} is OFF.</p>
  <div class="otbox"><div class="form"><div><label>Employee</label><select id="of_e"><option value="">Choose employee...</option>${emps.map((e) => `<option value="${esc(e.id)}">${esc(e.no)} - ${esc(nameOf(e))}</option>`).join("")}</select></div>
  <div><label>Date</label><input type="date" id="of_d" value="${today}"></div><div><label>Overtime hours (1.5 or 1:30)</label><input id="of_h" inputmode="decimal" placeholder="e.g. 2"></div><div><label>Reason (optional)</label><input id="of_r" placeholder="e.g. Enrollment, event, make-up class"></div></div>
  <div class="row" style="margin-top:.7rem"><button type="button" class="btn p" id="of_add">Add overtime</button><span class="muted">or</span><div><input type="file" id="of_f" accept=".xlsx,.xls,.csv"></div></div>
  <p class="muted" style="margin:.5rem 0 0">Upload columns: <b>Employee No, Date, Hours, Reason</b> (the first row may be a heading). Entries are saved to the database right away.</p></div>
  <div class="row" style="margin:1rem 0 .5rem"><div style="flex:1;min-width:14rem"><input id="of_q" type="search" placeholder="Search name, employee no., department or date" value="${esc(ST.otfQ || "")}" style="width:100%"></div></div>
  <div id="otf_body">${otfHTML()}</div></div>`;
}

/** The overtime file has its own tab in the database. Entries are added / removed on the server and the full list comes back, so two people (HR and payroll) filing at the same time never overwrite each other. */
async function otfAdd(list, msg) { try { ST.settings.otFile = await api("otAdd", { list }); if (msg) toast(msg); } catch (e) { } otfRedraw(); }

async function otfRemove(ids, msg) { try { ST.settings.otFile = await api("otRemove", { ids }); if (msg) toast(msg); } catch (e) { } otfRedraw(); }

function otfRedraw() { const b = $("#otf_body"); if (b) b.innerHTML = otfHTML(); }

function otfInit() {
  swSync();
  document.querySelectorAll("[data-go]").forEach((a) => a.onclick = (e) => { e.preventDefault(); const go = a.dataset.go, b = document.querySelector(`#svs [data-sv="${go}"]`); if (go === "otf") { ST.tab = "otf"; shell(); } else if (b) b.click(); else { ST.setView = go; ST.tab = "set"; shell(); } });
  if (!$("#of_add")) return;
  $("#of_add").onclick = async () => {
    const id = $("#of_e").value, d = $("#of_d").value, h = parseHrs($("#of_h").value);
    if (!id) return toast("Choose the employee.", true); if (!d) return toast("Choose the date.", true); if (!(h > 0) || h > 24) return toast("Enter the overtime hours (more than 0, up to 24).", true);
    const dup0 = (ST.settings.otFile || []).find((x) => x.empId === id && x.date === d);   // one entry per person and date: filing again changes it
    const ent = { id: dup0 ? dup0.id : "ot" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), empId: id, date: d, hours: Math.round(h * 10000) / 10000, reason: $("#of_r").value.trim() };
    $("#of_h").value = ""; $("#of_r").value = ""; await otfAdd([ent], dup0 ? "Overtime of that date changed." : "Overtime added to the file.");
  };
  $("#of_q").oninput = (e) => { ST.otfQ = e.target.value; otfRedraw(); };
  $("#otf_body").onclick = async (e) => { const b = e.target.closest("[data-otx]"); if (!b) return; if (!confirm("Remove this overtime entry?")) return; await otfRemove([b.dataset.otx], "Entry removed."); };
  $("#of_f").onchange = async (ev) => {
    const f = ev.target.files[0]; if (!f) return; ev.target.value = "";
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      let c = { no: 0, date: 1, hrs: 2, why: 3 }, start = 0;
      const hi = rows.findIndex((r) => r.some((x) => /hour|hrs/i.test(String(x))));
      if (hi >= 0) { start = hi + 1; const f2 = (re) => rows[hi].findIndex((x) => re.test(String(x).trim())); const no = f2(/^(emp(loyee)?\.?\s*)?(no|id|number|#)\.?$|emp.*(no|id)/i), dt = f2(/date/i), hr = f2(/hour|hrs/i), wy = f2(/reason|remark|note|purpose/i); c = { no: no >= 0 ? no : 0, date: dt >= 0 ? dt : 1, hrs: hr, why: wy }; }
      const toDate = (v) => { if (typeof v === "number") { const o = XLSX.SSF.parse_date_code(v); return o ? `${o.y}-${String(o.m).padStart(2, "0")}-${String(o.d).padStart(2, "0")}` : ""; } const t = String(v).trim(), m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/), u = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`; if (u) return `${u[3]}-${u[1].padStart(2, "0")}-${u[2].padStart(2, "0")}`; const d = new Date(t); return isNaN(d) ? "" : ymd(d); };
      let ok = 0, bad = 0; const L = (ST.settings.otFile ||= []), send = new Map();
      for (const r of rows.slice(start)) {
        if (!r.some((x) => String(x).trim())) continue;
        const key = String(r[c.no] ?? "").trim(), e = ST.employees.find((x) => normNo(x.no) === normNo(key)) || ST.employees.find((x) => key && nameNorm(nameOf(x)) === nameNorm(key)), d = toDate(r[c.date]), h = parseHrs(r[c.hrs]);
        if (!e || !d || !(h > 0) || h > 24) { bad++; continue; }
        const dup = L.find((x) => x.empId === e.id && x.date === d), dk = e.id + "|" + d, why = c.why >= 0 ? String(r[c.why] ?? "").trim() : "";
        send.set(dk, dup ? { id: dup.id, empId: e.id, date: d, hours: h, reason: why || dup.reason || "" } : { id: "ot" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + send.size, empId: e.id, date: d, hours: h, reason: why });
        ok++;
      }
      if (ok) await otfAdd([...send.values()], `${ok} overtime entr${ok === 1 ? "y" : "ies"} saved${bad ? `, ${bad} row(s) skipped (employee, date or hours not recognised)` : ""}.`); else toast("No valid rows found. Use the columns Employee No, Date, Hours.", true);
    } catch (e) { toast("Could not read the file: " + e.message, true); }
  };
}

