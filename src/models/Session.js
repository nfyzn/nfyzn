/**
 * Модель сессии
 */

const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

class Session {
  // Создание сессии
  static async create({ userId, deviceId }) {
    const sessionId = uuidv4();
    const accessToken = jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Короткоживущий токен
    );
    const refreshToken = jwt.sign(
      { userId, sessionId, deviceId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '30d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO sessions (id, user_id, device_id, access_token, refresh_token, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [sessionId, userId, deviceId, accessToken, refreshToken, expiresAt]
    );

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  // Поиск по токену
  static async findByAccessToken(accessToken) {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE access_token = $1 AND expires_at > NOW()',
      [accessToken]
    );
    return result.rows[0];
  }

  // Поиск по refresh токену
  static async findByRefreshToken(refreshToken) {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE refresh_token = $1 AND expires_at > NOW()',
      [refreshToken]
    );
    return result.rows[0];
  }

  // Обновление токенов
  static async updateTokens(sessionId, accessToken, refreshToken) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `UPDATE sessions 
       SET access_token = $1, refresh_token = $2, expires_at = $3
       WHERE id = $4`,
      [accessToken, refreshToken, expiresAt, sessionId]
    );

    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString()
    };
  }

  // Удаление сессии
  static async delete(sessionId) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  // Удаление всех сессий пользователя
  static async deleteAllForUser(userId, deviceId = null) {
    if (deviceId) {
      await pool.query('DELETE FROM sessions WHERE user_id = $1 AND device_id = $2', [userId, deviceId]);
    } else {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }
  }

  // Генерация нового access токена
  static generateAccessToken(userId, sessionId) {
    return jwt.sign(
      { userId, sessionId },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }
}

module.exports = Session;
