import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('用法: node scripts/import-to-pg.mjs <backup.json>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ 请先设置 DATABASE_URL 环境变量');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('railway.internal')
    ? { rejectUnauthorized: false }
    : false,
});

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

async function importData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 清空现有数据(如果有)
    await client.query('DELETE FROM notes');
    await client.query('DELETE FROM users');

    // 导入用户
    console.log(`导入 ${backup.users.length} 个用户...`);
    for (const user of backup.users) {
      await client.query(
        'INSERT INTO users (id, username, password_hash, salt, created_at) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.username, user.password_hash, user.salt, user.created_at]
      );
    }

    // 导入笔记
    console.log(`导入 ${backup.notes.length} 条笔记...`);
    for (const note of backup.notes) {
      await client.query(
        'INSERT INTO notes (id, user_id, ciphertext, iv, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [note.id, note.user_id, note.ciphertext, note.iv, note.created_at, note.updated_at]
      );
    }

    // 重置序列
    await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    await client.query(`SELECT setval('notes_id_seq', (SELECT MAX(id) FROM notes))`);

    await client.query('COMMIT');
    console.log('✅ 数据导入成功!');
    console.log(`   用户: ${backup.users.length} 个`);
    console.log(`   笔记: ${backup.notes.length} 条`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
