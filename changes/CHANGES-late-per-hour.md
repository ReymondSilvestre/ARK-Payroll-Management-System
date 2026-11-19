# Update: late in the DTR is counted per hour (same as overtime)
Files changed: js/dtr/rules.js, js/dtr/dtr-calc.js, js/core/settings.js, js/pages/payroll.js, js/pages/payslips.js, js/settings/holidays.js, js/settings/extras.js. No change to backend/Code.gs.

- Late is measured from the official time in, then counted in whole hours:
  - Staff / admins: 30-59 min late = 1 hr (1 hr 20 min = 1 hr, 1 hr 30-59 min = 2 hrs).
  - Teachers: 16-59 min late = 1 hr (1 hr 15 min = 1 hr, 1 hr 16-59 min = 2 hrs).
- Late is still flagged only after the grace period (staff 30, teachers 15). Late under the start minute (e.g. a Saturday with 15 min grace) is shown as "not counted".
- The DTR, Attendance check, Payroll tab (Late field) and payslip all use the hours. The DTR remark shows the actual minutes, e.g. "Late 1:00 (45 min in)".
- Settings > Late computation: "Count late per hour" ON/OFF and the start minute for staff (30) and teachers (16).
- Teachers paid from the Class check already deduct per hour with the same result (grace 15 = 16 min late is 1 hr), so class-monitor.js is unchanged.

## Saturday: Maintenance and Security follow their shift
- People on a shift (a department with a shift in Settings > Shifts, e.g. Maintenance, Security, or a shift assigned to the person) now work their shift on Saturday too. The Saturday half day (8:00 - 12:00) no longer applies to them, even if their department is ticked there. Late, early out and overtime on Saturday are counted from their shift time.
- A person set to "Half day" under Settings > Saturday half-day > Exceptions still gets the half day.
- Files: js/dtr/rules.js, js/settings/saturday.js. No change to backend/Code.gs.
