# Update: late columns in the Payroll tab
Files changed: js/pages/payroll.js only. No change to backend/Code.gs.

- Teachers: new column "Late hours deducted" beside Hours taught (H:MM, with the peso amount, number of late days and the actual late minutes after grace). Same figure as the Late line on the payslip.
- Staff / admins: new column "Late days" (number of days late from the DTR) beside Late min.
- Why Hours taught and late did not match: the Class DTR / Class check show the real late minutes after the grace period (e.g. 5 min), but payroll deducts late per whole hour, rounded up (5 min = 1:00). Hours taught is already reduced by that 1:00.

## Payslip / DTR: late shown in Hours:Minutes
Files: js/pages/payslips.js, js/dtr/dtr-calc.js.
- Late deduction note on the payslip: each day shows the deducted time as H:MM and the actual late as H:MM, e.g. "Nov 3 1:00 (actual 0:45 late)" (was "45 min in"). The teacher fallback note "N min late" is now H:MM too.
- DTR remark: "Late 1:00 (actual 0:45 late)" and "Late 0:20 (not counted)" instead of minutes only.

## Main database and Backup report: late information is saved
Files changed: js/pages/payroll.js, backend/Code.gs  (**Code.gs changed: paste it into Apps Script and Deploy > Manage deployments > Edit > New version**).
- Main database, tab **Payslips**: 4 new columns after "Detail (JSON)" (existing columns do not move): `Late days`, `Late hours deducted (H:MM)`, `Actual late after grace (H:MM)`, `Late deduction amount`. An older Payslips tab gets the new headers by itself on the first request after deploying (SCHEMA_V v10-2026-11-19a).
- Backup report, tab **EMPLOYEE PAYSLIP**: the same three late columns (Late days, Late hours deducted, Actual late after grace) sit right after "Late"; Late days is added to the TOTAL row.
- The values are the same as the Payroll tab columns (one function `lateInfo` in payroll.js) and are also kept in the payslip detail (`lateDays`, `lateDedMin`, `lateActMin`, `lateAmt`).
- Payslips saved BEFORE this update have no late days / hours: those cells stay empty (0 days). Open the run under Payslips > delete, then save the payroll again if you want them filled. Drafts are saved too but are left out of the backup report as before.
