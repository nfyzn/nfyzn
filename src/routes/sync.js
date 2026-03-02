const express = require('express');
const { body, validationResult } = require('express-validator');
const SyncService = require('../services/SyncService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/sync/changes
 * Получить изменения с момента последней синхронизации
 */
router.get('/changes', async (req, res) => {
  try {
    const { since } = req.query;

    if (!since) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'since parameter is required' 
      });
    }

    const sinceDate = new Date(since);
    
    if (isNaN(sinceDate.getTime())) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Invalid date format. Use ISO 8601 format.' 
      });
    }

    const changes = await SyncService.getChanges(req.user.id, sinceDate);

    res.json({
      changes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get sync changes error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get sync changes' 
    });
  }
});

/**
 * POST /api/sync/batch
 * Синхронизировать пакет изменений
 */
router.post('/batch',
  [
    body('movies')
      .optional()
      .isArray()
      .withMessage('movies must be an array'),
    body('types')
      .optional()
      .isArray()
      .withMessage('types must be an array'),
    body('genres')
      .optional()
      .isArray()
      .withMessage('genres must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: errors.array() 
        });
      }

      const { movies, types, genres } = req.body;

      const results = await SyncService.syncBatch(req.user.id, {
        movies,
        types,
        genres
      });

      // Получаем статистику
      const stats = await SyncService.getSyncStats(req.user.id);

      res.json({
        message: 'Sync completed successfully',
        results,
        conflicts: results.movies.conflicts || [],
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Batch sync error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to sync batch' 
      });
    }
  }
);

/**
 * GET /api/sync/stats
 * Получить статистику синхронизации
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await SyncService.getSyncStats(req.user.id);
    res.json(stats);
  } catch (error) {
    console.error('Get sync stats error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get sync stats' 
    });
  }
});

module.exports = router;
