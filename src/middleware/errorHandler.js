/**
 * Middleware для обработки ошибок
 */

const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Внутренняя ошибка сервера';

  // Логирование ошибки
  logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  // Обработка ошибок PostgreSQL
  if (err.code === '23505') { // Unique violation
    statusCode = 409;
    message = 'Конфликт данных';
  } else if (err.code === '23503') { // Foreign key violation
    statusCode = 400;
    message = 'Неверные данные';
  } else if (err.code === '23506') { // Check violation
    statusCode = 400;
    message = 'Ошибка проверки данных';
  }

  // Обработка ошибок JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Неверный токен';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Токен истёк';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler, AppError };
