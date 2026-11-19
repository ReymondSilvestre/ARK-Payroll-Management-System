# Update: separate Auto late & overtime settings for teachers
No change to backend/Code.gs. Files changed: js/core/settings.js, js/dtr/rules.js, js/dtr/dtr-calc.js, js/pages/class-monitor.js, js/pages/payroll.js, js/pages/payslips.js, js/settings/auto-overtime.js, js/settings/extras.js, js/settings/holidays.js

Settings > Auto late & overtime now has a **Teachers (separate settings)** block (saved as `dtr.teacher`):
- **Auto late deduction** (ON by default) - ON: hours count from the time in; OFF: late is only reported and hours count from the class start. The Late line on the payslip follows it.
- **Auto early-out deduction** (ON by default) - ON: hours stop at the time out; OFF: early out is only reported and hours count to the class end. The Early out line on the payslip follows it.
- **Early in is not counted as overtime** (ON by default) - OFF adds the early-in minutes as overtime, only for teachers allowed overtime.
The existing "Deduct late automatically" switch now applies to staff and admins only.
