const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class Movie {
  /**
   * Получить фильм по ID
   */
  static async findById(id, userId) {
    const result = await pool.query(
      `SELECT m.*, 
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.id) FILTER (WHERE mt.id IS NOT NULL), NULL) as type_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.name) FILTER (WHERE mt.name IS NOT NULL), NULL) as type_names,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.color) FILTER (WHERE mt.color IS NOT NULL), NULL) as type_colors,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.id) FILTER (WHERE g.id IS NOT NULL), NULL) as genre_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), NULL) as genre_names
       FROM movies m
       LEFT JOIN movie_movie_types mmt ON m.id = mmt.movie_id
       LEFT JOIN movie_types mt ON mmt.movie_type_id = mt.id
       LEFT JOIN movie_genres mg ON m.id = mg.movie_id
       LEFT JOIN genres g ON mg.genre_id = g.id
       WHERE m.id = $1 AND m.user_id = $2 AND m.deleted_at IS NULL
       GROUP BY m.id`,
      [id, userId]
    );
    
    if (result.rows.length === 0) return null;
    
    return this._formatMovieWithRelations(result.rows[0]);
  }

  /**
   * Получить все фильмы пользователя
   */
  static async findAll(userId, { status, searchQuery, sortBy, sortOrder, limit, offset } = {}) {
    let query = `
      SELECT m.*, 
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.id) FILTER (WHERE mt.id IS NOT NULL), NULL) as type_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.name) FILTER (WHERE mt.name IS NOT NULL), NULL) as type_names,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.color) FILTER (WHERE mt.color IS NOT NULL), NULL) as type_colors,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.id) FILTER (WHERE g.id IS NOT NULL), NULL) as genre_ids,
             ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), NULL) as genre_names
      FROM movies m
      LEFT JOIN movie_movie_types mmt ON m.id = mmt.movie_id
      LEFT JOIN movie_types mt ON mmt.movie_type_id = mt.id
      LEFT JOIN movie_genres mg ON m.id = mg.movie_id
      LEFT JOIN genres g ON mg.genre_id = g.id
      WHERE m.user_id = $1 AND m.deleted_at IS NULL
    `;
    
    const params = [userId];
    let paramIndex = 2;

    // Фильтр по статусу
    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Поиск по названию
    if (searchQuery) {
      query += ` AND m.title ILIKE $${paramIndex}`;
      params.push(`%${searchQuery}%`);
      paramIndex++;
    }

    query += ' GROUP BY m.id';

    // Сортировка
    if (sortBy) {
      const validSorts = ['title', 'rating', 'custom_order', 'created_at', 'updated_at'];
      const sortField = validSorts.includes(sortBy) ? sortBy : 'custom_order';
      const direction = sortOrder === 'ASC' ? 'ASC' : 'DESC';
      query += ` ORDER BY m.${sortField} ${direction}`;
    } else {
      query += ' ORDER BY m.custom_order ASC';
    }

    // Пагинация
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }

    const result = await pool.query(query, params);
    return result.rows.map(row => this._formatMovieWithRelations(row));
  }

  /**
   * Получить изменения для синхронизации
   */
  static async getChanges(userId, sinceTimestamp) {
    const result = await pool.query(
      `SELECT m.*, 
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.id) FILTER (WHERE mt.id IS NOT NULL), NULL) as type_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.name) FILTER (WHERE mt.name IS NOT NULL), NULL) as type_names,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT mt.color) FILTER (WHERE mt.color IS NOT NULL), NULL) as type_colors,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.id) FILTER (WHERE g.id IS NOT NULL), NULL) as genre_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.name) FILTER (WHERE g.name IS NOT NULL), NULL) as genre_names
       FROM movies m
       LEFT JOIN movie_movie_types mmt ON m.id = mmt.movie_id
       LEFT JOIN movie_types mt ON mmt.movie_type_id = mt.id
       LEFT JOIN movie_genres mg ON m.id = mg.movie_id
       LEFT JOIN genres g ON mg.genre_id = g.id
       WHERE m.user_id = $1 
         AND m.updated_at > $2
         AND m.deleted_at IS NULL
       GROUP BY m.id
       ORDER BY m.updated_at ASC`,
      [userId, sinceTimestamp]
    );
    
    return result.rows.map(row => this._formatMovieWithRelations(row));
  }

  /**
   * Создать фильм
   */
  static async create(userId, data) {
    const id = uuidv4();
    const { title, status, rating, seasonInfo, imageUrl, imagePath, imageOffsetY, customOrder } = data;
    
    const result = await pool.query(
      `INSERT INTO movies (id, user_id, title, status, rating, season_info, image_url, image_path, image_offset_y, custom_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, userId, title, status || 'to_watch', rating, seasonInfo, imageUrl, imagePath, imageOffsetY, customOrder || 0]
    );

    const movie = result.rows[0];

    // Связываем с типами
    if (data.types && data.types.length > 0) {
      await this._syncTypes(id, data.types);
    }

    // Связываем с жанрами
    if (data.genres && data.genres.length > 0) {
      await this._syncGenres(id, data.genres);
    }

    return this.findById(id, userId);
  }

  /**
   * Обновить фильм
   */
  static async update(id, userId, data) {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const updatableFields = ['title', 'status', 'rating', 'season_info', 'image_url', 'image_path', 'image_offset_y', 'custom_order'];
    
    for (const field of updatableFields) {
      const camelField = this._toCamelCase(field);
      if (data[camelField] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(data[camelField]);
        paramIndex++;
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    fields.push('sync_version = sync_version + 1');
    
    values.push(id);
    values.push(userId);

    const query = `
      UPDATE movies 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    const movie = result.rows[0];

    // Обновляем типы
    if (data.types !== undefined) {
      await this._syncTypes(id, data.types);
    }

    // Обновляем жанры
    if (data.genres !== undefined) {
      await this._syncGenres(id, data.genres);
    }

    return this.findById(id, userId);
  }

  /**
   * Удалить фильм (мягкое удаление)
   */
  static async delete(id, userId) {
    const existing = await this.findById(id, userId);
    if (!existing) return null;

    // Сохраняем в deleted_movies
    await pool.query(
      `INSERT INTO deleted_movies (user_id, movie_id, movie_data, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')`,
      [userId, id, JSON.stringify(existing)]
    );

    // Мягкое удаление
    await pool.query(
      `UPDATE movies 
       SET deleted_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP,
           sync_version = sync_version + 1
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return existing;
  }

  /**
   * Восстановить удалённый фильм
   */
  static async restore(movieId, userId) {
    const result = await pool.query(
      `UPDATE movies 
       SET deleted_at = NULL, 
           updated_at = CURRENT_TIMESTAMP,
           sync_version = sync_version + 1
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
       RETURNING *`,
      [movieId, userId]
    );

    if (result.rows.length > 0) {
      await pool.query(
        `UPDATE deleted_movies 
         SET restored = true 
         WHERE movie_id = $1 AND user_id = $2`,
        [movieId, userId]
      );
    }

    return result.rows[0];
  }

  /**
   * Получить недавно удалённые
   */
  static async getDeleted(userId, limit = 50) {
    const result = await pool.query(
      `SELECT id, movie_id, movie_data, deleted_at, expires_at, restored
       FROM deleted_movies
       WHERE user_id = $1 AND restored = false AND expires_at > NOW()
       ORDER BY deleted_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    
    return result.rows;
  }

  /**
   * Получить количество фильмов по статусам
   */
  static async getCountByStatus(userId) {
    const result = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM movies
       WHERE user_id = $1 AND deleted_at IS NULL
       GROUP BY status`,
      [userId]
    );
    
    const counts = { in_progress: 0, to_watch: 0, watched: 0 };
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.count);
    }
    
    return counts;
  }

  /**
   * Получить общее количество
   */
  static async getCount(userId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM movies WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Синхронизировать типы фильма
   */
  static async _syncTypes(movieId, types) {
    // Удаляем старые связи
    await pool.query('DELETE FROM movie_movie_types WHERE movie_id = $1', [movieId]);

    if (types.length === 0) return;

    // Вставляем новые связи
    const values = types.map((typeId, index) => `($1, $${index + 2})`).join(', ');
    const params = [movieId, ...types];
    
    await pool.query(
      `INSERT INTO movie_movie_types (movie_id, movie_type_id) VALUES ${values}`,
      params
    );
  }

  /**
   * Синхронизировать жанры фильма
   */
  static async _syncGenres(movieId, genres) {
    // Удаляем старые связи
    await pool.query('DELETE FROM movie_genres WHERE movie_id = $1', [movieId]);

    if (genres.length === 0) return;

    // Вставляем новые связи
    const values = genres.map((genreId, index) => `($1, $${index + 2})`).join(', ');
    const params = [movieId, ...genres];
    
    await pool.query(
      `INSERT INTO movie_genres (movie_id, genre_id) VALUES ${values}`,
      params
    );
  }

  /**
   * Форматировать фильм с отношениями
   */
  static _formatMovieWithRelations(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      status: row.status,
      rating: row.rating,
      season_info: row.season_info,
      image_url: row.image_url,
      image_path: row.image_path,
      image_offset_y: row.image_offset_y,
      custom_order: row.custom_order,
      sync_version: row.sync_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      types: row.type_ids.map((id, index) => ({
        id,
        name: row.type_names[index],
        color: row.type_colors[index]
      })),
      genres: row.genre_ids.map((id, index) => ({
        id,
        name: row.genre_names[index]
      }))
    };
  }

  /**
   * Преобразовать snake_case в camelCase
   */
  static _toCamelCase(str) {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
  }
}

module.exports = Movie;
