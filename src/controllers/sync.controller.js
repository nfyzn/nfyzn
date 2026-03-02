/**
 * Контроллер синхронизации
 */

const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// Синхронизация данных (push)
const syncPush = async (req, res, next) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const userId = req.user.userId;
    const { data, lastSyncTime, pendingChanges } = req.body;

    if (!data) {
      throw new AppError('Данные не предоставлены', 400);
    }

    let moviesSynced = 0;
    let typesSynced = 0;
    let genresSynced = 0;

    // Синхронизация типов
    if (data.types && Array.isArray(data.types)) {
      for (const type of data.types) {
        await client.query(
          `INSERT INTO movie_types (id, user_id, name, color_value, is_default)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, id) DO UPDATE SET
             name = EXCLUDED.name,
             color_value = EXCLUDED.color_value`,
          [type.id, userId, type.name, type.colorValue, type.isDefault || false]
        );
        typesSynced++;
      }
    }

    // Синхронизация жанров
    if (data.genres && Array.isArray(data.genres)) {
      for (const genre of data.genres) {
        await client.query(
          `INSERT INTO genres (id, user_id, name, is_default)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, id) DO UPDATE SET
             name = EXCLUDED.name`,
          [genre.id, userId, genre.name, genre.isDefault || false]
        );
        genresSynced++;
      }
    }

    // Синхронизация фильмов
    if (data.movies && Array.isArray(data.movies)) {
      for (const movie of data.movies) {
        await client.query(
          `INSERT INTO movies (id, user_id, title, status, rating, season_info, image_url, custom_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (user_id, id) DO UPDATE SET
             title = EXCLUDED.title,
             status = EXCLUDED.status,
             rating = EXCLUDED.rating,
             season_info = EXCLUDED.season_info,
             image_url = EXCLUDED.image_url,
             custom_order = EXCLUDED.custom_order,
             updated_at = EXCLUDED.updated_at`,
          [
            movie.id,
            userId,
            movie.title,
            movie.status,
            movie.rating,
            movie.seasonInfo,
            movie.imageUrl,
            movie.customOrder,
            movie.createdAt,
            movie.updatedAt
          ]
        );

        // Связи с типами
        if (movie.typeIds && Array.isArray(movie.typeIds)) {
          for (const typeId of movie.typeIds) {
            await client.query(
              `INSERT INTO movie_movie_types (movie_id, type_id, user_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (movie_id, type_id, user_id) DO NOTHING`,
              [movie.id, typeId, userId]
            );
          }
        }

        // Связи с жанрами
        if (movie.genreIds && Array.isArray(movie.genreIds)) {
          for (const genreId of movie.genreIds) {
            await client.query(
              `INSERT INTO movie_genres (movie_id, genre_id, user_id)
               VALUES ($1, $2, $3)
               ON CONFLICT (movie_id, genre_id, user_id) DO NOTHING`,
              [movie.id, genreId, userId]
            );
          }
        }

        moviesSynced++;
      }
    }

    // Обработка ожидающих изменений
    if (pendingChanges && Array.isArray(pendingChanges)) {
      for (const change of pendingChanges) {
        // TODO: Обработка отдельных изменений
        logger.debug(`Обработано изменение: ${change.type}/${change.action}/${change.id}`);
      }
    }

    await client.query('COMMIT');

    const lastSyncTime = new Date().toISOString();

    logger.info(`Синхронизация для пользователя ${userId}: фильмы=${moviesSynced}, типы=${typesSynced}, жанры=${genresSynced}`);

    res.json({
      success: true,
      data: {
        moviesSynced,
        typesSynced,
        genresSynced,
        lastSyncTime
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// Получение данных (pull)
const syncPull = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const lastSyncTime = req.query.lastSyncTime;

    let whereClause = 'user_id = $1';
    const values = [userId];
    let paramCount = 2;

    if (lastSyncTime) {
      whereClause += ` AND updated_at > $${paramCount++}`;
      values.push(lastSyncTime);
    }

    // Получение фильмов
    const moviesResult = await pool.query(
      `SELECT * FROM movies WHERE ${whereClause}`,
      values
    );

    // Получение типов
    const typesResult = await pool.query(
      `SELECT * FROM movie_types WHERE user_id = $1`,
      [userId]
    );

    // Получение жанров
    const genresResult = await pool.query(
      `SELECT * FROM genres WHERE user_id = $1`,
      [userId]
    );

    // Получение связей фильм-тип
    const movieTypesResult = await pool.query(
      `SELECT movie_id, type_id FROM movie_movie_types WHERE user_id = $1`,
      [userId]
    );

    // Получение связей фильм-жанр
    const movieGenresResult = await pool.query(
      `SELECT movie_id, genre_id FROM movie_genres WHERE user_id = $1`,
      [userId]
    );

    // Формирование ответа
    const movies = moviesResult.rows.map(movie => ({
      id: movie.id,
      title: movie.title,
      status: movie.status,
      rating: movie.rating,
      seasonInfo: movie.season_info,
      imageUrl: movie.image_url,
      customOrder: movie.custom_order,
      createdAt: movie.created_at,
      updatedAt: movie.updated_at,
      typeIds: movieTypesResult.rows
        .filter(mt => mt.movie_id === movie.id)
        .map(mt => mt.type_id),
      genreIds: movieGenresResult.rows
        .filter(mg => mg.movie_id === movie.id)
        .map(mg => mg.genre_id)
    }));

    const types = typesResult.rows.map(type => ({
      id: type.id,
      name: type.name,
      colorValue: type.color_value,
      isDefault: type.is_default
    }));

    const genres = genresResult.rows.map(genre => ({
      id: genre.id,
      name: genre.name,
      isDefault: genre.is_default
    }));

    res.json({
      success: true,
      data: {
        movies,
        types,
        genres,
        lastSyncTime: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  syncPush,
  syncPull
};
