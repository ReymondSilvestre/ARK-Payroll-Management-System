/* ============================================================
   SETTINGS: TIN / Tax computation (Philippines) - withholding tax method, brackets, minimum wage earner rule, employer TIN.
   File: js/settings/tax.js
   ============================================================ */

/** BIR income tax table for 2023 onward (TRAIN law): yearly taxable income. */
const TRAIN_BRACKETS = [{ over: 0, rate: 0, base: 0 }, { over: 250000, rate: 15, base: 0 }, { over: 400000, rate: 20, base: 22500 }, { over: 800000, rate: 25, base: 102500 }, { over: 2000000, rate: 30, base: 402500 }, { over: 8000000, rate: 35, base: 2202500 }];

const taxRow = (b) => `<tr data-tb><td><input type="number" step="any" class="tbo" value="${esc(b.over)}"></td><td><input type="number" step="any" class="tbr" value="${esc(b.rate)}"></td><td><input type="number" step="any" class="tbb" value="${esc(b.base)}"></td><td><button class="btn sm d" type="button" data-tbx>Remove</button></td></tr>`;

function taxHTML(S) {
  const T = S.tax, sel = (id, l, v, a, b) => `<div><label>${l}</label><select id="${id}"><option value="1">${a}</option><option value="0" ${v === false ? "selected" : ""}>${b}</option></select></div>`, n = (id, l, v) => `<div><label>${l}</label><input type="number" step="any" id="${id}" value="${v}"></div>`;
  return `<div data-sp="tax" ${spHide("tax")}><h3>TIN / Tax computation (Philippines)</h3>
  <p class="muted">How the withholding tax on compensation is computed on every payroll. Each employee's own TIN is typed under Employees (it is printed on the payslip and the tax report).</p>
  <h4 style="margin:.6rem 0 .3rem">Employer (school)</h4>
  <div class="form"><div><label>Employer name</label><input id="tx_en" value="${esc(T.employerName || "")}" placeholder="ARK Technological Institute Education System Inc"></div><div><label>Employer TIN</label><input id="tx_et" value="${esc(T.employerTin || "")}" placeholder="000-000-000-000"></div><div><label>BIR RDO code</label><input id="tx_rdo" value="${esc(T.rdo || "")}" placeholder="e.g. 056"></div></div>
  <h4 style="margin:1rem 0 .3rem">Withholding tax computation</h4>
  <div class="form">${sel("s_tax", "Withholding tax", T.on, "On - computed automatically", "Off - no tax withheld").replace('value="0" ', 'value="0" ')}
  <div><label>Method</label><select id="tx_m"><option value="bracket">Graduated rates (TRAIN table, yearly)</option><option value="flat" ${T.method === "flat" ? "selected" : ""}>Flat percentage of the pay</option></select></div>
  ${sel("tx_mwe", "Minimum wage earners (MWE)", !T.mweExempt ? false : true, "Exempt from tax (daily rate at or below the minimum wage)", "Taxed like everyone else").replace('<option value="1">', '<option value="1">')}
  ${sel("tx_ac", "Taxable pay is reduced by SSS, PhilHealth and Pag-IBIG", T.afterContrib, "Yes (mandatory contributions are tax-free)", "No (tax on the full pay)")}
  ${sel("tx_al", "Include taxable allowances in the taxable pay", T.includeAllowances, "Yes (unless the allowance is marked non-taxable)", "No (allowances are not taxed)")}
  ${n("tx_fr", "Flat method: tax rate (%)", T.flatRate || 0)}${n("tx_fo", "Flat method: monthly pay exempt from tax (\u20B1)", T.flatOver || 0)}</div>
  <h4 style="margin:1rem 0 .3rem">Graduated tax table (yearly taxable income)</h4>
  <p class="muted">Tax = base amount + rate % of the income over the lower limit. The first row is the tax-free income (\u20B10 tax up to the next row's limit). Use the BIR table in force; the default is the 2023-onward TRAIN table.</p>
  <div class="tw"><table id="tbtab"><tr><th>Income over (\u20B1 / year)</th><th>Rate (%)</th><th>Plus base tax (\u20B1)</th><th></th></tr>${T.brackets.map(taxRow).join("")}</table></div>
  <p><button class="btn" id="atb" type="button">+ Add bracket</button> <button class="btn" id="rtb" type="button">Reset to TRAIN table (2023+)</button></p>
  <p class="muted">Press <b>Save settings</b> to keep the change. An employee can still be set to &ldquo;Do not deduct&rdquo; tax, or given a fixed monthly tax, under Employees &rarr; Add information.</p></div>`;
}

function taxInit() {
  const t = $("#tbtab"); if (!t) return;
  $("#atb").onclick = () => t.insertAdjacentHTML("beforeend", taxRow({ over: 0, rate: 0, base: 0 }));
  $("#rtb").onclick = () => { if (confirm("Replace the table with the BIR TRAIN table (2023 onward)?")) t.innerHTML = "<tr><th>Income over (\u20B1 / year)</th><th>Rate (%)</th><th>Plus base tax (\u20B1)</th><th></th></tr>" + TRAIN_BRACKETS.map(taxRow).join(""); };
  t.onclick = (e) => { const b = e.target.closest("[data-tbx]"); if (b && t.querySelectorAll("[data-tb]").length > 1) b.closest("tr").remove(); };
}

function taxCollect() {
  const T = ST.settings.tax, v = (id) => $("#" + id).value, num = (x) => (isNaN(+x) ? 0 : +x);
  const L = [...document.querySelectorAll("[data-tb]")].map((r) => ({ over: num($(".tbo", r).value), rate: num($(".tbr", r).value), base: num($(".tbb", r).value) })).sort((a, b) => a.over - b.over);
  if (L.length) T.brackets = L;
  Object.assign(T, { on: v("s_tax") === "1", method: v("tx_m"), mweExempt: v("tx_mwe") === "1", afterContrib: v("tx_ac") === "1", includeAllowances: v("tx_al") === "1", flatRate: Math.max(0, num(v("tx_fr"))), flatOver: Math.max(0, num(v("tx_fo"))), employerName: v("tx_en").trim(), employerTin: v("tx_et").trim(), rdo: v("tx_rdo").trim() });
}
