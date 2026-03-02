const express = require('express');
const User = require('../models/User');
const Movie = require('../models/Movie');
const pool = require('../../config/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Все маршруты требуют аутентификации и прав администратора
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/admin/dashboard
 * Основная статистика для дашборда
 */
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalMovies,
      recentUsers,
      recentActivity
    ] = await Promise.all([
      User.getCount(),
      User.getActiveCount(),
      getTotalMoviesCount(),
      getRecentUsers(),
      getRecentActivity()
    ]);

    res.json({
      statistics: {
        totalUsers,
        activeUsers,
        totalMovies,
        totalUsersFormatted: totalUsers.toLocaleString(),
        activeUsersFormatted: activeUsers.toLocaleString(),
        totalMoviesFormatted: totalMovies.toLocaleString()
      },
      recentUsers,
      recentActivity
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get dashboard data' 
    });
  }
});

/**
 * GET /api/admin/users
 * Список всех пользователей с пагинацией
 */
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search;

    const users = await User.getAll(limit, offset);
    const total = await User.getCount();

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get users' 
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Информация о пользователе
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        error: 'Not Found',
        message: 'User not found' 
      });
    }

    // Получаем статистику пользователя
    const [movieCount, syncStats] = await Promise.all([
      Movie.getCount(req.params.id),
      getSyncStats(req.params.id)
    ]);

    res.json({
      user,
      stats: {
        movieCount,
        ...syncStats
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get user' 
    });
  }
});

/**
 * PUT /api/admin/users/:id/toggle-active
 * Активировать/деактивировать пользователя
 */
router.put('/users/:id/toggle-active', async (req, res) => {
  try {
    const isActive = await User.toggleActive(req.params.id);
    res.json({ 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      isActive 
    });
  } catch (error) {
    console.error('Toggle user active error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to toggle user status' 
    });
  }
});

/**
 * PUT /api/admin/users/:id/toggle-admin
 * Дать/снять права администратора
 */
router.put('/users/:id/toggle-admin', async (req, res) => {
  try {
    // Нельзя снять права с последнего админа
    if (req.params.id === req.user.id) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Cannot remove admin rights from yourself' 
      });
    }

    const isAdmin = await User.toggleAdmin(req.params.id);
    res.json({ 
      message: `User ${isAdmin ? 'promoted to admin' : 'demoted from admin'} successfully`,
      isAdmin 
    });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to toggle admin status' 
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Удалить пользователя
 */
router.delete('/users/:id', async (req, res) => {
  try {
    // Нельзя удалить самого себя
    if (req.params.id === req.user.id) {
      return res.status(400).json({ 
        error: 'Bad Request',
        message: 'Cannot delete yourself' 
      });
    }

    await User.delete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to delete user' 
    });
  }
});

/**
 * GET /api/admin/statistics
 * Подробная статистика приложения
 */
router.get('/statistics', async (req, res) => {
  try {
    const { period = '7' } = req.query;
    const days = parseInt(period);

    const [
      userGrowth,
      movieStats,
      syncActivity,
      topUsers
    ] = await Promise.all([
      getUserGrowth(days),
      getMovieStats(days),
      getSyncActivity(days),
      getTopUsers(days)
    ]);

    res.json({
      period: days,
      userGrowth,
      movieStats,
      syncActivity,
      topUsers
    });

  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get statistics' 
    });
  }
});

/**
 * GET /api/admin/sessions
 * Активные сессии всех пользователей
 */
router.get('/sessions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT us.id, us.user_id, u.email, u.display_name, 
              us.ip_address, us.user_agent, 
              us.created_at, us.last_activity, us.is_active
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.is_active = true
       ORDER BY us.last_activity DESC
       LIMIT 100`
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get sessions' 
    });
  }
});

/**
 * GET /api/admin/logs
 * Логи синхронизации
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, userId } = req.query;
    
    let query = `
      SELECT sl.*, u.email, u.display_name
      FROM sync_log sl
      JOIN users u ON sl.user_id = u.id
    `;
    
    const params = [];
    
    if (userId) {
      query += ' WHERE sl.user_id = $1';
      params.push(userId);
    }
    
    query += ' ORDER BY sl.created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: 'Failed to get logs' 
    });
  }
});

// Вспомогательные функции

async function getTotalMoviesCount() {
  const result = await pool.query('SELECT COUNT(*) FROM movies WHERE deleted_at IS NULL');
  return parseInt(result.rows[0].count);
}

async function getRecentUsers(limit = 10) {
  const result = await pool.query(
    `SELECT id, email, display_name, created_at, last_login_at 
     FROM users 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getRecentActivity(limit = 20) {
  const result = await pool.query(
    `SELECT sl.action, sl.entity_type, sl.created_at, 
            u.email, u.display_name,
            CASE 
              WHEN sl.entity_type = 'movie' THEN 'Фильм'
              WHEN sl.entity_type = 'type' THEN 'Тип'
              WHEN sl.entity_type = 'genre' THEN 'Жанр'
              ELSE sl.entity_type
            END as entity_name
     FROM sync_log sl
     JOIN users u ON sl.user_id = u.id
     ORDER BY sl.created_at DESC 
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function getSyncStats(userId) {
  const result = await pool.query(
    `SELECT 
       COUNT(*) as total_syncs,
       COUNT(*) FILTER (WHERE conflict_resolved = true) as conflicts_resolved,
       MAX(created_at) as last_sync_at
     FROM sync_log
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || { total_syncs: 0, conflicts_resolved: 0, last_sync_at: null };
}

async function getUserGrowth(days) {
  const result = await pool.query(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM users
     WHERE created_at > NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    []
  );
  return result.rows;
}

async function getMovieStats(days) {
  const result = await pool.query(
    `SELECT 
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${days} days') as movies_created,
       COUNT(*) FILTER (WHERE deleted_at > NOW() - INTERVAL '${days} days') as movies_deleted,
       COUNT(*) as total_movies
     FROM movies`
  );
  return result.rows[0];
}

async function getSyncActivity(days) {
  const result = await pool.query(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM sync_log
     WHERE created_at > NOW() - INTERVAL '${days} days'
     GROUP BY DATE(created_at)
     ORDER BY date DESC`,
    []
  );
  return result.rows;
}

async function getTopUsers(days) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, 
            COUNT(sl.id) as sync_count,
            COUNT(m.id) FILTER (WHERE m.created_at > NOW() - INTERVAL '${days} days') as movies_created
     FROM users u
     LEFT JOIN sync_log sl ON u.id = sl.user_id 
       AND sl.created_at > NOW() - INTERVAL '${days} days'
     LEFT JOIN movies m ON u.id = m.user_id 
       AND m.created_at > NOW() - INTERVAL '${days} days'
     GROUP BY u.id, u.email, u.display_name
     ORDER BY sync_count DESC, movies_created DESC
     LIMIT 10`
  );
  return result.rows;
}

module.exports = router;
