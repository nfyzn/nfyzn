# MovieList Backend

Backend-сервер для приложения MovieList с авторизацией, синхронизацией данных и админ-панелью.

## 📋 Требования

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **npm** или **yarn**

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Скопируйте файл `.env.example` в `.env` и настройте переменные:

```bash
cp .env.example .env
```

**Обязательные переменные:**

```env
# Порт сервера
PORT=3000

# База данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=movielist_db
DB_USER=movielist_user
DB_PASSWORD=ваш_надёжный_пароль

# JWT секреты (сгенерируйте случайные строки!)
JWT_ACCESS_SECRET=ваш_секретный_ключ_минимум_32_символа
JWT_REFRESH_SECRET=ваш_секретный_ключ_минимум_32_символа

# Учётные данные администратора
ADMIN_EMAIL=admin@movielist.app
ADMIN_PASSWORD=смените_этот_пароль_немедленно
```

### 3. Генерация секретных ключей

```bash
# Для Linux/Mac
openssl rand -base64 32

# Для Windows (PowerShell)
[System.Web.Security.Membership]::GeneratePassword(32, 8)
```

### 4. Установка PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Создание базы данных:**
```bash
sudo -u postgres psql

CREATE DATABASE movielist_db;
CREATE USER movielist_user WITH PASSWORD 'ваш_пароль';
GRANT ALL PRIVILEGES ON DATABASE movielist_db TO movielist_user;
\q
```

### 5. Запуск миграций

```bash
npm run migrate
```

### 6. Запуск сидирования (создание админа и данных по умолчанию)

```bash
npm run seed
```

### 7. Запуск сервера

**Разработка:**
```bash
npm run dev
```

**Продакшн:**
```bash
npm start
```

## 📁 Структура проекта

```
backend/
├── src/
│   ├── config/
│   │   └── database.js       # Подключение к БД
│   ├── models/
│   │   ├── User.js           # Модель пользователя
│   │   ├── Movie.js          # Модель фильма
│   │   ├── MovieType.js      # Модель типа
│   │   └── Genre.js          # Модель жанра
│   ├── services/
│   │   ├── AuthService.js    # Аутентификация, JWT
│   │   └── SyncService.js    # Синхронизация данных
│   ├── routes/
│   │   ├── auth.js           # Маршруты авторизации
│   │   ├── movies.js         # CRUD фильмов
│   │   ├── types.js          # CRUD типов
│   │   ├── genres.js         # CRUD жанров
│   │   ├── sync.js           # Синхронизация
│   │   └── admin.js          # Админ-панель
│   ├── middleware/
│   │   └── auth.js           # Middleware авторизации
│   ├── database/
│   │   ├── migrate.js        # Миграции БД
│   │   └── seed.js           # Сидирование
│   ├── app.js                # Настройка Express
│   └── index.js              # Точка входа
├── .env.example              # Шаблон переменных окружения
├── package.json
└── README.md
```

## 🔐 API Endpoints

### Авторизация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| POST | `/api/auth/logout` | Выход |
| POST | `/api/auth/logout-all` | Выход из всех сессий |
| GET | `/api/auth/me` | Информация о пользователе |
| PUT | `/api/auth/profile` | Обновление профиля |
| PUT | `/api/auth/change-password` | Смена пароля |
| GET | `/api/auth/sessions` | Активные сессии |

### Фильмы

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/movies` | Список фильмов |
| GET | `/api/movies/:id` | Фильм по ID |
| POST | `/api/movies` | Создать фильм |
| PUT | `/api/movies/:id` | Обновить фильм |
| DELETE | `/api/movies/:id` | Удалить фильм |
| POST | `/api/movies/:id/restore` | Восстановить фильм |
| GET | `/api/movies/deleted/recent` | Недавно удалённые |

### Типы и Жанры

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/types` | Список типов |
| POST | `/api/types` | Создать тип |
| PUT | `/api/types/:id` | Обновить тип |
| DELETE | `/api/types/:id` | Удалить тип |
| POST | `/api/types/reorder` | Переупорядочить типы |
| GET | `/api/genres` | Список жанров |
| POST | `/api/genres` | Создать жанр |
| PUT | `/api/genres/:id` | Обновить жанр |
| DELETE | `/api/genres/:id` | Удалить жанр |
| POST | `/api/genres/reorder` | Переупорядочить жанры |

### Синхронизация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/sync/changes?since=ISO_DATE` | Получить изменения |
| POST | `/api/sync/batch` | Пакетная синхронизация |
| GET | `/api/sync/stats` | Статистика синхронизации |

### Админ-панель

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/api/admin/dashboard` | Дашборд со статистикой |
| GET | `/api/admin/users` | Список пользователей |
| GET | `/api/admin/users/:id` | Информация о пользователе |
| PUT | `/api/admin/users/:id/toggle-active` | Активировать/деактивировать |
| PUT | `/api/admin/users/:id/toggle-admin` | Дать/снять права админа |
| DELETE | `/api/admin/users/:id` | Удалить пользователя |
| GET | `/api/admin/statistics` | Подробная статистика |
| GET | `/api/admin/sessions` | Активные сессии |
| GET | `/api/admin/logs` | Логи синхронизации |

## 🔒 Безопасность

### Требования к паролю:
- Минимум 8 символов
- Хотя бы одна заглавная буква
- Хотя бы одна строчная буква
- Хотя бы одна цифра

### JWT токены:
- **Access token**: 15 минут
- **Refresh token**: 7 дней

### Rate limiting:
- 100 запросов в 15 минут (API)
- 10 запросов в 15 минут (авторизация)

## 📊 Синхронизация

Стратегия: **Last Write Wins** с отслеживанием конфликтов.

### Формат пакетной синхронизации:

```json
{
  "movies": [
    {
      "action": "create|update|delete",
      "data": {
        "id": "uuid",
        "title": "...",
        "sync_version": 1
      }
    }
  ],
  "types": [...],
  "genres": [...]
}
```

## 🖥️ Развёртывание на VDS

### 1. Подготовка сервера (Ubuntu 24.04)

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Установка PM2 для управления процессом
sudo npm install -g pm2
```

### 2. Настройка базы данных

```bash
sudo -u postgres psql

CREATE DATABASE movielist_db;
CREATE USER movielist_user WITH PASSWORD 'надёжный_пароль';
GRANT ALL PRIVILEGES ON DATABASE movielist_db TO movielist_user;
\q
```

### 3. Развёртывание приложения

```bash
# Копирование файлов на сервер
scp -r backend/* user@your-server:/var/www/movielist-backend/

# Переход в директорию
cd /var/www/movielist-backend

# Установка зависимостей
npm install --production

# Настройка .env
cp .env.example .env
nano .env  # Отредактируйте переменные

# Запуск миграций
npm run migrate
npm run seed
```

### 4. Настройка PM2

```bash
# Создание процесса
pm2 start src/index.js --name movielist-backend

# Автозапуск при загрузке
pm2 startup
pm2 save

# Мониторинг
pm2 status
pm2 logs movielist-backend
```

### 5. Настройка Nginx (опционально)

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/movielist
```

**Конфигурация Nginx:**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Активация сайта
sudo ln -s /etc/nginx/sites-available/movielist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# SSL (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. Брандмауэр

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## 🧪 Тестирование

### Проверка health endpoint:

```bash
curl http://localhost:3000/health
```

### Регистрация пользователя:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "displayName": "Test User"
  }'
```

### Вход:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

## 📝 Логи

Логи записываются в консоль. Для сохранения в файл:

```bash
# В .env укажите:
LOG_FILE=logs/app.log
```

Просмотр логов PM2:

```bash
pm2 logs movielist-backend --lines 100
```

## 🔧 Устранение проблем

### Ошибка подключения к БД:
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT usename, passwd FROM pg_shadow;"
```

### Порт занят:
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### Проблемы с правами:
```bash
sudo chown -R $USER:$USER /var/www/movielist-backend
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs movielist-backend`
2. Проверьте статус БД: `sudo systemctl status postgresql`
3. Проверьте переменные окружения в `.env`
