const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let financeData = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let myChart = null;

const money = v => 
    (v === null || v === undefined || isNaN(v) || v === 0) ? "R$ 0,00" : 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Função para achar a chave correta de Ganho Bruto idependente de como foi escrita
const getGainKey = (obj) => {
    return Object.keys(obj).find(k => k.trim().toUpperCase() === 'GANHO BRUTO') || 'GANHO BRUTO';
};

fetch(API_URL)
    .then(r => r.json())
    .then(data => {
        // Limpar dados e garantir que os anos sejam números
        financeData = data.filter(d => d.year || d.year === 0);
        financeData.forEach(d => visibleYears.add(d.year));
        
        initYearFilters();
        initTabs();
        refreshView();
    });

function initYearFilters() {
    const div = document.getElementById('year-filters');
    div.innerHTML = '';
    const years = [...new Set(financeData.map(d => d.year))].sort();
    
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
    
    const btnGeral = createTab('Visão Geral', () => { currentCategory = null; renderOverview(); });
    btnGeral.classList.add('active');
    tabs.appendChild(btnGeral);

    const gainKey = getGainKey(financeData[0]);
    Object.keys(financeData[0])
        .filter(k => k !== 'year' && k !== gainKey && k.trim() !== "")
        .forEach(cat => {
            tabs.appendChild(createTab(cat, () => { currentCategory = cat; renderCategory(); }));
        });

    tabs.appendChild(createTab('GANHO BRUTO', () => { currentCategory = gainKey; renderCategory(); }));
}

function createTab(label, action) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = (e) => {
        document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        action();
    };
    return btn;
}

function renderOverview() {
    const data = financeData.filter(d => visibleYears.has(d.year));
    const gainKey = getGainKey(data[0] || {});
    const expenseKeys = Object.keys(data[0] || {}).filter(k => k !== 'year' && k !== gainKey && k.trim() !== "");

    const tableRows = data.map(d => {
        const totalLoss = expenseKeys.reduce((s, k) => s + (Number(d[k]) || 0), 0);
        const totalGain = Number(d[gainKey]) || 0;
        return {
            'Ano': d.year,
            'Perda Total': totalLoss,
            'Ganho Total': totalGain,
            'Relação': totalGain > 0 ? ((totalLoss / totalGain) * 100).toFixed(2) + '%' : '-'
        };
    });

    renderTable(['Ano', 'Perda Total', 'Ganho Total', 'Relação'], tableRows);
    renderSummary(tableRows, 'OVERVIEW');
    
    updateChart(data.map(d => d.year), [
        { label: 'Ganhos', data: tableRows.map(r => r['Ganho Total']), color: '#4caf50' },
        { label: 'Gastos', data: tableRows.map(r => r['Perda Total']), color: '#ff9800' }
    ]);
}

function renderCategory() {
    const data = financeData.filter(d => visibleYears.has(d.year));
    const gainKey = getGainKey(data[0] || {});
    const isGainTab = currentCategory === gainKey;
    const expenseKeys = Object.keys(data[0] || {}).filter(k => k !== 'year' && k !== gainKey && k.trim() !== "");

    const tableRows = data.map(d => {
        const val = Number(d[currentCategory]) || 0;
        const totalYearlyLoss = expenseKeys.reduce((s, k) => s + (Number(d[k]) || 0), 0);
        return {
            'Ano': d.year,
            'Valor Anual': val,
            'Média Mensal': val / 12,
            '% do Gasto Total': totalYearlyLoss > 0 ? ((val / totalYearlyLoss) * 100).toFixed(2) + '%' : '0%'
        };
    });

    const headers = isGainTab ? ['Ano', 'Valor Anual', 'Média Mensal'] : ['Ano', 'Valor Anual', 'Média Mensal', '% do Gasto Total'];
    renderTable(headers, tableRows);
    renderSummary(tableRows, 'CATEGORY');

    updateChart(data.map(d => d.year), [
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
            if (h.includes('Perda') || h.includes('Gasto')) td.className = 'loss';
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
                legend: { position: 'top', labels: { color: '#aaa', font: { size: 12 } } },
                tooltip: { padding: 12, backgroundColor: '#1c1f27', titleFont: { size: 14 } }
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
