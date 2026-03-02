#!/bin/bash

# MovieList Backend - Скрипт установки на VDS
# Версия: 1.2 (исправленная)
# Запускается ИЗ директории backend после копирования файлов

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     MovieList Backend - Установка на сервер               ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Логирование
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Проверка root прав
if [ "$EUID" -ne 0 ]; then 
  log_error "Пожалуйста, запустите от root (используйте sudo)"
  exit 1
fi

# Проверка наличия package.json
if [ ! -f "package.json" ]; then
  log_error "package.json не найден!"
  log_error "Запустите скрипт из директории backend после копирования файлов."
  exit 1
fi

log_success "Файлы найдены, начинаем установку..."

# Функция получения IP сервера
get_server_ip() {
  curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'
}

# ============================================================================
# [1/9] Обновление системы
# ============================================================================
log_info "[1/9] Обновление системы..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
log_success "Система обновлена"

# ============================================================================
# [2/9] Установка Node.js
# ============================================================================
log_info "[2/9] Установка Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
log_success "Node.js $(node -v) установлен"

# ============================================================================
# [3/9] Установка PostgreSQL
# ============================================================================
log_info "[3/9] Установка PostgreSQL..."
apt-get install -y -qq postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql > /dev/null 2>&1
log_success "PostgreSQL установлен и запущен"

# ============================================================================
# [4/9] Установка PM2
# ============================================================================
log_info "[4/9] Установка PM2..."
npm install -g pm2 > /dev/null 2>&1
log_success "PM2 установлен"

# ============================================================================
# [5/9] Установка Nginx и UFW
# ============================================================================
log_info "[5/9] Установка Nginx и UFW..."
apt-get install -y -qq nginx ufw
log_success "Nginx и UFW установлены"

# ============================================================================
# [6/9] Настройка базы данных
# ============================================================================
log_info "[6/9] Настройка базы данных..."
read -p "Введите пароль для БД: " -s DB_PASSWORD
echo

# Проверяем длину пароля
if [ ${#DB_PASSWORD} -lt 8 ]; then
  log_error "Пароль должен быть минимум 8 символов"
  exit 1
fi

# Удаляем старое и создаём заново с правильными правами
sudo -u postgres psql -v ON_ERROR_STOP=1 << EOSQL
-- Удаляем старое если есть
DROP DATABASE IF EXISTS movielist_db;
DROP USER IF EXISTS movielist_user;

-- Создаём пользователя и базу
CREATE USER movielist_user WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE movielist_db OWNER movielist_user;

-- Подключаемся к базе и настраиваем права
\\c movielist_db

-- Предоставляем все права на схему public
GRANT ALL ON SCHEMA public TO movielist_user;
GRANT ALL PRIVILEGES ON DATABASE movielist_db TO movielist_user;

-- Для PostgreSQL 15+ - права по умолчанию
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO movielist_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO movielist_user;
EOSQL

log_success "База данных настроена"

# ============================================================================
# [7/9] Настройка переменных окружения
# ============================================================================
log_info "[7/9] Настройка .env..."
cp .env.example .env

echo ""
echo "Введите значения:"
read -p "Email администратора [admin@movielist.app]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@movielist.app}

read -p "Пароль администратора: " -s ADMIN_PASSWORD
echo ""

# Проверка пароля админа
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
  log_error "Пароль администратора должен быть минимум 8 символов"
  exit 1
fi

# Генерация секретов
JWT_ACCESS=$(openssl rand -base64 32 | tr -d '\n')
JWT_REFRESH=$(openssl rand -base64 32 | tr -d '\n')

# Получаем IP сервера если нет домена
SERVER_IP=$(get_server_ip)
read -p "Домен (или Enter для ${SERVER_IP}): " DOMAIN
DOMAIN=${DOMAIN:-$SERVER_IP}

sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=*|" .env
sed -i "s|ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" .env
sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" .env
sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS}|" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH}|" .env

log_success ".env настроен"

# ============================================================================
# [8/9] Установка зависимостей и миграции
# ============================================================================
log_info "[8/9] Установка зависимостей npm..."
npm install --production --loglevel=error

log_info "Запуск миграций..."
npm run migrate

log_info "Сидирование данных..."
npm run seed

log_success "Зависимости установлены, миграции выполнены"

# ============================================================================
# [9/9] Настройка сервисов
# ============================================================================
log_info "[9/9] Настройка PM2, Nginx, UFW..."

# PM2
pm2 delete movielist-backend 2>/dev/null || true
pm2 start src/index.js --name movielist-backend
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

# Nginx
cat > /etc/nginx/sites-available/movielist << EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/movielist /etc/nginx/sites-enabled/movielist
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# UFW
ufw --force reset > /dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw allow 3000/tcp
echo "y" | ufw enable

log_success "Сервисы настроены"

# ============================================================================
# Итоги
# ============================================================================
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ Установка завершена успешно!                          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Сервер запущен на порту 3000                             ║"
echo "║  Админ-панель: http://${DOMAIN}/admin                        ║"
echo "║  API: http://${DOMAIN}/api/                                  ║"
echo "║  Health: http://${DOMAIN}/health                             ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Учётные данные администратора:                           ║"
echo "║  Email: ${ADMIN_EMAIL}"
echo "║  Пароль: (указан вами)                                    ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Полезные команды PM2:                                    ║"
echo "║  pm2 status              - Статус процессов               ║"
echo "║  pm2 logs movielist      - Логи                           ║"
echo "║  pm2 restart movielist   - Перезапуск                     ║"
echo "║  pm2 stop movielist      - Остановка                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
