/**
 * Контроллер авторизации
 */

const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Session = require('../models/Session');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Валидация регистрации
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Некорректный email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен быть не менее 6 символов')
    .matches(/[A-Za-z]/)
    .matches(/[0-9]/)
    .withMessage('Пароль должен содержать буквы и цифры'),
  body('displayName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Имя должно быть от 2 до 50 символов'),
];

// Валидация входа
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Некорректный email'),
  body('password')
    .notEmpty()
    .withMessage('Введите пароль'),
  body('deviceId')
    .notEmpty()
    .withMessage('Требуется ID устройства'),
];

// Регистрация
const register = async (req, res, next) => {
  try {
    // Проверка валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400);
    }

    const { email, password, displayName } = req.body;

    // Проверка существования пользователя
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new AppError('Email уже зарегистрирован', 409);
    }

    // Создание пользователя
    const user = await User.create({ email, password, displayName });

    // Создание сессии
    const session = await Session.create({
      userId: user.id,
      deviceId: req.body.deviceId || 'unknown'
    });

    // Обновление времени входа
    await User.updateLastLogin(user.id);

    logger.info(`Новый пользователь зарегистрирован: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          isGuest: user.is_guest,
          createdAt: user.created_at
        },
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

// Вход
const login = async (req, res, next) => {
  try {
    // Проверка валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 400);
    }

    const { email, password, deviceId } = req.body;

    // Поиск пользователя
    const user = await User.findByEmail(email);
    if (!user) {
      throw new AppError('Неверный email или пароль', 401);
    }

    // Проверка пароля
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AppError('Неверный email или пароль', 401);
    }

    // Удаление старых сессий для этого устройства
    await Session.deleteAllForUser(user.id, deviceId);

    // Создание новой сессии
    const session = await Session.create({ userId: user.id, deviceId });

    // Обновление времени входа
    await User.updateLastLogin(user.id);

    logger.info(`Пользователь вошёл: ${email}`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          isGuest: user.is_guest,
          createdAt: user.created_at,
          lastLoginAt: user.last_login_at
        },
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

// Выход
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const session = await Session.findByRefreshToken(refreshToken);
      if (session) {
        await Session.delete(session.id);
      }
    }

    logger.info('Пользователь вышел');

    res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  } catch (error) {
    next(error);
  }
};

// Обновление токена
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken, deviceId } = req.body;

    if (!refreshToken) {
      throw new AppError('Требуется refresh токен', 400);
    }

    // Проверка refresh токена
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Поиск сессии
    const session = await Session.findByRefreshToken(refreshToken);
    if (!session) {
      throw new AppError('Сессия не найдена', 401);
    }

    // Генерация новых токенов
    const newAccessToken = Session.generateAccessToken(decoded.userId, session.id);
    const newRefreshToken = jwt.sign(
      { userId: decoded.userId, sessionId: session.id, deviceId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    // Обновление сессии
    const tokens = await Session.updateTokens(session.id, newAccessToken, newRefreshToken);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AppError('Неверный refresh токен', 401));
    } else {
      next(error);
    }
  }
};

// Восстановление пароля
const resetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Проверка существования пользователя
    const user = await User.findByEmail(email);
    
    // Всегда возвращаем успех для безопасности
    res.json({
      success: true,
      message: 'Если email зарегистрирован, инструкции отправлены'
    });

    if (user) {
      // TODO: Отправить email с токеном восстановления
      logger.info(`Запрос восстановления пароля для: ${email}`);
    }
  } catch (error) {
    next(error);
  }
};

// Смена пароля
const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Проверка старого пароля
    const user = await User.findByEmail(req.user.email);
    const isValidPassword = await User.verifyPassword(oldPassword, user.password_hash);
    
    if (!isValidPassword) {
      throw new AppError('Неверный текущий пароль', 400);
    }

    // Смена пароля
    await User.changePassword(userId, newPassword);

    // Удаление всех сессий кроме текущей
    await pool.query(
      'DELETE FROM sessions WHERE user_id = $1 AND id != $2',
      [userId, req.user.sessionId]
    );

    logger.info(`Пароль изменён для пользователя: ${userId}`);

    res.json({
      success: true,
      message: 'Пароль успешно изменён'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  registerValidation,
  login,
  loginValidation,
  logout,
  refreshToken,
  resetPassword,
  changePassword
};
