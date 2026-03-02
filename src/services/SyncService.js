const pool = require('../../config/database');
const Movie = require('../models/Movie');
const MovieType = require('../models/MovieType');
const Genre = require('../models/Genre');

/**
 * Сервис синхронизации данных между клиентом и сервером
 * Стратегия: Last Write Wins с возможностью разрешения конфликтов
 */
class SyncService {
  /**
   * Получить все изменения с момента последней синхронизации
   */
  static async getChanges(userId, sinceTimestamp) {
    const [movies, types, genres] = await Promise.all([
      Movie.getChanges(userId, sinceTimestamp),
      MovieType.getChanges(userId, sinceTimestamp),
      Genre.getChanges(userId, sinceTimestamp)
    ]);

    return {
      movies,
      types,
      genres,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Синхронизировать пакет изменений от клиента
   */
  static async syncBatch(userId, changes) {
    const client = await pool.connect();
    const results = {
      movies: { created: [], updated: [], deleted: [], conflicts: [] },
      types: { created: [], updated: [], deleted: [] },
      genres: { created: [], updated: [], deleted: [] }
    };

    try {
      await client.query('BEGIN');

      // Синхронизация фильмов
      if (changes.movies) {
        for (const movieChange of changes.movies) {
          const result = await this._syncMovie(client, userId, movieChange);
          if (result.conflict) {
            results.movies.conflicts.push(result);
          } else if (result.action === 'created') {
            results.movies.created.push(result.data);
          } else if (result.action === 'updated') {
            results.movies.updated.push(result.data);
          } else if (result.action === 'deleted') {
            results.movies.deleted.push(result.id);
          }
        }
      }

      // Синхронизация типов
      if (changes.types) {
        for (const typeChange of changes.types) {
          const result = await this._syncType(client, userId, typeChange);
          if (result.action === 'created') {
            results.types.created.push(result.data);
          } else if (result.action === 'updated') {
            results.types.updated.push(result.data);
          } else if (result.action === 'deleted') {
            results.types.deleted.push(result.id);
          }
        }
      }

      // Синхронизация жанров
      if (changes.genres) {
        for (const genreChange of changes.genres) {
          const result = await this._syncGenre(client, userId, genreChange);
          if (result.action === 'created') {
            results.genres.created.push(result.data);
          } else if (result.action === 'updated') {
            results.genres.updated.push(result.data);
          } else if (result.action === 'deleted') {
            results.genres.deleted.push(result.id);
          }
        }
      }

      await client.query('COMMIT');

      // Логируем синхронизацию
      await this._logSync(userId, 'batch_sync', changes);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return results;
  }

  /**
   * Синхронизация одного фильма
   */
  static async _syncMovie(client, userId, change) {
    const { action, data, serverVersion } = change;

    try {
      if (action === 'create') {
        // Проверяем, существует ли уже фильм с таким ID
        const existing = await client.query(
          'SELECT id, sync_version FROM movies WHERE id = $1 AND user_id = $2',
          [data.id, userId]
        );

        if (existing.rows.length > 0) {
          // Конфликт: фильм уже существует
          return {
            conflict: true,
            action: 'create',
            local: data,
            server: existing.rows[0]
          };
        }

        // Создаём фильм
        const movieData = {
          ...data,
          types: data.type_ids || [],
          genres: data.genre_ids || []
        };
        
        // Временное отключение триггеров для прямой вставки
        const result = await client.query(
          `INSERT INTO movies (id, user_id, title, status, rating, season_info, image_url, image_path, image_offset_y, custom_order, sync_version, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING
           RETURNING *`,
          [
            data.id, userId, data.title, data.status || 'to_watch',
            data.rating, data.season_info, data.image_url, data.image_path,
            data.image_offset_y, data.custom_order || 0, data.sync_version || 1,
            data.created_at || new Date(), data.updated_at || new Date()
          ]
        );

        // Синхронизируем типы
        if (data.type_ids && data.type_ids.length > 0) {
          await client.query(
            'DELETE FROM movie_movie_types WHERE movie_id = $1',
            [data.id]
          );
          
          for (const typeId of data.type_ids) {
            await client.query(
              'INSERT INTO movie_movie_types (movie_id, movie_type_id) VALUES ($1, $2)',
              [data.id, typeId]
            );
          }
        }

        // Синхронизируем жанры
        if (data.genre_ids && data.genre_ids.length > 0) {
          await client.query(
            'DELETE FROM movie_genres WHERE movie_id = $1',
            [data.id]
          );
          
          for (const genreId of data.genre_ids) {
            await client.query(
              'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)',
              [data.id, genreId]
            );
          }
        }

        return { action: 'created', data: result.rows[0] || data };

      } else if (action === 'update') {
        // Проверяем версию на сервере
        const existing = await client.query(
          'SELECT sync_version, updated_at FROM movies WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
          [data.id, userId]
        );

        if (existing.rows.length === 0) {
          // Фильм не найден, создаём
          return await this._syncMovie(client, userId, { ...change, action: 'create' });
        }

        const serverVer = existing.rows[0].sync_version;
        
        // Last Write Wins: если клиентская версия новее или равна
        if ((data.sync_version || 1) >= serverVer) {
          const fields = [];
          const values = [];
          let paramIndex = 1;

          if (data.title !== undefined) {
            fields.push(`title = $${paramIndex++}`);
            values.push(data.title);
          }
          if (data.status !== undefined) {
            fields.push(`status = $${paramIndex++}`);
            values.push(data.status);
          }
          if (data.rating !== undefined) {
            fields.push(`rating = $${paramIndex++}`);
            values.push(data.rating);
          }
          if (data.season_info !== undefined) {
            fields.push(`season_info = $${paramIndex++}`);
            values.push(data.season_info);
          }
          if (data.image_url !== undefined) {
            fields.push(`image_url = $${paramIndex++}`);
            values.push(data.image_url);
          }
          if (data.image_path !== undefined) {
            fields.push(`image_path = $${paramIndex++}`);
            values.push(data.image_path);
          }
          if (data.image_offset_y !== undefined) {
            fields.push(`image_offset_y = $${paramIndex++}`);
            values.push(data.image_offset_y);
          }
          if (data.custom_order !== undefined) {
            fields.push(`custom_order = $${paramIndex++}`);
            values.push(data.custom_order);
          }

          if (fields.length > 0) {
            fields.push(`sync_version = sync_version + 1`);
            fields.push(`updated_at = $${paramIndex++}`);
            values.push(data.updated_at || new Date());

            values.push(data.id);
            values.push(userId);

            const query = `
              UPDATE movies 
              SET ${fields.join(', ')} 
              WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
              RETURNING *
            `;

            const result = await client.query(query, values);

            // Обновляем типы
            if (data.type_ids !== undefined) {
              await client.query('DELETE FROM movie_movie_types WHERE movie_id = $1', [data.id]);
              for (const typeId of data.type_ids) {
                await client.query(
                  'INSERT INTO movie_movie_types (movie_id, movie_type_id) VALUES ($1, $2)',
                  [data.id, typeId]
                );
              }
            }

            // Обновляем жанры
            if (data.genre_ids !== undefined) {
              await client.query('DELETE FROM movie_genres WHERE movie_id = $1', [data.id]);
              for (const genreId of data.genre_ids) {
                await client.query(
                  'INSERT INTO movie_genres (movie_id, genre_id) VALUES ($1, $2)',
                  [data.id, genreId]
                );
              }
            }

            return { action: 'updated', data: result.rows[0] };
          }
        }

        // Конфликт версий
        return {
          conflict: true,
          action: 'update',
          local: data,
          server: existing.rows[0]
        };

      } else if (action === 'delete') {
        await client.query(
          `UPDATE movies 
           SET deleted_at = CURRENT_TIMESTAMP, 
               sync_version = sync_version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2`,
          [data.id, userId]
        );

        return { action: 'deleted', id: data.id };
      }

    } catch (error) {
      console.error('Sync movie error:', error);
      throw error;
    }
  }

  /**
   * Синхронизация типа
   */
  static async _syncType(client, userId, change) {
    const { action, data } = change;

    if (action === 'create') {
      const result = await client.query(
        `INSERT INTO movie_types (id, user_id, name, color, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
         RETURNING *`,
        [data.id, userId, data.name, data.color, data.sort_order || 0]
      );
      return { action: 'created', data: result.rows[0] };

    } else if (action === 'update') {
      const result = await client.query(
        `UPDATE movie_types 
         SET name = COALESCE($1, name), 
             color = COALESCE($2, color),
             sort_order = COALESCE($3, sort_order),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [data.name, data.color, data.sort_order, data.id, userId]
      );
      return { action: 'updated', data: result.rows[0] || data };

    } else if (action === 'delete') {
      await client.query(
        `UPDATE movie_types 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND user_id = $2`,
        [data.id, userId]
      );
      return { action: 'deleted', id: data.id };
    }
  }

  /**
   * Синхронизация жанра
   */
  static async _syncGenre(client, userId, change) {
    const { action, data } = change;

    if (action === 'create') {
      const result = await client.query(
        `INSERT INTO genres (id, user_id, name, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, name) DO NOTHING
         RETURNING *`,
        [data.id, userId, data.name, data.sort_order || 0]
      );
      return { action: 'created', data: result.rows[0] || data };

    } else if (action === 'update') {
      const result = await client.query(
        `UPDATE genres 
         SET name = COALESCE($1, name), 
             sort_order = COALESCE($2, sort_order),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [data.name, data.sort_order, data.id, userId]
      );
      return { action: 'updated', data: result.rows[0] || data };

    } else if (action === 'delete') {
      await client.query(
        `UPDATE genres 
         SET deleted_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND user_id = $2`,
        [data.id, userId]
      );
      return { action: 'deleted', id: data.id };
    }
  }

  /**
   * Логирование синхронизации
   */
  static async _logSync(userId, action, changes) {
    try {
      const movieCount = changes.movies?.length || 0;
      const typeCount = changes.types?.length || 0;
      const genreCount = changes.genres?.length || 0;

      await pool.query(
        `INSERT INTO sync_log (user_id, action, entity_type, new_data)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          action,
          'batch',
          JSON.stringify({ movies: movieCount, types: typeCount, genres: genreCount })
        ]
      );
    } catch (error) {
      console.error('Sync log error:', error);
    }
  }

  /**
   * Получить статистику синхронизации
   */
  static async getSyncStats(userId) {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_syncs,
         COUNT(*) FILTER (WHERE conflict_resolved = true) as conflicts_resolved,
         MAX(created_at) as last_sync_at
       FROM sync_log
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || {
      total_syncs: 0,
      conflicts_resolved: 0,
      last_sync_at: null
    };
  }
}

module.exports = SyncService;
