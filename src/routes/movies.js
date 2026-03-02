const express = require('express');
const { body, validationResult } = require('express-validator');
const Movie = require('../models/Movie');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticate);

/**
 * GET /api/movies
 * Получить все фильмы с фильтрацией и пагинацией
 */
router.get('/', async (req, res) => {
  try {
    const { status, search, sort, order, limit, offset } = req.query;

    const movies = await Movie.findAll(req.user.id, {
      status,
      searchQuery: search,
      sortBy: sort,
      sortOrder: order,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    const counts = await Movie.getCountByStatus(req.user.id);

    res.json({
      movies,
      counts,
      total: movies.length
    });

  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get movies' 
    });
  }
});

/**
 * GET /api/movies/:id
 * Получить фильм по ID
 */
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id, req.user.id);

    if (!movie) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Movie not found' 
      });
    }

    res.json(movie);

  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get movie' 
    });
  }
});

/**
 * POST /api/movies
 * Создать новый фильм
 */
router.post('/',
  [
    body('title')
      .notEmpty()
      .withMessage('Title is required')
      .isLength({ max: 500 })
      .withMessage('Title must be less than 500 characters'),
    body('status')
      .optional()
      .isIn(['in_progress', 'to_watch', 'watched'])
      .withMessage('Invalid status'),
    body('rating')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Rating must be between 0 and 10'),
    body('season_info')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Season info must be less than 255 characters'),
    body('image_url')
      .optional()
      .isURL()
      .withMessage('Invalid image URL'),
    body('types')
      .optional()
      .isArray({ max: 3 })
      .withMessage('Maximum 3 types allowed'),
    body('genres')
      .optional()
      .isArray({ max: 6 })
      .withMessage('Maximum 6 genres allowed')
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

      const { title, status, rating, seasonInfo, imageUrl, types, genres } = req.body;

      const movie = await Movie.create(req.user.id, {
        title,
        status,
        rating,
        seasonInfo,
        imageUrl,
        types,
        genres
      });

      res.status(201).json({
        message: 'Movie created successfully',
        movie
      });

    } catch (error) {
      console.error('Create movie error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to create movie' 
      });
    }
  }
);

/**
 * PUT /api/movies/:id
 * Обновить фильм
 */
router.put('/:id',
  [
    body('title')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Title must be less than 500 characters'),
    body('status')
      .optional()
      .isIn(['in_progress', 'to_watch', 'watched'])
      .withMessage('Invalid status'),
    body('rating')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Rating must be between 0 and 10'),
    body('season_info')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Season info must be less than 255 characters'),
    body('image_url')
      .optional()
      .isURL()
      .withMessage('Invalid image URL'),
    body('types')
      .optional()
      .isArray({ max: 3 })
      .withMessage('Maximum 3 types allowed'),
    body('genres')
      .optional()
      .isArray({ max: 6 })
      .withMessage('Maximum 6 genres allowed')
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

      const movie = await Movie.update(req.params.id, req.user.id, req.body);

      if (!movie) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Movie not found' 
        });
      }

      res.json({
        message: 'Movie updated successfully',
        movie
      });

    } catch (error) {
      console.error('Update movie error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to update movie' 
      });
    }
  }
);

/**
 * DELETE /api/movies/:id
 * Удалить фильм
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Movie.delete(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Movie not found' 
      });
    }

    res.json({
      message: 'Movie deleted successfully',
      movie: deleted
    });

  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete movie' 
    });
  }
});

/**
 * POST /api/movies/:id/restore
 * Восстановить удалённый фильм
 */
router.post('/:id/restore', async (req, res) => {
  try {
    const restored = await Movie.restore(req.params.id, req.user.id);

    if (!restored) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'Movie not found or already restored' 
      });
    }

    res.json({
      message: 'Movie restored successfully',
      movie: restored
    });

  } catch (error) {
    console.error('Restore movie error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to restore movie' 
    });
  }
});

/**
 * GET /api/movies/deleted/recent
 * Получить недавно удалённые фильмы
 */
router.get('/deleted/recent', async (req, res) => {
  try {
    const deleted = await Movie.getDeleted(req.user.id, 50);

    res.json({
      deleted,
      total: deleted.length
    });

  } catch (error) {
    console.error('Get deleted movies error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get deleted movies' 
    });
  }
});

module.exports = router;
