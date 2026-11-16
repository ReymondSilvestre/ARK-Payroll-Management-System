/* ============================================================
   START THE APP - must stay the LAST script (everything above must already be defined).
   File: js/app/boot.js
   ============================================================ */

token ? load().catch(showLogin) : showLogin();

