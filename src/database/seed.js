const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting database seeding...');
    
    // Создаём администратора
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@movielist.app';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    
    const existingAdmin = await client.query(
      'SELECT id, is_admin FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      const result = await client.query(
        `INSERT INTO users (email, password_hash, display_name, is_admin, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, is_admin`,
        [adminEmail, passwordHash, 'Administrator', true, true]
      );
      
      console.log('✅ Admin user created:', result.rows[0].email);
    } else {
      // Обновляем пароль если админ уже существует
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await client.query(
        'UPDATE users SET password_hash = $1, is_admin = true WHERE email = $2',
        [passwordHash, adminEmail]
      );
      console.log('ℹ️  Admin user updated:', adminEmail);
    }
    
    // Создаём типы по умолчанию (без привязки к пользователю)
    const defaultTypes = [
      { name: 'Аниме', color: '#4CAF50' },
      { name: 'Фильм', color: '#2196F3' },
      { name: 'Сериал', color: '#9C27B0' },
      { name: 'Мультфильм', color: '#FF9800' },
    ];
    
    let typesCreated = 0;
    for (const type of defaultTypes) {
      const result = await client.query(
        `INSERT INTO movie_types (name, color, is_default, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, name) DO NOTHING
         RETURNING id`,
        [type.name, type.color, true, defaultTypes.indexOf(type)]
      );
      
      // Если user_id NULL (для дефолтных), просто вставляем
      if (result.rows.length === 0) {
        await client.query(
          `INSERT INTO movie_types (name, color, is_default, sort_order)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [type.name, type.color, true, defaultTypes.indexOf(type)]
        );
      }
      typesCreated++;
    }
    console.log(`✅ Default types created: ${typesCreated}`);
    
    // Создаём жанры по умолчанию
    const defaultGenres = [
      'Боевик', 'Комедия', 'Драма', 'Ужасы', 'Фантастика', 'Фэнтези',
      'Романтика', 'Триллер', 'Приключения', 'Анимация'
    ];
    
    let genresCreated = 0;
    for (const genre of defaultGenres) {
      const result = await client.query(
        `INSERT INTO genres (name, is_default, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, name) DO NOTHING
         RETURNING id`,
        [genre, true, defaultGenres.indexOf(genre)]
      );
      
      if (result.rows.length === 0) {
        await client.query(
          `INSERT INTO genres (name, is_default, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [genre, true, defaultGenres.indexOf(genre)]
        );
      }
      genresCreated++;
    }
    console.log(`✅ Default genres created: ${genresCreated}`);
    
    console.log('✅ Seeding completed successfully');
    
  } catch (error) {
    console.error('❌ Seeding error:', error.message);
    if (error.detail) {
      console.error('📋 Detail:', error.detail);
    }
    if (error.hint) {
      console.error('💡 Hint:', error.hint);
    }
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Seeding finished');
      process.exit(0);
    })
    .catch(() => {
      console.error('❌ Seeding failed');
      process.exit(1);
    });
}

module.exports = { seed };
