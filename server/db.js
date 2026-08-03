import pg from 'pg';
import fs from 'node:fs';

const { Pool } = pg;

// Railway 会自动注入 DATABASE_URL,本地开发从 .env 读取
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('   未设置 DATABASE_URL 环境变量');
  console.error('   本地开发: 在 .env 中填写 postgresql://user:pass@localhost:5432/dbname');
  console.error('   Railway:  服务会自动注入,无需手动设置');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // Railway 内部连接不需要 SSL,外部连接需要
  ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('railway.internal')
    ? { rejectUnauthorized: false }
    : false,
});

// 初始化表结构
async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at DESC);
    `);
    console.log('✅ PostgreSQL 连接成功,表结构已初始化');
  } finally {
    client.release();
  }
}

init().catch(err => {
  console.error('❌ 数据库初始化失败:', err.message);
  process.exit(1);
});

export default {
  query: (text, params) => pool.query(text, params),
  pool,
};
