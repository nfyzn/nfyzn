const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware для проверки JWT токена
 */
const authenticate = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Access token is required' 
      });
    }

    const token = authHeader.substring(7);
    
    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token type' 
      });
    }

    // Проверяем существование пользователя
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'User not found or inactive' 
      });
    }

    // Добавляем пользователя в запрос
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Authentication failed' 
    });
  }
};

/**
 * Middleware для проверки прав администратора
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Admin access required' 
    });
  }
  next();
};

/**
 * Опциональная аутентификация (не требует токен, но добавляет пользователя если есть)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      if (decoded.type === 'access') {
        const user = await User.findById(decoded.userId);
        if (user && user.is_active) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Игнорируем ошибки, это опциональная аутентификация
    next();
  }
};

module.exports = { authenticate, requireAdmin, optionalAuth };
