const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Счётчик обработанных запросов на этом экземпляре
let requestCount = 0;

app.get('/', (req, res) => {
  requestCount++;
  res.json({
    message: 'Response from backend server',
    port: PORT,
    requestCount,
    hostname: require('os').hostname(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port: PORT });
});

app.get('/api/data', (req, res) => {
  requestCount++;
  res.json({
    source: `server:${PORT}`,
    data: [
      { id: 1, name: 'Item A' },
      { id: 2, name: 'Item B' },
    ],
    requestCount,
  });
});

app.listen(PORT, () => {
  console.log(`Backend server started on port ${PORT}`);
});
