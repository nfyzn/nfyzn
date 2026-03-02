const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database seeding...');
    
    // Создаём администратора
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@movielist.app';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      await client.query(
        `INSERT INTO users (email, password_hash, display_name, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        [adminEmail, passwordHash, 'Administrator', true, true]
      );
      
      console.log('✅ Admin user created');
    } else {
      console.log('ℹ️  Admin user already exists');
    }
    
    // Создаём типы по умолчанию
    const defaultTypes = [
      { name: 'Аниме', color: '#4CAF50' },
      { name: 'Фильм', color: '#2196F3' },
      { name: 'Сериал', color: '#9C27B0' },
      { name: 'Мультфильм', color: '#FF9800' },
    ];
    
    for (const type of defaultTypes) {
      await client.query(
        `INSERT INTO movie_types (name, color, is_default, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, name) DO NOTHING`,
        [type.name, type.color, true, defaultTypes.indexOf(type)]
      );
    }
    
    // Создаём жанры по умолчанию
    const defaultGenres = [
      'Боевик', 'Комедия', 'Драма', 'Ужасы', 'Фантастика', 'Фэнтези',
      'Романтика', 'Триллер', 'Приключения', 'Анимация'
    ];
    
    for (const genre of defaultGenres) {
      await client.query(
        `INSERT INTO genres (name, is_default, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, name) DO NOTHING`,
        [genre, true, defaultGenres.indexOf(genre)]
      );
    }
    
    console.log('✅ Default types and genres created');
    console.log('✅ Seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seed };
