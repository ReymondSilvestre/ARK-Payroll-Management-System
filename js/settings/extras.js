/* ============================================================
   SETTINGS: extra settings blocks and how they are collected on Save.
   File: js/settings/extras.js
   ============================================================ */

function setExtras() {
  otfInit();
  const rows = () => [...document.querySelectorAll("[data-hr]")].map((r) => ({ date: $(".hd", r).value, label: $(".hl", r).value.trim(), type: $(".ht", r).value })).filter((h) => h.date);
  $("#add_dd").onclick = () => $("#ddt").insertAdjacentHTML("beforeend", ddRow("", {}));
  $("#ddt").onclick = (e) => { const b = e.target.closest("[data-ddx]"); if (b) b.closest("tr").remove(); };
  const shRefresh = () => { const L = shCollect(); document.querySelectorAll(".shw").forEach((s) => { const cur = s.value; s.innerHTML = shOpts(L, cur); }); };
  $("#ash").onclick = () => { $("#sht").insertAdjacentHTML("beforeend", shRow({})); shRefresh(); };
  $("#sht").oninput = shRefresh; $("#sht").onclick = (e) => { const b = e.target.closest("[data-shx]"); if (b) { b.closest("tr").remove(); shRefresh(); } };
  $("#shq").oninput = (e) => { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll("[data-se]").forEach((r) => r.hidden = !!q && !r.dataset.q.includes(q)); };
  $("#ah").onclick = () => $("#htab").insertAdjacentHTML("beforeend", holRow({}));
  $("#aw").onclick = () => $("#wtab").insertAdjacentHTML("beforeend", wfhRow({}));
  $("#wtab").onclick = (e) => { const b = e.target.closest("[data-wx]"); if (b) b.closest("tr").remove(); };
  $("#alt").onclick = () => $("#ltab").insertAdjacentHTML("beforeend", lvRow({ paid: true }));
  $("#lvreset").onclick = async () => { if (!confirm("Reset the leave types to the default list (Personal, Birthday, Emergency, Sick - 7 days in total; Maternity 105; Paternity 7; Leave Without Pay)?")) return; ST.settings.leaveTypes = null; ST.settings.leaveTotal = 7; await api("saveSettings", ST.settings); ST.setView = "lv"; toast("Leave types reset to default."); set(); };
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
  S.dtr.wfhDays = [...document.querySelectorAll("[data-wr]")].map((r) => ({ date: $(".wd", r).value, label: $(".wl", r).value.trim(), type: $(".wt", r).value, hours: $(".wh", r).value === "" ? null : +$(".wh", r).value })).filter((h) => h.date);
  S.wfh = { staffPaid: v("wf1") === "1", staffPct: isNaN(+v("wf2")) ? 100 : +v("wf2"), teachersPaid: v("wf3") === "1", teacherHours: isNaN(+v("wf4")) || v("wf4") === "" ? 8 : +v("wf4"), teacherPct: isNaN(+v("wf5")) ? 100 : +v("wf5") };
  S.holiday = { regular: { notWorked: +v("hp1"), worked: +v("hp2") }, special: { notWorked: +v("hp3"), worked: +v("hp4") }, teachersPaid: v("hp5") === "1" };
  Object.assign(S.dtr, { start: v("dt1") || "08:00", end: v("dt2") || "17:00", teacherStart: v("dt1t") || "", teacherEnd: v("dt2t") || "", lunchMin: +v("dt3"), 
    workDays: [...document.querySelectorAll(".wdc")].filter((c) => c.checked).map((c) => +c.value), restDayAsOt: v("dt6") === "1", attOt: !!document.getElementById("dt10") && document.getElementById("dt10").checked, holPunch: !!document.getElementById("dt11") && document.getElementById("dt11").checked, noInRule: v("dt7"), noOutRule: v("dt8"), halfDayAbs: Math.min(1, Math.max(0, isNaN(+v("dt9")) ? 0.5 : +v("dt9"))), daysV: 2 });
  if (!S.dtr.workDays.length) S.dtr.workDays = [1, 2, 3, 4, 5, 6];
  S.dtr.deptTimes = {}; document.querySelectorAll("[data-dd]").forEach((r) => { const n = $(".ddn", r).value.trim(), a = $(".dds", r).value, b = $(".dde", r).value; if (n && (a || b)) S.dtr.deptTimes[n.toLowerCase()] = { label: n, start: a, end: b }; });
  S.dtr.shifts = shCollect().map((s) => ({ ...s, name: shName(s) })); S.dtr.empShift = {}; document.querySelectorAll(".shw").forEach((s) => { if (s.value) S.dtr.empShift[s.dataset.id] = s.value; }); S.dtr.minV = 1;
  const gr = { staff: {}, teacher: {}, admin: {} }; document.querySelectorAll(".gri").forEach((x) => { gr[x.dataset.g][x.dataset.d] = Math.max(0, +x.value || 0); });
  S.dtr.grace = gr; S.dtr.graceStaff = gr.staff[1]; S.dtr.graceMin = gr.staff[1]; S.dtr.graceTeacher = gr.teacher[1];
  const og = {}, op = {}; document.querySelectorAll(".otg").forEach((x) => { og[x.dataset.g] = x.checked; }); document.querySelectorAll("[data-oe]").forEach((r) => { const k = $(".otw", r).value; if (k) op[r.dataset.oe] = k; });
  S.dtr.ot = { groups: og, people: op, startMin: Math.max(0, +v("ot1") || 0), blockMin: Math.max(1, +v("ot2") || 1), minMin: Math.max(0, +v("ot3") || 0), maxHrs: Math.max(0, +v("ot4") || 0), auto: $("#ot5").checked };
  S.dtr.late = { countFrom: "beyond", round: v("lt2"), blockMin: Math.max(1, +v("lt3") || 1), deduct: $("#lt4").checked };
  S.leaveTypes = [...document.querySelectorAll("[data-lt]")].map((r) => ({ name: $(".ln", r).value.trim(), paid: $(".lp", r).value === "1", days: +$(".ld", r).value || 0, pool: $(".lpool", r).checked })).filter((x) => x.name); S.leaveTotal = isNaN(+v("lv_tot")) || v("lv_tot") === "" ? 7 : +v("lv_tot"); S.unpaidLeave = v("lv_ded") === "1";
}

