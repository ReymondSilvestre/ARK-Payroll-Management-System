/* ============================================================
   BIOMETRIC FILE READER - reads Excel / CSV / DAT exports of any layout into punches.
   File: js/dtr/biometric-reader.js
   ============================================================ */

/* ===== BIOMETRIC READER (any layout) ===== */
/* Reads Excel (.xlsx/.xls/.ods), CSV and text/DAT exports in these layouts:
   1) one row per day with Time In / Time Out (and break) columns   2) one punch per row (ID + date/time)
   3) separate Date and Time columns   4) calendar grid (days 1-31 across the page)   5) plain text lines.
   The header row can be anywhere, column names can be anything reasonable, and times can be 24h, AM/PM, text or Excel time cells. */
const BIO = (() => {
  const MONS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec", mon = (s) => MONS.split("|").indexOf(String(s).slice(0, 3).toLowerCase()) + 1;
  const ok = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null);
  const order = () => (ST.settings && ST.settings.dtr && ST.settings.dtr.dateOrder) || "MDY";
  const ab = (a, b, y) => { a = +a; b = +b; y = +y; if (y < 100) y += 2000; return a > 12 ? ok(y, b, a) : b > 12 ? ok(y, a, b) : order() === "DMY" ? ok(y, b, a) : ok(y, a, b); };
  const blank = (v) => v === "" || v === null || v === undefined || (typeof v === "string" && !v.trim());

  /* ---- dates ---- */
  function dateIn(s) {   // first date written inside a string -> {y,m,d,i,n}
    const find = (rx, f) => { const m = rx.exec(s); if (!m) return null; const x = f(m); return x && { ...x, i: m.index + (m[1] || "").length, n: m[0].length - (m[1] || "").length }; };
    return find(/(^|\D)(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?!\d)/, (m) => ok(+m[2], +m[3], +m[4]))
      || find(new RegExp("(^|\\D)(\\d{1,2})[\\s\\-\\/.]*(" + MONS + ")[a-z]*\\.?[\\s\\-,\\/.]*(\\d{4}|\\d{2})(?!\\d)", "i"), (m) => ok(+m[4] < 100 ? 2000 + +m[4] : +m[4], mon(m[3]), +m[2]))
      || find(new RegExp("(^|[^A-Za-z])(" + MONS + ")[a-z]*\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})(?!\\d)", "i"), (m) => ok(+m[4], mon(m[2]), +m[3]))
      || find(/(^|\D)(\d{1,2})[-\/](\d{1,2})[-\/](\d{4}|\d{2})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/(^|\D)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/, (m) => ab(m[2], m[3], m[4]))
      || find(/^\s*()(\d{4})(\d{2})(\d{2})(?:\d{4,6})?\s*$/, (m) => ok(+m[2], +m[3], +m[4]));
  }
  function dateOf(v) {
    if (v instanceof Date) return isNaN(v) ? null : ok(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === "number") {
      if (v >= 30000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
      return Number.isInteger(v) && v >= 19900101 && v <= 21001231 ? dateIn(String(v)) : null;
    }
    return typeof v === "string" ? dateIn(v) : null;
  }

  /* ---- times (minutes after midnight) ---- */
  const TRX = /(^|[^\d:.])(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?(?![\d:])/g;
  function timesIn(s) {
    const out = []; let m; TRX.lastIndex = 0;
    while ((m = TRX.exec(s))) { let h = +m[2]; const mi = +m[3]; let ap = m[5]; if (mi > 59) continue; if (ap) { if (h < 1 || h > 12) continue; ap = ap.toUpperCase(); if (ap === "P" && h < 12) h += 12; if (ap === "A" && h === 12) h = 0; } else if (h > 23) continue; out.push(h * 60 + mi); }
    return out;
  }
  function timesOf(v, loose) {   // loose: the column is known to hold times, so 0727 / 730 also count
    let r = [];
    if (v instanceof Date) r = isNaN(v) ? [] : [v.getHours() * 60 + v.getMinutes() + Math.round(v.getSeconds() / 60 * 1e4) / 1e4];
    else if (typeof v === "number") {
      if (v > 0 && v < 1) r = [Math.round(v * 1440) % 1440];
      else if (v >= 30000 && v < 80000 && v % 1) r = [Math.round((v % 1) * 1440) % 1440];
      else if (loose && Number.isInteger(v) && v >= 100 && v <= 2359 && v % 100 < 60) r = [Math.floor(v / 100) * 60 + (v % 100)];
    } else if (typeof v === "string") {
      const s = v.trim(); r = timesIn(s);
      if (!r.length && loose && /^\d{3,4}$/.test(s)) { const n = +s; if (n % 100 < 60 && n < 2400) r = [Math.floor(n / 100) * 60 + (n % 100)]; }
    }
    return r.filter((t) => t > 0);   // 00:00 is how many exports show an empty cell
  }

  /* ---- what is each column? ---- */
  const NOT = /late|under|overtime|hrs|hours?|total|(^|[^a-z])mins?([^a-z]|$)|minutes?|rate|pay|status|leave|type|dept|remark|note|shift|sched|hired|birth|dtr|summary|balance|loan/;
  function roleOf(h) {
    const s = String(h ?? "").toLowerCase().replace(/[\r\n]+/g, " ").trim(); if (!s || s.length > 40) return null;
    if (/^(m\.?\s?i\.?|middle.*)$/.test(s)) return "mi";
    if (/last.?name|surname|family.?name|^l\.?name$/.test(s)) return "last";
    if (/first.?name|given.?name|^f\.?name$/.test(s)) return "first";
    if (/date.?time|time.?stamp|punch|check.?time|log.?time|scan.?time|clock.?time/.test(s)) return "tm";
    if (/name/.test(s) && !/file|machine|device|company|branch|position|group|type|shift|leave|dept|department|sheet/.test(s)) return "name";
    if (/^(employee|emp|person|staff)$/.test(s)) return "name";
    if ((/(^|[^a-z])(id|no|num|number|code)\.?$/.test(s) || /^(id|no|userid|user id|badge|pin)\b/.test(s)) && !/type|dept|department|status|note|device|machine|terminal|leave|work|verify|event|mode|rate|rank|sss|tin|philhealth|pag|account|bank/.test(s)) return "id";
    if (/date/.test(s) && !/hired|birth|end|start|from|expir|period|created|(^|[^a-z])to$/.test(s)) return "date";
    if (/(^|[^a-z])(time|in|out|am|pm|break|lunch|check|clock|arriv|depart|punch|scan|log)([^a-z]|$)/.test(s) && !NOT.test(s) && !/(^|[^a-z])ot([^a-z]|$)|code/.test(s)) return "tm";
    return NOT.test(s) || /(^|[^a-z])ot([^a-z]|$)/.test(s) ? "x" : null;
  }
  function findHeader(rows) {
    let best = -1, bs = 1;
    rows.slice(0, 40).forEach((r, i) => { let sc = 0, t = false, d = false; for (const c of r || []) { if (typeof c !== "string") continue; const ro = roleOf(c); if (ro && ro !== "x") { sc++; if (ro === "tm") t = true; if (ro === "date") d = true; } } if ((t || d) && sc > bs) { best = i; bs = sc; } });
    return best;
  }

  /* ---- layout A: a table (one row per day, or one punch per row) ---- */
  function table(rows, push) {
    const hi = findHeader(rows), start = hi + 1; let N = 0; rows.slice(0, 300).forEach((r) => { N = Math.max(N, (r || []).length); });
    const role = new Array(N).fill(null), blankHead = new Array(N).fill(true);
    if (hi >= 0) rows[hi].forEach((h, j) => { if (!blank(h)) blankHead[j] = false; role[j] = roleOf(h); });
    const sample = rows.slice(start, start + 80);
    for (let j = 0; j < N; j++) {      // columns the header could not explain: look at the data itself
      if (role[j] && role[j] !== "x") continue; if (role[j] === "x") continue;
      const v = sample.map((r) => (r || [])[j]).filter((x) => !blank(x)); if (v.length < 2) continue;
      const share = (f) => v.filter(f).length / v.length;
      if (share((x) => timesOf(x, false).length > 0) >= 0.7) role[j] = "tm";
      else if (share((x) => !!dateOf(x)) >= 0.7) role[j] = "date";
      else if (blankHead[j]) {
        const idLike = (x) => /^[A-Za-z]{0,6}[-_ ]?\d{1,12}$/.test(String(x).trim()), nameLike = (x) => typeof x === "string" && /[A-Za-z]{3,}/.test(x) && !timesOf(x, false).length && !dateOf(x);
        if (!role.includes("id") && share(idLike) >= 0.8) role[j] = "id";
        else if (!role.includes("name") && share(nameLike) >= 0.8 && new Set(v.map((x) => String(x).trim().toLowerCase())).size >= 3) role[j] = "name";
      }
    }
    const idx = (k) => role.map((r, j) => (r === k ? j : -1)).filter((j) => j >= 0), C = { id: idx("id"), name: idx("name"), date: idx("date"), tm: idx("tm"), last: idx("last")[0] ?? -1, first: idx("first")[0] ?? -1, mi: idx("mi")[0] ?? -1 };
    if (!C.tm.length && !C.date.length) return;
    if (!C.id.length && !C.name.length && !(C.last >= 0 && C.first >= 0)) return;
    let cur = null;
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]; if (!r || !r.some((x) => !blank(x))) continue;
      const cell = (j) => (blank(r[j]) ? "" : r[j]);
      let id = ""; for (const j of C.id) { const v = String(cell(j)).trim(); if (v) { id = v; break; } }
      let nm = ""; if (C.last >= 0 && C.first >= 0) nm = `${cell(C.last)}, ${cell(C.first)} ${C.mi >= 0 ? cell(C.mi) : ""}`.replace(/^[\s,]+|[\s,]+$/g, ""); else for (const j of C.name) { const v = String(cell(j)).trim(); if (v) { nm = v; break; } }
      let date = null; for (const j of C.date) { date = dateOf(cell(j)); if (date) break; }
      const ts = [];
      for (const j of C.tm) { const v = cell(j); if (v === "") continue; const t = timesOf(v, true); if (!t.length) continue; const cd = dateOf(v); t.forEach((m) => ts.push([m, cd])); }
      if (!ts.length) for (const j of C.date) for (const m of timesOf(cell(j), false)) ts.push([m, null]);   // a "Date" column that also holds the time
      if (!id && !nm) { if (date && !ts.length) cur = date; continue; }   // a line like "Date: 11/11/2026" above a group of rows
      if (!ts.length) continue;
      for (const [m, cd] of ts) { const d = cd || date || cur; if (d) push(id, new Date(d.y, d.m - 1, d.d, Math.floor(m / 60), m % 60), nm); }
    }
  }

  /* ---- layout B: calendar grid, days 1-31 (or dates) across the top, several times in each cell ---- */
  let warn = "";
  function grid(rows, push) {
    let hi = -1, cols = [];
    for (let i = 0; i < Math.min(rows.length, 40) && hi < 0; i++) {
      const r = rows[i] || [], dt = [], dn = [];
      r.forEach((c, j) => {
        const s = String(c ?? "").trim(), m = /^(\d{1,2})(?:[\s\r\n]+[A-Za-z]{2,9}\.?)?$/.exec(s);
        if (m && +m[1] >= 1 && +m[1] <= 31) dn.push([j, +m[1]]);
        else if (!timesOf(c, false).length && !blank(c)) { const d = dateOf(c); if (d && (typeof c !== "string" || dateIn(c).n >= s.length - 1)) dt.push([j, d]); }
      });
      const asc = (a) => a.length >= 7 && a.slice(1).filter((x, k) => x[1] > a[k][1]).length >= (a.length - 1) * 0.8;
      if (dt.length >= 5) { hi = i; cols = dt.map(([j, d]) => ({ j, d })); }
      else if (asc(dn)) { hi = i; cols = dn.map(([j, d]) => ({ j, day: d })); }
    }
    if (hi < 0) return;
    if (cols[0].day !== undefined) {   // only day numbers: the month comes from the title lines
      const txt = rows.slice(0, hi + 3).flat().filter((x) => x !== "" && x != null).map((x) => (typeof x === "number" && x >= 30000 && x < 80000 ? (() => { const d = dateOf(x); return d ? `${d.y}-${d.m}-${d.d}` : ""; })() : String(x))).join(" | ");
      let y = 0, mo = 0, m;
      if ((m = /(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      else if ((m = new RegExp("(" + MONS + ")[a-z]*\\.?[\\s,\\-]*(\\d{4})", "i").exec(txt))) { y = +m[2]; mo = mon(m[1]); }
      else if ((m = new RegExp("(\\d{4})[\\s,\\-]*(" + MONS + ")", "i").exec(txt))) { y = +m[1]; mo = mon(m[2]); }
      else if ((m = /(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/.exec(txt))) { const d = ab(m[1], m[2], m[3]); if (d) { y = d.y; mo = d.m; } }
      else if ((m = /(\d{4})[-\/.](\d{1,2})(?![\d])/.exec(txt))) { y = +m[1]; mo = +m[2]; }
      if (!y || mo < 1 || mo > 12) { warn = "This looks like a calendar-style report (days 1-31 across the page) but the month and year could not be found. Type the month, for example 2026-11, in a cell above the table and upload again."; return; }
      let prev = 0; for (const c of cols) { if (c.day < prev) { mo++; if (mo > 12) { mo = 1; y++; } } prev = c.day; c.d = ok(y, mo, c.day); }
    }
    const first = Math.min(...cols.map((c) => c.j)), left = {}; (rows[hi] || []).forEach((h, j) => { if (j < first) { const ro = roleOf(h); if (ro === "id" || ro === "name") left[j] = ro; } });
    const LI = /^\s*(?:user\s*)?(?:id|no\.?|emp(?:loyee)?\s*(?:id|no\.?)|badge(?:\s*(?:id|no\.?))?)\s*[:\uFF1A]\s*(.*)$/i, LN = /^\s*(?:emp(?:loyee)?\s*)?name\s*[:\uFF1A]\s*(.*)$/i;
    const nextNZ = (r, j) => { for (let k = j + 1; k < r.length; k++) { const s = String(r[k] ?? "").trim(); if (s) return LI.test(s) || LN.test(s) ? "" : s; } return ""; };
    let cur = { id: "", nm: "" };
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || []; let id = "", nm = "";
      for (let j = 0; j < r.length; j++) { const s = String(r[j] ?? "").trim(); let m; if ((m = LI.exec(s))) id = m[1].trim() || nextNZ(r, j); else if ((m = LN.exec(s))) nm = m[1].trim() || nextNZ(r, j); }
      for (const j in left) { const v = String(r[j] ?? "").trim(); if (!v) continue; if (left[j] === "id" && !id) id = v; if (left[j] === "name" && !nm) nm = v; }
      if (id) cur = { id, nm }; else if (nm) cur = { id: cur.id, nm };
      if (!cur.id && !cur.nm) continue;
      for (const c of cols) { if (!c.d) continue; for (const m of timesOf(r[c.j], false)) push(cur.id, new Date(c.d.y, c.d.m - 1, c.d.d, Math.floor(m / 60), m % 60), cur.nm); }
    }
  }

  /* ---- layout C: text / DAT / CSV ---- */
  function splitLine(l, d) { const out = []; let c = "", q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === d && !q) { out.push(c.trim()); c = ""; } else c += ch; } out.push(c.trim()); return out; }
  const STOP = /^(in|out|check|(check|clock|time)[-_]?(in|out)|c\/(in|out)|fp|face|card|pw|normal|ot|am|pm|i|o)$/i;
  function scanLine(ln, push) {
    const dm = dateIn(ln); if (!dm) return;
    const rest0 = ln.slice(0, dm.i) + " " + ln.slice(dm.i + dm.n), ts = timesIn(rest0); if (!ts.length) return;
    const toks = rest0.replace(TRX, " ").split(/[\s|;]+/).filter(Boolean), id = toks.find((t) => /^[A-Za-z]{0,6}[-_]?\d{1,12}$/.test(t)) || "";
    const nm = toks.filter((t) => t !== id && /[A-Za-z]{2,}/.test(t) && !STOP.test(t)).join(" ");
    if (!id && !nm) return;
    ts.forEach((m) => { if (m > 0) push(id, new Date(dm.y, dm.m - 1, dm.d, Math.floor(m / 60), m % 60), nm); });
  }
  function text(txt, push) {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim()); if (!lines.length) return;
    const smp = lines.slice(0, 12), delim = ["\t", ";", "|", ","].find((d) => smp.filter((l) => l.includes(d)).length >= Math.ceil(smp.length * 0.8));
    const rows = delim ? lines.map((l) => splitLine(l, delim)) : null;
    let n = 0; const counted = (...x) => { n++; push(...x); };
    const viaRows = () => { if (rows) sheet(rows, counted); }, viaLines = () => lines.forEach((l) => scanLine(l, counted));
    const [a, b] = rows && (delim === "\t" || findHeader(rows) >= 0) ? [viaRows, viaLines] : [viaLines, viaRows];
    a(); if (!n) b();
  }
  function sheet(rows, push) { let n = 0; const p = (...x) => { n++; push(...x); }; grid(rows, p); if (!n) table(rows, p); }

  async function readText(f) {
    const b = new Uint8Array(await f.arrayBuffer());
    if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(b.subarray(2));
    if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(b.subarray(2));
    return new TextDecoder("utf-8").decode(b).replace(/^\uFEFF/, "");
  }
  return { sheet, text, readText, take: () => { const w = warn; warn = ""; return w; } };
})();

async function readPunches(f) {
  const out = [], push = (id, dt, nm) => {
    nm = String(nm ?? "").replace(/\s+/g, " ").trim(); if (!/[A-Za-z]/.test(nm)) nm = "";
    const has = id !== "" && id != null && String(id).trim() !== "", k = has ? normNo(id) : (nm ? "n:" + nameNorm(nm).replace(/,/g, " ").replace(/\s+/g, " ") : "");
    if (k && dt && !isNaN(dt)) out.push([k, dt, nm]);
  };
  BIO.take();
  const buf = await f.arrayBuffer(), h = new Uint8Array(buf.slice(0, 8)), isZip = h[0] === 0x50 && h[1] === 0x4b, isOle = h[0] === 0xd0 && h[1] === 0xcf;
  if (isZip || isOle) {
    const wb = XLSX.read(buf, { type: "array", raw: true });
    for (const n of wb.SheetNames) BIO.sheet(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" }), push);
  } else BIO.text(await BIO.readText({ arrayBuffer: async () => buf }), push);
  const w = BIO.take(); if (!out.length && w) throw new Error(w);
  return out;
}

