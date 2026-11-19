# Regular Pay = regular working days x daily rate (pay by days of the cut-off)

Problem found on the payslip Oct 26 - Nov 10, 2026 (daily rate 645): Regular Pay showed 7,095 for "12 regular working days x 645" (should be 7,740).
Cause: the pay was still the fixed half of the monthly pay (645 x 26 / 2 = 8,385 = 13 days), then the 2 holidays (1,290) were taken out of it. That cut-off really has 14 working days (Mon-Sat) = 12 regular + 2 holidays.

Now (Settings > Payroll settings > **Pay by days of the cut-off**, On by default):
- Basic of the cut-off = paid days of THAT cut-off (Mon-Sat, holidays included) x daily rate = 14 x 645 = 9,030
- Regular Pay = 12 x 645 = 7,740, Holiday pay = 2 x 645 = 1,290 (+ extra for working on a holiday)
- Apply to twice-a-month pay of daily-rate people (staff / admins). Teachers (per hour) and hand-typed pay are not affected.
- SSS / PhilHealth / Pag-IBIG and the tax estimate still use the monthly pay, so they do not change.
- Off = the old fixed half of the monthly pay.
Files: js/core/payroll-calc.js, js/core/settings.js, js/pages/settings.js

## Follow-up (holiday count)
- A holiday date entered twice in Settings > Holidays was counted twice (payslip showed 2 holidays for Nov 2). Payroll now counts one holiday per date.
- The Holiday pay line on the payslip now names the holidays paid, e.g. "Holiday pay (1 holiday: Nov 2 All Souls' Day)". Files: js/pages/payroll.js, js/pages/payslips.js
