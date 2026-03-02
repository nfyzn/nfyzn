#!/bin/bash
# MovieList Server Setup Script for Ubuntu 24.04
# IP: 95.81.121.164
# Этот скрипт настраивает сервер с чистого листа до рабочего состояния

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Логирование
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    log_error "Запустите скрипт от root (sudo ./setup_server.sh)"
    exit 1
fi

log_info "=== MovieList Server Setup ==="
log_info "Начало настройки сервера..."

# ============================================
# 1. Обновление системы
# ============================================
log_info "Шаг 1/12: Обновление системы..."
apt update && apt upgrade -y

# ============================================
# 2. Установка базовых зависимостей
# ============================================
log_info "Шаг 2/12: Установка базовых зависимостей..."
apt install -y \
    curl \
    git \
    wget \
    build-essential \
    openssl \
    ca-certificates \
    gnupg \
    apt-transport-https \
    lsb-release \
    ufw \
    fail2ban \
    htop \
    nano \
    unzip

# ============================================
# 3. Установка Node.js 20.x
# ============================================
log_info "Шаг 3/12: Установка Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверка установки
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
log_info "Установлен Node.js: $NODE_VERSION, npm: $NPM_VERSION"

# ============================================
# 4. Установка PostgreSQL 16
# ============================================
log_info "Шаг 4/12: Установка PostgreSQL 16..."
apt install -y postgresql postgresql-contrib

# Запуск PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Проверка статуса
if systemctl is-active --quiet postgresql; then
    log_info "PostgreSQL запущен"
else
    log_error "PostgreSQL не запустился"
    exit 1
fi

# ============================================
# 5. Установка Redis
# ============================================
log_info "Шаг 5/12: Установка Redis..."
apt install -y redis-server

# Настройка Redis
systemctl enable redis-server
systemctl start redis-server

# Проверка
if systemctl is-active --quiet redis-server; then
    log_info "Redis запущен"
else
    log_error "Redis не запустился"
    exit 1
fi

# ============================================
# 6. Установка Nginx
# ============================================
log_info "Шаг 6/12: Установка Nginx..."
apt install -y nginx

systemctl enable nginx
systemctl start nginx

# Проверка
if systemctl is-active --quiet nginx; then
    log_info "Nginx запущен"
else
    log_error "Nginx не запустился"
    exit 1
fi

# ============================================
# 7. Настройка брандмауэра UFW
# ============================================
log_info "Шаг 7/12: Настройка брандмауэра..."

# Сброс правил
ufw --force reset

# Разрешение SSH
ufw allow 22/tcp

# Разрешение HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Разрешение порта приложения (3000)
ufw allow 3000/tcp

# Включение брандмауэра
ufw --force enable

log_info "Брандмауэр настроен (порты: 22, 80, 443, 3000)"

# ============================================
# 8. Настройка Fail2Ban
# ============================================
log_info "Шаг 8/12: Настройка Fail2Ban..."

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log_info "Fail2Ban настроен и запущен"

# ============================================
# 9. Создание пользователя и базы данных
# ============================================
log_info "Шаг 9/12: Настройка базы данных..."

# Генерация случайного пароля
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Сохранение пароля в файл
echo "DB_PASSWORD=$DB_PASSWORD" > /root/movielist_db_password.txt
chmod 600 /root/movielist_db_password.txt

# Создание пользователя и БД
sudo -u postgres psql << EOF
CREATE DATABASE movielist;
CREATE USER movielist_user WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE movielist TO movielist_user;
ALTER DATABASE movielist OWNER TO movielist_user;
\q
EOF

log_info "База данных 'movielist' создана"
log_warn "Пароль БД сохранён в /root/movielist_db_password.txt"

# ============================================
# 10. Создание структуры приложения
# ============================================
log_info "Шаг 10/12: Создание структуры приложения..."

# Создание директорий
mkdir -p /var/www/movielist-backend
mkdir -p /var/www/movielist-backend/logs
mkdir -p /var/www/movielist-backend/uploads

# Установка PM2 глобально
npm install -g pm2

# ============================================
# 11. Создание конфигурационных файлов
# ============================================
log_info "Шаг 11/12: Создание конфигурационных файлов..."

# Генерация секретных ключей
JWT_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Создание .env файла
cat > /var/www/movielist-backend/.env << EOF
# Окружение
NODE_ENV=production
PORT=3000

# База данных
DATABASE_URL=postgresql://movielist_user:$DB_PASSWORD@localhost:5432/movielist

# JWT секреты
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=30d
REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET

# Redis
REDIS_URL=redis://localhost:6379

# SMTP (для восстановления пароля)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# URL приложения
API_URL=http://95.81.121.164:3000
FRONTEND_URL=http://95.81.121.164

# Лимиты
MAX_FILE_SIZE=10485760
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
EOF

chmod 600 /var/www/movielist-backend/.env
log_info "Файл .env создан"

# ============================================
# 12. Настройка Nginx как reverse proxy
# ============================================
log_info "Шаг 12/12: Настройка Nginx..."

cat > /etc/nginx/sites-available/movielist << 'EOF'
server {
    listen 80;
    server_name 95.81.121.164;

    # Логи
    access_log /var/log/nginx/movielist_access.log;
    error_log /var/log/nginx/movielist_error.log;

    # Максимальный размер загружаемых файлов
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Статические файлы (если будут)
    location /static {
        alias /var/www/movielist-backend/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Создание симлинка
ln -sf /etc/nginx/sites-available/movielist /etc/nginx/sites-enabled/movielist

# Проверка конфигурации
nginx -t

# Перезагрузка Nginx
systemctl restart nginx

log_info "Nginx настроен"

# ============================================
# Завершение
# ============================================
echo ""
log_info "=== Настройка сервера завершена ==="
echo ""
log_info "Сервер доступен по адресу: http://95.81.121.164"
log_info "API доступно по адресу: http://95.81.121.164:3000/api"
echo ""
log_warn "ВАЖНО: Сохраните следующие файлы:"
log_warn "  - /root/movielist_db_password.txt (пароль БД)"
log_warn "  - /var/www/movielist-backend/.env (конфигурация приложения)"
echo ""
log_info "Следующие шаги:"
log_info "  1. Скопируйте файлы backend в /var/www/movielist-backend/"
log_info "  2. Выполните: cd /var/www/movielist-backend && npm install"
log_info "  3. Выполните: pm2 start ecosystem.config.js"
log_info "  4. Выполните: pm2 save"
log_info "  5. Выполните: pm2 startup"
echo ""
log_info "Полезные команды:"
log_info "  - pm2 status (статус приложений)"
log_info "  - pm2 logs movielist-api (логи приложения)"
log_info "  - pm2 restart movielist-api (перезапуск)"
log_info "  - tail -f /var/log/nginx/movielist_error.log (ошибки Nginx)"
echo ""
