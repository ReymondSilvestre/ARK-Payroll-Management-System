/* ============================================================
   APP STATE - API url, tiny helpers ($, esc, money), the ST state object, school details.
   File: js/app/state.js
   ============================================================ */

const API_URL = "https://script.google.com/macros/s/AKfycbziiRmj072ytw_7bT42ia3EGimasoL74xoXwZJFttyyqZbuLeL4KQng8OUUVRbon_Fc/exec";

const $ = (s, r = document) => r.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const money = (n) => (+n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const A = $("#app");

 let ST = { user: null, settings: DEFAULT_SETTINGS, employees: [], runs: [], tab: "dash", sheet: "", users: [], run: null };

let token = localStorage.getItem("pms.token") || "";

const SCHOOL = { name: "ARK Technological Institute Education System Inc.", address: "J-Seven Bldg. Magallanes Cor. Granja St. Brgy 7 Lucena City", contact: "717-65-10 or at 0907-365-6617" };

