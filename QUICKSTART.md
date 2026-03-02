# ⚡ Быстрая установка MovieList Backend

## 🚀 Автоматическая установка (5 минут)

### 1. Скопируйте файлы на сервер

**Windows PowerShell:**
```powershell
scp -r c:\MovieList\movielist_app\backend\* root@ваш-IP:/var/www/movielist-backend/
```

### 2. Подключитесь к серверу

```bash
ssh root@ваш-IP
```

### 3. Запустите установку

```bash
cd /var/www/movielist-backend/
chmod +x install.sh
./install.sh
```

### 4. Введите данные когда спросит:

- **Пароль для БД** (минимум 8 символов)
- **Email администратора** (например: `admin@movielist.app`)
- **Пароль администратора** (минимум 8 символов)
- **Домен** (нажмите Enter для использования IP)

### 5. Готово!

Откройте в браузере: `http://ваш-IP/admin`

---

## 🔍 Проверка

```bash
# Статус
pm2 status

# Логи
pm2 logs movielist-backend

# Health check
curl http://localhost:3000/health
```

---

## 🛠️ Полезные команды

```bash
pm2 restart movielist-backend    # Перезапуск
pm2 logs movielist-backend       # Логи
systemctl status nginx           # Статус Nginx
systemctl status postgresql      # Статус БД
ufw status                       # Брандмауэр
```

---

## 📖 Полная документация

- `README.md` - полная документация по API
- `DEPLOYMENT.md` - подробная инструкция по развёртыванию
- `.env.example` - пример переменных окружения

---

## ⚠️ Если что-то пошло не так

1. Проверьте логи: `pm2 logs movielist-backend`
2. Проверьте статус БД: `systemctl status postgresql`
3. Пересоздайте базу (см. `DEPLOYMENT.md`)
4. Проверьте `.env`: `nano /var/www/movielist-backend/.env`
