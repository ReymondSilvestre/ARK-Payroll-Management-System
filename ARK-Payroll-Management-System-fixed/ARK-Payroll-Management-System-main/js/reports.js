(() => {
  const REPORT_OPTIONS = [
    { value: 'monthly', label: 'Monthly Salary per Cut Off / Month' },
    { value: 'cashAdvances', label: 'Cash Advances Records' },
    { value: 'loans', label: 'Loan Records' },
    { value: 'govt', label: 'Government Mandate Deductions (SSS, PhilHealth, Pag-IBIG, TIN)' }
  ];

  function money(n) {
    return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function nameOf(e) {
    if (!e) return '';
    if (e.name) return e.name;
    const full = [e.first, e.mi ? `${e.mi}.` : '', e.last].filter(Boolean).join(' ');
    return full || '';
  }

  function renderReport(kind) {
    const list = window.ST || { employees: [], runs: [] };
    const employees = list.employees || [];
    const runs = list.runs || [];

    if (kind === 'monthly') {
      const rows = runs.map((run) => ({
        period: run.period || 'N/A',
        count: run.count || 0,
        gross: run.gross || 0,
        net: run.net || 0,
        payDate: run.payDate || '-'
      }));
      return `
        <div class="report-card">
          <div class="report-filter">
            <div>
              <label>Payroll period</label>
              <select id="report-month-select">
                <option value="all">All periods</option>
                ${rows.map((r) => `<option value="${r.period}">${r.period}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="report-grid">
            ${rows.length ? rows.slice(-4).map((r) => `
              <div class="report-metric">
                <small>${r.period}</small>
                <strong>₱ ${money(r.net)}</strong>
                <div class="muted">Employees: ${r.count}</div>
                <div class="muted">Gross: ₱ ${money(r.gross)}</div>
              </div>
            `).join('') : '<div class="muted">No payroll data yet.</div>'}
          </div>
        </div>
      `;
    }

    if (kind === 'cashAdvances') {
      const cash = employees.filter((e) => (e.ca && Number(e.ca.balance) > 0)).map((e) => ({
        name: nameOf(e),
        no: e.no || '-',
        balance: Number((e.ca && e.ca.balance) || 0)
      }));
      return `
        <div class="report-card">
          <div class="report-grid">
            ${cash.length ? cash.map((x) => `
              <div class="report-metric">
                <small>${x.no}</small>
                <strong>${x.name}</strong>
                <div class="muted">Cash advance balance: ₱ ${money(x.balance)}</div>
              </div>
            `).join('') : '<div class="muted">No cash advance records found.</div>'}
          </div>
        </div>
      `;
    }

    if (kind === 'loans') {
      const loans = employees.filter((e) => Array.isArray(e.deductions) && e.deductions.length).map((e) => ({
        name: nameOf(e),
        no: e.no || '-',
        loanTotal: (e.deductions || []).reduce((sum, row) => sum + Number(row.amount || 0) + Number(row.balance || 0), 0)
      }));
      return `
        <div class="report-card">
          <div class="report-grid">
            ${loans.length ? loans.map((x) => `
              <div class="report-metric">
                <small>${x.no}</small>
                <strong>${x.name}</strong>
                <div class="muted">Loan total: ₱ ${money(x.loanTotal)}</div>
              </div>
            `).join('') : '<div class="muted">No loan records found.</div>'}
          </div>
        </div>
      `;
    }

    const mandateRows = employees.map((e) => ({
      name: nameOf(e),
      no: e.no || '-',
      sss: e.sssNo || '-',
      philhealth: e.philhealthNo || '-',
      pagibig: e.pagibigNo || '-',
      tin: e.tin || '-'
    }));

    return `
      <div class="report-card">
        <div class="report-grid">
          ${mandateRows.length ? mandateRows.slice(0, 20).map((x) => `
            <div class="report-metric">
              <small>${x.no}</small>
              <strong>${x.name}</strong>
              <div class="muted">SSS: ${x.sss}</div>
              <div class="muted">PhilHealth: ${x.philhealth}</div>
              <div class="muted">Pag-IBIG: ${x.pagibig}</div>
              <div class="muted">TIN: ${x.tin}</div>
            </div>
          `).join('') : '<div class="muted">No government mandate data found.</div>'}
        </div>
      </div>
    `;
  }

  function replaceReportsView() {
    if (typeof window.rep !== 'function') return;
    const oldRep = window.rep;
    window.rep = function rep() {
      const reportKind = 'monthly';
      const content = `
        <div class="card">
          <h3>Reports</h3>
          <div class="report-filter">
            <div>
              <label>Report type</label>
              <select id="report-type-select">
                ${REPORT_OPTIONS.map((opt) => `<option value="${opt.value}" ${opt.value === reportKind ? 'selected' : ''}>${opt.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div id="report-output" style="margin-top: 14px;">${renderReport(reportKind)}</div>
        </div>
      `;
      const container = document.getElementById('v');
      if (container) {
        container.innerHTML = content;
        const select = document.getElementById('report-type-select');
        select.addEventListener('change', (event) => {
          const out = document.getElementById('report-output');
          out.innerHTML = renderReport(event.target.value);
        });
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    replaceReportsView();
  });
})();
