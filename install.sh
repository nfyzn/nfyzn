#!/bin/bash

# MovieList Backend - Скрипт установки на VDS (исправленный)
# Запускается ИЗ директории backend после копирования файлов

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     MovieList Backend - Установка на сервер               ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Проверка root прав
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Пожалуйста, запустите от root${NC}"
  exit 1
fi

# Проверка наличия package.json
if [ ! -f "package.json" ]; then
  echo -e "${RED}❌ package.json не найден!${NC}"
  echo "Запустите скрипт из директории backend после копирования файлов."
  exit 1
fi

echo -e "${GREEN}✓ Файлы найдены, начинаем установку...${NC}"

# Обновление системы
echo -e "${YELLOW}[1/8] Обновление системы...${NC}"
apt update && apt upgrade -y

# Установка Node.js
echo -e "${YELLOW}[2/8] Установка Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Установка PostgreSQL
echo -e "${YELLOW}[3/8] Установка PostgreSQL...${NC}"
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Установка PM2
echo -e "${YELLOW}[4/8] Установка PM2...${NC}"
npm install -g pm2

# Установка Nginx
echo -e "${YELLOW}[5/8] Установка Nginx...${NC}"
apt install -y nginx

# Создание пользователя БД
echo -e "${YELLOW}[6/8] Настройка базы данных...${NC}"
read -p "Введите пароль для БД: " -s DB_PASSWORD
echo

sudo -u postgres psql << EOF
CREATE DATABASE movielist_db;
CREATE USER movielist_user WITH PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE movielist_db TO movielist_user;
\q
EOF

# Создание .env
echo -e "${YELLOW}[7/8] Настройка переменных окружения...${NC}"
cp .env.example .env

echo ""
echo "Введите значения:"
read -p "Домен (или Enter для *): " DOMAIN
read -p "Email администратора: " ADMIN_EMAIL
read -p "Пароль администратора: " -s ADMIN_PASSWORD
echo ""

# Генерация секретов
JWT_ACCESS=$(openssl rand -base64 32)
JWT_REFRESH=$(openssl rand -base64 32)

sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASSWORD}|" .env
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=${DOMAIN:-*}|" .env
sed -i "s|ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|" .env
sed -i "s|ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASSWORD}|" .env
sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS}|" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH}|" .env

# Установка зависимостей
echo -e "${YELLOW}[8/8] Установка зависимостей npm...${NC}"
npm install --production

# Запуск миграций
echo -e "${GREEN}Запуск миграций...${NC}"
npm run migrate

echo -e "${GREEN}Сидирование данных...${NC}"
npm run seed

# Настройка PM2
echo -e "${GREEN}Настройка PM2...${NC}"
pm2 start src/index.js --name movielist-backend
pm2 startup
pm2 save

# Настройка Nginx
echo -e "${GREEN}Настройка Nginx...${NC}"
read -p "Введите домен (или Enter для localhost): " DOMAIN_NAME
DOMAIN_NAME=${DOMAIN_NAME:-localhost}

cat > /etc/nginx/sites-available/movielist << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/movielist /etc/nginx/sites-enabled/movielist
nginx -t
systemctl restart nginx

# Брандмауэр
echo -e "${GREEN}Настройка брандмауэра...${NC}"
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw --force enable

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ✅ Установка завершена успешно!                          ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Сервер запущен на порту 3000                             ║"
echo "║  Админ-панель: http://${DOMAIN_NAME}/admin                   ║"
echo "║  Email админа: ${ADMIN_EMAIL}"
echo "║  PM2 статус: pm2 status                                   ║"
echo "║  PM2 логи: pm2 logs movielist-backend                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
