const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const pool = require('../../config/database');

class AuthService {
  /**
   * Генерация пары токенов (access + refresh)
   */
  static generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = uuidv4();
    const refreshTokenHash = this.hashToken(refreshToken);

    return { accessToken, refreshToken, refreshTokenHash };
  }

  /**
   * Хеширование refresh токена
   */
  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Сохранение refresh токена в БД
   */
  static async storeRefreshToken(userId, tokenHash, expiresAt) {
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  /**
   * Проверка access токена
   */
  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Проверка refresh токена
   */
  static async verifyRefreshToken(token) {
    const tokenHash = this.hashToken(token);
    
    const result = await pool.query(
      `SELECT rt.*, u.is_active 
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1 
         AND rt.revoked = false 
         AND rt.expires_at > NOW()
         AND u.is_active = true`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    return result.rows[0];
  }

  /**
   * Обновление пары токенов
   */
  static async refreshTokens(oldRefreshToken) {
    // Проверяем старый refresh токен
    const tokenData = await this.verifyRefreshToken(oldRefreshToken);
    
    // Аннулируем старый токен
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [this.hashToken(oldRefreshToken)]
    );

    // Генерируем новую пару
    const { accessToken, refreshToken, refreshTokenHash } = this.generateTokens(tokenData.user_id);
    
    // Сохраняем новый refresh токен
    const expiresAt = new Date();
    expiresAt.setMilliseconds(expiresAt.getMilliseconds() + 
      this.parseExpiryToMs(process.env.JWT_REFRESH_EXPIRY || '7d'));
    
    await this.storeRefreshToken(tokenData.user_id, refreshTokenHash, expiresAt);

    return { accessToken, refreshToken };
  }

  /**
   * Выход (аннулирование refresh токена)
   */
  static async logout(token) {
    const tokenHash = this.hashToken(token);
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1',
      [tokenHash]
    );
  }

  /**
   * Выход из всех сессий
   */
  static async logoutAll(userId) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId]
    );
  }

  /**
   * Очистка просроченных токенов
   */
  static async cleanupExpiredTokens() {
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = true'
    );
    return result.rowCount;
  }

  /**
   * Парсинг строки времени жизни в миллисекунды
   */
  static parseExpiryToMs(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // 7 дней по умолчанию

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Получение активных сессий пользователя
   */
  static async getActiveSessions(userId) {
    const result = await pool.query(
      `SELECT id, ip_address, user_agent, created_at, last_activity, is_active
       FROM user_sessions
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_activity DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Создание сессии
   */
  static async createSession(userId, ipAddress, userAgent) {
    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, ip_address, user_agent)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, ipAddress, userAgent]
    );
    return result.rows[0].id;
  }

  /**
   * Обновление активности сессии
   */
  static async updateSessionActivity(sessionId) {
    await pool.query(
      `UPDATE user_sessions 
       SET last_activity = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Завершение сессии
   */
  static async endSession(sessionId) {
    await pool.query(
      `UPDATE user_sessions 
       SET is_active = false 
       WHERE id = $1`,
      [sessionId]
    );
  }
}

module.exports = AuthService;
