/* ============================================================
   TEACHER HOURS tab - the hours of each teacher per day, from the teacher's own schedule.
   Saved in Settings (dtr.teacherHrs) and used by the DTR (js/dtr/dtr-calc.js) and the Payroll tab.
   File: js/pages/teacher-hours.js
   ============================================================ */

const TH_DAYS = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]];

function teacherHours() {
  const S = ST.settings, D = S.dtr, saved = D.teacherHrs || {}, times = D.teacherTimes || {}, wk = D.workDays || [1, 2, 3, 4, 5, 6], days = TH_DAYS.filter(([n]) => wk.includes(n)), mode = D.teacherHrMode === "cap" ? "cap" : "sched";
  const list = activeEmps().filter((e) => categoryOf(e) === "teacher").sort((a, b) => ST.thSort === "no" ? String(a.no).localeCompare(String(b.no), undefined, { numeric: true }) : ST.thSort === "za" ? nameOf(b).localeCompare(nameOf(a)) : nameOf(a).localeCompare(nameOf(b)));
  const rate = (e) => Math.max(+e.hourlyRate || 0, minHourly(S));
  const cell = (e, n) => { const v = ((saved[e.id] || {}).h || {})[n]; return `<td><input class="thin" type="number" min="0" max="24" step="0.25" placeholder="${D.teacherDefHrs ?? 8}" data-id="${esc(e.id)}" data-d="${n}" value="${v === undefined || v === null ? "" : esc(v)}" style="width:4.6rem"></td>`; };
  const tcell = (e, k) => `<td><input class="thin" type="time" data-t="${k}" data-id="${esc(e.id)}" value="${esc((times[e.id] || {})[k] || "")}" placeholder="" title="${k === "start" ? "Time in" : "Time out"}" style="width:6.6rem"></td>`;
  const rows = list.map((e) => `<tr data-te="${esc(e.id)}" data-q="${esc([e.no, nameOf(e), e.dept].join(" ").toLowerCase())}"><td>${esc(e.no)}</td><td>${esc(nameOf(e))}<br><small class="muted">${esc(e.position || "")}${e.dept ? " &middot; " + esc(e.dept) : ""}</small></td>${tcell(e, "start")}${tcell(e, "end")}${days.map(([n]) => cell(e, n)).join("")}<td class="n"><b class="tw">0</b></td><td class="n tp">0.00</td><td class="ts"></td><td class="noprint"><button class="btn sm" type="button" data-fill="${esc(e.id)}" title="Copy the Monday hours to Tuesday - Friday">Mon &rarr; Fri</button> <button class="btn sm d" type="button" data-clr="${esc(e.id)}">Clear</button></td></tr>`).join("");
  V(`<div class="card"><h3>Teacher hours per day</h3>
  <p class="muted"><b>Time in / Time out:</b> the designated working time of each teacher, for example <b>6:00 AM to 3:00 PM</b>. Late and overtime are counted from it. When no hours are typed for the days, the hours of the day are time in to time out minus the lunch break (6:00 AM - 3:00 PM = 8 hrs). Leave it blank to use the teachers' time in Settings.</p><p class="muted">Type the hours each teacher teaches on each day, following the teacher's schedule (for example Monday 6, Tuesday 4, Wednesday 6). The DTR and Payroll then use these hours: a teacher who is <b>present</b> on a day is paid the hours of <i>that day</i>; a day with <b>0 or blank</b> is a day without classes (not counted absent). A teacher with <b>no hours typed</b> uses the <b>default hours per day</b> (8 hours) on every work day; set the default to 0 to use the biometric hours instead. Holidays and WFH / asynchronous days are paid with the hours of that weekday too.</p>
  <div class="row noprint"><div><label>Sort</label><select id="thsort"><option value="az">Name A - Z</option><option value="za">Name Z - A</option><option value="no">Employee no.</option></select></div><div style="flex:1;min-width:14rem"><label>Search teacher</label><input id="thq" type="search" placeholder="Employee no., name or department" style="width:100%"></div>
  <div><label>Default hours per day</label><input id="thd" type="number" min="0" max="24" step="0.25" value="${D.teacherDefHrs ?? 8}" style="width:6rem"></div><div style="flex:2;min-width:18rem"><label>How the hours are paid</label><select id="thm"><option value="sched">Scheduled hours of the day, when the teacher is present (time in and time out)</option><option value="cap" ${mode === "cap" ? "selected" : ""}>Biometric hours, but never more than the scheduled hours</option></select></div>
  <div><label>Time in</label><input id="tha" type="time" style="width:7rem"></div><div><label>Time out</label><input id="thb" type="time" style="width:7rem"></div><button class="btn" id="thtf" type="button" title="Give every teacher WITHOUT a time the time in / out typed here">Fill empty times</button>
  <button class="btn" id="thf" type="button" title="Fill every empty day of every teacher with the default hours">Fill empty days with default</button><button class="btn p" id="ths">Save teacher hours</button></div>
  <div class="tw" style="margin-top:.6rem"><table id="tht"><tr><th>No.</th><th>Teacher</th><th>Time in</th><th>Time out</th>${days.map(([n, l]) => `<th>${l.slice(0, 3)}</th>`).join("")}<th class="n">Hours / week</th><th class="n">Pay / week</th><th>Schedule</th><th class="noprint"></th></tr>${rows || `<tr><td colspan="${days.length + 7}" class="muted">No active teachers. Set the payroll group of an employee to Teachers under Employees.</td></tr>`}</table></div>
  <p class="muted">Hours per day are decimals: 1.5 = 1 hr 30 min. <b>Pay / week</b> = hours &times; the teacher's hourly rate (at least the minimum rate). Press <b>Save teacher hours</b> to keep the changes.</p></div>`);
  const refresh = (id) => { const tr = document.querySelector(`[data-te="${CSS.escape(id)}"]`); if (!tr) return; const ins = [...tr.querySelectorAll("input[data-d]")], set = ins.some((i) => i.value !== ""), tm = (k) => (tr.querySelector(`input[data-t="${k}"]`) || {}).value || "", mn = (x) => { const [h, i] = x.split(":").map(Number); return h * 60 + (i || 0); }, sp = tm("start") && tm("end") && mn(tm("end")) > mn(tm("start")) ? mn(tm("end")) - mn(tm("start")) : 0, tdf = sp ? Math.max(0, sp - (sp > 300 ? +D.lunchMin || 0 : 0)) / 60 : 0, df = tdf || +$("#thd").value || 0, tot = set ? ins.reduce((n, i) => n + (+i.value || 0), 0) : df * ins.length, e = list.find((x) => x.id === id); tr.querySelector(".tw").textContent = Math.round(tot * 100) / 100; tr.querySelector(".tp").textContent = money(tot * (e ? rate(e) : 0)); tr.querySelector(".ts").innerHTML = set ? '<span style="color:#1a7f37">Set</span>' : df > 0 ? `<span class="muted">${tdf ? "From time in / out" : "Default"} (${Math.round(df * 100) / 100} hrs)</span>` : '<span class="muted">Biometric hours</span>'; };
  list.forEach((e) => refresh(e.id));
  $("#tht").oninput = (ev) => { const i = ev.target.closest("input[data-d],input[data-t]"); if (i) refresh(i.dataset.id); };
  $("#tht").onclick = (ev) => {
    const f = ev.target.closest("[data-fill]"), c = ev.target.closest("[data-clr]"), id = (f || c || {}).dataset ? (f ? f.dataset.fill : c.dataset.clr) : null; if (!id) return;
    const tr = document.querySelector(`[data-te="${CSS.escape(id)}"]`), at = (n) => tr.querySelector(`input[data-d="${n}"]`);
    if (f) { const m = at(1); if (!m || m.value === "") return toast("Type the Monday hours first.", true); [2, 3, 4, 5].forEach((n) => { const x = at(n); if (x) x.value = m.value; }); }
    else tr.querySelectorAll("input[data-d],input[data-t]").forEach((i) => i.value = "");
    refresh(id);
  };
  $("#thd").oninput = (ev) => { document.querySelectorAll("input[data-d]").forEach((i) => i.placeholder = ev.target.value); list.forEach((e) => refresh(e.id)); };
  $("#thf").onclick = () => { const df = $("#thd").value; if (!(+df > 0)) return toast("Type the default hours per day first.", true); document.querySelectorAll("input[data-d]").forEach((i) => { if (i.value === "") i.value = df; }); list.forEach((e) => refresh(e.id)); };
  $("#thtf").onclick = () => { const a = $("#tha").value, b = $("#thb").value; if (!a || !b) return toast("Type the time in and the time out first.", true); list.forEach((e) => { const tr = document.querySelector(`[data-te="${CSS.escape(e.id)}"]`), s1 = tr.querySelector('input[data-t="start"]'), s2 = tr.querySelector('input[data-t="end"]'); if (!s1.value && !s2.value) { s1.value = a; s2.value = b; } refresh(e.id); }); };
  $("#thsort").value = ST.thSort || "az";
  $("#thsort").onchange = (ev) => { ST.thSort = ev.target.value; teacherHours(); };
  $("#thq").oninput = (ev) => { const q = ev.target.value.trim().toLowerCase(); document.querySelectorAll("[data-te]").forEach((r) => r.hidden = !!q && !r.dataset.q.includes(q)); };
  $("#ths").onclick = async () => {
    const out = { ...(D.teacherHrs || {}) };
    list.forEach((e) => {
      const tr = document.querySelector(`[data-te="${CSS.escape(e.id)}"]`), h = { ...((out[e.id] || {}).h || {}) };   // days hidden by Work days (Settings) keep what was saved
      tr.querySelectorAll("input[data-d]").forEach((i) => { if (i.value === "" || isNaN(+i.value)) delete h[i.dataset.d]; else h[i.dataset.d] = Math.min(24, Math.max(0, +i.value)); });
      if (Object.keys(h).length) out[e.id] = { h }; else delete out[e.id];
    });
    const tout = { ...(D.teacherTimes || {}) };
    list.forEach((e) => { const tr = document.querySelector(`[data-te="${CSS.escape(e.id)}"]`), a = tr.querySelector('input[data-t="start"]').value, b = tr.querySelector('input[data-t="end"]').value; if (a && b) tout[e.id] = { start: a, end: b }; else delete tout[e.id]; });
    D.teacherTimes = tout; D.teacherHrs = out; D.teacherHrMode = $("#thm").value; D.teacherDefHrs = $("#thd").value === "" || isNaN(+$("#thd").value) ? 8 : Math.min(24, Math.max(0, +$("#thd").value));
    await api("saveSettings", S); toast("Teacher hours saved.");
  };
}
