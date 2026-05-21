const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

// In-memory хранилище пользователей
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com', age: 28 },
  { id: '2', name: 'Bob', email: 'bob@example.com', age: 34 },
];

let nextId = 3;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service_users' });
});

// GET /users — все пользователи
app.get('/users', (req, res) => {
  res.json(users);
});

// GET /users/:id — пользователь по ID
app.get('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// POST /users — создать пользователя
app.post('/users', (req, res) => {
  const { name, email, age } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  const user = { id: String(nextId++), name, email, age: age || null };
  users.push(user);
  res.status(201).json(user);
});

// PATCH /users/:id — обновить пользователя
app.patch('/users/:id', (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email, age } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (age !== undefined) user.age = age;

  res.json(user);
});

// DELETE /users/:id — удалить пользователя
app.delete('/users/:id', (req, res) => {
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const [deleted] = users.splice(idx, 1);
  res.json({ message: 'User deleted', user: deleted });
});

// Важно: слушаем на 0.0.0.0, чтобы быть доступными внутри Docker-сети
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Users service running on port ${PORT}`);
});
