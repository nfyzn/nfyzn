/**
 * MovieList Backend API Server
 * Точка входа приложения
 */

require('dotenv').config();

const app = require('./src/app');
const logger = require('./src/utils/logger');
const { pool } = require('./src/config/database');
const redisClient = require('./src/config/redis');

const PORT = process.env.PORT || 3000;

// Проверка подключения к базе данных
async function checkDatabase() {
  try {
    console.log('Проверка подключения к базе данных...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'установлен' : 'не установлен');
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('База данных подключена ✓');
    return true;
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error.message);
    logger.error('Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Проверка подключения к Redis
async function checkRedis() {
  try {
    console.log('Проверка подключения к Redis...');
    console.log('REDIS_URL:', process.env.REDIS_URL ? 'установлен' : 'не установлен');
    await redisClient.ping();
    console.log('Redis подключен ✓');
    return true;
  } catch (error) {
    console.error('Ошибка подключения к Redis:', error.message);
    logger.error('Ошибка подключения к Redis:', error.message);
    return false;
  }
}

// Запуск сервера
async function startServer() {
  try {
    console.log('=== Запуск MovieList API ===');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('PORT:', PORT);

    // Проверка подключений
    const dbConnected = await checkDatabase();
    const redisConnected = await checkRedis();

    if (!dbConnected) {
      console.error('Не удалось подключиться к базе данных. Выход...');
      logger.error('Не удалось подключиться к базе данных. Выход...');
      process.exit(1);
    }

    // Запуск сервера
    app.listen(PORT, () => {
      console.log(`Сервер запущен на порту ${PORT}`);
      console.log(`API доступно по адресу: http://localhost:${PORT}/api`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Режим: ${process.env.NODE_ENV || 'development'}`);
      
      logger.info(`Сервер запущен на порту ${PORT}`);
    });

    // Обработка сигналов завершения
    process.on('SIGTERM', () => {
      logger.info('Получен сигнал SIGTERM, завершение работы...');
      gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('Получен сигнал SIGINT, завершение работы...');
      gracefulShutdown();
    });

  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Корректное завершение работы
function gracefulShutdown() {
  pool.end()
    .then(() => {
      console.log('База данных отключена');
      logger.info('База данных отключена');
      return redisClient.quit();
    })
    .then(() => {
      console.log('Redis отключен');
      logger.info('Redis отключен');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Ошибка при завершении работы:', err);
      logger.error('Ошибка при завершении работы:', err);
      process.exit(1);
    });
}

// Обработка незахваченных исключений
process.on('uncaughtException', (error) => {
  console.error('Незахваченное исключение:', error);
  logger.error('Незахваченное исключение:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
  logger.error('Необработанное отклонение промиса:', reason);
});

startServer();
