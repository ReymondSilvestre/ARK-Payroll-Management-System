# Daily allowance is taken off for absent days (minus on the payslip)

- A daily allowance (Allowances > Paid: Working day / per day) is no longer paid for a day the employee is absent. Absent days (a half day counts as the half-day value in Settings, unpaid leave counts as a full day) x the daily amount are taken off.
- Weekday allowances (Mon, Wed, Fri ...) with "Pay only on days present" already skip absent days, so nothing is taken off twice. Weekday allowances with that option OFF lose the ticked weekdays on which the employee was absent or on unpaid leave.
- Payslip: the allowance line stays at the full amount, then a minus line is added on the EARNINGS side, e.g. "Less: Meal (2 days absent x P50.00) -P100.00". GROSS PAY is lower by that amount.
- NET PAY is lower by the allowance that is not paid (this is a real change in pay, not only a display change).
- The amount is also counted in TOTAL DEDUCTIONS of the Payroll page / reports (new field calc.allowLess), the same way absences are. The 13th month pay is not affected (allowances are not part of it).
- Teachers (paid per hour) are not affected.
- Payslips already saved keep their old figures: open the payroll for that cut-off and save it again.
Files: js/core/payroll-calc.js, js/pages/payslips.js (Code.gs not needed)
