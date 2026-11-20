# Payslip: Regular Pay, Holiday pay below it, Paid days by cut-off

- js/pages/payslips.js: "Basic pay" is now **Regular Pay**; the **Holiday pay** line comes right below it (shown when there is holiday pay for the period).
- js/core/payroll-calc.js: **Paid days** now counts the working days (Settings work days, Mon-Sat by default, holidays included) from the first to the last date of the cut-off, so 1st-15th, 16th-end, 26th-10th, 11th-25th and custom periods each show their own number (before: a fixed work days / 2).
- No change to the amounts, Code.gs not needed. Payslips already saved keep the Paid days they were saved with; open the payroll and save it again to refresh.
