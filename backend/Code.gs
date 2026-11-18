/* Payroll Management System - Google Apps Script backend
   PRIVATE DATABASE: the main database spreadsheet is never shown in the web app. Only the owner (the default account) can reveal it,
   and only after typing the database password (set it once inside the app: Users tab > Main database). Run lockDatabase() once from the editor
   so the file itself is private to your Google account.
   BACKUP REPORT: a second, readable spreadsheet (EMPLOYEE, EMPLOYEE PAYSLIP, PAYSLIP SUMMARY, EMPLOYEE CASH ADVANCE RECORD, SSS, PHILHEALTH, PAGIBIG, TAX,
   13TH MONTH JAN-JUN, 13TH MONTH JUL-DEC) is rebuilt from the database after every saved payroll, from Reports > Update backup report, and
   daily if you run installDailyBackup() once. */
/* Deploy: Extensions > Apps Script > paste this file > Deploy > Manage deployments > Edit > New version > Web app
           (Execute as: Me, Who has access: Anyone). Run setup() once from the editor to authorize and create the spreadsheet.
   A spreadsheet "Payroll Management System - Database" is created automatically in your Google Drive,
   with readable tabs: Employees, Payroll Runs, Payslips, Settings. */

var DB_NAME = 'Payroll Management System - Database';
var DEFAULT_EMAIL = 'reymonde.silvestre@gmail.com', DEFAULT_PASS = 'payroll123';
var TABS = {
  Employees: ['ID', 'Employee No', 'Last name', 'First name', 'M.I.', 'Name', 'Birthday', 'Gender', 'Civil status', 'Position', 'Department', 'Employment type', 'Date hired', 'Status', 'SSS No', 'PhilHealth No', 'Pag-IBIG No', 'TIN', 'Category', 'Monthly basic', 'Daily rate', 'Hourly rate', 'Email', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Tax', 'CA balance', 'CA per payday', 'Cash advance (JSON)', 'Allowances (JSON)', 'Loans (JSON)', 'Updated', 'Photo'],
  'Payroll Runs': ['Run ID', 'Period', 'Pay date', 'Employees', 'Gross', 'Deductions', 'Net pay', 'Saved by', 'Saved at', 'Group', 'Status'],
  Payslips: ['Run ID', 'Period', 'Employee No', 'Name', 'Position', 'Basic', 'Allowances', 'Overtime', 'Other earnings', 'Holiday pay', 'Gross', 'Absent', 'Late', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Tax', 'Loans/Other', 'Cash advance', 'Total deductions', 'Net pay', 'Detail (JSON)'],
  Settings: ['Key', 'Value'],
  Leaves: ['ID', 'Employee ID', 'Employee No', 'Name', 'Type', 'Paid', 'From', 'To', 'Days', 'Reason', 'Status', 'Filed by', 'Filed at'],
  'Daily Attendance Logs': ['Date', 'Day', 'Employee No', 'Name', 'Department', 'Group', 'Time in', 'Time out', 'Hours worked', 'Late (min)', 'Early in (min)', 'Early out (min)', 'Overtime (min)', 'Status', 'Remarks'],
  'Summary of Attendance': ['Employee No', 'Name', 'Department', 'Group', 'From', 'To', 'Schedule', 'Days present', 'Days absent', 'Half days', 'Late (days)', 'Late (min)', 'Early in (days)', 'Early in (min)', 'Early out (days)', 'Overtime (hrs)', 'Hours worked', 'Overtime allowed'],
  'Cash Advances': ['Employee No', 'Name', 'Department', 'Group', 'Outstanding balance', 'Deduct each pay', 'As of'],
  'Cash Loans': ['Employee No', 'Name', 'Department', 'Group', 'Loan type', 'Description', 'Per month', 'Balance', 'Status', 'As of'],
  Users: ['ID', 'Name', 'Email', 'Role', 'Department', 'Photo', 'Password hash', 'Salt', 'Created', 'Active'],
  'Overtime File': ['ID', 'Employee ID', 'Employee No', 'Name', 'Date', 'Hours', 'Reason', 'Filed by', 'Filed at'],
  'Payslip Summary': ['Run ID', 'Period', 'Pay date', 'Group', 'Employee No', 'Employee name', 'Salary (net pay)', 'Signature']
};
var HR_ACTIONS = ['bootstrap', 'saveLeave', 'deleteLeave', 'otAdd', 'otRemove'];   // what an HR account may call: leave and the overtime file, nothing else
var ROLES = ['payroll', 'hr'];                                                       // roles that can be given to a new account ('admin' exists only for the default owner)
var SCHEMA_V = 'v6-2026-11-18';                                                      // change this text when TABS change: the tabs are then checked once, not on every request

function setup() { var ss = db_(); resetDefaultUser(); Logger.log('DATABASE IN USE: ' + ss.getUrl()); return 'Database ready (private, only visible to you here in the editor): ' + ss.getUrl(); }
function showDatabaseLink() { var u = db_().getUrl(); Logger.log('DATABASE IN USE: ' + u); return u; }   // editor only: View > Logs (or Execution log) shows the link

/* USE YOUR OWN SPREADSHEET AS THE MAIN DATABASE:
   1) paste the link (or ID) of your spreadsheet between the quotes below, 2) save, 3) run connectDatabase() once.
   The app then saves everything into THAT spreadsheet: tabs Employees, Payroll Runs, Payslips, Settings, Leaves, Users... are added to it automatically. */
var MY_DATABASE_URL = 'https://docs.google.com/spreadsheets/d/1-bbKmo8rQNnSrOM4Fw_A2QWCchiU7iu8xzmPxypCAeQ/edit?usp=sharing';
function connectDatabase() {
  var m = String(MY_DATABASE_URL).match(/[-\w]{25,}/);
  if (!m) throw new Error('Paste your spreadsheet link into MY_DATABASE_URL (top of this function) first.');
  var ss = SpreadsheetApp.openById(m[0]);
  PropertiesService.getScriptProperties().setProperty('DB_ID', m[0]); PropertiesService.getScriptProperties().deleteProperty('SCHEMA_V');
  db_(); resetDefaultUser();
  Logger.log('CONNECTED. The app now saves to: ' + ss.getUrl());
  return 'Connected: ' + ss.getUrl();
}

/* Run ONCE from the editor: makes the database file private (no link sharing, no other editors or viewers). Only your Google account can open it. */
function lockDatabase() {
  var f = DriveApp.getFileById(db_().getId());
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  try { f.setShareableByEditors(false); } catch (e) { }
  f.getEditors().forEach(function (u) { try { f.removeEditor(u); } catch (e) { } });
  f.getViewers().forEach(function (u) { try { f.removeViewer(u); } catch (e) { } });
  return 'The database is now private. Only ' + f.getOwner().getEmail() + ' can open it.';
}

var SS_ = null;
/* FAST: the spreadsheet is opened once per request, and the tabs / headers / formats are checked only when SCHEMA_V changes (before, every request re-checked every tab = many seconds). Run refreshSchema() to force the check. */
function db_() {
  if (SS_) return SS_;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('DB_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(DB_NAME); props.setProperty('DB_ID', ss.getId()); props.deleteProperty('SCHEMA_V'); }
  if (props.getProperty('SCHEMA_V') !== SCHEMA_V) { ensureSchema_(ss); props.setProperty('SCHEMA_V', SCHEMA_V); }
  SS_ = ss; return ss;
}
function refreshSchema() { PropertiesService.getScriptProperties().deleteProperty('SCHEMA_V'); SS_ = null; db_(); return 'Tabs checked.'; }
function ensureSchema_(ss) {
  var old = ss.getSheetByName('Employees');   // an Employees tab made by an older version has other columns: keep it as a backup and start a new one
  if (old && old.getRange(1, 3).getValue() !== 'Last name') old.setName('Employees (old ' + Utilities.formatDate(new Date(), 'Asia/Manila', 'MMdd-HHmm') + ')');
  var first = ss.getSheets()[0];
  Object.keys(TABS).forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (!sh) { sh = (first && first.getName() === 'Sheet1' && ss.getSheets().length === 1) ? first.setName(n) : ss.insertSheet(n); }
    if (sh.getLastRow() === 0) {
      var h = TABS[n]; sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff');
      sh.setFrozenRows(1); sh.autoResizeColumns(1, h.length);
    }
    if (n === 'Payroll Runs' && sh.getRange(1, 10).getValue() !== 'Group') sh.getRange(1, 10).setValue('Group').setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff');   // older runs tab: add the Group column
    if (n === 'Payroll Runs' && sh.getRange(1, 11).getValue() !== 'Status') sh.getRange(1, 11).setValue('Status').setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff');   // older runs tab: add the Status column (runs without a status count as Finalized)
    if (n === 'Users') sh.getRange(1, 1, sh.getMaxRows(), 8).setNumberFormat('@');
    if (n === 'Leaves') [2, 3, 7, 8, 13].forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });   // ids and dates stay as typed
    if (n === 'Employees' && sh.getRange(1, 3).getValue() === 'Last name' && sh.getRange(1, 34).getValue() !== 'Photo') {   // older Employees tab: add the Photo column
      if (sh.getMaxColumns() < 34) sh.insertColumnsAfter(sh.getMaxColumns(), 34 - sh.getMaxColumns());
      sh.getRange(1, 34).setValue('Photo').setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff');
    }
    if (n === 'Overtime File') [1, 2, 3, 5, 9].forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });
    if (n === 'Payslip Summary') [1, 2, 3, 5].forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });
    if (n === 'Employees') [2, 7, 13, 15, 16, 17, 18].forEach(function (c) { sh.getRange(2, c, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@'); });   // numbers like SSS / TIN keep their zeros, dates stay as typed
  });
  }
function rows_(sh) { var v = sh.getDataRange().getValues(), h = v.shift(); return v.map(function (r, i) { var o = { _row: i + 2 }; h.forEach(function (k, j) { o[k] = r[j]; }); return o; }); }
function hash_(p, salt) { return 'h' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ':' + String(p)).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }   // 'h' + hex: always text, never turned into a number or formula by Sheets
function uid_() { return 'x' + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
/* ===================== ONE DATABASE =====================
   Everything lives in ONE spreadsheet in your Drive ("Payroll Management System - Database"): tabs Employees, Payroll Runs, Payslips, Settings and Users.
   Passwords are stored only as salted hashes. Do not share the spreadsheet with people who should not see payroll. */
function users_() {
  return rows_(db_().getSheetByName('Users')).filter(function (r) { return r.ID; }).map(function (r) {
    return { ID: String(r.ID), Name: r.Name, Email: String(r.Email), Role: r.Role, Dept: r.Department, Photo: r.Photo, 'Password hash': String(r['Password hash']), Salt: String(r.Salt), Created: r.Created, Active: String(r.Active) };
  });
}
function userPut_(u) {
  var sh = db_().getSheetByName('Users'), row = [String(u.ID), u.Name, String(u.Email).toLowerCase(), u.Role, u.Dept || '', u.Photo || '', u['Password hash'], u.Salt, u.Created, u.Active],
    ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], i;
  for (i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(u.ID)) { sh.getRange(i + 2, 1, 1, row.length).setValues([row]); return; }
  sh.appendRow(row);
}
function userDel_(id) { var sh = db_().getSheetByName('Users'), ids = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], i; for (i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(id)) sh.deleteRow(i + 2); }
function seedUser_() {
  if (users_().some(function (u) { return String(u.Email).toLowerCase() === DEFAULT_EMAIL; })) return;
  var salt = uid_(); userPut_({ ID: uid_(), Name: 'Reymonde Silvestre', Email: DEFAULT_EMAIL, Role: 'admin', 'Password hash': hash_(DEFAULT_PASS, salt), Salt: salt, Created: new Date(), Active: 'yes' });
}
/* If the default account cannot sign in: run this function once from the editor (Run > resetDefaultUser). It recreates the default user with the default password. */
function resetDefaultUser() {
  users_().filter(function (u) { return String(u.Email).toLowerCase() === DEFAULT_EMAIL; }).forEach(function (u) { userDel_(u.ID); });
  seedUser_(); return 'Default user reset: ' + DEFAULT_EMAIL + ' / ' + DEFAULT_PASS;
}

function doGet() { return out_({ ok: true, data: 'Payroll Management System API is running.', version: 'hr-fast-2026-11-18' }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var q = JSON.parse(e.postData.contents), ss = db_(), props = PropertiesService.getScriptProperties();
    if (!props.getProperty('SEEDED')) { seedUser_(); props.setProperty('SEEDED', '1'); }
    var cache = CacheService.getScriptCache();
    if (q.action === 'login') {
      var em0 = String(q.email || '').trim().toLowerCase(), u = users_().filter(function (x) { return String(x.Email).toLowerCase() === em0 && String(x.Active) !== 'no'; })[0];
      if (!u) return out_({ ok: false, error: 'No active account with that email.' });
      if (hash_(q.password || '', String(u.Salt)) !== String(u['Password hash'])) return out_({ ok: false, error: 'Wrong password for that account.' });
      var t = Utilities.getUuid(); cache.put('t_' + t, JSON.stringify({ id: u.ID, name: u.Name, email: u.Email, role: u.Role }), 21600);
      return out_({ ok: true, data: { token: t, user: { name: u.Name, email: u.Email, role: u.Role, dept: u.Dept || '', photo: u.Photo || '', isOwner: String(u.Email).toLowerCase() === DEFAULT_EMAIL } } });
    }
    var s = cache.get('t_' + q.token); if (!s) return out_({ ok: false, error: 'unauthenticated' });
    var me = JSON.parse(s), A = q.action, d = q.data || {};
    if (cache.get('off_' + me.id)) return out_({ ok: false, error: 'unauthenticated' });   // account disabled or deleted: the session ends at once
    var rr = cache.get('role_' + me.id); if (rr) me.role = rr;                                // role changed since sign-in
    if (String(me.role) === 'hr' && HR_ACTIONS.indexOf(A) < 0) return out_({ ok: false, error: 'Your HR account can only use Leave and the Overtime File.' });
    var Emp = ss.getSheetByName('Employees'), Run = ss.getSheetByName('Payroll Runs'), Sl = ss.getSheetByName('Payslips'), St = ss.getSheetByName('Settings'), Sm = ss.getSheetByName('Payslip Summary');
    var res = null;

    if (A === 'bootstrap') {
      var st0 = rows_(St).filter(function (r) { return r.Key === 'settings'; })[0], setObj = null;
      try { setObj = st0 ? JSON.parse(st0.Value) : null; } catch (e1) { setObj = null; }
      var ot = otRows_(ss);
      if (setObj && setObj.otFile !== undefined) {   // the overtime file used to live inside the settings: move it to its own tab once
        if (!ot.length && setObj.otFile && setObj.otFile.length) { otPut_(ss, setObj.otFile, me.name); ot = otRows_(ss); }
        delete setObj.otFile; St.getRange(st0._row, 2).setValue(JSON.stringify(setObj));
      }
      var lvs = rows_(ss.getSheetByName('Leaves')).filter(function (r) { return r.ID; }).map(lvOut_);
      if (String(me.role) === 'hr') {   // HR sees only what Leave and the Overtime File need: no salaries, no government numbers, no payroll settings
        var sOut = hrSettings_(setObj); sOut.otFile = ot;
        res = { settings: sOut, employees: rows_(Emp).filter(function (r) { return r.ID; }).map(function (r) { var o = empOut_(r); return { id: o.id, no: o.no, last: o.last, first: o.first, mi: o.mi, name: o.name, position: o.position, dept: o.dept, etype: o.etype, status: o.status, category: o.category, photo: '' }; }), runs: [], leaves: lvs, backup: '' };
      } else {
        if (setObj) setObj.otFile = ot;
        res = { settings: setObj, employees: rows_(Emp).map(empOut_), runs: runsOut_(Run), leaves: lvs, backup: props.getProperty('BK_URL') || '' };
      }
    } else if (A === 'listRuns') {
      res = runsOut_(Run);
    } else if (A === 'saveSettings') {
      delete d.otFile;   // the overtime file has its own tab (saved by otAdd / otRemove), so saving the settings can never wipe what HR filed
      var json0 = JSON.stringify(d);
      if (json0.length > 49000) return out_({ ok: false, error: 'The settings are too big for one spreadsheet cell (' + json0.length + ' characters). Remove old holidays or unused shifts.' });
      var r0 = rows_(St).filter(function (r) { return r.Key === 'settings'; })[0];
      if (r0) St.getRange(r0._row, 2).setValue(json0); else St.appendRow(['settings', json0]);
      res = true;
    } else if (A === 'saveEmployees') {           // add / edit / bulk upload: matched by Employee No, otherwise by last + first name. One read and one write, photos are never read back.
      var NC = 33, lastE = Emp.getLastRow(), blk = lastE > 1 ? Emp.getRange(2, 1, lastE - 1, NC).getValues() : [], added = 0, updated = 0, touched = [], fresh = [], photoSet = [], low = function (v) { return String(v || '').trim().toLowerCase(); };
      (d.list || []).forEach(function (x) {
        var mi = -1, i;
        for (i = 0; i < blk.length; i++) { var c = blk[i]; if ((x.no && String(c[1]) === String(x.no)) || (!x.no && low(c[2]) === low(x.last) && low(c[3]) === low(x.first))) { mi = i; break; } }
        var ca = x.ca || {}, nm = (x.last || '') + ', ' + (x.first || '') + (x.mi ? ' ' + String(x.mi).replace(/\.?$/, '.') : ''), eid = mi >= 0 ? blk[mi][0] : uid_();
        var row = [eid, x.no || '', x.last || '', x.first || '', x.mi || '', nm, x.birthday || '', x.gender || '', x.civil || '', x.position || '', x.dept || '', x.etype || '', x.hired || '', x.status || 'Active', x.sssNo || '', x.philhealthNo || '', x.pagibigNo || '', x.tin || '', x.category || '',
          +x.basicMonthly || 0, +x.dailyRate || 0, +x.hourlyRate || 0, x.email || '', x.sss === false ? 'no' : 'yes', x.philhealth === false ? 'no' : 'yes', x.pagibig === false ? 'no' : 'yes', x.tax === false ? 'no' : 'yes',
          +ca.balance || 0, +ca.perPay || 0, JSON.stringify(ca), JSON.stringify(x.allowances || []), JSON.stringify(x.deductions || []), new Date()];
        var ph = x.photo !== undefined ? String(x.photo || '') : undefined;
        if (mi >= 0) { blk[mi] = row; updated++; if (ph !== undefined) photoSet.push([mi + 2, ph]); }
        else { fresh.push(row.concat([ph || ''])); blk.push(row); added++; }
        touched.push({ id: eid, no: row[1], last: row[2], first: row[3], mi: row[4], name: nm, birthday: row[6], gender: row[7], civil: row[8], position: row[9], dept: row[10], etype: row[11], hired: row[12], status: row[13],
          sssNo: row[14], philhealthNo: row[15], pagibigNo: row[16], tin: row[17], category: row[18], basicMonthly: row[19], dailyRate: row[20], hourlyRate: row[21], email: row[22], photo: ph,
          sss: row[23] !== 'no', philhealth: row[24] !== 'no', pagibig: row[25] !== 'no', tax: row[26] !== 'no', ca: ca, allowances: x.allowances || [], deductions: x.deductions || [] });
      });
      if (updated) Emp.getRange(2, 1, lastE - 1, NC).setValues(blk.slice(0, lastE - 1));   // all existing rows in ONE write
      if (fresh.length) { var st1 = Emp.getLastRow() + 1; if (Emp.getMaxRows() < st1 + fresh.length) Emp.insertRowsAfter(Emp.getMaxRows(), st1 + fresh.length - Emp.getMaxRows()); Emp.getRange(st1, 1, fresh.length, NC + 1).setValues(fresh); }
      photoSet.forEach(function (p) { Emp.getRange(p[0], 34).setValue(p[1]); });
      res = { added: added, updated: updated, partial: true, employees: touched };   // only the saved people come back; the app merges them into its list (a full list with every photo made each save slow)
    } else if (A === 'deleteEmployee') {
      var e0 = rows_(Emp).filter(function (r) { return r.ID === d.id; })[0]; if (e0) Emp.deleteRow(e0._row); res = true;
    } else if (A === 'saveRun') {
      var id = d.id || ('RUN-' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyyMMdd-HHmmss') + '-' + uid_().slice(1, 4)), exG = groups_(Run, 1, id);
      if (exG.length && d.id && String(Run.getRange(exG[0][0], 11).getValue() || 'Finalized') !== 'Draft') return out_({ ok: false, error: 'This payroll run is already finalized and locked. Delete it first if it must be redone.' });
      delGroups_(Run, 1, id); delGroups_(Sl, 1, id); delGroups_(Sm, 1, id);   // a few block deletes (before: one deleteRow call per payslip)
      Run.appendRow([id, d.period, d.payDate, d.slips.length, d.gross, d.ded, d.net, me.name, new Date(), d.group || '', d.status === 'Draft' ? 'Draft' : 'Finalized']);
      Run.getRange(Run.getLastRow(), 5, 1, 3).setNumberFormat('#,##0.00');
      var rowsOut = d.slips.map(function (p) { var c = p.calc; return [id, d.period, p.no, p.name, p.position, c.basic, c.allow, c.ot, (Number(c.otherEarn) || 0) + (Number(c.wfhPay) || 0), c.holPay, c.gross, (Number(c.absent) || 0) + (Number(c.wfhDed) || 0), c.late, c.sssEe, c.phicEe, c.hdmfEe, c.tax, c.other, c.caDed, c.totalDed, c.net, JSON.stringify(c)]; });
      if (rowsOut.length) { var s1 = Sl.getLastRow() + 1; if (Sl.getMaxRows() < s1 + rowsOut.length) Sl.insertRowsAfter(Sl.getMaxRows(), s1 + rowsOut.length - Sl.getMaxRows()); Sl.getRange(s1, 1, rowsOut.length, rowsOut[0].length).setValues(rowsOut); Sl.getRange(s1, 6, rowsOut.length, 16).setNumberFormat('#,##0.00'); }
      // PAYSLIP SUMMARY (main database): employee name, salary (net pay) and a blank Signature column for each payslip of the run
      var sumRows = d.slips.map(function (p) { return [id, String(d.period || ''), String(d.payDate || ''), grp_(d.group), String(p.no || ''), String(p.name || ''), num_(p.calc.net), '']; });
      if (sumRows.length) { var s2 = Sm.getLastRow() + 1; if (Sm.getMaxRows() < s2 + sumRows.length) Sm.insertRowsAfter(Sm.getMaxRows(), s2 + sumRows.length - Sm.getMaxRows()); Sm.getRange(s2, 1, sumRows.length, 8).setValues(sumRows); Sm.getRange(s2, 7, sumRows.length, 1).setNumberFormat('#,##0.00'); }
      res = { id: id, runs: runsOut_(Run) };
      markBackup_();   // the backup report is rebuilt in the background about a minute later: the save no longer waits for it
    } else if (A === 'getRun') {
      res = []; groups_(Sl, 1, d.id).forEach(function (g) {   // read only this run's rows (before: the whole Payslips tab on every click)
        Sl.getRange(g[0], 1, g[1], 22).getValues().forEach(function (r) { res.push({ no: txt_(r[2]), name: r[3], position: r[4], calc: JSON.parse(r[21]) }); });
      });
    } else if (A === 'deleteRun') {
      delGroups_(Run, 1, d.id); delGroups_(Sl, 1, d.id); delGroups_(Sm, 1, d.id); res = true;
      markBackup_();
    } else if (A === 'listUsers') {
      res = users_().map(function (u) { return { id: u.ID, name: u.Name, email: u.Email, role: u.Role || 'payroll', dept: u.Dept || '', photo: u.Photo || '', active: String(u.Active) !== 'no', created: u.Created }; });
    } else if (A === 'addUser') {                 // every payroll user can create accounts
      var em = String(d.email || '').trim().toLowerCase();
      if (!em || !d.password || String(d.password).length < 6) return out_({ ok: false, error: 'Email and a password of at least 6 characters are required.' });
      if (users_().some(function (u) { return String(u.Email).toLowerCase() === em; })) return out_({ ok: false, error: 'That email already has an account.' });
      var salt = uid_(); userPut_({ ID: uid_(), Name: d.name || em, Email: em, Role: ROLES.indexOf(d.role) >= 0 ? d.role : 'payroll', Dept: d.dept || '', Photo: d.photo || '', 'Password hash': hash_(d.password, salt), Salt: salt, Created: new Date(), Active: 'yes' }); res = true;
    } else if (A === 'updateUser') {               // edit name, email, department and the 2x2 picture of an account
      var u4 = users_().filter(function (u) { return u.ID === d.id; })[0]; if (!u4) return out_({ ok: false, error: 'User not found.' });
      var em4 = String(d.email || u4.Email).trim().toLowerCase();
      if (em4 !== String(u4.Email).toLowerCase()) {
        if (String(u4.Email).toLowerCase() === DEFAULT_EMAIL) return out_({ ok: false, error: 'The email of the default account cannot be changed.' });
        if (users_().some(function (u) { return u.ID !== u4.ID && String(u.Email).toLowerCase() === em4; })) return out_({ ok: false, error: 'That email already has an account.' });
      }
      if (ROLES.indexOf(d.role) >= 0 && String(u4.Email).toLowerCase() !== DEFAULT_EMAIL && String(u4.ID) !== String(me.id)) { u4.Role = d.role; cache.put('role_' + u4.ID, d.role, 21600); }
      u4.Name = d.name || u4.Name; u4.Email = em4; u4.Dept = d.dept || ''; if (d.photo !== undefined) u4.Photo = d.photo || '';
      userPut_(u4);
      res = { id: u4.ID, name: u4.Name, email: u4.Email, role: u4.Role, dept: u4.Dept || '', photo: u4.Photo || '' };
      if (String(u4.ID) === String(me.id)) cache.put('t_' + q.token, JSON.stringify({ id: u4.ID, name: u4.Name, email: u4.Email, role: u4.Role }), 21600);
    } else if (A === 'setPassword') {
      var u1 = users_().filter(function (u) { return u.ID === d.id; })[0]; if (!u1 || !d.password || String(d.password).length < 6) return out_({ ok: false, error: 'Password must be at least 6 characters.' });
      var s2 = uid_(); u1['Password hash'] = hash_(d.password, s2); u1.Salt = s2; userPut_(u1); res = true;
    } else if (A === 'toggleUser') {
      var u2 = users_().filter(function (u) { return u.ID === d.id; })[0]; if (u2 && String(u2.Email).toLowerCase() !== me.email.toLowerCase()) { u2.Active = d.active ? 'yes' : 'no'; userPut_(u2); if (d.active) cache.remove('off_' + u2.ID); else cache.put('off_' + u2.ID, '1', 21600); } res = true;
    } else if (A === 'saveLeave') {
      var Lv = ss.getSheetByName('Leaves'), id5 = d.id || ('LV-' + Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyyMMdd-HHmmss') + '-' + uid_().slice(1, 4)),
          now5 = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd HH:mm'),
          row5 = [id5, String(d.empId || ''), String(d.no || ''), d.name || '', d.type || '', d.paid ? 'yes' : 'no', String(d.from || ''), String(d.to || d.from || ''), +d.days || 0, d.reason || '', d.status || 'Pending', me.name, now5],
          ex5 = rows_(Lv).filter(function (r) { return String(r.ID) === id5; })[0];
      if (ex5) Lv.getRange(ex5._row, 1, 1, row5.length).setValues([row5]); else Lv.appendRow(row5);
      res = { id: id5, empId: row5[1], no: row5[2], name: row5[3], type: row5[4], paid: !!d.paid, from: row5[6], to: row5[7], days: row5[8], reason: row5[9], status: row5[10], by: me.name, at: now5 };
    } else if (A === 'deleteLeave') {
      var Lv2 = ss.getSheetByName('Leaves'), x5 = rows_(Lv2).filter(function (r) { return String(r.ID) === String(d.id); })[0]; if (x5) Lv2.deleteRow(x5._row); res = true;
    } else if (A === 'saveSheets') {              // attendance logs, attendance summary, cash advances, cash loans, 13th month: each sheet is rewritten
      var ALLOWED = ['Daily Attendance Logs', 'Summary of Attendance', 'Cash Advances', 'Cash Loans', 'Allowances', '13th Month Pay'];
      (d.sheets || []).forEach(function (x) {
        if (ALLOWED.indexOf(x.name) < 0) return;
        var sh = ss.getSheetByName(x.name) || ss.insertSheet(x.name), h = x.header || [], rows = x.rows || [], w = h.length, i, n;
        sh.clear(); if (sh.getMaxRows() < rows.length + 2) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 2 - sh.getMaxRows()); if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
        sh.getRange(1, 1, 1, w).setValues([h]).setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff'); sh.setFrozenRows(1);
        (x.text || []).forEach(function (c) { sh.getRange(2, c + 1, Math.max(1, rows.length), 1).setNumberFormat('@'); });   // numbers, dates and times typed as text keep their form
        for (i = 0; i < rows.length; i += 2000) { n = Math.min(2000, rows.length - i); sh.getRange(2 + i, 1, n, w).setValues(rows.slice(i, i + n)); }
        if (rows.length < 400) sh.autoResizeColumns(1, w);
      });
      res = true;
    } else if (A === 'deleteUser') {
      var u3 = users_().filter(function (u) { return u.ID === d.id; })[0]; if (u3 && String(u3.Email).toLowerCase() !== me.email.toLowerCase() && u3.Email !== DEFAULT_EMAIL) userDel_(u3.ID); cache.put('off_' + u3.ID, '1', 21600); res = true;
    } else if (A === 'updateBackup') {
      props.deleteProperty('BK_DIRTY'); res = updateBackup_(+d.year || 0, d.sheets);
    } else if (A === 'openDatabase') {              // owner only, needs the database password
      if (String(me.email).toLowerCase() !== DEFAULT_EMAIL) return out_({ ok: false, error: 'Only the owner can open the main database.' });
      var chk = dbPwCheck_(d.password, cache); if (chk) return out_({ ok: false, error: chk });
      res = { url: ss.getUrl() };
    } else if (A === 'setDbPassword') {             // owner only; first time needs no current password
      if (String(me.email).toLowerCase() !== DEFAULT_EMAIL) return out_({ ok: false, error: 'Only the owner can set the database password.' });
      var pr = PropertiesService.getScriptProperties();
      if (String(d.password || '').length < 8) return out_({ ok: false, error: 'The database password must be at least 8 characters.' });
      if (pr.getProperty('DB_PW_HASH')) { var chk2 = dbPwCheck_(d.current, cache); if (chk2) return out_({ ok: false, error: chk2 }); }
      var s3 = uid_(); pr.setProperty('DB_PW_SALT', s3); pr.setProperty('DB_PW_HASH', hash_(d.password, s3)); res = true;
    } else if (A === 'otAdd') {                   // add / change overtime entries: [{id, empId, date, hours, reason}] (HR and payroll)
      otPut_(ss, d.list || [], me.name); res = otRows_(ss);
    } else if (A === 'otRemove') {
      otDel_(ss, d.ids || []); res = otRows_(ss);
    } else return out_({ ok: false, error: 'Unknown action.' });
    return out_({ ok: true, data: res });
  } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); }
  finally { lock.releaseLock(); }
}

/* ===================== helpers: row blocks, runs list, overtime file, backup scheduling ===================== */
/* Contiguous row groups whose column `col` equals `val`: [[firstRow, count], ...]. Reads ONE column only. */
function groups_(sh, col, val) {
  var n = sh.getLastRow() - 1, out = [], i, start = -1, v;
  if (n < 1) return out;
  v = sh.getRange(2, col, n, 1).getValues();
  for (i = 0; i <= n; i++) {
    var hit = i < n && String(v[i][0]) === String(val);
    if (hit && start < 0) start = i;
    if (!hit && start >= 0) { out.push([start + 2, i - start]); start = -1; }
  }
  return out;
}
function delGroups_(sh, col, val) {
  var g = groups_(sh, col, val), i;
  for (i = g.length - 1; i >= 0; i--) {
    if (sh.getMaxRows() - g[i][1] <= sh.getFrozenRows()) sh.insertRowsAfter(sh.getMaxRows(), 1);
    sh.deleteRows(g[i][0], g[i][1]);
  }
}
function runsOut_(Run) {
  return rows_(Run).filter(function (r) { return r['Run ID']; }).map(function (r) { return { id: r['Run ID'], period: r.Period, payDate: r['Pay date'], count: r.Employees, gross: r.Gross, ded: r.Deductions, net: r['Net pay'], group: r.Group || '', status: r.Status || 'Finalized', by: r['Saved by'], at: r['Saved at'] }; });
}
function hrSettings_(s) { s = s || {}; var D = s.dtr || {}; return { leaveTypes: s.leaveTypes || null, leaveTotal: s.leaveTotal, unpaidLeave: s.unpaidLeave, workDays: s.workDays, dtr: { workDays: D.workDays, holidays: D.holidays || [] } }; }

/* OVERTIME FILE: its own tab (Overtime File). Entries: {id, empId, date, hours, reason}. */
function otOut_(r) { return { id: String(r.ID), empId: String(r['Employee ID']), no: txt_(r['Employee No']), name: r.Name, date: txt_(r.Date), hours: +r.Hours || 0, reason: r.Reason || '', by: r['Filed by'] || '', at: txt_(r['Filed at']) }; }
function otRows_(ss) { return rows_(ss.getSheetByName('Overtime File')).filter(function (r) { return r.ID; }).map(otOut_); }
function otPut_(ss, list, by) {
  var sh = ss.getSheetByName('Overtime File'), last = sh.getLastRow(), ids = {}, upd = [], fresh = [], now = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd HH:mm'), emp = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { ids[String(r[0])] = i + 2; });
  rows_(ss.getSheetByName('Employees')).forEach(function (r) { emp[String(r.ID)] = { no: txt_(r['Employee No']), name: txt_(r.Name) }; });
  list.forEach(function (x) {
    var e = emp[String(x.empId)] || {}, id = String(x.id || ('ot' + Utilities.getUuid().replace(/-/g, '').slice(0, 10))), h = Math.round((+x.hours || 0) * 10000) / 10000;
    if (!(h > 0) || h > 24 || !x.date) return;
    var row = [id, String(x.empId || ''), e.no || String(x.no || ''), e.name || String(x.name || ''), String(x.date), h, String(x.reason || ''), by || '', now];
    if (ids[id]) upd.push([ids[id], row]); else fresh.push(row);
  });
  upd.forEach(function (u) { sh.getRange(u[0], 1, 1, 9).setValues([u[1]]); });
  if (fresh.length) { var st = sh.getLastRow() + 1; if (sh.getMaxRows() < st + fresh.length) sh.insertRowsAfter(sh.getMaxRows(), st + fresh.length - sh.getMaxRows()); sh.getRange(st, 1, fresh.length, 9).setValues(fresh); }
}
function otDel_(ss, idList) {
  var sh = ss.getSheetByName('Overtime File'), last = sh.getLastRow(), del = {}, rows = [], i;
  idList.forEach(function (x) { del[String(x)] = 1; });
  if (last < 2) return;
  sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, k) { if (del[String(r[0])]) rows.push(k + 2); });
  for (i = rows.length - 1; i >= 0; i--) { if (sh.getMaxRows() - 1 <= sh.getFrozenRows()) sh.insertRowsAfter(sh.getMaxRows(), 1); sh.deleteRow(rows[i]); }
}

/* BACKUP IN THE BACKGROUND: saving a payroll only marks the backup as out of date and sets a one-time trigger; the backup report is rebuilt about a minute later (this was the 1-2 minutes of waiting). */
function markBackup_() {
  try {
    PropertiesService.getScriptProperties().setProperty('BK_DIRTY', '1');
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'backupIfDirty'; });
    if (!has) ScriptApp.newTrigger('backupIfDirty').timeBased().after(60 * 1000).create();
  } catch (e) { }   // if triggers are not allowed the nightly backup and the Update backup report button still work
}
function backupIfDirty() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'backupIfDirty') ScriptApp.deleteTrigger(t); });
  var pr = PropertiesService.getScriptProperties(), cache = CacheService.getScriptCache();
  if (pr.getProperty('BK_DIRTY') !== '1' || cache.get('bk_run')) return;
  pr.deleteProperty('BK_DIRTY'); cache.put('bk_run', '1', 600);
  try { updateBackup_(); } finally { cache.remove('bk_run'); }
}

/* ===================== DATABASE PASSWORD (owner only) ===================== */
function dbPwCheck_(p, cache) {
  var pr = PropertiesService.getScriptProperties(), h = pr.getProperty('DB_PW_HASH'), fails = +cache.get('dbfail') || 0;
  if (!h) return 'No database password is set yet. Set one first (Users tab > Main database).';
  if (fails >= 5) return 'Too many wrong attempts. Try again in 15 minutes.';
  if (hash_(p || '', pr.getProperty('DB_PW_SALT')) !== h) { cache.put('dbfail', String(fails + 1), 900); return 'Wrong database password.'; }
  cache.remove('dbfail'); return '';
}

/* ===================== BACKUP REPORT: a readable copy in a SEPARATE spreadsheet =====================
   Tabs: EMPLOYEE, EMPLOYEE PAYSLIP, EMPLOYEE CASH ADVANCE RECORD, CASH LOANS, ALLOWANCES, DAILY ATTENDANCE LOGS, SUMMARY OF ATTENDANCE, SSS, PHILHEALTH, PAGIBIG, TAX, 13TH MONTH JAN-JUN, 13TH MONTH JUL-DEC.
   The whole spreadsheet is rewritten from the database each time, so edit the database (through the app), never this report. */
var BK_NAME = 'Payroll Backup Report';
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var GROUP_NAMES = { staff: 'Staff', teacher: 'Teachers', admin: 'School admins' };

function txt_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Manila', 'yyyy-MM-dd') : String(v == null ? '' : v); }
function num_(v) { return Math.round((+v || 0) * 100) / 100; }
function pj_(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
function natCmp_(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
function grp_(g) { g = String(g || ''); return GROUP_NAMES[g] || g; }
function periodYM_(period) {   // same reading of the pay period text as the 13th month tab in the app
  var t = String(period || ''), ys = t.match(/\b(20\d\d)\b/g), re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi, m, last = '', mi = -1, i;
  while ((m = re.exec(t)) !== null) last = m[1].toLowerCase();
  if (last) for (i = 0; i < 12; i++) if (MONTHS[i].slice(0, 3).toLowerCase() === last) mi = i;
  return { y: ys ? +ys[ys.length - 1] : 0, m: mi };
}
function listText_(arr, f) { return (arr || []).map(f).filter(function (s) { return s; }).join('; '); }

function bkBuild_(emps, runs, slips, year, workDays) {
  var empBy = {}, nameBy = {}, runBy = {}, stamp = Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, yyyy h:mm a');
  emps.forEach(function (e) { empBy[String(e.no)] = e; nameBy[String(e.name).toLowerCase()] = e; });
  runs.forEach(function (r) { runBy[String(r['Run ID'])] = r; });
  var S = slips.filter(function (r) { return r['Run ID'] !== '' && r['Run ID'] != null; }).map(function (r) {
    var run = runBy[String(r['Run ID'])] || {}, no = txt_(r['Employee No']);
    return { r: r, c: pj_(r['Detail (JSON)']), e: empBy[no] || nameBy[String(r.Name || '').toLowerCase()] || {}, pay: txt_(run['Pay date']), period: txt_(r.Period), grp: grp_(run.Group), no: no, name: String(r.Name || '') };
  });
  S.sort(function (a, b) { return a.pay < b.pay ? 1 : a.pay > b.pay ? -1 : (a.period < b.period ? 1 : a.period > b.period ? -1 : natCmp_(a.no, b.no)); });
  var sub = 'Backup copy of the Payroll Management System  |  updated ' + stamp + '  |  read-only report: change data in the app, not here';
  var defs = [], list = emps.slice().sort(function (a, b) { return natCmp_(a.no, b.no); });

  // 1. EMPLOYEE
  defs.push({ name: 'EMPLOYEE', title: 'EMPLOYEE', subtitle: sub + '  |  ' + list.length + ' employee(s)', cap: true, blocks: [{
    header: ['Employee No', 'Name', 'Position', 'Department', 'Group', 'Employment type', 'Status', 'Date hired', 'Birthday', 'Gender', 'Civil status', 'SSS No', 'PhilHealth No', 'Pag-IBIG No', 'TIN', 'Monthly basic', 'Daily rate', 'Hourly rate', 'Email', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding tax', 'Allowances', 'Loans / deductions', 'Cash advance balance'],
    text: [0, 7, 8, 11, 12, 13, 14], money: [15, 16, 17, 25], total: [],
    rows: list.map(function (e) {
      var ca = e.ca || {};
      return [e.no, e.name, e.position, e.dept, grp_(e.category), e.etype, e.status, e.hired, e.birthday, e.gender, e.civil, e.sssNo, e.philhealthNo, e.pagibigNo, e.tin, num_(e.basicMonthly), num_(e.dailyRate), num_(e.hourlyRate), e.email,
        e.sss ? 'Yes' : 'No', e.philhealth ? 'Yes' : 'No', e.pagibig ? 'Yes' : 'No', e.tax ? 'Yes' : 'No',
        listText_(e.allowances, function (a) { return String(a.label || a.name || a.type || '') + (a.amount !== undefined && a.amount !== '' ? ' ' + num_(a.amount) : ''); }),
        listText_(e.deductions, function (d) { return [d.type, d.label].filter(function (x) { return x; }).join(' ') + (d.amount !== undefined && d.amount !== '' ? ' ' + num_(d.amount) + '/month' : '') + (d.balance !== undefined && d.balance !== '' && d.balance !== null ? ' (balance ' + num_(d.balance) + ')' : ''); }),
        num_(ca.balance)];
    }) }] });

  // 2. EMPLOYEE PAYSLIP
  defs.push({ name: 'EMPLOYEE PAYSLIP', title: 'EMPLOYEE PAYSLIP', subtitle: sub + '  |  every saved payroll, newest first', blocks: [{
    header: ['Pay date', 'Period', 'Group', 'Employee No', 'Name', 'Position', 'Basic', 'Allowances', 'Overtime', 'Other earnings', 'Holiday pay', 'Gross', 'Absent', 'Late', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Tax', 'Loans / other', 'Cash advance', 'Total deductions', 'Net pay'],
    text: [0, 1, 3], money: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], total: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    rows: S.map(function (s) {
      var r = s.r; return [s.pay, s.period, s.grp, s.no, s.name, String(r.Position || ''), num_(r.Basic), num_(r.Allowances), num_(r.Overtime), num_(r['Other earnings']), num_(r['Holiday pay']), num_(r.Gross), num_(r.Absent), num_(r.Late), num_(r.SSS), num_(r.PhilHealth), num_(r['Pag-IBIG']), num_(r.Tax), num_(r['Loans/Other']), num_(r['Cash advance']), num_(r['Total deductions']), num_(r['Net pay'])];
    }) }] });

  // 2b. PAYSLIP SUMMARY: one block per payroll run: employee name, salary (net pay) and an empty Signature column to sign on
  var smBlocks = [], smBy = {};
  S.forEach(function (s0) {
    var k = String(s0.r['Run ID']), B = smBy[k];
    if (!B) { B = smBy[k] = { heading: (s0.grp || 'All') + '  |  ' + s0.period + '  |  Pay date ' + s0.pay, header: ['No.', 'Employee No', 'Employee name', 'Salary (net pay)', 'Signature'], text: [1], money: [3], total: [3], rows: [] }; smBlocks.push(B); }
    B.rows.push([B.rows.length + 1, s0.no, s0.name, num_(s0.r['Net pay']), '']);
  });
  smBlocks.forEach(function (B) { B.rows.sort(function (a, b) { return String(a[2]).localeCompare(String(b[2])); }); B.rows.forEach(function (r, i) { r[0] = i + 1; }); });
  defs.push({ name: 'PAYSLIP SUMMARY', title: 'PAYSLIP SUMMARY', subtitle: sub + '  |  employee name, salary (net pay) and signature, one list per payroll run, newest first', sig: 4, blocks: smBlocks.length ? smBlocks : [{ header: ['No.', 'Employee No', 'Employee name', 'Salary (net pay)', 'Signature'], rows: [] }] });

  // 3. EMPLOYEE CASH ADVANCE RECORD: current balances, then every deduction
  var bal = list.filter(function (e) { var ca = e.ca || {}; return +ca.balance > 0 || +ca.perPay > 0; }).map(function (e) { var ca = e.ca || {}; return [e.no, e.name, e.dept, grp_(e.category), num_(ca.balance), num_(ca.perPay)]; });
  var hist = S.filter(function (s) { return num_(s.r['Cash advance']) > 0; }).map(function (s) { var c = s.c; return [s.pay, s.period, s.no, s.name, c.caBal === undefined ? '' : num_(c.caBal), num_(s.r['Cash advance']), c.caAfter === undefined ? '' : num_(c.caAfter)]; });
  defs.push({ name: 'EMPLOYEE CASH ADVANCE RECORD', title: 'EMPLOYEE CASH ADVANCE RECORD', subtitle: sub, blocks: [
    { heading: 'CURRENT CASH ADVANCE BALANCES', header: ['Employee No', 'Name', 'Department', 'Group', 'Outstanding balance', 'Deduct each pay'], text: [0], money: [4, 5], total: [4], rows: bal },
    { heading: 'CASH ADVANCE DEDUCTION HISTORY (from saved payslips)', header: ['Pay date', 'Period', 'Employee No', 'Name', 'Balance before', 'Cash advance deducted', 'Balance after'], text: [0, 1, 2], money: [4, 5, 6], total: [5], rows: hist }] });

  // 3b. CASH LOANS (Salary Loan, SSS Loan, Pag-IBIG Loan ...) and ALLOWANCES of every employee
  var loanRows = [], alwRows = [];
  list.forEach(function (e) {
    (e.deductions || []).forEach(function (d) { var tr = d.balance !== undefined && d.balance !== '' && d.balance !== null, b = tr ? num_(d.balance) : ''; loanRows.push([e.no, e.name, e.dept, grp_(e.category), String(d.type || ''), String(d.label || ''), num_(d.amount), b, tr ? (b > 0 ? 'Active' : 'Paid') : 'No balance tracked']); });
    (e.allowances || []).forEach(function (a) { var amt = num_(a.amount), pd = !!a.perDay; alwRows.push([e.no, e.name, e.dept, grp_(e.category), String(a.label || a.name || ''), amt, pd ? 'Per day' : 'Per month', pd ? num_(amt * workDays) : amt, a.taxable === false ? 'No' : 'Yes']); });
  });
  defs.push({ name: 'CASH LOANS', title: 'CASH LOANS', subtitle: sub + '  |  loans of every employee and what is still owed', blocks: [{ header: ['Employee No', 'Name', 'Department', 'Group', 'Loan type', 'Description', 'Per month', 'Balance', 'Status'], text: [0], money: [6, 7], total: [6, 7], rows: loanRows }] });
  defs.push({ name: 'ALLOWANCES', title: 'ALLOWANCES', subtitle: sub + '  |  a per-day allowance is multiplied by ' + workDays + ' working days per month', blocks: [{ header: ['Employee No', 'Name', 'Department', 'Group', 'Allowance', 'Amount', 'Per', 'Monthly amount', 'Taxable'], text: [0], money: [5, 7], total: [7], rows: alwRows }] });

  // 4-7. SSS, PHILHEALTH, PAGIBIG, TAX
  function gov(name, idHead, idKey, eeCol, erKey) {
    var rows = S.filter(function (s) { return num_(s.r[eeCol]) > 0 || num_(s.c[erKey]) > 0; }).map(function (s) { var ee = num_(s.r[eeCol]), er = num_(s.c[erKey]); return [s.pay, s.period, s.grp, s.no, s.name, String(s.e[idKey] || ''), ee, er, num_(ee + er)]; });
    defs.push({ name: name, title: name, subtitle: sub + '  |  employee share is deducted from pay; employer share is the school\'s share', blocks: [{ header: ['Pay date', 'Period', 'Group', 'Employee No', 'Name', idHead, 'Employee share', 'Employer share', 'Total contribution'], text: [0, 1, 3, 5], money: [6, 7, 8], total: [6, 7, 8], rows: rows }] });
  }
  gov('SSS', 'SSS No', 'sssNo', 'SSS', 'sssEr');
  gov('PHILHEALTH', 'PhilHealth No', 'philhealthNo', 'PhilHealth', 'phicEr');
  gov('PAGIBIG', 'Pag-IBIG No', 'pagibigNo', 'Pag-IBIG', 'hdmfEr');
  defs.push({ name: 'TAX', title: 'TAX', subtitle: sub + '  |  withholding tax taken from each payslip', blocks: [{ header: ['Pay date', 'Period', 'Group', 'Employee No', 'Name', 'TIN', 'Gross pay', 'Tax withheld'], text: [0, 1, 3, 5], money: [6, 7], total: [6, 7],
    rows: S.filter(function (s) { return num_(s.r.Tax) > 0; }).map(function (s) { return [s.pay, s.period, s.grp, s.no, s.name, String(s.e.tin || ''), num_(s.r.Gross), num_(s.r.Tax)]; }) }] });

  // 8-9. 13TH MONTH PAY, split in two halves: January - June and July - December
  var keep = {}, ids = {}, by = {}, i;
  runs.forEach(function (r) { if (periodYM_(r.Period).y === year) keep[String(r.Group || '') + '|' + txt_(r.Period)] = String(r['Run ID']); });   // the same period saved twice counts once
  Object.keys(keep).forEach(function (k) { ids[keep[k]] = 1; });
  S.forEach(function (s) {
    if (!ids[String(s.r['Run ID'])]) return;
    var q = periodYM_(s.period), x = by[s.no];
    if (!x) { x = by[s.no] = { no: s.no, name: s.name, e: s.e, m: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], d: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }; }
    if (q.m < 0) return;
    x.m[q.m] += num_(s.r.Basic); x.d[q.m] += num_(s.r.Absent) + num_(s.r.Late);
  });
  var nos = Object.keys(by).sort(natCmp_);
  [0, 1].forEach(function (h) {
    var a = h * 6, rows = [];
    nos.forEach(function (no) {
      var x = by[no], basic = 0, ded = 0, k, mm = [];
      for (k = a; k < a + 6; k++) { basic += x.m[k]; ded += x.d[k]; mm.push(num_(x.m[k])); }
      basic = num_(basic); ded = num_(ded); if (basic <= 0) return;
      var net = Math.max(0, num_(basic - ded));
      rows.push([x.no, x.name, x.e.dept || '', grp_(x.e.category), x.e.position || ''].concat(mm, [basic, ded, net, num_(net / 12)]));
    });
    var nm = h === 0 ? '13TH MONTH JAN-JUN' : '13TH MONTH JUL-DEC', lab = h === 0 ? 'JANUARY - JUNE' : 'JULY - DECEMBER';
    defs.push({ name: nm, title: '13TH MONTH PAY  |  ' + lab + ' ' + year, subtitle: sub + '  |  13th month pay of this half = net basic salary earned in these 6 months divided by 12 (basic only; absences and late are subtracted). January-June plus July-December = the full-year 13th month pay.',
      blocks: [{ header: ['Employee No', 'Name', 'Department', 'Group', 'Position'].concat(MONTHS.slice(a, a + 6), ['Total basic earned', 'Less absences and late', 'Net basic salary', '13th month pay']), text: [0], money: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], total: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], rows: rows }] });
  });
  return defs;
}

function bkWrite_(ss, def) {
  var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name), w = 1, r = 4, lay = [], need, flt = sh.getFilter();
  if (flt) flt.remove();
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.clear(); sh.setFrozenRows(0);
  def.blocks.forEach(function (b) {
    var L = { b: b, bw: b.header.length, rows: b.rows || [] };
    w = Math.max(w, L.bw);
    if (b.heading) { L.hr = r; r++; }
    L.head = r; r++; L.start = r; r += Math.max(1, L.rows.length);
    if (b.total && b.total.length && L.rows.length) { L.tot = r; r++; }
    r++; lay.push(L);
  });
  need = r + 2;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  lay.forEach(function (L) {
    var b = L.b, n = L.rows.length, i, c, k, nn;
    sh.getRange(L.head, 1, 1, L.bw).setValues([b.header]).setFontWeight('bold').setBackground('#b3121f').setFontColor('#ffffff').setVerticalAlignment('middle');
    (b.text || []).forEach(function (c) { sh.getRange(L.start, c + 1, Math.max(1, n), 1).setNumberFormat('@'); });   // ids, dates and periods stay as typed
    (b.money || []).forEach(function (c) { sh.getRange(L.start, c + 1, n + (L.tot ? 1 : 0) || 1, 1).setNumberFormat('#,##0.00'); });
    if (!n) { sh.getRange(L.start, 1).setValue('No records yet.').setFontStyle('italic').setFontColor('#777777'); return; }
    for (i = 0; i < n; i += 2000) { nn = Math.min(2000, n - i); sh.getRange(L.start + i, 1, nn, L.bw).setValues(L.rows.slice(i, i + nn)); }
    sh.getRange(L.start, 1, n, L.bw).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
    if (L.tot) {
      var t = [], sum;
      for (c = 0; c < L.bw; c++) t.push('');
      t[0] = 'TOTAL';
      (b.total || []).forEach(function (c) { sum = 0; for (k = 0; k < n; k++) sum += +L.rows[k][c] || 0; t[c] = num_(sum); });
      sh.getRange(L.tot, 1, 1, L.bw).setValues([t]).setFontWeight('bold').setBackground('#f3e3e5').setBorder(true, false, false, false, false, false);
    }
  });
  sh.autoResizeColumns(1, w);   // sized before the title is written, so the long title does not widen column A
  if (def.cap) for (var c2 = 1; c2 <= w; c2++) if (sh.getColumnWidth(c2) > 320) sh.setColumnWidth(c2, 320);
  if (def.sig !== undefined) {   // signature column: wide, boxed, tall rows so it can be printed and signed
    sh.setColumnWidth(def.sig + 1, 280);
    lay.forEach(function (L) { if (!L.rows.length) return; sh.getRange(L.start, def.sig + 1, L.rows.length, 1).setBorder(true, true, true, true, true, true); sh.setRowHeights(L.start, L.rows.length, 30); sh.getRange(L.start, 1, L.rows.length, L.bw).setVerticalAlignment('middle'); });
  }
  sh.getRange(1, 1).setValue(def.title).setFontSize(14).setFontWeight('bold');
  sh.getRange(2, 1).setValue(def.subtitle).setFontColor('#666666').setFontStyle('italic');
  lay.forEach(function (L) { if (L.hr) sh.getRange(L.hr, 1).setValue(L.b.heading).setFontWeight('bold').setFontSize(12); });
  if (lay.length === 1) {
    sh.setFrozenRows(lay[0].head);
    if (lay[0].rows.length) sh.getRange(lay[0].head, 1, lay[0].rows.length + 1, lay[0].bw).createFilter();
  } else sh.setFrozenRows(2);
}

/* Attendance comes from the biometric files kept in the browser, so the app sends it with the backup request: Daily Attendance Logs and Summary of Attendance. Those two tabs show the data of the last time the button was pressed. */
function bkExtra_(sheets, stamp) {
  var OK = { 'Daily Attendance Logs': 1, 'Summary of Attendance': 1 };
  return (sheets || []).filter(function (x) { return OK[x.name]; }).map(function (x) {
    var tx = {}; (x.text || []).forEach(function (c) { tx[c] = 1; });
    return { name: x.name.toUpperCase(), title: x.name.toUpperCase(), subtitle: 'Backup copy of the Payroll Management System  |  from the biometric files, sent ' + stamp + '  |  refreshed when "Update backup report" is pressed in the app', blocks: [{ header: x.header || [], text: x.text || [], money: [], total: [], rows: x.rows || [] }] };
  });
}

function updateBackup_(year, sheets) {
  var db = db_(), props = PropertiesService.getScriptProperties(), y = year || +Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy'), id = props.getProperty('BK_ID'), ss = null,
    emps = rows_(db.getSheetByName('Employees')).filter(function (r) { return r.ID; }).map(empOut_),
    runs = rows_(db.getSheetByName('Payroll Runs')).filter(function (r) { return r['Run ID'] && String(r.Status || 'Finalized') !== 'Draft'; }),   // drafts are left out of the backup / reports
    slips = rows_(db.getSheetByName('Payslips'));
  var okRun = {}; runs.forEach(function (r) { okRun[String(r['Run ID'])] = 1; }); slips = slips.filter(function (s) { return okRun[String(s['Run ID'])]; });
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create(BK_NAME); props.setProperty('BK_ID', ss.getId()); }   // created private in your Drive
  var setRow = rows_(db.getSheetByName('Settings')).filter(function (r) { return r.Key === 'settings'; })[0], wd = 22;
  try { wd = +(JSON.parse(setRow.Value).workDays) || 22; } catch (e0) { }
  var defs = bkBuild_(emps, runs, slips, y, wd).concat(bkExtra_(sheets, Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, yyyy h:mm a')));
  // The attendance tabs are filled from the app. Until the first time they are sent, show them as empty tabs so they are always in the backup.
  [['DAILY ATTENDANCE LOGS', TABS['Daily Attendance Logs']],
   ['SUMMARY OF ATTENDANCE', TABS['Summary of Attendance']]].forEach(function (p) {
    if (!defs.some(function (d) { return d.name === p[0]; }) && !ss.getSheetByName(p[0])) defs.push({ name: p[0], title: p[0], subtitle: 'Backup copy of the Payroll Management System  |  not sent yet: press \"Update backup report\" in Reports to fill it from the biometric files', blocks: [{ header: p[1], rows: [] }] });
  });
  defs.forEach(function (d) { bkWrite_(ss, d); });
  var blank = ss.getSheetByName('Sheet1'); if (blank && ss.getSheets().length > defs.length) ss.deleteSheet(blank);
  defs.forEach(function (d, i) { ss.setActiveSheet(ss.getSheetByName(d.name)); ss.moveActiveSheet(i + 1); });
  ss.setActiveSheet(ss.getSheetByName('EMPLOYEE'));
  props.setProperty('BK_URL', ss.getUrl());
  return { url: ss.getUrl(), year: y, at: Utilities.formatDate(new Date(), 'Asia/Manila', 'MMM d, yyyy h:mm a') };
}
/* Run once from the editor to also refresh the backup report every night (10 PM Manila time). */
function installDailyBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyBackup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyBackup').timeBased().everyDays(1).atHour(22).inTimezone('Asia/Manila').create();
  return 'Daily backup report scheduled for about 10 PM.';
}
function dailyBackup() { var cache = CacheService.getScriptCache(); if (cache.get('bk_run')) return; cache.put('bk_run', '1', 600); try { updateBackup_(); } finally { cache.remove('bk_run'); } }

function lvOut_(r) {
  var t = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Manila', 'yyyy-MM-dd') : String(v == null ? '' : v); };
  return { id: String(r.ID), empId: String(r['Employee ID']), no: String(r['Employee No']), name: r.Name, type: r.Type, paid: String(r.Paid) === 'yes', from: t(r.From), to: t(r.To), days: +r.Days || 0, reason: r.Reason || '', status: r.Status || 'Pending', by: r['Filed by'] || '', at: t(r['Filed at']) };
}
function empOut_(r) {
  var j = function (s, d) { try { return JSON.parse(s || d); } catch (e) { return JSON.parse(d); } }, t = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Manila', 'yyyy-MM-dd') : String(v == null ? '' : v); };
  return { id: r.ID, no: t(r['Employee No']), last: t(r['Last name']), first: t(r['First name']), mi: t(r['M.I.']), name: t(r.Name), birthday: t(r.Birthday), gender: t(r.Gender), civil: t(r['Civil status']), position: t(r.Position), dept: t(r.Department), etype: t(r['Employment type']), hired: t(r['Date hired']), status: t(r.Status) || 'Active',
    sssNo: t(r['SSS No']), philhealthNo: t(r['PhilHealth No']), pagibigNo: t(r['Pag-IBIG No']), tin: t(r.TIN), category: t(r.Category), basicMonthly: +r['Monthly basic'] || 0, dailyRate: +r['Daily rate'] || 0, hourlyRate: +r['Hourly rate'] || 0, email: t(r.Email), photo: t(r.Photo),
    sss: r.SSS !== 'no', philhealth: r.PhilHealth !== 'no', pagibig: r['Pag-IBIG'] !== 'no', tax: r.Tax !== 'no', ca: j(r['Cash advance (JSON)'], '{}'), allowances: j(r['Allowances (JSON)'], '[]'), deductions: j(r['Loans (JSON)'], '[]') };
}
