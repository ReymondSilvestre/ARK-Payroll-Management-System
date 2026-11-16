/* ============================================================
   SERVER CALLS - api() to the Google Apps Script backend (backend/Code.gs), loading messages.
   File: js/app/api.js
   ============================================================ */

async function api(action, data) {
  $("#busy").style.display = "flex";
  try {
    let r, t, j;
    try { r = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, token, data, ...(action === "login" ? data : {}) }) }); t = await r.text(); }
    catch (e) { throw new Error("Cannot reach the server. In Apps Script deploy a NEW VERSION as Web app with 'Who has access: Anyone', then reload."); }
    try { j = JSON.parse(t); } catch (e) { throw new Error("The server did not return data. Set 'Who has access' to Anyone and deploy a New version of Code.gs."); }
    if (!j.ok) { const m = typeof j.error === "string" ? j.error : (j.error && j.error.message) || "Server error"; if (m === "unauthenticated") { logout(); throw new Error("Session expired. Please sign in again."); } if (j.error && typeof j.error === "object") throw new Error("The deployed script is the old one (not this Payroll Code.gs). Paste the new Code.gs and deploy a New version."); throw new Error(m); }
    return j.data;
  } catch (e) { toast(e.message || "No connection.", true); throw e; } finally { $("#busy").style.display = "none"; }
}

async function checkApi() {
  const el = $("#st"); if (!el) return;
  try { const r = await fetch(API_URL), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    if (j && j.ok && /Payroll Management System/.test(j.data)) { if (j.version) { el.textContent = "Server connected. Code version: " + j.version; el.style.color = "#1a7f37"; } else { el.textContent = "Server connected but it is running OLD Code.gs (no backup/database features). Paste the new Code.gs and deploy a New version."; el.style.color = "#7a0c14"; } }
    else if (j) { el.textContent = "Server answers but it is NOT the Payroll Code.gs. Paste the new Code.gs and deploy a New version."; el.style.color = "#7a0c14"; }
    else { el.textContent = "Server not public. Deploy as Web app, Who has access: Anyone."; el.style.color = "#7a0c14"; }
  } catch (e) { el.textContent = "Cannot reach the server. Check the URL / deployment access (Anyone)."; el.style.color = "#7a0c14"; }
}

/* ===== v2: loading animations, 3 payroll sections, cash loan, holidays, biometric DTR ===== */
const BUSY = { login: "Signing in", bootstrap: "Loading your data", getRun: "Loading payslips", saveRun: "Saving payroll", saveEmployees: "Saving", saveSettings: "Saving settings", deleteRun: "Deleting payroll", deleteEmployee: "Deleting employee", saveLeave: "Saving leave", deleteLeave: "Deleting leave" };

const _api = api;

api = async (a, d) => { const w = BUSY[a] || (/^(save|add|set|toggle)/.test(a) ? "Saving" : "Loading"); $("#busy").innerHTML = `<div class="bx"><div class="spin"></div><b>${w}</b><div class="bar"><i></i></div></div>`; return _api(a, d); };

