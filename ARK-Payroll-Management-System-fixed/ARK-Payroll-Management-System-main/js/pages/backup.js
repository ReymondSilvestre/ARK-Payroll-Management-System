/* ============================================================
   BACKUP report and owner-only database access.
   File: js/pages/backup.js
   ============================================================ */

/* ===================== Backup report (separate readable spreadsheet) and owner-only database access ===================== */
BUSY.updateBackup = "Updating backup report";

 BUSY.openDatabase = "Checking password";

function backupCard() {
  return `<div class="card noprint"><h3>Backup report (readable Google Sheet)</h3><p class="muted">A separate spreadsheet with one tab each for EMPLOYEE, EMPLOYEE PAYSLIP, EMPLOYEE CASH ADVANCE RECORD, SSS, PHILHEALTH, PAGIBIG and TAX, plus CASH LOANS, ALLOWANCES, DAILY ATTENDANCE LOGS, SUMMARY OF ATTENDANCE and the 13TH MONTH PAY split into JANUARY - JUNE and JULY - DECEMBER. The payroll tabs refresh by themselves every time a payroll is saved. The attendance tabs (DAILY ATTENDANCE LOGS and SUMMARY OF ATTENDANCE) are read from the biometric files in this browser, so they are updated when you press the button (choose the dates below; empty = all biometric dates). Cash advances, cash loans and allowances come from the employee records and are always current. <b>Download backup (Excel)</b> gives the same five sheets as a file. Anyone opening it needs to be shared on the file in Google Sheets.</p>
  <div class="row"><div><label>Attendance from</label><input type="date" id="bk_f" value="${sheetRange().from}"></div><div><label>Attendance to</label><input type="date" id="bk_t" value="${sheetRange().to}"></div><div><label>13th month year</label><input type="number" id="bk_y" value="${new Date().getFullYear()}" style="max-width:110px"></div><button class="btn p" id="bk_u">Update backup report</button><button class="btn" id="bk_x">Download backup (Excel, 5 sheets)</button>${ST.backup ? `<a class="btn" href="${esc(ST.backup)}" target="_blank" rel="noopener">Open backup report</a>` : ""}</div></div>`;
}

function backupInit() {
  $("#bk_x").onclick = () => { const R = sheetRange(), f = $("#bk_f").value || R.from, t = $("#bk_t").value || R.to; xlsxBook(allSheets(f && t && f <= t ? f : "", f && t && f <= t ? t : ""), `ARK-Backup-${new Date().toISOString().slice(0, 10)}.xlsx`); };
  $("#bk_u").onclick = async () => { try { const R = sheetRange(), f = $("#bk_f").value || R.from, t = $("#bk_t").value || R.to, att = f && t && f <= t ? allSheets(f, t).filter((x) => x.name === "Daily Attendance Logs" || x.name === "Summary of Attendance") : []; if (!att.length) toast("No biometric dates chosen: the attendance tabs keep their last data."); const r = await api("updateBackup", { year: +$("#bk_y").value || 0, sheets: att }); ST.backup = r.url; toast("Backup report updated " + r.at + "."); rep(); } catch (e) { } };
}

function dbCard() {
  return `<div class="card"><h3>Main database (owner only)</h3><p class="muted">The main database spreadsheet is hidden from this system. Only you, the owner, can reveal it, and only with the database password. The file itself stays private to your Google account, so never share it.</p>
  <div class="row"><div><label>Database password</label><input type="password" id="db_p" autocomplete="off"></div><button class="btn p" id="db_o">Open database</button></div><p id="db_l"></p>
  <div class="row"><div><label>Current password (leave empty the first time)</label><input type="password" id="db_c" autocomplete="off"></div><div><label>New database password (min 8)</label><input type="password" id="db_n" autocomplete="off"></div><button class="btn" id="db_s">Set / change password</button></div></div>`;
}

function dbInit() {
  if (!$("#db_o")) return;
  $("#db_o").onclick = async () => { try { const r = await api("openDatabase", { password: $("#db_p").value }); $("#db_p").value = ""; $("#db_l").innerHTML = `<a class="btn p" href="${esc(r.url)}" target="_blank" rel="noopener">Open the database now</a> <span class="muted">This link disappears when you leave this page.</span>`; } catch (e) { } };
  $("#db_s").onclick = async () => { try { await api("setDbPassword", { current: $("#db_c").value, password: $("#db_n").value }); $("#db_c").value = $("#db_n").value = ""; toast("Database password saved."); } catch (e) { } };
}

