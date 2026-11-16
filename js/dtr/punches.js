/* ============================================================
   DTR DATA - dates, name matching, which employee owns which biometric record, saved punches.
   File: js/dtr/punches.js
   ============================================================ */

/* ---------- Biometric files -> DTR ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDay = (s, n = 1) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); };

const normNo = (s) => String(s ?? "").trim().replace(/^0+(?=.)/, "").toLowerCase();

const hm = (n) => n == null ? "" : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

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
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds());
  const s = String(v ?? "").trim(); let y, mo, d, h, mi, ap, m;
  if (m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { [, y, mo, d, h, mi, ap] = m; }
  else if (m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})[ T]+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i)) { y = +m[3] < 100 ? 2000 + (+m[3]) : m[3]; [mo, d] = ST.settings.dtr.dateOrder === "DMY" ? [m[2], m[1]] : [m[1], m[2]]; h = m[4]; mi = m[5]; ap = m[6]; }
  else return null;
  h = +h; if (ap) { ap = ap.toUpperCase(); if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0; }
  const sc = s.match(/\d{1,2}:\d{2}:(\d{2})/);
  return new Date(+y, +mo - 1, +d, h, +mi, sc ? +sc[1] : 0);
}

