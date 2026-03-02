/**
 * Middleware для аутентификации
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { AppError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
  try {
    // Получение токена из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Требуется авторизация', 401);
    }

    const accessToken = authHeader.split(' ')[1];

    // Проверка токена
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    
    // Проверка сессии в базе данных
    const result = await pool.query(
      'SELECT * FROM sessions WHERE access_token = $1 AND expires_at > NOW()',
      [accessToken]
    );

    if (result.rows.length === 0) {
      throw new AppError('Сессия недействительна', 401);
    }

    const session = result.rows[0];

    // Добавление пользователя в запрос
    req.user = {
      userId: session.user_id,
      sessionId: session.id,
      deviceId: session.device_id
    };
    req.session = session;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AppError('Неверный или истёкший токен', 401));
    } else {
      next(error);
    }
  }
};

module.exports = authMiddleware;
