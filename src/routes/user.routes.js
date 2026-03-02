/**
 * Маршруты пользователя
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/user/profile - Получение профиля
router.get('/profile', authMiddleware, userController.getProfile);

// PUT /api/user/profile - Обновление профиля
router.put('/profile', authMiddleware, userController.updateProfile);

// DELETE /api/user/account - Удаление аккаунта
router.delete('/account', authMiddleware, userController.deleteAccount);

module.exports = router;
