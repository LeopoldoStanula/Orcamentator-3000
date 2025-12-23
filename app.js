const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let financeData = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let charts = [];

const money = v =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

fetch(API_URL)
  .then(r => r.json())
  .then(data => {
    financeData = data;
    data.forEach(d => visibleYears.add(d.year));
    initYearFilters();
    initTabs();
    renderOverview();
  });

function filteredData() {
  return financeData.filter(d => visibleYears.has(d.year));
}

/* ---------- FILTROS ---------- */

function initYearFilters() {
  const div = document.getElementById('year-filters');
  div.innerHTML = '';

  financeData.forEach(d => {
    const btn = document.createElement('button');
    btn.textContent = d.year;
    btn.classList.add('active');
    btn.onclick = () => {
      btn.classList.toggle('active');
      btn.classList.contains('active')
        ? visibleYears.add(d.year)
        : visibleYears.delete(d.year);
      refreshView();
    };
    div.appendChild(btn);
  });
}

/* ---------- ABAS ---------- */

function initTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';

  tabs.appendChild(createTab('Visão Geral', () => {
    currentCategory = null;
    renderOverview();
  }));

  Object.keys(financeData[0])
    .filter(k => k !== 'year' && k !== 'GANHO BRUTO')
    .forEach(cat => {
      tabs.appendChild(createTab(cat, () => {
        currentCategory = cat;
        renderCategory();
      }));
    });
}

function createTab(label, action) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    action();
  };
  return btn;
}

/* ---------- OVERVIEW ---------- */

function renderOverview() {
  const data = filteredData();
  const expenseKeys = Object.keys(data[0]).filter(k => k !== 'year' && k !== 'GANHO BRUTO');

  const totals = data.map(d => {
    const expenses = expenseKeys.reduce((s, k) => s + d[k], 0);
    return {
      year: d.year,
      expense: expenses,
      income: d['GANHO BRUTO'],
      ratio: (expenses / d['GANHO BRUTO']) * 100
    };
  });

  renderTable(
    ['Ano', 'Perda Total', 'Ganho Total', 'Relação Gasto/Ganho (%)'],
    totals.map(t => ({
      Ano: t.year,
      'Perda Total': money(t.expense),
      'Ganho Total': money(t.income),
      'Relação Gasto/Ganho (%)': `${t.ratio.toFixed(2)}%`
    }))
  );

  renderSummary(data, expenseKeys);
  renderCharts(totals);
}

/* ---------- SUMMARY ---------- */

function renderSummary(data, expenseKeys) {
  const box = document.getElementById('summary-boxes');
  const totalMonths = data.length * 12;

  const totalIncome = data.reduce((s, d) => s + d['GANHO BRUTO'], 0);
  const totalExpense = data.reduce(
    (s, d) => s + expenseKeys.reduce((a, k) => a + d[k], 0), 0
  );

  box.innerHTML = `
    <div class="summary-box">Média mensal de ganhos<br><strong>${money(totalIncome / totalMonths)}</strong></div>
    <div class="summary-box">Média mensal de gastos<br><strong>${money(totalExpense / totalMonths)}</strong></div>
    <div class="summary-box">Relação Gasto/Ganho<br><strong>${((totalExpense / totalIncome) * 100).toFixed(2)}%</strong></div>
  `;
}

/* ---------- CATEGORIA ---------- */

function renderCategory() {
  const data = filteredData();
  const expenseKeys = Object.keys(data[0]).filter(k => k !== 'year' && k !== 'GANHO BRUTO');

  renderTable(
    ['Ano', 'Valor Anual', 'Média Mensal', 'Relação Gasto/Ganho (%)'],
    data.map(d => {
      const totalExpense = expenseKeys.reduce((s, k) => s + d[k], 0);
      return {
        Ano: d.year,
        'Valor Anual': money(d[currentCategory]),
        'Média Mensal': money(d[currentCategory] / 12),
        'Relação Gasto/Ganho (%)': ((d[currentCategory] / totalExpense) * 100).toFixed(2) + '%'
      };
    })
  );

  renderSingleChart(
    data.map(d => d.year),
    data.map(d => d[currentCategory]),
    '#ff9800'
  );
}

/* ---------- TABELA ---------- */

function renderTable(headers, rows) {
  const thead = document.querySelector('thead');
  const tbody = document.querySelector('tbody');

  thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = showValues ? r[h] : '-';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/* ---------- GRÁFICOS ---------- */

function renderCharts(totals) {
  charts.forEach(c => c.destroy());
  charts = [];

  charts.push(new Chart(document.getElementById('chart-expense'), {
    type: 'line',
    data: {
      labels: totals.map(t => t.year),
      datasets: [{ data: totals.map(t => t.expense), borderColor: '#ff9800', tension: 0.3 }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  }));

  charts.push(new Chart(document.getElementById('chart-income'), {
    type: 'line',
    data: {
      labels: totals.map(t => t.year),
      datasets: [{ data: totals.map(t => t.income), borderColor: '#4caf50', tension: 0.3 }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  }));
}

function renderSingleChart(labels, values, color) {
  charts.forEach(c => c.destroy());
  charts = [
    new Chart(document.getElementById('chart-expense'), {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: color, tension: 0.3 }] },
      options: { scales: { y: { beginAtZero: true } } }
    })
  ];
}

function refreshView() {
  currentCategory ? renderCategory() : renderOverview();
}

document.getElementById('toggleValues').addEventListener('change', e => {
  showValues = e.target.checked;
  refreshView();
});
