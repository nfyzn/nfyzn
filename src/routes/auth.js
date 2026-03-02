const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuthService = require('../services/AuthService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post('/register',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number'),
    body('displayName')
      .optional()
      .isLength({ max: 100 })
      .trim()
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

      const { email, password, displayName } = req.body;

      // Проверяем существование пользователя
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Conflict',
          message: 'User with this email already exists' 
        });
      }

      // Хешируем пароль
      const passwordHash = await bcrypt.hash(password, 12);

      // Создаём пользователя
      const user = await User.create({
        email,
        passwordHash,
        displayName
      });

      // Генерируем токены
      const { accessToken, refreshToken, refreshTokenHash } = AuthService.generateTokens(user.id);

      // Сохраняем refresh токен
      const expiresAt = new Date();
      expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 
        AuthService.parseExpiryToMs(process.env.JWT_REFRESH_EXPIRY || '7d'));
      
      await AuthService.storeRefreshToken(user.id, refreshTokenHash, expiresAt);

      // Обновляем время последнего входа
      await User.updateLastLogin(user.id);

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          createdAt: user.created_at
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to register user' 
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Вход в аккаунт
 */
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
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

      const { email, password } = req.body;

      // Находим пользователя
      const user = await User.findByEmail(email);
      
      if (!user) {
        // Не раскрываем, существует ли пользователь
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid email or password' 
        });
      }

      // Проверяем пароль
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid email or password' 
        });
      }

      // Проверяем активность
      if (!user.is_active) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Account is deactivated' 
        });
      }

      // Генерируем токены
      const { accessToken, refreshToken, refreshTokenHash } = AuthService.generateTokens(user.id);

      // Сохраняем refresh токен
      const expiresAt = new Date();
      expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 
        AuthService.parseExpiryToMs(process.env.JWT_REFRESH_EXPIRY || '7d'));
      
      await AuthService.storeRefreshToken(user.id, refreshTokenHash, expiresAt);

      // Обновляем время последнего входа
      await User.updateLastLogin(user.id);

      // Создаём сессию
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('user-agent');
      await AuthService.createSession(user.id, ipAddress, userAgent);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          isAdmin: user.is_admin
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to login' 
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * Обновление токенов
 */
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
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

      const { refreshToken } = req.body;

      // Обновляем токены
      const { accessToken, refreshToken: newRefreshToken } = 
        await AuthService.refreshTokens(refreshToken);

      res.json({
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: error.message 
        });
      }

      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to refresh tokens' 
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Выход из аккаунта
 */
router.post('/logout',
  authenticate,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }

      res.json({ message: 'Logout successful' });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to logout' 
      });
    }
  }
);

/**
 * POST /api/auth/logout-all
 * Выход из всех сессий
 */
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    await AuthService.logoutAll(req.user.id);
    res.json({ message: 'Logged out from all sessions successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to logout from all sessions' 
    });
  }
});

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: user.is_admin,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get profile' 
    });
  }
});

/**
 * PUT /api/auth/profile
 * Обновление профиля
 */
router.put('/profile', authenticate,
  [
    body('displayName')
      .optional()
      .isLength({ max: 100 })
      .trim(),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('Invalid URL format')
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

      const { displayName, avatarUrl } = req.body;
      const user = await User.updateProfile(req.user.id, { displayName, avatarUrl });

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          avatarUrl: user.avatar_url
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to update profile' 
      });
    }
  }
);

/**
 * PUT /api/auth/change-password
 * Смена пароля
 */
router.put('/change-password', authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and number')
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

      const { currentPassword, newPassword } = req.body;
      const user = await User.findByEmail(req.user.email);

      // Проверяем текущий пароль
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Current password is incorrect' 
        });
      }

      // Хешируем новый пароль
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Обновляем пароль
      await User.changePassword(req.user.id, newPasswordHash);

      // Аннулируем все refresh токены
      await AuthService.logoutAll(req.user.id);

      res.json({ message: 'Password changed successfully. Please login again.' });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to change password' 
      });
    }
  }
);

/**
 * GET /api/auth/sessions
 * Получение активных сессий
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const sessions = await AuthService.getActiveSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get sessions' 
    });
  }
});

module.exports = router;
