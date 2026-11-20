# Edit employee: "Birthday is required" although a birthday was typed

Cause: the Birthday / Date hired boxes are date boxes, which can only show and return yyyy-mm-dd. A date saved in another form (5/20/1990, May 20, 1990, 1990-05-20T00:00:00Z, an Excel date number ... e.g. from an Excel upload or typed in the sheet) showed as an EMPTY box, so the form read "" and refused to save (and Date hired of such an employee was silently saved as blank).

Fix (js/pages/employees.js):
- The form converts any of these date forms to yyyy-mm-dd before showing it, so the saved birthday / date hired is shown in the box and is kept.
- If the box is half typed (month/day/year not complete) the message now says so ("Birthday is not complete: type the month, day and year, or pick it from the calendar").
- If the saved value is not a real date at all, the message shows it ("The saved value "..." is not a valid date: pick the date again").
Code.gs not needed.
