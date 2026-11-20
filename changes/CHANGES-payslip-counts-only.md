# Payslip: no "x rate" computations, only the numbers

- Earnings lines show only the name and amount: "Regular Pay", "Holiday pay", the allowance name (e.g. "Meal"), "Teaching pay". The "(13 regular working days x P600.00)" style text is removed everywhere on the payslip (Regular Pay, Holiday pay, allowances, half day, late note).
- The summary row above EARNINGS now shows the numbers: Rate, No. of work days, No. of holidays, Allowance days, Days absent, Overtime. (Days present and the "Holiday pay: P..." note under paid days were removed.) With allowances that have different day counts, each is listed by name.
- Teachers: Rate per hour, Hours taught, No. of holidays, Allowance days, Days absent (-), Overtime.
- Minus lines: "Less: Absences", "Less: Half day", "Less: Meal (absent)", "Less: Late (h:mm)", "Less: Undertime".
Includes the earlier changes (late / undertime and daily allowance minus when absent).
File: js/pages/payslips.js (plus js/core/payroll-calc.js from the previous update)

## Update: allowance for absent days is inside "Less: Absences"
- There is no separate "Less: Meal (absent)" line any more. "Less: Absences" = absent days x daily rate + the daily allowance not paid for those days (one minus line, one amount).
- Gross pay, total deductions and net pay are unchanged by this (same total, one line).
