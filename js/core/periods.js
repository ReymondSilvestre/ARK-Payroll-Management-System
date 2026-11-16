/* ============================================================
   PAY PERIODS - cut-offs (1-15 / 16-end), monthly periods, custom periods.
   File: js/core/periods.js
   ============================================================ */

/** The pay period for a month and a half ("first", "second", "whole"). P = the pay period rules from the Settings (first day / last day of each half). */
function periodOf(month, half, P) {
  const R = { ...DEFAULT_SETTINGS.period, ...(P || {}) };
  const [y, m] = month.split("-").map(Number), last = new Date(y, m, 0).getDate(), p = (n) => String(n).padStart(2, "0"), cl = (n) => Math.min(last, Math.max(1, Math.round(+n) || 1));
  const a = half === "second" ? cl(R.secondFrom) : cl(R.firstFrom), b = half === "first" ? cl(R.firstTo) : last;
  const mon = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long" });
  const label = half === "whole" ? mon + " " + y : `${mon} ${a} - ${b}, ${y}`;
  return { start: `${y}-${p(m)}-${p(a)}`, end: `${y}-${p(m)}-${p(b)}`, label, half };
}

/** A period typed by hand (start and end dates), for the half the contributions follow. */
function customPeriod(start, end, half) {
  const f = (d) => new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return { start, end, label: `${f(start)} - ${f(end)}`, half };
}

/** The cut-off periods a payroll can follow. half = which pay of the month it is (for "contributions in the 1st / 2nd pay"). */
const CUTOFFS = [
  { key: "c26_10", label: "26th - 10th", half: "first", pair: "A" },
  { key: "c11_25", label: "11th - 25th", half: "second", pair: "A" },
  { key: "c1_15", label: "1st - 15th", half: "first", pair: "B" },
  { key: "c16_end", label: "16th - 30th / 31st (end of month)", half: "second", pair: "B" },
];

/** The period of a cut-off for a month. For 26th - 10th the month is the one the period ENDS in (Nov 2026 = Oct 26 - Nov 10). */
function cutoffPeriod(month, key) {
  const [y, m] = month.split("-").map(Number), p = (n) => String(n).padStart(2, "0"), mon = (yy, mm) => new Date(yy, mm - 1, 1).toLocaleString("en-US", { month: "short" }), last = (yy, mm) => new Date(yy, mm, 0).getDate();
  const c = CUTOFFS.find((x) => x.key === key) || CUTOFFS[2];
  let a, b, label;
  if (key === "c26_10") { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; a = `${py}-${p(pm)}-26`; b = `${y}-${p(m)}-10`; label = `${mon(py, pm)} 26 - ${mon(y, m)} 10, ${y}`; }
  else if (key === "c11_25") { a = `${y}-${p(m)}-11`; b = `${y}-${p(m)}-25`; label = `${mon(y, m)} 11 - 25, ${y}`; }
  else if (key === "c16_end") { const l = last(y, m); a = `${y}-${p(m)}-16`; b = `${y}-${p(m)}-${p(l)}`; label = `${mon(y, m)} 16 - ${l}, ${y}`; }
  else { a = `${y}-${p(m)}-01`; b = `${y}-${p(m)}-15`; label = `${mon(y, m)} 1 - 15, ${y}`; }
  return { start: a, end: b, label, half: c.half, cut: c.key };
}

/** Which cut-off a pair of dates is ("custom" when it is none of them, "whole" for a whole month). */
function cutOfDates(start, end) {
  if (!start || !end) return "custom";
  const d = (x) => +x.slice(8, 10), [ey, em] = end.split("-").map(Number), l = new Date(ey, em, 0).getDate(), sm = start.slice(0, 7) === end.slice(0, 7);
  if (d(start) === 26 && d(end) === 10 && !sm) return "c26_10";
  if (d(start) === 11 && d(end) === 25 && sm) return "c11_25";
  if (d(start) === 1 && d(end) === 15 && sm) return "c1_15";
  if (d(start) === 16 && d(end) === l && sm) return "c16_end";
  if (d(start) === 1 && d(end) === l && sm) return "whole";
  return "custom";
}

