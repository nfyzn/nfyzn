/**
 * Маршруты авторизации
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/register - Регистрация
router.post(
  '/register',
  authController.registerValidation,
  authController.register
);

// POST /api/auth/login - Вход
router.post(
  '/login',
  authController.loginValidation,
  authController.login
);

// POST /api/auth/logout - Выход
router.post('/logout', authController.logout);

// POST /api/auth/refresh - Обновление токена
router.post('/refresh', authController.refreshToken);

// POST /api/auth/reset-password - Восстановление пароля
router.post('/reset-password', authController.resetPassword);

// PUT /api/auth/change-password - Смена пароля
router.put(
  '/change-password',
  authMiddleware,
  authController.changePassword
);

module.exports = router;
