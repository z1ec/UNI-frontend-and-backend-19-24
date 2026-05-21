const { Sequelize, DataTypes } = require('sequelize');
const express = require('express');

const app = express();
app.use(express.json());

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mydatabase',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

const User = sequelize.define(
  'User',
  {
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 150 },
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

// создать пользователя
app.post('/api/users', async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.findAll({ order: [['created_at', 'DESC']] });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// получить пользователя по ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// обновить пользователя
app.patch('/api/users/:id', async (req, res) => {
  try {
    const [count, updated] = await User.update(req.body, {
      where: { id: req.params.id },
      returning: true,
    });
    if (count === 0) return res.status(404).json({ error: 'User not found' });
    res.json(updated[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// удалить пользователя
app.delete('/api/users/:id', async (req, res) => {
  try {
    const count = await User.destroy({ where: { id: req.params.id } });
    if (count === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log('PostgreSQL connected, tables synced');
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('Database connection error:', err.message);
    process.exit(1);
  });
