/* ============================================================
   MIGRATIONS - upgrades for settings saved by older versions.
   File: js/app/migrations.js
   ============================================================ */

/** Settings saved before the work-days setting existed: Monday to Saturday are work days, Sunday work is overtime, and a month has 26 working days (only if it still has the old default of 22). Saving the settings keeps whatever you then choose. */
/** Settings saved before: late and overtime are counted in exact minutes (no 30-minute blocks). Saving the Settings afterwards keeps whatever you choose. */
function minutesMigrate() { const D = ST.settings.dtr; if (D.minV >= 1) return; D.ot = { ...(D.ot || {}), startMin: 0, blockMin: 1, minMin: 0 }; D.late = { ...(D.late || {}), blockMin: 1 }; D.minV = 1; }

function daysMigrate() {
  const S = ST.settings, D = S.dtr; if (D.daysV >= 2) return;
  D.workDays = [1, 2, 3, 4, 5, 6]; D.restDayAsOt = true; D.daysV = 2; if (+S.workDays === 22) S.workDays = 26;
}

