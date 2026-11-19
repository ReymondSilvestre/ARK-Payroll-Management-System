/* ============================================================
   MIGRATIONS - upgrades for settings saved by older versions.
   File: js/app/migrations.js
   ============================================================ */

/** Settings saved before the work-days setting existed: Monday to Saturday are work days, Sunday work is overtime, and a month has 26 working days (only if it still has the old default of 22). Saving the settings keeps whatever you then choose. */
/** Settings saved before: late and overtime are counted in exact minutes (no 30-minute blocks). Saving the Settings afterwards keeps whatever you choose. */
function minutesMigrate() { const D = ST.settings.dtr; if (D.minV >= 1) return; D.ot = { ...(D.ot || {}), startMin: 0, blockMin: 1, minMin: 0 }; D.late = { ...(D.late || {}), blockMin: 1 }; D.minV = 1; }

/** Overtime is counted in whole hours: minutes 30 to 59 count as one more hour, 1 to 29 are not counted (1 hr 29 min = 1 hr, 1 hr 30 min = 2 hrs), set once. Changing "Counted in blocks of" under Settings > Overtime afterwards is kept. */
function otHourMigrate() { const D = ST.settings.dtr; if (D.otHourV >= 4) return; D.ot = { ...(D.ot || {}), blockMin: 60, roundFrom: 30 }; D.otHourV = 4; }

function daysMigrate() {
  const S = ST.settings, D = S.dtr; if (D.daysV >= 2) return;
  D.workDays = [1, 2, 3, 4, 5, 6]; D.restDayAsOt = true; D.daysV = 2; if (+S.workDays === 22) S.workDays = 26;
}

