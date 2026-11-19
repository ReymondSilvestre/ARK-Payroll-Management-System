# Update: schedule upload, class check as teacher biometric, payslip deduction reasons

No change to backend/Code.gs - replace only the web files (js/, index.html unchanged).
Files changed: js/pages/class-monitor.js, js/pages/payroll.js, js/core/payroll-calc.js, js/pages/payslips.js

## 1. Class schedule upload (Class check > Class schedule)
- Templates: Excel with examples, Excel with all your teachers' names, CSV, and "Download current schedule" (edit it and upload again).
- Upload .xlsx / .xls / .csv -> preview with every problem listed per row (teacher not found, bad time, overlap...). Nothing is saved until you press Import.
- Days: Mon, Wed, Fri | MWF | TTh | Mon-Fri | weekdays.  Times: 6:00 AM, 18:30 (no AM/PM: 1:00-6:59 is read as PM, flagged in the preview).
- Import modes: replace the classes of the teachers in the file (default) / add to existing / replace the whole school schedule.
- Removing a saved class now switches it off instead of erasing it, so its past class checks still count in payroll.

## 2. Class check = teacher's biometric for payroll hours
- Payroll > Teachers: "Hours taught" now comes from the class check. Shown under it: counted vs scheduled hours, absent, not checked, no clock-out.
- Paid time per class = later of (class start, time in) to earlier of (class end, time out). Time in within the grace minutes counts from class start.
- Absent / not clocked in = not paid. No clock-out: counted to class end (or not counted - your choice).
- Rule is in Class schedule tab > "Payroll rule" (class check or old DTR way). A teacher with no class in the schedule keeps using DTR hours. Typing hours by hand still overrides.
- Past records keep their own start/end, so editing the schedule never changes old pay.
- Report column is now "Hours counted for pay" (same rule as payroll).

## 3. Payslip: every deduction says what it is for
- Absences (dates + reason: no punch / no time out), unpaid leave (type + dates), late (dates and minutes, rate), holiday / WFH deductions (which day, % paid), SSS / PhilHealth / Pag-IBIG (employee share, which cut-off), tax (basis), each loan separately with balance before/after, cash advance with balance, other deduction with the typed reason.
- Payroll table has a new "Reason (other ded)" box; Finalize warns if an Other deduction has no reason.
- Teacher payslip shows a class-check line (scheduled, taught, late/absent not paid).
