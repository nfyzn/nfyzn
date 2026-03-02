const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class MovieType {
  /**
   * Получить все типы пользователя
   */
  static async findAll(userId) {
    // Пользовательские типы
    const customResult = await pool.query(
      `SELECT id, name, color, sort_order, created_at, updated_at
       FROM movie_types
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [userId]
    );

    // Типы по умолчанию (без user_id)
    const defaultResult = await pool.query(
      `SELECT id, name, color, sort_order, created_at, updated_at
       FROM movie_types
       WHERE is_default = true
       ORDER BY sort_order ASC, created_at ASC`
    );

    return {
      custom: customResult.rows,
      defaults: defaultResult.rows
    };
  }

  /**
   * Создать тип
   */
  static async create(userId, { name, color }) {
    const id = uuidv4();
    
    // Получаем максимальный sort_order
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM movie_types WHERE user_id = $1',
      [userId]
    );
    const maxOrder = parseInt(maxOrderResult.rows[0].max_order);

    const result = await pool.query(
      `INSERT INTO movie_types (id, user_id, name, color, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, userId, name, color || '#4CAF50', maxOrder + 1]
    );

    return result.rows[0];
  }

  /**
   * Обновить тип
   */
  static async update(id, userId, { name, color }) {
    const result = await pool.query(
      `UPDATE movie_types 
       SET name = COALESCE($1, name), 
           color = COALESCE($2, color),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [name, color, id, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Удалить тип (мягкое удаление)
   */
  static async delete(id, userId) {
    await pool.query(
      `UPDATE movie_types 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  /**
   * Переупорядочить типы
   */
  static async reorder(userId, typeIds) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (let i = 0; i < typeIds.length; i++) {
        await client.query(
          `UPDATE movie_types 
           SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND user_id = $3`,
          [i, typeIds[i], userId]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Получить изменения для синхронизации
   */
  static async getChanges(userId, sinceTimestamp) {
    const result = await pool.query(
      `SELECT id, name, color, sort_order, created_at, updated_at
       FROM movie_types
       WHERE user_id = $1 AND updated_at > $2 AND deleted_at IS NULL
       ORDER BY updated_at ASC`,
      [userId, sinceTimestamp]
    );
    
    return result.rows;
  }
}

module.exports = MovieType;
