# 🚀 Инструкция по развёртыванию MovieList Backend на VDS

## 📋 Шаг 1: Выбор ОС

**Рекомендуется: Ubuntu 24.04-amd64**

Причины:
- ✅ Долгосрочная поддержка (LTS) до 2029 года
- ✅ Актуальные пакеты
- ✅ Лучшая документация
- ✅ Совместимость со всеми инструментами

---

## 📋 Шаг 2: Копирование файлов на сервер

### Вариант A: Через SCP (Windows PowerShell)

```powershell
scp -r c:\MovieList\movielist_app\backend\* root@ваш-IP:/var/www/movielist-backend/
```

### Вариант B: Через WinSCP / FileZilla

1. Подключитесь к серверу:
   - Хост: `ваш-IP` или `vm3962043.ovz.srv.ru`
   - Порт: `22`
   - Логин: `root`
   - Пароль: (ваш пароль от VDS)

2. Перейдите в `/var/www/`

3. Создайте папку `movielist-backend`

4. Загрузите все файлы из `backend/` в эту папку

---

## 📋 Шаг 3: Подключение к серверу

```bash
ssh root@ваш-IP
```

---

## 📋 Шаг 4: Запуск установки

```bash
# Перейдите в директорию
cd /var/www/movielist-backend/

# Дайте права на выполнение скрипта
chmod +x install.sh

# Запустите установку
./install.sh
```

### Скрипт спросит:

1. **Пароль для БД** - придумайте надёжный пароль (минимум 8 символов)
2. **Email администратора** - например, `admin@movielist.app`
3. **Пароль администратора** - минимум 8 символов (запомните!)
4. **Домен** - нажмите Enter для использования IP сервера

---

## 📋 Шаг 5: Проверка работы

После завершения установки:

```bash
# Проверка статуса
pm2 status

# Проверка логов
pm2 logs movielist-backend

# Проверка доступности
curl http://localhost:3000/health
```

### Открыть в браузере:

- **Админ-панель**: `http://ваш-IP/admin`
- **API**: `http://ваш-IP/api/`
- **Health**: `http://ваш-IP/health`

---

## 📋 Шаг 6: Первый вход

1. Откройте `http://ваш-IP/admin`
2. Введите email и пароль администратора (которые указали при установке)
3. Готово!

---

## 🔧 Полезные команды

```bash
# Статус процессов
pm2 status

# Логи в реальном времени
pm2 logs movielist-backend --lines 100

# Перезапуск сервера
pm2 restart movielist-backend

# Остановка сервера
pm2 stop movielist-backend

# Мониторинг ресурсов
pm2 monit

# Проверка статуса Nginx
systemctl status nginx

# Проверка статуса PostgreSQL
systemctl status postgresql

# Проверка брандмауэра
ufw status
```

---

## 🔐 Настройка SSL (если есть домен)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d ваш-домен.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

---

## 🐛 Устранение проблем

### Ошибка: "permission denied for schema public"

```bash
sudo -u postgres psql << EOF
\c movielist_db
GRANT ALL ON SCHEMA public TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO movielist_user;
\q
EOF

# Перезапустите миграции
npm run migrate
npm run seed
```

### Ошибка: "порт 3000 занят"

```bash
# Найти процесс
sudo lsof -i :3000

# Убить процесс
sudo kill -9 <PID>

# Или измените порт в .env
PORT=3001
```

### Сервер не доступен извне

```bash
# Проверьте брандмауэр
ufw status

# Откройте порт если нужно
ufw allow 3000/tcp
ufw reload
```

### Nginx выдаёт 502 Bad Gateway

```bash
# Проверьте, запущен ли backend
pm2 status

# Если нет - запустите
pm2 start movielist-backend

# Перезапустите Nginx
systemctl restart nginx
```

---

## 📊 Мониторинг

### Логи приложения

```bash
# PM2 логи
pm2 logs movielist-backend

# Nginx логи
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# PostgreSQL логи
tail -f /var/log/postgresql/postgresql-*.log
```

### Статистика

```bash
# Использование памяти
free -h

# Использование диска
df -h

# Загрузка CPU
top
```

---

## 🔄 Обновление приложения

```bash
cd /var/www/movielist-backend

# Обновите файлы (через git или scp)

# Установите зависимости если изменился package.json
npm install --production

# Перезапустите сервер
pm2 restart movielist-backend
```

---

## 📞 Контакты

При возникновении проблем проверьте:

1. ✅ Статус сервисов: `pm2 status && systemctl status nginx postgresql`
2. ✅ Логи: `pm2 logs movielist-backend`
3. ✅ Брандмауэр: `ufw status`
4. ✅ Переменные окружения: `cat /var/www/movielist-backend/.env`

---

## ✅ Чек-лист после установки

- [ ] Сервер отвечает на `/health`
- [ ] Админ-панель доступна
- [ ] Можно войти с учётными данными админа
- [ ] PostgreSQL работает
- [ ] Nginx работает
- [ ] Брандмауэр настроен
- [ ] PM2 автозапуск настроен
- [ ] Логи записываются

**После успешной установки можно приступать к интеграции с Flutter-приложением!** 🎉
