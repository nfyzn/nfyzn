/**
 * Конфигурация подключения к PostgreSQL
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Проверка подключения
pool.on('connect', () => {
  console.log('Подключено к базе данных');
});

pool.on('error', (err) => {
  console.error('Неожиданная ошибка базы данных:', err);
  process.exit(-1);
});

module.exports = { pool };
