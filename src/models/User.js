/**
 * Модель пользователя
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class User {
  // Создание пользователя
  static async create({ email, password, displayName, isGuest = false }) {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name, is_guest, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, email, display_name, avatar_url, is_guest, created_at`,
      [userId, email, passwordHash, displayName, isGuest]
    );

    return result.rows[0];
  }

  // Поиск по email
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  // Поиск по ID
  static async findById(userId) {
    const result = await pool.query(
      'SELECT id, email, display_name, avatar_url, is_guest, created_at, last_login_at FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  }

  // Проверка пароля
  static async verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
  }

  // Обновление профиля
  static async update(userId, { displayName, email, avatarUrl }) {
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return this.findById(userId);
    }

    values.push(userId);
    const result = await pool.query(
      `UPDATE users 
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING id, email, display_name, avatar_url, is_guest, created_at`,
      values
    );

    return result.rows[0];
  }

  // Обновление времени последнего входа
  static async updateLastLogin(userId) {
    await pool.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [userId]
    );
  }

  // Удаление пользователя
  static async delete(userId) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  // Смена пароля
  static async changePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );
  }
}

module.exports = User;
