const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let financeData = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let myChart = null;

const money = v => 
    (v === null || v === undefined || isNaN(v) || v === 0) ? "R$ 0,00" : 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Normaliza as chaves do objeto para evitar erro de Ganho Bruto vs GANHO BRUTO
function normalizeData(data) {
    return data.map(item => {
        const normalized = {};
        for (let key in item) {
            // Remove espaços e deixa tudo em maiúsculo para comparação segura
            const cleanKey = key.trim().toUpperCase();
            normalized[cleanKey] = item[key];
        }
        return normalized;
    });
}

fetch(API_URL)
    .then(r => r.json())
    .then(data => {
        financeData = normalizeData(data).filter(d => d.YEAR || d.YEAR === 0);
        financeData.forEach(d => visibleYears.add(d.YEAR));
        initYearFilters();
        initTabs();
        refreshView();
    });

function initYearFilters() {
    const div = document.getElementById('year-filters');
    div.innerHTML = '';
    const years = [...new Set(financeData.map(d => d.YEAR))].sort();
    years.forEach(year => {
        const btn = document.createElement('button');
        btn.textContent = year;
        btn.classList.add('active');
        btn.onclick = () => {
            btn.classList.toggle('active');
            visibleYears.has(year) ? visibleYears.delete(year) : visibleYears.add(year);
            refreshView();
        };
        div.appendChild(btn);
    });
}

function initTabs() {
    const tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    tabs.appendChild(createTab('Visão Geral', () => { currentCategory = null; renderOverview(); }, true));

    if (financeData.length > 0) {
        Object.keys(financeData[0])
            .filter(k => k !== 'YEAR' && k !== 'GANHO BRUTO' && k !== 'CONTA' && k.trim() !== "")
            .forEach(cat => {
                tabs.appendChild(createTab(cat, () => { currentCategory = cat; renderCategory(); }));
            });
    }
    tabs.appendChild(createTab('GANHO BRUTO', () => { currentCategory = 'GANHO BRUTO'; renderCategory(); }));
}

function createTab(label, action, active = false) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (active) btn.classList.add('active');
    btn.onclick = () => {
        document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        action();
    };
    return btn;
}

function renderOverview() {
    const data = financeData.filter(d => visibleYears.has(d.YEAR));
    const expenseKeys = Object.keys(data[0] || {}).filter(k => k !== 'YEAR' && k !== 'GANHO BRUTO' && k !== 'CONTA' && k.trim() !== "");

    const tableRows = data.map(d => {
        const totalLoss = expenseKeys.reduce((s, k) => s + (parseFloat(d[k]) || 0), 0);
        const totalGain = parseFloat(d['GANHO BRUTO']) || 0;
        return {
            'Ano': d.YEAR,
            'Perda Total': totalLoss,
            'Ganho Total': totalGain,
            'Relação': totalGain > 0 ? ((totalLoss / totalGain) * 100).toFixed(2) + '%' : '-'
        };
    });

    renderTable(['Ano', 'Perda Total', 'Ganho Total', 'Relação'], tableRows);
    renderSummary(tableRows, 'OVERVIEW');
    updateChart(data.map(d => d.YEAR), [
        { label: 'Ganhos', data: tableRows.map(r => r['Ganho Total']), color: '#4caf50' },
        { label: 'Gastos', data: tableRows.map(r => r['Perda Total']), color: '#ff9800' }
    ]);
}

function renderCategory() {
    const data = financeData.filter(d => visibleYears.has(d.YEAR));
    const isGainTab = currentCategory === 'GANHO BRUTO';

    const tableRows = data.map(d => {
        const val = parseFloat(d[currentCategory]) || 0;
        const totalGain = parseFloat(d['GANHO BRUTO']) || 0;
        return {
            'Ano': d.YEAR,
            'Valor Anual': val,
            'Média Mensal': val / 12,
            'Relação (Sua Lógica %)': totalGain > 0 ? ((val / totalGain) * 100).toFixed(2) + '%' : '-'
        };
    });

    const headers = isGainTab ? ['Ano', 'Valor Anual', 'Média Mensal'] : ['Ano', 'Valor Anual', 'Média Mensal', 'Relação (Sua Lógica %)'];
    renderTable(headers, tableRows);
    renderSummary(tableRows, 'CATEGORY');
    updateChart(data.map(d => d.YEAR), [
        { label: currentCategory, data: tableRows.map(r => r['Valor Anual']), color: isGainTab ? '#4caf50' : '#ff9800' }
    ]);
}

function renderSummary(rows, type) {
    const box = document.getElementById('summary-boxes');
    const totalMonths = rows.length * 12;

    if (type === 'OVERVIEW') {
        const totalG = rows.reduce((s, r) => s + r['Ganho Total'], 0);
        const totalL = rows.reduce((s, r) => s + r['Perda Total'], 0);
        box.innerHTML = `
            <div class="summary-box" style="border-top-color: #4caf50"><span>Média Ganhos</span><strong>${showValues ? money(totalG / totalMonths) : '-'}</strong></div>
            <div class="summary-box" style="border-top-color: #ff9800"><span>Média Gastos</span><strong>${showValues ? money(totalL / totalMonths) : '-'}</strong></div>
        `;
    } else {
        const totalC = rows.reduce((s, r) => s + r['Valor Anual'], 0);
        box.innerHTML = `
            <div class="summary-box"><span>Média Mensal (${currentCategory})</span><strong>${showValues ? money(totalC / totalMonths) : '-'}</strong></div>
            <div class="summary-box"><span>Total Acumulado</span><strong>${showValues ? money(totalC) : '-'}</strong></div>
        `;
    }
}

function renderTable(headers, rows) {
    const thead = document.querySelector('thead');
    const tbody = document.querySelector('tbody');
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';

    rows.forEach(r => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const rawVal = r[h];
            td.textContent = (showValues || h === 'Ano') ? (typeof rawVal === 'number' ? money(rawVal) : rawVal) : '-';
            if (h.includes('Ganho')) td.className = 'gain';
            if (h.includes('Perda') || h.includes('Gasto') || h === currentCategory) td.className = currentCategory === 'GANHO BRUTO' ? 'gain' : 'loss';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function updateChart(labels, datasets) {
    const ctx = document.getElementById('main-chart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets.map(ds => ({
                label: ds.label,
                data: ds.data,
                borderColor: ds.color,
                backgroundColor: ds.color + '15',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: ds.color
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#aaa' } },
                tooltip: { padding: 12, backgroundColor: '#1c1f27' }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });
}

function refreshView() {
    currentCategory ? renderCategory() : renderOverview();
}

document.getElementById('toggleValues').addEventListener('change', e => {
    showValues = e.target.checked;
    refreshView();
});
