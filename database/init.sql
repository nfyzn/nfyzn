-- MovieList Database Schema
-- PostgreSQL 16+
-- Запуск: sudo -u postgres psql -d movielist -f /var/www/movielist-backend/database/init.sql

-- Пользователи
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    is_guest BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE
);

-- Сессии
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, device_id)
);

-- Фильмы/Карточки
CREATE TABLE IF NOT EXISTS movies (
    id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL,
    rating INTEGER CHECK (rating >= 0 AND rating <= 10),
    season_info TEXT,
    image_url TEXT,
    image_path TEXT,
    image_offset_y DOUBLE PRECISION,
    custom_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, id)
);

-- Типы фильмов
CREATE TABLE IF NOT EXISTS movie_types (
    id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    color_value INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, id)
);

-- Жанры
CREATE TABLE IF NOT EXISTS genres (
    id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, id)
);

-- Связи фильм-тип
CREATE TABLE IF NOT EXISTS movie_movie_types (
    movie_id UUID NOT NULL,
    type_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (movie_id, type_id, user_id),
    FOREIGN KEY (user_id, movie_id) REFERENCES movies(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, type_id) REFERENCES movie_types(user_id, id) ON DELETE CASCADE
);

-- Связи фильм-жанр
CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id UUID NOT NULL,
    genre_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (movie_id, genre_id, user_id),
    FOREIGN KEY (user_id, movie_id) REFERENCES movies(user_id, id) ON DELETE CASCADE,
    FOREIGN KEY (user_id, genre_id) REFERENCES genres(user_id, id) ON DELETE CASCADE
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_access_token ON sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_movies_user_id ON movies(user_id);
CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(user_id, status);
CREATE INDEX IF NOT EXISTS idx_movies_updated_at ON movies(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_movie_types_user_id ON movie_types(user_id);
CREATE INDEX IF NOT EXISTS idx_genres_user_id ON genres(user_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_movies_updated_at BEFORE UPDATE ON movies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Встроенные типы (по умолчанию) - добавляются при первом входе пользователя
-- Встроенные жанры (по умолчанию) - добавляются при первом входе пользователя
