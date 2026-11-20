# Payslip computed by the days of the cut-off (paid days, daily allowance)

Problems:
- A daily allowance (Allowances > Paid: Working day / per day) was still amount x working days a month / 2 (13 days), whatever the cut-off. Oct 26 - Nov 10 has 14-15 paid days, so the allowance was short.
- A REGULAR holiday that falls on a rest day (e.g. Sunday Nov 1) was counted in "No. of holidays" and taken out of the regular days, but was never part of the cut-off's paid days, so Regular Pay days were one too few.

Now (Settings > Payroll settings > Pay by days of the cut-off = On, twice-a-month pay):
- Paid days of the cut-off = working days (Mon-Sat by default) + regular holidays on rest days.
- Daily allowance = paid days of THAT cut-off x amount per day; the payslip shows e.g. "Meal (15 days x 50.00)".
- Monthly allowances, loans, SSS / PhilHealth / Pag-IBIG and tax are unchanged (fixed per month, split by cut-off).
- Off = the old fixed half-month computation.
Payslips already saved keep their old figures: open the payroll for that cut-off and save it again.
File: js/core/payroll-calc.js (Code.gs not needed)

## New setting: holidays that fall on Sunday / rest day
Settings > Payroll settings > **Count a holiday that falls on Sunday / rest day** (On by default).
- On = a regular holiday on a Sunday counts as a paid day of the cut-off and shows under Holiday pay.
- Off = it is not counted at all (not in paid days, No. of holidays, Holiday pay or the daily allowance days).
- Special (non-working) holidays on a rest day are never counted.
Files: js/core/settings.js, js/core/payroll-calc.js, js/pages/payroll.js, js/pages/settings.js
