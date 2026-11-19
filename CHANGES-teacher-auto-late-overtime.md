# Update: separate Auto late & overtime settings for teachers
No change to backend/Code.gs. Files changed: js/core/settings.js, js/dtr/rules.js, js/dtr/dtr-calc.js, js/pages/class-monitor.js, js/pages/payroll.js, js/pages/payslips.js, js/settings/auto-overtime.js, js/settings/extras.js, js/settings/holidays.js

Settings > Auto late & overtime now has a **Teachers (separate settings)** block (saved as `dtr.teacher`):
- **Auto late deduction** (ON by default) - ON: hours count from the time in; OFF: late is only reported and hours count from the class start. The Late line on the payslip follows it.
- **Auto early-out deduction** (ON by default) - ON: hours stop at the time out; OFF: early out is only reported and hours count to the class end. The Early out line on the payslip follows it.
- Early in is never counted as overtime (fixed rule, no switch): the early minutes are not paid and are never added to overtime; DTR hours start at the scheduled time in.
The existing "Deduct late automatically" switch now applies to staff and admins only.

## Teacher late deduction: per hour after the grace period
- Late is counted only after the teacher's grace period and deducted per whole hour, rounded up, for each class (e.g. grace 15 min, in 20 min late = 5 min late after grace = 1:00 deducted).
- The payslip Late line shows the deducted hours; the day notes show "(0:05 late after grace, deducted 1:00)".
- Early out is still deducted by the exact minutes. Teachers paid from DTR hours (no class schedule) are not changed.

## Biometric DTR hours in 30-minute blocks
- Hours worked from the biometric DTR are counted in blocks of 30 minutes; the excess minutes are not counted (8:45 = 8:30, 8:20 = 8:00).
- Settings > Auto late & overtime > "Biometric DTR: count hours worked in blocks of (minutes)" (default 30, 0 = exact minutes). Teachers with set Teacher Hours keep their scheduled hours.

## Employee payslip: half day and undertime
- Staff / admin payslip: "Half day (N days)" is now its own deduction line (days from the DTR, x half-day value in Settings x daily rate). "Absences" no longer includes them, the total deduction is the same.
- "Undertime (H:MM) - no deduction" is listed with each day, the time out and the minutes early. Undertime is shown only; nothing is deducted for it.
- Files: js/pages/payroll.js, js/core/payroll-calc.js, js/pages/payslips.js. No change to backend/Code.gs.

## Overtime counted per hour: minutes 31-59 count as 1 hour
- Overtime is counted in whole hours. The minutes past the last full hour count as one more hour only from minute 31 (1 hr 30 min = 1 hr, 1 hr 31 min to 1 hr 59 min = 2 hrs, 1-30 min alone = 0).
- Settings > Overtime: "Counted in blocks of (minutes)" = 60 and new "Minutes of the hour from which a full hour counts" = 31 (0 = the excess minutes are never counted). Set once for saved settings; later changes are kept.
- Applies to late time out and holiday / WFH work. Overtime typed in the Overtime File is paid as filed.
