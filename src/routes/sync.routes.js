/**
 * Маршруты синхронизации
 */

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync.controller');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/sync/push - Отправка данных на сервер
router.post('/push', authMiddleware, syncController.syncPush);

// GET /api/sync/pull - Получение данных с сервера
router.get('/pull', authMiddleware, syncController.syncPull);

module.exports = router;
