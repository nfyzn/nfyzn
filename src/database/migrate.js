const pool = require('../config/database');

const migrations = [
  // Расширение для UUID
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

  // Пользователи
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,

  // Индекс для поиска по email
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)`,

  // Refresh токены
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked BOOLEAN DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash)`,

  // Карточки фильмов
  `CREATE TABLE IF NOT EXISTS movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'to_watch',
    rating INTEGER CHECK (rating >= 0 AND rating <= 10),
    season_info VARCHAR(255),
    image_url VARCHAR(500),
    image_path VARCHAR(500),
    image_offset_y DOUBLE PRECISION,
    custom_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    sync_version INTEGER DEFAULT 1,
    last_synced_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_movies_user_id ON movies(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status)`,
  `CREATE INDEX IF NOT EXISTS idx_movies_deleted_at ON movies(deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_movies_sync_version ON movies(sync_version)`,
  `CREATE INDEX IF NOT EXISTS idx_movies_updated_at ON movies(updated_at DESC)`,

  // Типы фильмов (связь многие-ко-многим)
  `CREATE TABLE IF NOT EXISTS movie_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#4CAF50',
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_movie_types_user_id_name ON movie_types(user_id, name) WHERE user_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_movie_types_user_id ON movie_types(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movie_types_is_default ON movie_types(is_default)`,

  // Связь фильмов с типами
  `CREATE TABLE IF NOT EXISTS movie_movie_types (
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    movie_type_id UUID NOT NULL REFERENCES movie_types(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, movie_type_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_movie_movie_types_movie_id ON movie_movie_types(movie_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movie_movie_types_type_id ON movie_movie_types(movie_type_id)`,

  // Жанры (связь многие-ко-многим)
  `CREATE TABLE IF NOT EXISTS genres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_genres_user_id_name ON genres(user_id, name) WHERE user_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_genres_user_id ON genres(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_genres_is_default ON genres(is_default)`,

  // Связь фильмов с жанрами
  `CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_movie_genres_movie_id ON movie_genres(movie_id)`,
  `CREATE INDEX IF NOT EXISTS idx_movie_genres_genre_id ON movie_genres(genre_id)`,

  // Настройки сортировки
  `CREATE TABLE IF NOT EXISTS sort_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filter_status VARCHAR(50),
    sort_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sort_orders_user_id_status ON sort_orders(user_id, filter_status) WHERE filter_status IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sort_orders_user_id_null ON sort_orders(user_id) WHERE filter_status IS NULL`,
  `CREATE INDEX IF NOT EXISTS idx_sort_orders_user_id ON sort_orders(user_id)`,

  // Недавно удалённые
  `CREATE TABLE IF NOT EXISTS deleted_movies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id UUID NOT NULL,
    movie_data JSONB NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    restored BOOLEAN DEFAULT false
  )`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_movies_user_id ON deleted_movies(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_movies_expires_at ON deleted_movies(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_deleted_movies_movie_id ON deleted_movies(movie_id)`,

  // Лог синхронизации
  `CREATE TABLE IF NOT EXISTS sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    conflict_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_log_created_at ON sync_log(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_log_user_id_created_at ON sync_log(user_id, created_at DESC)`,

  // Сессии пользователей (для админки)
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
  )`,
  `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity DESC)`,

  // Статистика приложения
  `CREATE TABLE IF NOT EXISTS app_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_movies INTEGER DEFAULT 0,
    movies_created INTEGER DEFAULT 0,
    movies_deleted INTEGER DEFAULT 0,
    sync_operations INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_app_statistics_date ON app_statistics(stat_date DESC)`,
];

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migration...');
    console.log(`📊 Total migrations: ${migrations.length}`);
    
    for (let i = 0; i < migrations.length; i++) {
      const query = migrations[i];
      await client.query(query);
      
      // Показываем прогресс для длинных миграций
      if ((i + 1) % 10 === 0 || i === migrations.length - 1) {
        console.log(`📝 Migration ${i + 1}/${migrations.length} completed`);
      }
    }
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    if (error.detail) {
      console.error('📋 Detail:', error.detail);
    }
    if (error.hint) {
      console.error('💡 Hint:', error.hint);
    }
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Migration finished');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed');
      process.exit(1);
    });
}

module.exports = { migrate };
