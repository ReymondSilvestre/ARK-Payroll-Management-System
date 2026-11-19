# Two biometric devices (Main Building / Annex Building)

Upload both buildings' files and the app joins them per employee **by name**.
Example: teacher time in at Main Building, time out at Annex Building -> one DTR line (first punch = in, last = out).

## How to use
DTR -> Biometric files -> choose the **Biometric device / building** from the drop-down (Main Building or Annex Building) -> choose that device's file -> upload.
Repeat for the other building. Old uploads made before this change (no building) keep working.

## What changed
- js/pages/dtr.js: new "Biometric device / building" box; punches are saved as `Main Building|ID`, so the same ID number on two devices never mixes two people.
- js/dtr/punches.js: helpers devKey / keyDev / keyId / keyLabel / devOf; the ID fallback ignores the building prefix; name matching (and manual Link) already joins the same person's records from both devices.
- js/dtr/dtr-calc.js: when time in and time out came from different buildings, the DTR Remarks show "In: Main Building, Out: Annex Building".
- Old uploads (no building) keep working.

## Note
If a person has no name in one device's export, the file's ID can't be matched across buildings: use "Not matched to an employee" to link that ID to the employee once (remembered for next uploads).
