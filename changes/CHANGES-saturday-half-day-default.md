# Fix - Saturday half day: Maintenance and Security stay unchecked

Files changed (replace these on your web host / GitHub Pages):
- js/core/settings.js   (default now has off: ["Maintenance", "Security"])
- js/dtr/rules.js       (a department in the "off" list never gets the half-day Saturday)
- js/settings/saturday.js (unchecked departments are saved as "off"; the list shows them unchecked)
- js/app/migrations.js + js/app/auth.js (one-time clean-up of already-saved settings)

After uploading: hard refresh (Ctrl+F5), open Settings > Saturday half day, press Save settings once.
Code.gs is NOT changed.
