# Инструкция по развёртыванию MovieList с чистого листа

## Быстрое развёртывание (5 минут)

### Шаг 1: Настройка сервера

```bash
# Подключиться к серверу
ssh root@95.81.121.164

# Перейти в директорию
cd /root

# Запустить скрипт настройки
chmod +x setup_server.sh
./setup_server.sh
```

Скрипт автоматически:
- ✅ Обновит систему
- ✅ Установит Node.js 20, PostgreSQL 16, Redis, Nginx
- ✅ Настроит брандмауэр (порты 22, 80, 443, 3000)
- ✅ Настроит Fail2Ban
- ✅ Создаст базу данных с правильными правами
- ✅ Создаст структуру приложения
- ✅ Настроит Nginx как reverse proxy

### Шаг 2: Копирование файлов backend

```bash
# На вашем компьютере (Windows PowerShell)
scp c:\MovieList\movielist_app\backend\* root@95.81.121.164:/var/www/movielist-backend/
scp -r c:\MovieList\movielist_app\backend\src root@95.81.121.164:/var/www/movielist-backend/
scp -r c:\MovieList\movielist_app\backend\database root@95.81.121.164:/var/www/movielist-backend/
```

### Шаг 3: Установка зависимостей и инициализация БД

```bash
# На сервере
cd /var/www/movielist-backend

# Установка зависимостей
npm install

# Инициализация базы данных
sudo -u postgres psql -d movielist -f database/init.sql

# Дать права на таблицы
sudo -u postgres psql -d movielist -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO movielist_user;"
sudo -u postgres psql -d movielist -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO movielist_user;"
```

### Шаг 4: Запуск приложения

```bash
# На сервере
cd /var/www/movielist-backend

# Запуск через PM2
pm2 start ecosystem.config.js

# Сохранение конфигурации
pm2 save

# Автозапуск при старте системы
pm2 startup
# (выполните команду, которую выведет pm2)
```

### Шаг 5: Проверка работы

```bash
# Проверка статуса (должно быть 0 рестартов)
pm2 status

# Проверка health endpoint
curl http://localhost:3000/health

# Тест регистрации
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","displayName":"Test User"}'

# Тест входа
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!","deviceId":"test-device-123"}'
```

---

## Проверка с внешнего устройства

```bash
# С вашего компьютера
curl http://95.81.121.164:3000/health
curl http://95.81.121.164/api/health  # Через Nginx
```

---

## Полезные команды

### Управление приложением
```bash
pm2 status              # Статус приложений
pm2 restart movielist-api  # Перезапуск
pm2 stop movielist-api     # Остановка
pm2 logs movielist-api     # Логи
pm2 monit                 # Мониторинг
```

### Логи
```bash
tail -f /var/www/movielist-backend/logs/combined.log
tail -f /var/www/movielist-backend/logs/error.log
tail -f /var/log/nginx/movielist_error.log
```

### База данных
```bash
# Подключение к PostgreSQL
sudo -u postgres psql -d movielist

# Просмотр таблиц
\dt

# Выход
\q
```

---

## Структура файлов

```
/var/www/movielist-backend/
├── server.js                 # Точка входа
├── package.json              # Зависимости
├── ecosystem.config.js       # PM2 конфигурация
├── .env                      # Переменные окружения
├── database/
│   └── init.sql              # Схема БД
├── logs/                     # Логи
├── uploads/                  # Загрузки
└── src/
    ├── app.js
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    └── utils/
```

---

## Устранение неполадок

### Ошибка "relation does not exist"
```bash
# Пересоздать БД
sudo -u postgres psql -d movielist -f database/init.sql
```

### Ошибка "permission denied"
```bash
# Дать права
sudo -u postgres psql -d movielist << EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO movielist_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO movielist_user;
EOF
```

### Приложение перезапускается
```bash
# Посмотреть логи
pm2 logs movielist-api --lines 50

# Перезапустить с обновлением env
pm2 restart movielist-api --update-env
```

### Ошибка 502 Bad Gateway
```bash
# Проверить статус приложения
pm2 status

# Проверить Nginx
systemctl status nginx
tail -f /var/log/nginx/movielist_error.log
```

---

## Файлы для копирования

Все файлы находятся в `c:\MovieList\movielist_app\backend\`:

```
setup_server.sh          # Скрипт настройки сервера
package.json             # Зависимости npm
ecosystem.config.js      # PM2 конфигурация
server.js                # Точка входа
.env.example             # Пример .env
database/init.sql        # Схема БД
src/app.js               # Express приложение
src/config/*             # Конфигурация БД и Redis
src/controllers/*        # Контроллеры
src/middleware/*         # Middleware
src/models/*             # Модели
src/routes/*             # Маршруты
src/utils/*              # Утилиты
```
