const express = require('express');
const { body, validationResult } = require('express-validator');
const MovieType = require('../models/MovieType');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/types
 * Получить все типы
 */
router.get('/', async (req, res) => {
  try {
    const types = await MovieType.findAll(req.user.id);
    res.json(types);
  } catch (error) {
    console.error('Get types error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get types' 
    });
  }
});

/**
 * POST /api/types
 * Создать тип
 */
router.post('/',
  [
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color')
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

      const type = await MovieType.create(req.user.id, req.body);

      res.status(201).json({
        message: 'Type created successfully',
        type
      });

    } catch (error) {
      console.error('Create type error:', error);
      
      if (error.code === '23505') { // Unique violation
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'Type with this name already exists' 
        });
      }

      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to create type' 
      });
    }
  }
);

/**
 * PUT /api/types/:id
 * Обновить тип
 */
router.put('/:id',
  [
    body('name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color')
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

      const type = await MovieType.update(req.params.id, req.user.id, req.body);

      if (!type) {
        return res.status(404).json({ 
          error: 'Not Found',
          message: 'Type not found' 
        });
      }

      res.json({
        message: 'Type updated successfully',
        type
      });

    } catch (error) {
      console.error('Update type error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to update type' 
      });
    }
  }
);

/**
 * DELETE /api/types/:id
 * Удалить тип
 */
router.delete('/:id', async (req, res) => {
  try {
    await MovieType.delete(req.params.id, req.user.id);
    res.json({ message: 'Type deleted successfully' });
  } catch (error) {
    console.error('Delete type error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete type' 
    });
  }
});

/**
 * POST /api/types/reorder
 * Переупорядочить типы
 */
router.post('/reorder',
  [
    body('typeIds')
      .isArray()
      .withMessage('typeIds must be an array')
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

      const { typeIds } = req.body;
      await MovieType.reorder(req.user.id, typeIds);

      res.json({ message: 'Types reordered successfully' });

    } catch (error) {
      console.error('Reorder types error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to reorder types' 
      });
    }
  }
);

module.exports = router;
