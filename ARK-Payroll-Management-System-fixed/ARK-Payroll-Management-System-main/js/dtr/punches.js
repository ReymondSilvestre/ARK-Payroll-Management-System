/* ============================================================
   DTR DATA - dates, name matching, which employee owns which biometric record, saved punches.
   File: js/dtr/punches.js
   ============================================================ */

/* ---------- Biometric files -> DTR ---------- */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDay = (s, n = 1) => { const d = new Date(s + "T12:00"); d.setDate(d.getDate() + n); return ymd(d); };

const normNo = (s) => String(s ?? "").trim().replace(/^0+(?=.)/, "").toLowerCase();

/* ---------- Several biometric devices (Building 1, Building 2 ...) ----------
   A record key is "ID" (old uploads / no device chosen) or "Building 1|ID". The device is part of the key so the same ID number on two devices
   never mixes two people; the records of one person on different devices are joined by NAME (or linked by hand) in dtrMap() / daysOf(). */
const devKey = (dev, k) => { dev = String(dev ?? "").replace(/\|/g, " ").trim(); return dev ? dev + "|" + k : k; };
const keyDev = (k) => { const i = String(k).indexOf("|"); return i > 0 ? String(k).slice(0, i) : ""; };
const keyId = (k) => { const i = String(k).indexOf("|"); return i > 0 ? String(k).slice(i + 1) : String(k); };
const keyLabel = (k) => { const id = keyId(k), dv = keyDev(k); return (id.startsWith("n:") ? "(name only)" : id) + (dv ? " - " + dv : ""); };
/** Which device recorded the punch at minute m on date d for this employee ("" = unknown / no device chosen). */
function devOf(e, d, m) {
  const x = dtrMap().byEmp[e.id]; if (!x || m == null) return "";
  for (const k of x.keys) if (((ST.dtr.days[k] || {})[d] || []).includes(m)) return keyDev(k);
  return "";
}

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

/** How well does a biometric name fit an employee (0 = not the same person, 1 = same)? Tolerates the usual differences between the device and the employee file:
    "Last, First" or "First Last" order, glued surnames (DELACRUZ), a full middle name in the file (employee file has only the M.I.), initials instead of given names (J.C., "M. ELENA"),
    and names cut short by the device (DELA CRUZ JUAN CAR). A different middle initial / middle name still means another person: link that one by hand. */
function nameScore(bp, ep) {
  const E = [...ep.L, ...ep.F]; if (!bp || !bp.all.length || !E.length) return 0;
  const cb = bp.all.join(""), Lc = ep.L.join(""), Fc = ep.F.join(""); let sc;
  if (cb === Lc + Fc || cb === Fc + Lc) sc = 1;
  else {
    const toks = bp.all.slice(), used = new Set(); let pen = 0, fh = 0, ini = bp.ini.slice(), midDone = false;
    if (ep.L.length > 1) { const i = toks.findIndex((t) => tokEq(t, Lc)); if (i >= 0) { toks.splice(i, 1); ep.L.forEach((_, j) => used.add(j)); } }   // "DELACRUZ" = "Dela Cruz"
    const extra = [];
    toks.forEach((t, ti) => {
      let k = E.findIndex((x, i) => !used.has(i) && tokEq(t, x));
      if (k < 0 && ti === toks.length - 1 && t.length >= 3) { k = E.findIndex((x, i) => !used.has(i) && x.length > t.length && x.startsWith(t)); if (k >= 0) pen += 0.12; }   // cut short by the device
      if (k >= 0) { used.add(k); if (k >= ep.L.length) fh++; } else extra.push(t);
    });
    for (const t of extra) {
      if (ep.mi && t[0] === ep.mi && !midDone) { midDone = true; continue; }                     // the full middle name: its first letter is the employee's M.I.
      const g = [...Array(ep.F.length).keys()].map((i) => ep.L.length + i).filter((i) => !used.has(i));
      if (t.length <= 3 && g.length) { const pick = []; let gi = 0; for (const ch of t) { const m = g.slice(gi).findIndex((i) => E[i][0] === ch); if (m < 0) { pick.length = 0; break; } pick.push(g[gi + m]); gi += m + 1; } if (pick.length === t.length) { pick.forEach((i) => used.add(i)); fh++; pen += 0.04; continue; } }   // squashed initials: JC = Juan Carlos
      if (ep.mi) return 0;                                                                          // another middle name: probably another person
      pen += 0.1; if (pen > 0.25) return 0;                                                         // an extra name (the employee file has no middle name)
    }
    let initOnly = 0;
    for (const c of ini) {
      const g = [...Array(ep.F.length).keys()].map((i) => ep.L.length + i).find((i) => !used.has(i) && E[i][0] === c);
      if (g !== undefined && !(ep.mi === c && !fh)) { used.add(g); initOnly++; }                    // initial of a given name (M. ELENA, J. C.)
      else if (ep.mi && c === ep.mi) midDone = true;
      else if (ep.mi) return 0;                                                                     // a different middle initial = probably another person
    }
    if (!(fh + initOnly) || [...used].filter((i) => i < ep.L.length).length !== ep.L.length) return 0;   // the whole surname AND at least one given name (or its initial) must be there
    if (!bp.flat && !bp.L.every((t) => ep.L.some((x) => tokEq(t, x)) || tokEq(t, Lc))) return 0; // "LAST, First" must agree on the surname side
    sc = 0.6 + 0.4 * used.size / E.length - pen;
    if (!fh) sc = Math.min(sc, 0.8);                                                              // initials only: a weaker match
    if (midDone) sc += 0.05;
    return Math.max(0, Math.min(1, sc));
  }
  if (bp.ini.length && ep.mi) { if (!bp.ini.includes(ep.mi)) return 0; sc += 0.05; }
  return Math.min(1, sc);
}

/** A record with only a FIRST NAME in the file (e.g. "JUAN" or "MARIA ELENA"): it belongs to the employee whose given name it is, but only when no other employee has that first name; otherwise it is listed as "fits several" (the ID number can still decide). */
function firstNameOnly(bp, P) {
  if (!bp || !bp.flat || !bp.all.length || bp.all.length > 3) return null;
  const hit = P.filter(([, ep]) => { const used = new Set(); return ep.F.length && bp.all.every((t) => { const k = ep.F.findIndex((x, i) => !used.has(i) && tokEq(t, x)); if (k < 0) return false; used.add(k); return true; }); }).map((x) => x[0]);
  if (!hit.length) return null;
  return hit.length === 1 ? { e: hit[0], first: true } : { amb: hit };
}

function matchName(name, P) {
  const bp = bioParts(name); if (!bp) return null;
  const r = P.map(([e, ep]) => [e, nameScore(bp, ep)]).filter((x) => x[1] >= 0.7).sort((a, b) => b[1] - a[1]);
  if (!r.length) return firstNameOnly(bp, P);
  return r[1] && r[0][1] - r[1][1] < 0.1 ? { amb: r.filter((x) => r[0][1] - x[1] < 0.1).map((x) => x[0]) } : { e: r[0][0] };
}

/** Which employee does each biometric record belong to? Cached; reset with ST._dm = null. */
function dtrMap() {
  if (ST._dm) return ST._dm;
  const D = ST.dtr, emps = ST.employees; D.names ||= {}; D.link ||= {};
  const P = emps.map((e) => [e, empParts(e)]), byNo = new Map(emps.map((e) => [normNo(e.no), e])), byEmp = {}, unmatched = [];
  for (const k of Object.keys(D.days)) {
    const nm = D.names[k] || "", man = D.link[k] && emps.find((e) => e.id === D.link[k]), m = !man && nm ? matchName(nm, P) : null, idE = byNo.get(normNo(keyId(k)));
    let e = null, by = "", warn = "";
    if (man) { e = man; by = "manual"; }
    else if (m && m.e) { e = m.e; by = m.first ? "first name" : "name"; }
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

/** Records linked by hand to an employee are also kept in the main database (tab "Biometric Links") and the backup report (sheet BIOMETRIC LINKS), so they survive a new computer or a cleared browser. The whole list is sent, so an unlink is saved too. */
const dtrLinkList = () => Object.entries((ST.dtr && ST.dtr.link) || {}).map(([key, empId]) => ({ key, empId, name: ((ST.dtr.names || {})[key]) || "" }));
async function saveLinks() { try { await api("saveDtrLinks", { links: dtrLinkList() }); } catch { } }   // api() already shows the error; the link stays on this computer

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

