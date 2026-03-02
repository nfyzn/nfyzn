const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class Genre {
  /**
   * Получить все жанры пользователя
   */
  static async findAll(userId) {
    // Пользовательские жанры
    const customResult = await pool.query(
      `SELECT id, name, sort_order, created_at, updated_at
       FROM genres
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [userId]
    );

    // Жанры по умолчанию (без user_id)
    const defaultResult = await pool.query(
      `SELECT id, name, sort_order, created_at, updated_at
       FROM genres
       WHERE is_default = true
       ORDER BY sort_order ASC, created_at ASC`
    );

    return {
      custom: customResult.rows,
      defaults: defaultResult.rows
    };
  }

  /**
   * Создать жанр
   */
  static async create(userId, { name }) {
    const id = uuidv4();
    
    // Получаем максимальный sort_order
    const maxOrderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM genres WHERE user_id = $1',
      [userId]
    );
    const maxOrder = parseInt(maxOrderResult.rows[0].max_order);

    const result = await pool.query(
      `INSERT INTO genres (id, user_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, userId, name, maxOrder + 1]
    );

    return result.rows[0];
  }

  /**
   * Обновить жанр
   */
  static async update(id, userId, { name }) {
    const result = await pool.query(
      `UPDATE genres 
       SET name = COALESCE($1, name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [name, id, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Удалить жанр (мягкое удаление)
   */
  static async delete(id, userId) {
    await pool.query(
      `UPDATE genres 
       SET deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  /**
   * Переупорядочить жанры
   */
  static async reorder(userId, genreIds) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      for (let i = 0; i < genreIds.length; i++) {
        await client.query(
          `UPDATE genres 
           SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND user_id = $3`,
          [i, genreIds[i], userId]
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
      `SELECT id, name, sort_order, created_at, updated_at
       FROM genres
       WHERE user_id = $1 AND updated_at > $2 AND deleted_at IS NULL
       ORDER BY updated_at ASC`,
      [userId, sinceTimestamp]
    );
    
    return result.rows;
  }
}

module.exports = Genre;
