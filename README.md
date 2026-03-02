# MovieList Backend

Backend-сервер для приложения MovieList с авторизацией, синхронизацией данных и админ-панелью.

## 📋 Требования

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **npm** или **yarn**
- **Linux** (Ubuntu/Debian рекомендуется)

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd backend
npm install
```

### 2. Настройка окружения

Скопируйте файл `.env.example` в `.env`:

```bash
cp .env.example .env
```

**Обязательные переменные:**

```env
# Порт сервера
PORT=3000

# Режим работы (development/production)
NODE_ENV=development

# База данных PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=movielist_db
DB_USER=movielist_user
DB_PASSWORD=ваш_надёжный_пароль

# JWT секреты (сгенерируйте случайные строки!)
JWT_ACCESS_SECRET=ваш_секретный_ключ_минимум_32_символа
JWT_REFRESH_SECRET=ваш_секретный_ключ_минимум_32_символа

# Время жизни токенов
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Учётные данные администратора
ADMIN_EMAIL=admin@movielist.app
ADMIN_PASSWORD=смените_этот_пароль_немедленно
```

### 3. Генерация секретных ключей

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
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

-- Подключиться к базе и дать права на схему
\c movielist_db
GRANT ALL ON SCHEMA public TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO movielist_user;
\q
```

### 5. Запуск миграций

```bash
npm run migrate
```

### 6. Запуск сидирования

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
│   ├── index.js              # Точка входа + cron
│   └── public/
│       └── admin.html        # Админ-панель
├── .env.example              # Шаблон переменных
├── install.sh                # Скрипт установки на VDS
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

### Web Interface

| URL | Описание |
|-----|----------|
| `/admin` | Админ-панель (HTML) |
| `/health` | Health check |

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

### Защита:
- Helmet (security headers)
- CORS настройка
- Валидация всех данных
- Мягкое удаление данных
- Шифрование паролей (bcrypt)

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
        "sync_version": 1,
        "updated_at": "2024-01-01T00:00:00Z"
      }
    }
  ],
  "types": [...],
  "genres": [...]
}
```

## 🖥️ Развёртывание на VDS

### Автоматическая установка

**Шаг 1:** Скопируйте файлы на сервер

```bash
# С вашего компьютера
scp -r backend/* root@ваш-сервер:/var/www/movielist-backend/
```

**Шаг 2:** Подключитесь к серверу и запустите скрипт

```bash
ssh root@ваш-сервер
cd /var/www/movielist-backend/
chmod +x install.sh
./install.sh
```

Скрипт автоматически:
- Обновит систему
- Установит Node.js, PostgreSQL, Nginx, PM2, UFW
- Создаст базу данных с правильными правами
- Настроит .env (спросит email/пароль админа)
- Запустит миграции и сидирование
- Настроит Nginx как reverse proxy
- Настроит брандмауэр

### Ручная установка

Если предпочитаете ручную настройку, следуйте шагам из раздела "Быстрый старт".

### Настройка домена

**Если есть домен:**
1. Настройте A-запись: `your-domain.com → IP сервера`
2. При запуске `install.sh` укажите домен
3. Установите SSL: `sudo certbot --nginx -d your-domain.com`

**Если только IP:**
- Используйте IP сервера (определяется автоматически)
- Доступ: `http://ваш-IP/admin`

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

### Ответ:

```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "displayName": "Test User",
    "isAdmin": false
  },
  "tokens": {
    "accessToken": "eyJhbG...",
    "refreshToken": "uuid",
    "expiresIn": "15m"
  }
}
```

## 🔧 Управление через PM2

```bash
# Статус
pm2 status

# Логи
pm2 logs movielist-backend

# Перезапуск
pm2 restart movielist-backend

# Остановка
pm2 stop movielist-backend

# Удаление
pm2 delete movielist-backend

# Мониторинг
pm2 monit
```

## 📝 Логи

Логи записываются в консоль и сохраняются PM2.

Просмотр логов:

```bash
# Через PM2
pm2 logs movielist-backend --lines 100

# Файл логов (если настроено)
tail -f logs/app.log
```

## 🔧 Устранение проблем

### Ошибка подключения к БД:

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\du"
```

### Порт занят:

```bash
sudo lsof -i :3000
sudo netstat -tulpn | grep 3000
```

### Проблемы с правами PostgreSQL:

```bash
sudo -u postgres psql
\c movielist_db
GRANT ALL ON SCHEMA public TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO movielist_user;
\q
```

### Пересоздание базы:

```bash
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS movielist_db;
DROP USER IF EXISTS movielist_user;
CREATE USER movielist_user WITH PASSWORD 'новый_пароль';
CREATE DATABASE movielist_db OWNER movielist_user;
\c movielist_db
GRANT ALL ON SCHEMA public TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO movielist_user;
\q
EOF
```

### Обновление .env:

```bash
cd /var/www/movielist-backend
nano .env
# Измените нужные значения
pm2 restart movielist-backend
```

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs movielist-backend`
2. Проверьте статус БД: `sudo systemctl status postgresql`
3. Проверьте переменные окружения в `.env`
4. Проверьте доступность порта: `sudo netstat -tulpn | grep 3000`

## 📄 Лицензия

MIT
