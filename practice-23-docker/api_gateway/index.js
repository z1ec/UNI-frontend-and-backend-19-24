const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8000;
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://service_users:8000';
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://service_orders:8000';

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeout = options.recoveryTimeout || 10000; // 10s
    this.state = 'CLOSED';   // CLOSED | OPEN | HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker:${this.name}] HALF_OPEN — testing recovery`);
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log(`[CircuitBreaker:${this.name}] OPEN after ${this.failures} failures`);
    }
  }

  getStatus() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

const usersBreaker = new CircuitBreaker('users-service');
const ordersBreaker = new CircuitBreaker('orders-service');

// ─── Утилиты запросов ─────────────────────────────────────────────────────────

async function fetchUsers(path = '/users') {
  return usersBreaker.call(async () => {
    const res = await fetch(`${USERS_SERVICE_URL}${path}`, { timeout: 5000 });
    if (!res.ok) throw new Error(`Users service error: ${res.status}`);
    return res.json();
  });
}

async function fetchOrders(path = '/orders') {
  return ordersBreaker.call(async () => {
    const res = await fetch(`${ORDERS_SERVICE_URL}${path}`, { timeout: 5000 });
    if (!res.ok) throw new Error(`Orders service error: ${res.status}`);
    return res.json();
  });
}

async function postTo(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 5000,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Service error'), { status: res.status });
  return data;
}

async function patchTo(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 5000,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Service error'), { status: res.status });
  return data;
}

async function deleteTo(url) {
  const res = await fetch(url, { method: 'DELETE', timeout: 5000 });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Service error'), { status: res.status });
  return data;
}

// ─── Маршруты Gateway ─────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  const [usersStatus, ordersStatus] = await Promise.allSettled([
    fetch(`${USERS_SERVICE_URL}/health`).then((r) => r.json()),
    fetch(`${ORDERS_SERVICE_URL}/health`).then((r) => r.json()),
  ]);

  res.json({
    gateway: 'ok',
    services: {
      users: usersStatus.status === 'fulfilled' ? usersStatus.value : 'unavailable',
      orders: ordersStatus.status === 'fulfilled' ? ordersStatus.value : 'unavailable',
    },
    circuitBreakers: [usersBreaker.getStatus(), ordersBreaker.getStatus()],
  });
});

// ─── USERS ────────────────────────────────────────────────────────────────────

app.get('/api/users', async (req, res) => {
  try {
    const data = await fetchUsers('/users');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Users service unavailable', detail: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const data = await fetchUsers(`/users/${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Users service unavailable', detail: err.message });
  }
});

// Агрегация: пользователь + его заказы одним запросом
app.get('/api/users/:id/details', async (req, res) => {
  try {
    const [user, orders] = await Promise.all([
      fetchUsers(`/users/${req.params.id}`),
      fetchOrders(`/orders/user/${req.params.id}`),
    ]);
    res.json({ user, orders });
  } catch (err) {
    res.status(503).json({ error: 'Aggregation failed', detail: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const data = await usersBreaker.call(() =>
      postTo(`${USERS_SERVICE_URL}/users`, req.body)
    );
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const data = await usersBreaker.call(() =>
      patchTo(`${USERS_SERVICE_URL}/users/${req.params.id}`, req.body)
    );
    res.json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const data = await usersBreaker.call(() =>
      deleteTo(`${USERS_SERVICE_URL}/users/${req.params.id}`)
    );
    res.json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

app.get('/api/orders', async (req, res) => {
  try {
    const data = await fetchOrders('/orders');
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Orders service unavailable', detail: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const data = await fetchOrders(`/orders/${req.params.id}`);
    res.json(data);
  } catch (err) {
    res.status(503).json({ error: 'Orders service unavailable', detail: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const data = await ordersBreaker.call(() =>
      postTo(`${ORDERS_SERVICE_URL}/orders`, req.body)
    );
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const data = await ordersBreaker.call(() =>
      patchTo(`${ORDERS_SERVICE_URL}/orders/${req.params.id}`, req.body)
    );
    res.json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const data = await ordersBreaker.call(() =>
      deleteTo(`${ORDERS_SERVICE_URL}/orders/${req.params.id}`)
    );
    res.json(data);
  } catch (err) {
    res.status(err.status || 503).json({ error: err.message });
  }
});

// ─── Запуск ───────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`  → Users service: ${USERS_SERVICE_URL}`);
  console.log(`  → Orders service: ${ORDERS_SERVICE_URL}`);
});
