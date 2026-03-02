const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class User {
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, email, display_name, avatar_url, is_active, is_admin, last_login_at, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  static async create({ email, passwordHash, displayName }) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, avatar_url, is_active, is_admin, created_at`,
      [id, email, passwordHash, displayName || null]
    );
    return result.rows[0];
  }

  static async updateLastLogin(id) {
    await pool.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  static async updateProfile(id, { displayName, avatarUrl }) {
    const result = await pool.query(
      `UPDATE users 
       SET display_name = COALESCE($1, display_name), 
           avatar_url = COALESCE($2, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, display_name, avatar_url`,
      [displayName, avatarUrl, id]
    );
    return result.rows[0];
  }

  static async changePassword(id, newPasswordHash) {
    await pool.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newPasswordHash, id]
    );
  }

  static async getAll(limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT id, email, display_name, is_active, is_admin, last_login_at, created_at 
       FROM users 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  static async getCount() {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
  }

  static async getActiveCount() {
    const result = await pool.query("SELECT COUNT(*) FROM users WHERE is_active = true AND last_login_at > NOW() - INTERVAL '30 days'");
    return parseInt(result.rows[0].count);
  }

  static async toggleActive(id) {
    const result = await pool.query(
      `UPDATE users 
       SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1
       RETURNING is_active`,
      [id]
    );
    return result.rows[0].is_active;
  }

  static async toggleAdmin(id) {
    const result = await pool.query(
      `UPDATE users 
       SET is_admin = NOT is_admin, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1
       RETURNING is_admin`,
      [id]
    );
    return result.rows[0].is_admin;
  }

  static async delete(id) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  }
}

module.exports = User;
