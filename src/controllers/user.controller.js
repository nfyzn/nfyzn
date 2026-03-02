/**
 * Контроллер пользователя
 */

const User = require('../models/User');
const Session = require('../models/Session');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Получение профиля
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isGuest: user.is_guest,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// Обновление профиля
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { displayName, email, avatarUrl } = req.body;

    // Проверка email на уникальность
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        throw new AppError('Email уже занят', 409);
      }
    }

    const user = await User.update(userId, { displayName, email, avatarUrl });

    logger.info(`Профиль обновлён для пользователя: ${userId}`);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        isGuest: user.is_guest,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

// Удаление аккаунта
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Удаление всех сессий
    await Session.deleteAllForUser(userId);

    // Удаление пользователя (каскадно удалит все данные)
    await User.delete(userId);

    logger.info(`Аккаунт удалён: ${userId}`);

    res.json({
      success: true,
      message: 'Аккаунт успешно удалён'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  deleteAccount
};
