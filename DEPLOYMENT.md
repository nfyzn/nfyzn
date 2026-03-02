# Инструкция по развёртыванию MovieList на сервере Ubuntu 24.04

## Информация о сервере
- **IP-адрес:** 95.81.121.164
- **ОС:** Ubuntu 24.04 LTS
- **Порт приложения:** 3000
- **База данных:** PostgreSQL
- **Кэш:** Redis

---

## Шаг 1: Подготовка сервера

### 1.1. Подключение к серверу
```bash
ssh root@95.81.121.164
```

### 1.2. Запуск скрипта настройки
```bash
# Скопируйте скрипт на сервер
scp setup_server.sh root@95.81.121.164:/root/

# Подключитесь к серверу и запустите скрипт
ssh root@95.81.121.164
cd /root
chmod +x setup_server.sh
./setup_server.sh
```

Скрипт автоматически:
- Обновит систему
- Установит Node.js 20.x, PostgreSQL 16, Redis, Nginx
- Настроит брандмауэр (порты 22, 80, 443, 3000)
- Настроит Fail2Ban
- Создаст базу данных и пользователя
- Создаст структуру приложения
- Настроит Nginx как reverse proxy

---

## Шаг 2: Развёртывание backend

### 2.1. Копирование файлов backend на сервер
```bash
# С локальной машины
scp -r backend/* root@95.81.121.164:/var/www/movielist-backend/
```

### 2.2. Установка зависимостей
```bash
# На сервере
cd /var/www/movielist-backend
npm install
```

### 2.3. Инициализация базы данных
```bash
# На сервере
sudo -u postgres psql -d movielist -f /var/www/movielist-backend/database/init.sql
```

### 2.4. Запуск приложения через PM2
```bash
# На сервере
cd /var/www/movielist-backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Выполните команду, которую выведет pm2 startup
```

### 2.5. Проверка работы
```bash
# Проверка статуса
pm2 status

# Просмотр логов
pm2 logs movielist-api

# Проверка API
curl http://localhost:3000/health
```

---

## Шаг 3: Настройка Flutter-приложения

### 3.1. Обновление URL сервера

Файлы для проверки:
- `lib/services/auth_service.dart` - строка `_baseUrl`
- `lib/services/sync_service.dart` - строка `_baseUrl`

```dart
static const String _baseUrl = 'http://95.81.121.164:3000/api';
```

### 3.2. Установка зависимостей
```bash
cd c:\MovieList\movielist_app
flutter pub get
```

### 3.3. Сборка и запуск
```bash
# Для Android
flutter build apk --release

# Для iOS
flutter build ios --release
```

---

## Шаг 4: Проверка работы

### 4.1. Тестирование API
```bash
# Health check
curl http://95.81.121.164:3000/health

# Регистрация
curl -X POST http://95.81.121.164:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "displayName": "Test User"
  }'

# Вход
curl -X POST http://95.81.121.164:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "deviceId": "test-device-123"
  }'
```

### 4.2. Тестирование приложения
1. Запустите приложение на устройстве/эмуляторе
2. Попробуйте зарегистрироваться
3. Попробуйте войти
4. Проверьте синхронизацию данных

---

## Полезные команды

### Управление приложением
```bash
# Статус приложений
pm2 status

# Перезапуск
pm2 restart movielist-api

# Остановка
pm2 stop movielist-api

# Логи
pm2 logs movielist-api --lines 100

# Мониторинг
pm2 monit
```

### Логи
```bash
# Логи Nginx
tail -f /var/log/nginx/movielist_access.log
tail -f /var/log/nginx/movielist_error.log

# Логи приложения
tail -f /var/www/movielist-backend/logs/combined.log
tail -f /var/www/movielist-backend/logs/error.log
```

### База данных
```bash
# Подключение к PostgreSQL
sudo -u postgres psql

# Подключение к конкретной БД
sudo -u postgres psql -d movielist

# Просмотр таблиц
\dt

# Выход
\q
```

### Перезапуск служб
```bash
systemctl restart nginx
systemctl restart postgresql
systemctl restart redis-server
systemctl restart fail2ban
```

---

## Структура файлов backend

```
/var/www/movielist-backend/
├── server.js                 # Точка входа
├── package.json              # Зависимости
├── ecosystem.config.js       # Конфигурация PM2
├── .env                      # Переменные окружения (не копировать!)
├── database/
│   └── init.sql              # Схема БД
├── logs/                     # Логи приложения
├── uploads/                  # Загруженные файлы
└── src/
    ├── app.js                # Приложение Express
    ├── config/
    │   ├── database.js       # Подключение к PostgreSQL
    │   └── redis.js          # Подключение к Redis
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── sync.controller.js
    │   └── user.controller.js
    ├── middleware/
    │   ├── authMiddleware.js
    │   └── errorHandler.js
    ├── models/
    │   ├── User.js
    │   └── Session.js
    ├── routes/
    │   ├── auth.routes.js
    │   ├── sync.routes.js
    │   └── user.routes.js
    └── utils/
        └── logger.js         # Логирование
```

---

## Безопасность

### 1. Обновление системы
```bash
# Автоматические обновления безопасности
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 2. Проверка брандмауэра
```bash
ufw status
```

### 3. Мониторинг попыток взлома
```bash
# Fail2Ban логи
tail -f /var/log/fail2ban.log

# SSH логи
tail -f /var/log/auth.log
```

### 4. Резервное копирование БД
```bash
# Создать дамп
sudo -u postgres pg_dump movielist > /backup/movielist_$(date +%Y%m%d).sql

# Восстановить из дампа
sudo -u postgres psql movielist < /backup/movielist_20240101.sql
```

---

## Устранение неполадок

### Приложение не запускается
```bash
# Проверка логов PM2
pm2 logs movielist-api --err

# Проверка порта
netstat -tulpn | grep 3000

# Проверка .env файла
cat /var/www/movielist-backend/.env
```

### Ошибка подключения к БД
```bash
# Проверка статуса PostgreSQL
systemctl status postgresql

# Проверка подключения
sudo -u postgres psql -d movielist -c "SELECT NOW()"
```

### Ошибка 502 Bad Gateway
```bash
# Проверка статуса приложения
pm2 status

# Проверка логов Nginx
tail -f /var/log/nginx/movielist_error.log

# Перезапуск Nginx
systemctl restart nginx
```

---

## Контакты и поддержка

В случае возникновения проблем:
1. Проверьте логи приложения
2. Проверьте логи Nginx
3. Проверьте статус служб
4. Проверьте доступность портов
