/**
 * Конфигурация подключения к Redis
 */

const { createClient } = require('redis');

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Подключено к Redis');
});

// Инициализация подключения
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Ошибка подключения к Redis:', err);
  }
})();

module.exports = redisClient;
