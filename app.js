const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';


let financeData = [];
let visibleYears = new Set();
let currentCategory = null;
let showValues = true;
let showMonthlyAverages = false;


let myChart = null, ratioChart = null, categoryChart = null;
let categoryTooltipElement = null;


const money = v =>
    (v === null || v === undefined || isNaN(v) || v === 0) ? "R$ 0,00" :
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Função para determinar a cor da seta baseado no tipo (gasto/ganho) e variação
function getArrowColor(label, diff) {
    const isGain = label.toLowerCase().includes('ganho') || label === 'GANHO BRUTO';
    const isExpense = label.toLowerCase().includes('gasto') || label.toLowerCase().includes('perda') || label.toLowerCase().includes('despesa');
    
    if (diff === 0) return "#888";
    
    if (isGain) {
        // Ganhos: ↓ (menor) = laranja, ↑ (maior) = verde
        return diff > 0 ? "#4caf50" : "#ff9800";
    } else if (isExpense) {
        // Gastos: ↓ (menor) = verde, ↑ (maior) = laranja
        return diff > 0 ? "#ff9800" : "#4caf50";
    } else {
        // Padrão: positivo = verde, negativo = laranja
        return diff > 0 ? "#4caf50" : "#ff9800";
    }
}


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


fetch(API_URL).then(r => r.json()).then(data => {
    financeData = normalizeData(data).filter(d => d.YEAR || d.YEAR === 0);
    financeData.forEach(d => visibleYears.add(d.YEAR));
    initYearFilters();
    initTabs();
    refreshView();
});


function initYearFilters() {
    const div = document.getElementById('year-filters');
    const years = [...new Set(financeData.map(d => d.YEAR))].sort();
    div.innerHTML = '';
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
    tabs.appendChild(createTab('Visão Geral', () => { currentCategory = null; refreshView(); }, true));
    if (financeData.length > 0) {
        Object.keys(financeData[0])
            .filter(k => k !== 'YEAR' && k !== 'GANHO BRUTO' && k.trim() !== "")
            .forEach(cat => tabs.appendChild(createTab(cat, () => { currentCategory = cat; refreshView(); })));
    }
    tabs.appendChild(createTab('GANHO BRUTO', () => { currentCategory = 'GANHO BRUTO'; refreshView(); }));
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
        return { 'Ano': d.YEAR, 'Perda Total': totalLoss, 'Ganho Total': totalGain, 'Relação Gasto/Ganho': ratio.toFixed(2) + '%', _ratioRaw: ratio };
    });


    renderTable(['Ano', 'Perda Total', 'Ganho Total', 'Relação Gasto/Ganho'], tableRows);


    const totalG = data.reduce((s, d) => s + (d['GANHO BRUTO'] || 0), 0);
    const totalL = data.reduce((s, d) => s + expenseKeys.reduce((sum, k) => sum + (d[k] || 0), 0), 0);
    renderSummaryBoxes([
        { label: 'Média Mensal Ganhos', value: money(totalG / (data.length * 12 || 1)), color: '#4caf50' },
        { label: 'Média Mensal Gastos', value: money(totalL / (data.length * 12 || 1)), color: '#ff9800' },
        { label: 'Relação Geral', value: totalG > 0 ? ((totalL / totalG) * 100).toFixed(2) + '%' : '-', color: '#36a2eb' }
    ]);


    const categoryDatasets = expenseKeys.map((key, index) => ({
        label: key,
        data: data.map(d => d['GANHO BRUTO'] > 0 ? (d[key] / d['GANHO BRUTO'] * 100) : 0),
        rawValues: data.map(d => d[key]),
        borderColor: `hsl(${index * 50}, 70%, 55%)`,
        backgroundColor: `hsl(${index * 50}, 70%, 55%)`,
        fill: false
    }));


    updateCharts(
        data.map(d => d.YEAR),
        [{ label: 'Ganhos', data: tableRows.map(r => r['Ganho Total']), color: '#4caf50' }, { label: 'Gastos', data: tableRows.map(r => r['Perda Total']), color: '#ff9800' }],
        [{ label: '% Relação Gasto/Ganho', data: tableRows.map(r => r._ratioRaw), color: '#36a2eb' }],
        categoryDatasets
    );
}


function renderCategory() {
    const data = financeData.filter(d => visibleYears.has(d.YEAR));
    const isGainTab = currentCategory === 'GANHO BRUTO';
    const tableRows = data.map(d => {
        const val = d[currentCategory] || 0;
        const totalGain = d['GANHO BRUTO'] || 0;
        const ratio = totalGain > 0 ? (val / totalGain) * 100 : 0;
        return { 'Ano': d.YEAR, 'Valor Anual': val, 'Média Mensal': val / 12, 'Relação': ratio.toFixed(2) + '%', _ratioRaw: ratio };
    });


    renderTable(isGainTab ? ['Ano', 'Valor Anual', 'Média Mensal'] : ['Ano', 'Valor Anual', 'Média Mensal', 'Relação'], tableRows);
    const totalCat = data.reduce((s, d) => s + (d[currentCategory] || 0), 0);
    const totalGain = data.reduce((s, d) => s + (d['GANHO BRUTO'] || 0), 0);
    const ratio = totalGain > 0 ? (totalCat / totalGain) * 100 : 0;
    renderSummaryBoxes([
        { label: 'Total Acumulado', value: money(totalCat), color: isGainTab ? '#4caf50' : '#ff9800' },
        { label: 'Média Mensal', value: money(totalCat / (data.length * 12 || 1)), color: '#aaa' },
        ...(isGainTab ? [] : [{ label: 'Relação Gasto/Ganho', value: ratio.toFixed(2) + '%', color: '#36a2eb' }])
    ]);


    updateCharts(
        data.map(d => d.YEAR),
        [{ label: currentCategory, data: tableRows.map(r => r['Valor Anual']), color: isGainTab ? '#4caf50' : '#ff9800' }],
        isGainTab ? [] : [{ label: `% Relação ${currentCategory}/Ganho`, data: tableRows.map(r => r._ratioRaw), color: '#36a2eb' }],
        null
    );
}


function updateCharts(labels, mainDS, ratioDS, catDS) {
    if (myChart) myChart.destroy();
    if (ratioChart) ratioChart.destroy();
    if (categoryChart) categoryChart.destroy();


    const commonOptions = (showPercent = false, isCategoryChart = false, maxHundred = false) => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                labels: {
                    color: '#888', font: { size: 10 },
                    usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6
                }
            },
            tooltip: {
                backgroundColor: '#1c1f27',
                padding: 15,
                bodySpacing: 10, // Mais entrelinha/respiro conforme pedido
                usePointStyle: true,
                boxPadding: 8,
                itemSort: (a, b) => b.raw - a.raw,
                callbacks: {
                    label: (ctx) => {
                        let label = ctx.dataset.label || '';
                        let val = ctx.parsed.y;
                        let text = "";


                        if (isCategoryChart) {
                            // Primeira seção: Gastos (apenas o valor monetário)
                            text = `${label}: ${money(ctx.dataset.rawValues[ctx.dataIndex])}`;
                        } else {
                            text = showPercent ? `${label}: ${val.toFixed(2)}%` : `${label}: ${money(val)}`;
                        }
                        return text;
                    },
                    // Segunda Tooltip / Footer com a variação anual (com cores via external tooltip se necessário)
                    afterBody: (context) => {
                        if (context.length === 0 || context[0].dataIndex === 0) return "";
                        if (isCategoryChart) return ""; // Para gráfico de categorias, usar external tooltip
                       
                        let lines = ["", "───────────────", "Variação vs Ano Anterior:"];
                        context.forEach(item => {
                            const currentVal = item.raw;
                            const prevVal = item.dataset.data[item.dataIndex - 1];
                           
                            if (prevVal !== undefined && prevVal !== 0) {
                                const diff = ((currentVal - prevVal) / prevVal) * 100;
                                const icon = diff > 0 ? "▲" : (diff < 0 ? "▼" : "●");
                                // Cor será aplicada via CSS ou external tooltip, aqui apenas o texto
                                lines.push(`${item.dataset.label}: ${icon} ${Math.abs(diff).toFixed(1)}%`);
                            }
                        });
                        return lines;
                    }
                }
            }
        },
        scales: {
            y: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                min: 0,
                max: maxHundred ? 100 : undefined,
                ticks: { color: '#666', font: { size: 10 }, callback: v => showPercent ? v + '%' : money(v) }
            },
            x: { grid: { display: true, color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 10 } } }
        }
    });


    myChart = new Chart(document.getElementById('main-chart').getContext('2d'), {
        type: 'line',
        data: { labels, datasets: mainDS.map(ds => ({ ...ds, tension: 0, pointRadius: 3, pointStyle: 'circle', borderColor: ds.color, backgroundColor: ds.color })) },
        options: commonOptions(false)
    });


    ratioChart = new Chart(document.getElementById('ratio-chart').getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: ratioDS.map(ds => ({ ...ds, backgroundColor: ds.color+'CC', borderRadius: 4 })) },
        options: commonOptions(true, false, true)
    });


    const catContainer = document.getElementById('category-chart-container');
    if (catDS) {
        catContainer.style.display = 'block';
        
        // Criar elemento para external tooltip se não existir
        if (!categoryTooltipElement) {
            categoryTooltipElement = document.createElement('div');
            categoryTooltipElement.id = 'category-tooltip';
            categoryTooltipElement.style.cssText = 'position: absolute; pointer-events: none; background: #1c1f27; color: #e8ebf0; padding: 10px 12px; border-radius: 8px; border: 1px solid #2f3442; font-size: 0.85rem; opacity: 0; z-index: 1000; transition: opacity 0.3s; max-width: 300px;';
            document.body.appendChild(categoryTooltipElement);
        }
        
        const categoryOptions = {
            ...commonOptions(true, true, false),
            plugins: {
                ...commonOptions(true, true, false).plugins,
                tooltip: {
                    ...commonOptions(true, true, false).plugins.tooltip,
                    enabled: false, // Desabilitar tooltip padrão
                    external: (context) => {
                        const tooltip = context.tooltip;
                        if (!tooltip.opacity || tooltip.opacity === 0) {
                            categoryTooltipElement.style.opacity = '0';
                            return;
                        }
                        
                        const dataIndex = tooltip.dataPoints[0].dataIndex;
                        const isFirstYear = dataIndex === 0;
                        
                        let html = '<div style="line-height: 1.4; font-size: 0.85rem;">';
                        tooltip.dataPoints.forEach(point => {
                            const rawValue = point.dataset.rawValues[dataIndex];
                            const categoryColor = point.dataset.borderColor || point.dataset.backgroundColor || '#888';
                            
                            // Mostrar bolinha colorida + label + valor
                            html += `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">`;
                            html += `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${categoryColor};"></span>`;
                            html += `<span>${point.dataset.label}: <strong>${money(rawValue)}</strong>`;
                            
                            // Adicionar variação inline se não for primeiro ano
                            if (!isFirstYear) {
                                const currentVal = point.raw;
                                const prevVal = point.dataset.data[dataIndex - 1];
                                if (prevVal !== undefined && prevVal !== 0) {
                                    const diff = ((currentVal - prevVal) / prevVal) * 100;
                                    const icon = diff > 0 ? "▲" : (diff < 0 ? "▼" : "●");
                                    // Categorias são gastos: ↓ (menor) = verde, ↑ (maior) = laranja
                                    const arrowColor = getArrowColor(point.dataset.label, diff);
                                    html += ` <span style="color: ${arrowColor}; font-size: 0.9em;">${icon} ${Math.abs(diff).toFixed(1)}%</span>`;
                                }
                            }
                            html += `</span></div>`;
                        });
                        html += '</div>';
                        
                        categoryTooltipElement.innerHTML = html;
                        
                        // Calcular posicionamento evitando ultrapassar limites da tela
                        const chartRect = context.chart.canvas.getBoundingClientRect();
                        const canvasPos = {
                            left: chartRect.left,
                            top: chartRect.top,
                            right: chartRect.right,
                            bottom: chartRect.bottom
                        };
                        
                        // Posicionar temporariamente para calcular dimensões
                        categoryTooltipElement.style.opacity = '0';
                        categoryTooltipElement.style.display = 'block';
                        let left = tooltip.caretX + canvasPos.left;
                        let top = tooltip.caretY + canvasPos.top;
                        
                        categoryTooltipElement.style.left = left + 'px';
                        categoryTooltipElement.style.top = top + 'px';
                        categoryTooltipElement.style.transform = 'translate(-50%, -100%)';
                        
                        // Ajustar posicionamento após calcular dimensões reais
                        requestAnimationFrame(() => {
                            const rect = categoryTooltipElement.getBoundingClientRect();
                            const padding = 10;
                            let finalLeft = left;
                            let finalTop = top;
                            let finalTransform = 'translate(-50%, -100%)';
                            
                            // Ajustar se ultrapassar a direita
                            if (rect.right > window.innerWidth - padding) {
                                finalLeft = window.innerWidth - rect.width / 2 - padding;
                            }
                            // Ajustar se ultrapassar a esquerda
                            if (rect.left < padding) {
                                finalLeft = rect.width / 2 + padding;
                            }
                            // Ajustar se ultrapassar o topo - mostrar abaixo
                            if (rect.top < padding) {
                                finalTop = tooltip.caretY + canvasPos.top + 20;
                                finalTransform = 'translate(-50%, 0)';
                            }
                            // Ajustar se ultrapassar a parte inferior da viewport visível
                            if (rect.bottom > window.innerHeight - padding) {
                                finalTop = window.innerHeight - rect.height - padding;
                            }
                            
                            categoryTooltipElement.style.left = finalLeft + 'px';
                            categoryTooltipElement.style.top = finalTop + 'px';
                            categoryTooltipElement.style.transform = finalTransform;
                            categoryTooltipElement.style.opacity = '1';
                        });
                    }
                }
            }
        };
        
        categoryChart = new Chart(document.getElementById('category-chart').getContext('2d'), {
            type: 'line',
            data: { labels, datasets: catDS.map(ds => ({ ...ds, tension: 0, pointRadius: 3, pointStyle: 'circle', borderWidth: 2 })) },
            options: categoryOptions
        });
    } else {
        catContainer.style.display = 'none';
        if (categoryTooltipElement) {
            categoryTooltipElement.style.opacity = '0';
        }
    }
}


function renderSummaryBoxes(boxes) {
    document.getElementById('summary-boxes').innerHTML = boxes.map(b => `
        <div class="summary-box" style="border-left-color: ${b.color}">
            <span>${b.label}</span>
            <strong>${showValues ? b.value : '•••••'}</strong>
        </div>
    `).join('');
}


function renderTable(headers, rows) {
    const thead = document.querySelector('thead');
    const tbody = document.querySelector('tbody');
    thead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
    tbody.innerHTML = rows.map(r => `
        <tr>${headers.map(h => {
            let val = r[h];
            let style = h.includes('Ganho') ? 'gain' : (h.includes('Perda') || h.includes('Gasto') || h === currentCategory ? 'loss' : '');
            if (currentCategory === 'GANHO BRUTO') style = 'gain';
            return `<td class="${style}">${h === 'Ano' ? val : (showValues ? (typeof val === 'number' ? money(val) : val) : '•••••')}</td>`;
        }).join('')}</tr>
    `).join('');
}


function refreshView() { currentCategory ? renderCategory() : renderOverview(); }
document.getElementById('toggleValues').addEventListener('change', e => { showValues = e.target.checked; refreshView(); });

// Event listener para toggle de médios mensais (adicionado após o DOM carregar)
if (document.getElementById('toggleMonthlyAverages')) {
    document.getElementById('toggleMonthlyAverages').addEventListener('change', e => { 
        showMonthlyAverages = e.target.checked; 
        if (currentCategory === null) refreshView(); // Apenas atualizar se estiver na visão geral
    });
}
