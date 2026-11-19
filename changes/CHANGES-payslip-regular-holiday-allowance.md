# Payslip: regular working days + Holiday pay; allowance option for holidays / WFH

## Payslip
- Summary row: **Paid days (regular working days)** = the working days of the cut-off minus its holidays; the **Holiday pay** amount is shown right below it.
- EARNINGS: **Regular Pay (N regular working days x daily rate)** and, below it, **Holiday pay (N holidays)**.
- Fixed-pay people: the monthly pay already covers the holidays, so holidays x daily rate move from Regular Pay to Holiday pay (plus any extra for working on a holiday). Regular Pay + Holiday pay = the old basic + holiday pay, so GROSS / NET do not change. A holiday paid below 100% still shows in DEDUCTIONS as before.
- Teachers (per hour): Teaching pay stays hours x rate; Holiday pay (paid holiday / fixed amount) is the line below it.
- A hand-typed pay (administrators) is not split.

## Allowances (Allowances menu)
- New box on "Selected days of the week": **Include holidays and WFH days (paid even without a punch)**. Ticked = every ticked weekday that is a holiday (Settings > Holidays) or a WFH day is paid, even with "Pay only on days present" on. For an every-day allowance tick all 7 days.
- "Working day (every work day)" already includes holidays and WFH days.

Files: js/pages/payslips.js, js/core/payroll-calc.js, js/pages/loans.js. Code.gs not needed.
