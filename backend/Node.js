import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3000;

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzbsjALT2rVI32pL1bvFfVyD95agZnWmjjd_0vzx12ZtHXTOOINq6jGB9xonCaT7FTc/exec';

app.get('/api/finance', async (req, res) => {
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar dados' });
  }
});

app.listen(PORT, () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});
