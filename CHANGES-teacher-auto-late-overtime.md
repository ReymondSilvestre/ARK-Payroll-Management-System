# Update: separate Auto late & overtime settings for teachers
No change to backend/Code.gs. Files changed: js/core/settings.js, js/dtr/rules.js, js/dtr/dtr-calc.js, js/pages/class-monitor.js, js/pages/payroll.js, js/pages/payslips.js, js/settings/auto-overtime.js, js/settings/extras.js, js/settings/holidays.js

Settings > Auto late & overtime now has a **Teachers (separate settings)** block (saved as `dtr.teacher`):
- **Auto late deduction** (ON by default) - ON: hours count from the time in; OFF: late is only reported and hours count from the class start. The Late line on the payslip follows it.
- **Auto early-out deduction** (ON by default) - ON: hours stop at the time out; OFF: early out is only reported and hours count to the class end. The Early out line on the payslip follows it.
- **Early in is not counted as overtime** (ON by default) - OFF adds the early-in minutes as overtime, only for teachers allowed overtime.
The existing "Deduct late automatically" switch now applies to staff and admins only.

## Teacher late deduction: per hour after the grace period
- Late is counted only after the teacher's grace period and deducted per whole hour, rounded up, for each class (e.g. grace 15 min, in 20 min late = 5 min late after grace = 1:00 deducted).
- The payslip Late line shows the deducted hours; the day notes show "(0:05 late after grace, deducted 1:00)".
- Early out is still deducted by the exact minutes. Teachers paid from DTR hours (no class schedule) are not changed.

## Biometric DTR hours in 30-minute blocks
- Hours worked from the biometric DTR are counted in blocks of 30 minutes; the excess minutes are not counted (8:45 = 8:30, 8:20 = 8:00).
- Settings > Auto late & overtime > "Biometric DTR: count hours worked in blocks of (minutes)" (default 30, 0 = exact minutes). Teachers with set Teacher Hours keep their scheduled hours.
