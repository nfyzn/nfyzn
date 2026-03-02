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
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('База данных подключена');
    return true;
  } catch (error) {
    logger.error('Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Проверка подключения к Redis
async function checkRedis() {
  try {
    await redisClient.ping();
    logger.info('Redis подключен');
    return true;
  } catch (error) {
    logger.error('Ошибка подключения к Redis:', error.message);
    return false;
  }
}

// Запуск сервера
async function startServer() {
  try {
    // Проверка подключений
    const dbConnected = await checkDatabase();
    const redisConnected = await checkRedis();

    if (!dbConnected) {
      logger.error('Не удалось подключиться к базе данных. Выход...');
      process.exit(1);
    }

    // Запуск сервера
    app.listen(PORT, () => {
      logger.info(`Сервер запущен на порту ${PORT}`);
      logger.info(`API доступно по адресу: http://localhost:${PORT}/api`);
      logger.info(`Режим: ${process.env.NODE_ENV || 'development'}`);
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
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Корректное завершение работы
function gracefulShutdown() {
  pool.end()
    .then(() => {
      logger.info('База данных отключена');
      return redisClient.quit();
    })
    .then(() => {
      logger.info('Redis отключен');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Ошибка при завершении работы:', err);
      process.exit(1);
    });
}

// Обработка незахваченных исключений
process.on('uncaughtException', (error) => {
  logger.error('Незахваченное исключение:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Необработанное отклонение промиса:', reason);
});

startServer();
