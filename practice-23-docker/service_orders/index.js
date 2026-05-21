const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;

// In-memory хранилище заказов
const orders = [
  { id: '1', userId: '1', product: 'Laptop', amount: 1200, status: 'delivered' },
  { id: '2', userId: '2', product: 'Phone', amount: 800, status: 'pending' },
];

let nextId = 3;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'service_orders' });
});

// GET /orders — все заказы
app.get('/orders', (req, res) => {
  res.json(orders);
});

// GET /orders/:id — заказ по ID
app.get('/orders/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// GET /orders/user/:userId — заказы конкретного пользователя
app.get('/orders/user/:userId', (req, res) => {
  const userOrders = orders.filter((o) => o.userId === req.params.userId);
  res.json(userOrders);
});

// POST /orders — создать заказ
app.post('/orders', (req, res) => {
  const { userId, product, amount } = req.body;
  if (!userId || !product || amount === undefined) {
    return res.status(400).json({ error: 'userId, product and amount are required' });
  }
  const order = { id: String(nextId++), userId, product, amount, status: 'pending' };
  orders.push(order);
  res.status(201).json(order);
});

// PATCH /orders/:id — обновить статус заказа
app.patch('/orders/:id', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status, product, amount } = req.body;
  if (status !== undefined) order.status = status;
  if (product !== undefined) order.product = product;
  if (amount !== undefined) order.amount = amount;

  res.json(order);
});

// DELETE /orders/:id — удалить заказ
app.delete('/orders/:id', (req, res) => {
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  const [deleted] = orders.splice(idx, 1);
  res.json({ message: 'Order deleted', order: deleted });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orders service running on port ${PORT}`);
});
