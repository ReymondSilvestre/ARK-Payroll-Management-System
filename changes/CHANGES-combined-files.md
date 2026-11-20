# Fewer files: scripts and styles combined

Nothing was changed inside the code: each new file is the former files joined in the SAME order (a marker line shows where each old file starts, e.g. ">>>>>>>>>> js/pages/payslips.js >>>>>>>>>>"). Loaded in a test, the 37 old scripts and the 5 new ones define exactly the same functions and values.

| New file | Former files |
|---|---|
| js/core.js | core/settings, core/periods, core/payroll-calc, app/state, app/api, app/auth, app/layout, dtr/punches, dtr/biometric-reader, dtr/rules, dtr/dtr-calc |
| js/pages.js | pages/dashboard, employees, loans, payroll, payslips, reports, settings |
| js/settings-pages.js | settings/holidays, shifts, saturday, auto-overtime, overtime-file, tax, extras |
| js/more-pages.js | pages/users, dtr, teacher-hours, class-monitor, class-dtr, dtr/attendance-check, pages/leave, spreadsheets, backup, month13 |
| js/boot.js | app/migrations, app/boot (must stay last) |
| css/styles.css | css/01-base, 02-v2-look, 03-v3-modern, 04-v4-professional (the font @import moved to the top) |

- index.html now loads 5 scripts and 1 stylesheet (was 37 and 4).
- Removed unused copies: js/reports.js and css/style.css (identical to legacy/reports.js and legacy/css-style.css; index.html never loaded them) and the nested ARK-Payroll-Management-System-fixed folder (an older copy of the project).
- Older CHANGES-*.md notes still name the old files (e.g. js/pages/payslips.js): use the table above to find the same code.
- The backend/Code.gs is not changed.
