const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

let financeData = [];

fetch(API_URL)
  .then(res => res.json())
  .then(data => {
    financeData = data;
    populateYearSelect(data);
    renderYear(data[0]);
  })
  .catch(() => {
    document.getElementById('output').textContent =
      'Erro ao carregar dados da API';
  });

function populateYearSelect(data) {
  const select = document.getElementById('yearSelect');

  data.forEach(item => {
    const option = document.createElement('option');
    option.value = item.year;
    option.textContent = item.year;
    select.appendChild(option);
  });

  select.addEventListener('change', e => {
    const year = Number(e.target.value);
    const selected = financeData.find(d => d.year === year);
    renderYear(selected);
  });
}

function renderYear(yearData) {
  document.getElementById('output').textContent =
    JSON.stringify(yearData, null, 2);
}
