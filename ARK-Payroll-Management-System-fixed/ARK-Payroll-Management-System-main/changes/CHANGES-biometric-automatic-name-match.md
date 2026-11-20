# Biometric upload: automatic match by name (stronger)

The DTR upload already matched a biometric record to an employee by name, but it gave up ("Not matched") whenever the name in the file was written a little differently. It now also matches:
- a full middle name in the file (employee file has only the M.I.): `SANTOS MARIA ELENA RAMOS`, `GARCIA, JOSE MANUEL` (M = Garcia's M.I.)
- initials instead of given names: `DELA CRUZ, J.C.`, `DELACRUZ JC`, `SANTOS, M. ELENA`, `BAUTISTA R`
- names cut short by the device: `DELA CRUZ JUAN CAR`
- the same as before: Last, First / First Last order, glued surnames (DELACRUZ), Ma. / Maria, accents, one-letter typos.
A DIFFERENT middle initial or middle name is still NOT matched (probably another person): link it by hand.
Order of trust is unchanged: manual link > name in the file > same ID number. If two employees fit equally well it is listed as "fits several".

Records that still cannot be decided (DTR > Not matched to an employee):
- the best guess is pre-selected and marked "(suggested)" (2 or more name parts agree and nobody else fits as well);
- new button **Link all suggested** saves all of them at once; the links are remembered for the next upload.

Files: js/dtr/punches.js (nameScore), js/pages/dtr.js. Code.gs not needed.

## First name only
A record that has only a first name in the file (`JUAN`, `JUAN CARLOS`, `ELENA`) is matched to the employee with that given name, shown as matched by "first name".
- Only when ONE employee has that first name. If two or more do (e.g. `MARIA`), it is listed under "Not matched" as "fits several"; if the file also has an ID number equal to one of those employees' numbers, the ID decides.
- A full or partial name that fits better (surname present) always wins over a first-name-only match.
File: js/dtr/punches.js (firstNameOnly, matchName)

## Manual links are saved in the main database and the backup
Until now a biometric record you linked by hand (DTR > Not matched to an employee > Link to employee / Link all suggested / Unlink) was kept only in the browser. Now:
- **Main database**: new tab `Biometric Links` (Link key, Biometric ID, Device, Name in file, Employee ID, Employee No, Employee name, Linked by, Linked at). Saved at every link / unlink; an unlink removes the row.
- **Backup report**: new sheet `BIOMETRIC LINKS` (Biometric ID, Device, Name in file, Employee No, Employee name, Linked by, Linked at), refreshed with the other sheets (a minute after a change, nightly, or Update backup report).
- **On sign-in** the app loads the links from the database, so they are there on a new computer or after clearing the browser. The first time a browser signs in after this update, the links it already had are added to the database once.
- Only links made by hand are stored; records matched automatically by name are recomputed at every upload.

## How to install
1. Replace the web files (js/dtr/punches.js, js/pages/dtr.js, js/app/auth.js).
2. Apps Script: paste the new `backend/Code.gs` (your MY_DATABASE_URL is already in it) -> Deploy -> Manage deployments -> Edit -> New version. The first request creates the `Biometric Links` tab (10-20 seconds).
