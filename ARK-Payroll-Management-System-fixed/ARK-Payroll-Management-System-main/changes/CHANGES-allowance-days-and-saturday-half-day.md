# Update – weekday allowances + Saturday half day

## How to install
1. Replace the web files on GitHub Pages: `index.html` and the `js/` folder (new file: `js/settings/saturday.js`).
2. Apps Script: paste the new `backend/Code.gs` (only the ALLOWANCES backup sheet changed) -> Deploy -> Manage deployments -> Edit -> **New version**.
3. Open Settings -> **Saturday half day**, check the departments, press **Save settings**.

## 1. Allowance on chosen days of the week
Allowances -> pick the employee -> **Paid: Selected days of the week** -> tick the days (e.g. Mon, Wed, Fri) -> Amount = pesos per day.
- "Pay only on days present (DTR)": a day counts only when the biometric/DTR has a punch that day. Absent, leave and holiday days are not paid.
  Untick it to pay every ticked weekday of the period (holidays are still skipped).
- Payslip shows e.g. `Transportation (4 days x 100.00)`. The Allowances sheet/backup shows "Per day: Mon, Wed, Fri".
- Old allowances (Month / Working day) work exactly as before.

## 2. Saturday half day (Settings -> Saturday half day)
- Departments ticked there (default: Finance, Registrar, IT, Marketing, Administrative, Executive) work **8:00 AM - 12:00 noon** on Saturday.
  Names are matched loosely: "Accounting / Finance" = Finance, "Administration" = Administrative. Exceptions can be set per employee.
- The day is still **paid as one full day**: the monthly pay already covers Saturday, so nothing is deducted. Late / early out / absent are checked against 8:00 - 12:00.
- **Saturday overtime** starts at 1:00 PM (12:00 - 1:00 not counted) and is paid only when allowed that day:
  - "Only when allowed that day" (default): file the hours in the Overtime File for that Saturday.
  - "Automatic": uses the biometric time out for people allowed overtime (Settings -> Overtime).
- Everybody else (and teachers) keeps their normal Saturday.
