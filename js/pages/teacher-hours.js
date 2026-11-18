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
    ST.thDraft[emp.id] = { t, h, hSet: true };
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
    const hrs = { ...(D.teacherHrs || {}) }, tms = { ...(D.teacherDayTimes || {}) };
    Object.entries(ST.thDraft).forEach(([id, dr]) => {
      const h = { ...((hrs[id] || {}).h || {}) }, t = { ...(tms[id] || {}) };   // days hidden by Work days (Settings) keep what was saved
      Object.entries(dr.t || {}).forEach(([n, v]) => {
        const hv = (dr.h || {})[n], full = v.start && v.end && thSpanHrs(v.start, v.end, 0) > 0;
        if (full) t[n] = { start: v.start, end: v.end }; else delete t[n];
        if (hv !== undefined && hv !== "" && !isNaN(+hv)) h[n] = Math.min(24, Math.max(0, +hv));
        else if (full) h[n] = Math.round(thSpanHrs(v.start, v.end, D.lunchMin) * 100) / 100;
        else delete h[n];
      });
      if (Object.keys(h).length) hrs[id] = { h }; else delete hrs[id];
      if (Object.keys(t).length) tms[id] = t; else delete tms[id];
    });
    D.teacherHrs = hrs; D.teacherDayTimes = tms; ST.thDraft = {};
    if ($("#thm")) D.teacherHrMode = $("#thm").value;
    if ($("#thd")) D.teacherDefHrs = $("#thd").value === "" || isNaN(+$("#thd").value) ? 8 : Math.min(24, Math.max(0, +$("#thd").value));
    await api("saveSettings", S); toast("Teacher hours saved."); teacherHours();
  };
}
