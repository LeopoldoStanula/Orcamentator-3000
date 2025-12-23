const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let data = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let chart;

const money = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

fetch(API_URL)
  .then(r => r.json())
  .then(json => {
    data = json;
    data.forEach(d => visibleYears.add(d.year));
    initYearFilters();
    initTabs();
    renderOverview();
  });

function filtered() {
  return data.filter(d => visibleYears.has(d.year));
}

/* ---------- OVERVIEW ---------- */

function renderOverview() {
  const rows = filtered();

  const expenseKeys = Object.keys(rows[0])
    .filter(k => k !== 'year' && k !== 'GANHO BRUTO');

  const totals = rows.map(d => {
    const expenses = expenseKeys
      .map(k => d[k])
      .filter(v => v > 0)
      .reduce((a, b) => a + b, 0);

    const income = d['GANHO BRUTO'] > 0 ? d['GANHO BRUTO'] : 0;

    return {
      year: d.year,
      expense: expenses,
      income,
      ratio: income > 0 ? (expenses / income) * 100 : null
    };
  });

  renderTable(
    ['Ano', 'Perda Total', 'Ganho Total', 'Relação Gasto/Ganho (%)'],
    totals.map(t => ({
      Ano: t.year,
      'Perda Total': money(t.expense),
      'Ganho Total': money(t.income),
      'Relação Gasto/Ganho (%)': t.ratio !== null ? t.ratio.toFixed(2) + '%' : '-'
    }))
  );

  renderSummary(totals);
  renderChart(totals);
}

/* ---------- SUMMARY ---------- */

function renderSummary(totals) {
  const box = document.getElementById('summary-boxes');

  const validIncomeYears = totals.filter(t => t.income > 0).length;
  const validExpenseYears = totals.filter(t => t.expense > 0).length;

  const totalIncome = totals.reduce((s, t) => s + t.income, 0);
  const totalExpense = totals.reduce((s, t) => s + t.expense, 0);

  box.innerHTML = `
    <div class="summary-box">Média mensal ganhos<br><strong>${money(totalIncome / (validIncomeYears * 12))}</strong></div>
    <div class="summary-box">Média mensal gastos<br><strong>${money(totalExpense / (validExpenseYears * 12))}</strong></div>
    <div class="summary-box">Relação total<br><strong>${((totalExpense / totalIncome) * 100).toFixed(2)}%</strong></div>
  `;
}

/* ---------- CATEGORIA ---------- */

function renderCategory() {
  const rows = filtered();
  const expenseKeys = Object.keys(rows[0])
    .filter(k => k !== 'year' && k !== 'GANHO BRUTO');

  renderTable(
    currentCategory === 'GANHO BRUTO'
      ? ['Ano', 'Valor Anual', 'Média Mensal']
      : ['Ano', 'Valor Anual', 'Média Mensal', 'Relação Gasto/Ganho (%)'],

    rows.map(d => {
      const value = d[currentCategory];
      const months = value > 0 ? 12 : 0;
      const avg = months ? value / months : 0;

      const totalExpense = expenseKeys.reduce((s, k) => s + (d[k] > 0 ? d[k] : 0), 0);

      return {
        Ano: d.year,
        'Valor Anual': money(value),
        'Média Mensal': months ? money(avg) : '-',
        'Relação Gasto/Ganho (%)':
          currentCategory === 'GANHO BRUTO'
            ? undefined
            : totalExpense > 0
              ? ((value / totalExpense) * 100).toFixed(2) + '%'
              : '-'
      };
    })
  );
}

/* ---------- TABLE ---------- */

function renderTable(headers, rows) {
  const thead = document.querySelector('thead');
  const tbody = document.querySelector('tbody');

  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = showValues && r[h] !== undefined ? r[h] : '-';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/* ---------- CHART ---------- */

function renderChart(totals) {
  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('chart'), {
    type: 'line',
    data: {
      labels: totals.map(t => t.year),
      datasets: [
        {
          label: 'Gastos',
          data: totals.map(t => t.expense),
          borderColor: '#ff9800'
        },
        {
          label: 'Ganhos',
          data: totals.map(t => t.income),
          borderColor: '#4caf50'
        }
      ]
    },
    options: {
      scales: { y: { beginAtZero: true } }
    }
  });
}

/* ---------- UI ---------- */

function refresh() {
  currentCategory ? renderCategory() : renderOverview();
}

document.getElementById('toggleValues').onchange = e => {
  showValues = e.target.checked;
  refresh();
};

document.getElementById('toggleExpense').onchange = e => {
  chart.data.datasets[0].hidden = !e.target.checked;
  chart.update();
};

document.getElementById('toggleIncome').onchange = e => {
  chart.data.datasets[1].hidden = !e.target.checked;
  chart.update();
};
