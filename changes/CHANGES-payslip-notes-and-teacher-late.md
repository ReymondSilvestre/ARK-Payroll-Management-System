# Update: payslip notes removed, teacher late deduction
No change to backend/Code.gs. Files changed: js/pages/payslips.js, js/pages/payroll.js, js/pages/class-monitor.js

- All payslips (employees and teachers): the small notes under each deduction and the teacher class-check note are removed.
- Teacher payslip: a "Late" deduction line now shows the late minutes x hourly rate. Its note lists each late with the day, class start and time in, e.g. "Mon, Nov 3: class 8:00 AM, in 8:15 AM (15 min late)".
- The late amount is already unpaid (hours are counted from the time in). The payslip now shows Teaching pay including the late hours, with the Late deduction taken out, so Net pay is unchanged.

## Early in / early out (teachers)
- Class check now records early in (time in before class start) and early out (time out before class end).
- Teacher payslip: "Early out" is a deduction (minutes x hourly rate; those minutes were already unpaid) with a note of the day, class end and time out. "Early in" is listed with no deduction (early minutes are not paid extra), with day and time. Net pay unchanged.
