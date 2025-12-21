const API_URL = 'https://script.google.com/macros/s/AKfycbxBWIbLNjfrhUggoxpJDj3w3orAmRyMFEeczE1I6pVtuhV2ZwopbUsHRGt4wBti80ef/exec';

fetch(API_URL)
  .then(response => response.json())
  .then(data => {
    console.log('Dados recebidos:', data);
    renderTable(data);
  })
  .catch(err => {
    console.error(err);
    document.querySelector('tbody').innerHTML =
      '<tr><td>Erro ao carregar dados</td></tr>';
  });

function renderTable(data) {
  const table = document.getElementById('finance-table');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  const headers = Object.keys(data[0]);

  thead.innerHTML = `
    <tr>
      ${headers.map(h => `<th>${h}</th>`).join('')}
    </tr>
  `;

  tbody.innerHTML = '';

  data.forEach(row => {
    tbody.innerHTML += `
      <tr>
        ${headers.map(h => `<td>${row[h]}</td>`).join('')}
      </tr>
    `;
  });
}
