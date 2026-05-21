# Практические занятия 19–24: Фронтенд и бэкенд разработка

Репозиторий содержит выполненные практические задания по дисциплине **«Фронтенд и бэкенд разработка»**, 4 семестр, 2025/2026 уч. год.

---

## Структура проекта

```
├── practice-19-postgresql/   # Пр. 19: REST API + PostgreSQL (Sequelize)
├── practice-20-mongodb/      # Пр. 20: REST API + MongoDB (Mongoose)
├── practice-21-redis/        # Пр. 21: Redis-кэширование + RBAC
├── practice-22-load-balancing/ # Пр. 22: Балансировка нагрузки (Nginx, HAProxy)
├── practice-23-docker/       # Пр. 23: Контейнеризация (Docker Compose)
│   ├── api_gateway/
│   ├── service_users/
│   └── service_orders/
└── README.md                 # Пр. 24: Описание проделанной работы
```

---

## Практическое занятие 19 — PostgreSQL + Sequelize

### Описание

REST API для управления пользователями с подключением базы данных **PostgreSQL** через ORM **Sequelize**.

### Модель данных

| Поле         | Тип       | Описание                        |
|--------------|-----------|---------------------------------|
| id           | Integer   | Автоинкрементный первичный ключ |
| first_name   | Varchar   | Имя пользователя                |
| last_name    | Varchar   | Фамилия пользователя            |
| age          | Integer   | Возраст пользователя            |
| created_at   | Timestamp | Время создания                  |
| updated_at   | Timestamp | Время последнего обновления     |

### API эндпоинты

| Метод  | Адрес            | Описание                        |
|--------|------------------|---------------------------------|
| POST   | /api/users       | Создание нового пользователя    |
| GET    | /api/users       | Получение списка пользователей  |
| GET    | /api/users/:id   | Получение пользователя по ID    |
| PATCH  | /api/users/:id   | Обновление пользователя         |
| DELETE | /api/users/:id   | Удаление пользователя           |

### Запуск

```bash
cd practice-19-postgresql
cp .env.example .env        # настроить параметры БД
npm install
npm start
```

---

## Практическое занятие 20 — MongoDB + Mongoose

### Описание

REST API аналогичный пр. 19, но с использованием **NoSQL**-базы данных **MongoDB** через ODM **Mongoose**.

### Ключевые отличия от PostgreSQL

- Схема данных гибкая — можно добавлять поля без миграций
- Вместо числового ID используется `_id` (ObjectId BSON)
- Нет JOIN-запросов, агрегация через pipeline

### Запуск

```bash
cd practice-20-mongodb
cp .env.example .env        # настроить MONGO_URI
npm install
npm start
```

---

## Практическое занятие 21 — Redis-кэширование

### Описание

Расширение RBAC-приложения (JWT + роли: `admin`, `seller`, `user`) с кэшированием GET-запросов через **Redis**.

### Как работает кэширование

```
Клиент → [cacheMiddleware] → Redis (есть?) → вернуть из кэша (source: "cache")
                                ↓ нет
                           Обработчик → saveToCache → Redis
                                      → ответ клиенту (source: "server")
```

### TTL кэша

- Пользователи: **60 секунд**
- Товары: **600 секунд**

### Инвалидация кэша

При изменении (PUT) или удалении (DELETE) пользователя/товара вызывается `invalidateUsersCache()` / `invalidateProductsCache()`, которые удаляют соответствующие ключи из Redis.

### Запуск

```bash
# Запустить Redis (Docker)
docker run -d -p 6379:6379 redis:alpine

cd practice-21-redis
cp .env.example .env
npm install
npm start
```

---

## Практическое занятие 22 — Балансировка нагрузки

### Описание

Демонстрация балансировки нагрузки с использованием **Nginx** и **HAProxy**.

### Запуск нескольких backend-серверов

```bash
cd practice-22-load-balancing
npm install

# В трёх отдельных терминалах:
PORT=3000 node server.js
PORT=3001 node server.js
PORT=3002 node server.js   # резервный сервер
```

### Nginx как балансировщик

Конфигурация в [nginx.conf](practice-22-load-balancing/nginx.conf):

- **Алгоритм**: Round Robin (по умолчанию)
- Основные серверы: `3000`, `3001`
- Резервный сервер: `3002` (включается при недоступности основных)
- Health checks: `max_fails=2 fail_timeout=30s`

Применение конфига (Linux):
```bash
sudo cp nginx.conf /etc/nginx/sites-enabled/default
sudo nginx -t && sudo nginx -s reload
```

Тестирование балансировки:
```bash
# Запросить несколько раз — поле port будет меняться
curl http://localhost/
```

### HAProxy как альтернатива

Конфигурация в [haproxy.cfg](practice-22-load-balancing/haproxy.cfg):

- Порт `80` — входящий трафик
- Порт `8080` — веб-интерфейс статистики (`/haproxy-stats`)
- Параметр `check` — автоматический health check через `/health`

---

## Практическое занятие 23 — Контейнеризация с Docker

### Описание

Микросервисное приложение на **Docker Compose**: три сервиса, изолированная сеть, API Gateway с Circuit Breaker.

### Архитектура

```
Клиент (порт 8000)
      │
      ▼
 api_gateway          ← единственная точка входа снаружи
      │  │
      │  └──── /api/users   → service_users  (внутренняя сеть)
      └──────  /api/orders  → service_orders (внутренняя сеть)
```

### Сервисы

| Сервис         | Описание                                                   |
|----------------|------------------------------------------------------------|
| `api_gateway`  | Проксирует запросы, реализует Circuit Breaker и агрегацию |
| `service_users`| CRUD-операции с пользователями                             |
| `service_orders`| CRUD-операции с заказами                                  |

### Circuit Breaker (паттерн)

Три состояния:
- **CLOSED** — нормальная работа
- **OPEN** — слишком много ошибок, запросы блокируются, возвращается fallback
- **HALF_OPEN** — тестовый запрос для проверки восстановления

### API агрегация

`GET /api/users/:id/details` — параллельно запрашивает пользователя и его заказы, возвращает в одном ответе.

### Запуск

```bash
cd practice-23-docker
docker compose up --build
```

Проверка работы:
```bash
# Статус всех сервисов
curl http://localhost:8000/health

# Список пользователей
curl http://localhost:8000/api/users

# Агрегированные данные пользователя
curl http://localhost:8000/api/users/1/details

# Список заказов
curl http://localhost:8000/api/orders
```

Остановка:
```bash
docker compose down
```

---

## Практическое занятие 24 — Подготовка к контрольной работе

Контрольная работа №4 включает результат выполнения практических заданий 19–23.

### Чек-лист

- [x] Пр. 19: REST API + PostgreSQL (Sequelize), полный CRUD
- [x] Пр. 20: REST API + MongoDB (Mongoose), полный CRUD
- [x] Пр. 21: Redis-кэширование GET-запросов, инвалидация при изменениях
- [x] Пр. 22: Nginx (Round Robin, резервный сервер, health checks), HAProxy
- [x] Пр. 23: Docker Compose, 3 микросервиса, Circuit Breaker, API агрегация
- [x] README с описанием каждой практики

---

## Технологии

| Технология     | Применение                                      |
|----------------|-------------------------------------------------|
| Node.js        | Среда выполнения для всех backend-сервисов      |
| Express.js     | HTTP-фреймворк                                  |
| PostgreSQL      | Реляционная БД (пр. 19)                        |
| Sequelize      | ORM для PostgreSQL                              |
| MongoDB        | NoSQL документная БД (пр. 20)                  |
| Mongoose       | ODM для MongoDB                                 |
| Redis          | In-memory кэш, хранилище сессий (пр. 21)       |
| JWT + bcrypt   | Аутентификация и хеширование паролей (пр. 21)  |
| Nginx          | Балансировщик нагрузки (пр. 22)                |
| HAProxy        | Альтернативный балансировщик (пр. 22)          |
| Docker         | Контейнеризация приложений (пр. 23)            |
| Docker Compose | Оркестрация многоконтейнерных приложений (пр. 23) |
# UNI-frontend-and-backend-19-24
