const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let financeData = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let myChart = null;
let ratioChart = null; // Segundo gráfico

const money = v => 
    (v === null || v === undefined || isNaN(v) || v === 0) ? "R$ 0,00" : 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function normalizeData(data) {
    return data.map(item => {
        const normalized = {};
        for (let key in item) {
            const cleanKey = key.trim().toUpperCase();
            let val = item[key];
            if (cleanKey === 'YEAR') {
                normalized[cleanKey] = val;
            } else {
                if (typeof val === 'string') {
                    val = val.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.');
                }
                normalized[cleanKey] = parseFloat(val) || 0;
            }
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
        // Incluído 'CONTA' no filtro para que ela apareça como aba
        Object.keys(financeData[0])
            .filter(k => k !== 'YEAR' && k !== 'GANHO BRUTO' && k.trim() !== "")
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
        const totalLoss = expenseKeys.reduce((s, k) => s + (d[k] || 0), 0);
        const totalGain = d['GANHO BRUTO'] || 0;
        const ratio = totalGain > 0 ? (totalLoss / totalGain) * 100 : 0;
        return {
            'Ano': d.YEAR,
            'Perda Total': totalLoss,
            'Ganho Total': totalGain,
            'Relação Gasto/Ganho': ratio.toFixed(2) + '%',
            '_ratioRaw': ratio // Valor numérico para o gráfico
        };
    });

    renderTable(['Ano', 'Perda Total', 'Ganho Total', 'Relação Gasto/Ganho'], tableRows);
    
    const totalG = data.reduce((s, d) => s + (d['GANHO BRUTO'] || 0), 0);
    const totalL = data.reduce((s, d) => s + expenseKeys.reduce((sum, k) => sum + (d[k] || 0), 0), 0);
    
    const yearsWithGain = data.filter(d => d['GANHO BRUTO'] > 0).length;
    const avgG = yearsWithGain > 0 ? totalG / (yearsWithGain * 12) : 0;
    const yearsWithLoss = data.filter(d => expenseKeys.reduce((sum, k) => sum + (d[k] || 0), 0) > 0).length;
    const avgL = yearsWithLoss > 0 ? totalL / (yearsWithLoss * 12) : 0;

    renderSummaryBoxes([
        { label: 'Média Mensal Ganhos', value: money(avgG), color: '#4caf50' },
        { label: 'Média Mensal Gastos', value: money(avgL), color: '#ff9800' },
        { label: 'Relação Gasto/Ganho', value: totalG > 0 ? ((totalL / totalG) * 100).toFixed(2) + '%' : '-', color: '#e8ebf0' }
    ]);

    updateCharts(
        data.map(d => d.YEAR), 
        [{ label: 'Ganhos', data: tableRows.map(r => r['Ganho Total']), color: '#4caf50' }, { label: 'Gastos', data: tableRows.map(r => r['Perda Total']), color: '#ff9800' }],
        [{ label: '% Relação Gasto/Ganho', data: tableRows.map(r => r._ratioRaw), color: '#36a2eb' }]
    );
}

function renderCategory() {
    const data = financeData.filter(d => visibleYears.has(d.YEAR));
    const isGainTab = currentCategory === 'GANHO BRUTO';

    const tableRows = data.map(d => {
        const val = d[currentCategory] || 0;
        const totalGain = d['GANHO BRUTO'] || 0;
        const ratio = totalGain > 0 ? (val / totalGain) * 100 : 0;
        return {
            'Ano': d.YEAR,
            'Valor Anual': val,
            'Média Mensal': val > 0 ? val / 12 : 0,
            'Relação Gasto/Ganho': ratio.toFixed(2) + '%',
            '_ratioRaw': ratio
        };
    });

    const headers = isGainTab ? ['Ano', 'Valor Anual', 'Média Mensal'] : ['Ano', 'Valor Anual', 'Média Mensal', 'Relação Gasto/Ganho'];
    renderTable(headers, tableRows);

    const totalCat = data.reduce((s, d) => s + (d[currentCategory] || 0), 0);
    const totalGainAll = data.reduce((s, d) => s + (d['GANHO BRUTO'] || 0), 0);
    const yearsWithVal = data.filter(d => d[currentCategory] > 0).length;
    const avgCat = yearsWithVal > 0 ? totalCat / (yearsWithVal * 12) : 0;

    const boxes = [
        { label: 'Total Acumulado', value: money(totalCat), color: isGainTab ? '#4caf50' : '#ff9800' },
        { label: `Média Mensal (${yearsWithVal} anos)`, value: money(avgCat), color: '#aaa' }
    ];

    if (!isGainTab) {
        boxes.push({ label: 'Relação Gasto/Ganho', value: totalGainAll > 0 ? ((totalCat / totalGainAll) * 100).toFixed(2) + '%' : '-', color: '#e8ebf0' });
    }

    renderSummaryBoxes(boxes);

    updateCharts(
        data.map(d => d.YEAR),
        [{ label: currentCategory, data: tableRows.map(r => r['Valor Anual']), color: isGainTab ? '#4caf50' : '#ff9800' }],
        isGainTab ? [] : [{ label: `% Relação ${currentCategory}/Ganho`, data: tableRows.map(r => r._ratioRaw), color: '#36a2eb' }]
    );
}

function updateCharts(labels, mainDatasets, ratioDatasets) {
    const ctxMain = document.getElementById('main-chart').getContext('2d');
    const ctxRatio = document.getElementById('ratio-chart').getContext('2d');

    if (myChart) myChart.destroy();
    if (ratioChart) ratioChart.destroy();

    // Configurações visuais do gráfico de linha (estilo anterior)
    myChart = new Chart(ctxMain, {
        type: 'line',
        data: {
            labels: labels,
            datasets: mainDatasets.map(ds => ({
                label: ds.label,
                data: ds.data,
                borderColor: ds.color,
                backgroundColor: ds.color + '20', // Opacidade leve
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: ds.color
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false }, // Tooltip ativada
            plugins: {
                legend: { labels: { color: '#aaa', font: { size: 12 } } },
                tooltip: { padding: 12, backgroundColor: '#1c1f27' }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666' } },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });

    // Gráfico de Relação (Eixo Y até 100% e Tooltip formatada)
    ratioChart = new Chart(ctxRatio, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: ratioDatasets.map(ds => ({
                label: ds.label,
                data: ds.data,
                backgroundColor: ds.color + '80',
                borderColor: ds.color,
                borderWidth: 1,
                borderRadius: 5
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#aaa' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Relação: ${context.parsed.y.toFixed(2)}%`;
                        }
                    },
                    padding: 12,
                    backgroundColor: '#1c1f27'
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100, // Eixo fixo em 100%
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#666',
                        callback: value => value + '%'
                    }
                },
                x: { grid: { display: false }, ticks: { color: '#666' } }
            }
        }
    });
}

// Funções de apoio (renderTable, renderSummaryBoxes, refreshView) permanecem as mesmas
function renderSummaryBoxes(boxes) {
    const container = document.getElementById('summary-boxes');
    container.innerHTML = boxes.map(b => `
        <div class="summary-box" style="border-top-color: ${b.color}">
            <span>${b.label}</span>
            <strong>${showValues ? b.value : '-'}</strong>
        </div>
    `).join('');
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
            if (h === 'Ano') td.textContent = rawVal;
            else td.textContent = showValues ? (typeof rawVal === 'number' ? money(rawVal) : rawVal) : '-';
            if (h.includes('Ganho')) td.className = 'gain';
            if (h.includes('Perda') || h.includes('Gasto') || h === currentCategory) td.className = currentCategory === 'GANHO BRUTO' ? 'gain' : 'loss';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function refreshView() { currentCategory ? renderCategory() : renderOverview(); }
document.getElementById('toggleValues').addEventListener('change', e => { showValues = e.target.checked; refreshView(); });
