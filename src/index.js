const app = require('./app');
const pool = require('./config/database');
const AuthService = require('./services/AuthService');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;

/**
 * Проверка подключения к БД перед запуском
 */
async function checkDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Запуск сервера
 */
async function startServer() {
  try {
    // Проверяем подключение к БД
    const dbConnected = await checkDatabase();
    
    if (!dbConnected) {
      console.error('❌ Cannot start server without database connection');
      process.exit(1);
    }

    // Запускаем сервер
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎬 MovieList Backend Server                             ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                             ║
║   Time: ${new Date().toLocaleString('ru-RU')}                          ║
║                                                           ║
║   Endpoints:                                              ║
║   - POST   /api/auth/register     - Регистрация           ║
║   - POST   /api/auth/login        - Вход                  ║
║   - POST   /api/auth/refresh      - Обновление токена     ║
║   - POST   /api/auth/logout       - Выход                 ║
║   - GET    /api/auth/me           - Профиль               ║
║   - GET    /api/movies            - Фильмы                ║
║   - GET    /api/types             - Типы                  ║
║   - GET    /api/genres            - Жанры                 ║
║   - GET    /api/sync/changes      - Синхронизация         ║
║   - POST   /api/sync/batch        - Пакетная синхрон.     ║
║   - GET    /api/admin/dashboard   - Админ-панель          ║
║   - GET    /api/admin/users       - Пользователи          ║
║   - GET    /health               - Health check            ║
║   - GET    /admin                - Web Admin Panel         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n📍 ${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        console.log('📍 HTTP server closed');
        
        try {
          await pool.end();
          console.log('✅ Database connections closed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown due to timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Запускаем фоновые задачи
    setupCronJobs();

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Фоновые задачи
 */
function setupCronJobs() {
  // Очистка просроченных refresh токенов - каждый час
  cron.schedule('0 * * * *', async () => {
    try {
      const deleted = await AuthService.cleanupExpiredTokens();
      if (deleted > 0) {
        console.log(`[CRON] Cleaned up ${deleted} expired refresh tokens`);
      }
    } catch (error) {
      console.error('[CRON] Error cleaning up tokens:', error);
    }
  });

  // Очистка старых записей deleted_movies (старше 30 дней) - каждый день в 3:00
  cron.schedule('0 3 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM deleted_movies WHERE expires_at < NOW()`
      );
      if (result.rowCount > 0) {
        console.log(`[CRON] Cleaned up ${result.rowCount} expired deleted movies`);
      }
    } catch (error) {
      console.error('[CRON] Error cleaning up deleted movies:', error);
    }
  });

  // Очистка неактивных сессий (старше 7 дней) - каждый день в 4:00
  cron.schedule('0 4 * * *', async () => {
    try {
      const result = await pool.query(
        `DELETE FROM user_sessions 
         WHERE last_activity < NOW() - INTERVAL '7 days'`
      );
      if (result.rowCount > 0) {
        console.log(`[CRON] Cleaned up ${result.rowCount} inactive sessions`);
      }
    } catch (error) {
      console.error('[CRON] Error cleaning up sessions:', error);
    }
  });

  // Сбор ежедневной статистики - каждый день в 00:00
  cron.schedule('0 0 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const [totalUsersResult, activeUsersResult, totalMoviesResult] = await Promise.all([
        pool.query("SELECT COUNT(*) FROM users WHERE is_active = true"),
        pool.query("SELECT COUNT(*) FROM users WHERE is_active = true AND last_login_at > NOW() - INTERVAL '30 days'"),
        pool.query("SELECT COUNT(*) FROM movies WHERE deleted_at IS NULL")
      ]);

      await pool.query(
        `INSERT INTO app_statistics (stat_date, total_users, active_users, total_movies)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (stat_date) DO UPDATE SET
           total_users = EXCLUDED.total_users,
           active_users = EXCLUDED.active_users,
           total_movies = EXCLUDED.total_movies,
           updated_at = CURRENT_TIMESTAMP`,
        [
          yesterday.toISOString().split('T')[0],
          parseInt(totalUsersResult.rows[0].count),
          parseInt(activeUsersResult.rows[0].count),
          parseInt(totalMoviesResult.rows[0].count)
        ]
      );

      console.log('[CRON] Daily statistics collected');
    } catch (error) {
      console.error('[CRON] Error collecting statistics:', error);
    }
  });

  console.log('✅ Cron jobs scheduled');
}

// Запуск
startServer();
