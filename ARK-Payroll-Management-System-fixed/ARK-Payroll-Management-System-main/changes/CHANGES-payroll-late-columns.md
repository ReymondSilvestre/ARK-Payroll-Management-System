# Update: late columns in the Payroll tab
Files changed: js/pages/payroll.js only. No change to backend/Code.gs.

- Teachers: new column "Late hours deducted" beside Hours taught (H:MM, with the peso amount, number of late days and the actual late minutes after grace). Same figure as the Late line on the payslip.
- Staff / admins: new column "Late days" (number of days late from the DTR) beside Late min.
- Why Hours taught and late did not match: the Class DTR / Class check show the real late minutes after the grace period (e.g. 5 min), but payroll deducts late per whole hour, rounded up (5 min = 1:00). Hours taught is already reduced by that 1:00.
