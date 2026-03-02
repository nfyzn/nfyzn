const express = require('express');
const { body, validationResult } = require('express-validator');
const Genre = require('../models/Genre');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/genres
 * Получить все жанры
 */
router.get('/', async (req, res) => {
  try {
    const genres = await Genre.findAll(req.user.id);
    res.json(genres);
  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get genres' 
    });
  }
});

/**
 * POST /api/genres
 * Создать жанр
 */
router.post('/',
  [
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters')
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

      const genre = await Genre.create(req.user.id, req.body);

      res.status(201).json({
        message: 'Genre created successfully',
        genre
      });

    } catch (error) {
      console.error('Create genre error:', error);
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'Genre with this name already exists' 
        });
      }

      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to create genre' 
      });
    }
  }
);

/**
 * PUT /api/genres/:id
 * Обновить жанр
 */
router.put('/:id',
  [
    body('name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters')
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

      const genre = await Genre.update(req.params.id, req.user.id, req.body);

      if (!genre) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Genre not found' 
        });
      }

      res.json({
        message: 'Genre updated successfully',
        genre
      });

    } catch (error) {
      console.error('Update genre error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to update genre' 
      });
    }
  }
);

/**
 * DELETE /api/genres/:id
 * Удалить жанр
 */
router.delete('/:id', async (req, res) => {
  try {
    await Genre.delete(req.params.id, req.user.id);
    res.json({ message: 'Genre deleted successfully' });
  } catch (error) {
    console.error('Delete genre error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete genre' 
    });
  }
});

/**
 * POST /api/genres/reorder
 * Переупорядочить жанры
 */
router.post('/reorder',
  [
    body('genreIds')
      .isArray()
      .withMessage('genreIds must be an array')
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

      const { genreIds } = req.body;
      await Genre.reorder(req.user.id, genreIds);

      res.json({ message: 'Genres reordered successfully' });

    } catch (error) {
      console.error('Reorder genres error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to reorder genres' 
      });
    }
  }
);

module.exports = router;
