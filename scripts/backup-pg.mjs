/**
 * PostgreSQL 数据库备份工具
 * 从 Railway PostgreSQL 导出数据到本地 JSON + SQL 文件
 *
 * 用法:
 *   node scripts/backup-pg.mjs
 *   npm run backup
 *
 * 配置:
 *   在 .env.backup 文件中设置 DATABASE_PUBLIC_URL
 *   或设置环境变量 DATABASE_PUBLIC_URL
 */

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

// ===== 1. 读取数据库连接串 =====

// 尝试从 .env.backup 读取
const envBackupPath = '.env.backup';
let connectionString = process.env.DATABASE_PUBLIC_URL;

if (!connectionString && fs.existsSync(envBackupPath)) {
  const envContent = fs.readFileSync(envBackupPath, 'utf8');
  const match = envContent.match(/^DATABASE_PUBLIC_URL=(.+)$/m);
  if (match) {
    connectionString = match[1].trim();
    // 去掉引号
    if ((connectionString.startsWith('"') && connectionString.endsWith('"')) ||
        (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
      connectionString = connectionString.slice(1, -1);
    }
  }
}

if (!connectionString) {
  console.error('❌ 未找到数据库连接串');
  console.error('');
  console.error('请任选一种方式配置:');
  console.error('  1. 创建 .env.backup 文件,内容:');
  console.error('     DATABASE_PUBLIC_URL=postgresql://postgres:密码@sakura.proxy.rlwy.net:端口/railway');
  console.error('');
  console.error('  2. 设置环境变量:');
  console.error('     set DATABASE_PUBLIC_URL=postgresql://postgres:密码@sakura.proxy.rlwy.net:端口/railway');
  console.error('');
  console.error('💡 连接串可从 Railway 控制台 → Postgres → Variables → DATABASE_PUBLIC_URL 复制');
  process.exit(1);
}

// ===== 2. 连接数据库 =====

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('railway.internal') ? false : { rejectUnauthorized: false },
});

console.log('🔗 正在连接数据库...');

// ===== 3. 导出数据 =====

async function backup() {
  const client = await pool.connect();
  try {
    // 获取所有表
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map(r => r.table_name);

    console.log(`📊 发现 ${tables.length} 个表: ${tables.join(', ')}`);

    // 导出数据
    const backup = {};
    let totalRows = 0;

    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${table} ORDER BY id`);
      backup[table] = result.rows;
      totalRows += result.rows.length;
      console.log(`   ${table}: ${result.rows.length} 行`);
    }

    // ===== 4. 生成文件名(带时间戳) =====

    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/T/, '_')
      .replace(/\..+/, '')
      .replace(/:/g, '-')
      .slice(0, -3); // 去掉秒的小数部分

    const backupDir = 'backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const jsonFile = path.join(backupDir, `backup_${timestamp}.json`);
    const sqlFile = path.join(backupDir, `backup_${timestamp}.sql`);

    // ===== 5. 保存 JSON 格式 =====

    fs.writeFileSync(jsonFile, JSON.stringify(backup, null, 2), 'utf8');

    // ===== 6. 生成 SQL 格式 =====

    let sql = `-- PostgreSQL 数据库备份
-- 备份时间: ${now.toLocaleString('zh-CN')}
-- 表数量: ${tables.length}
-- 总行数: ${totalRows}

BEGIN;

`;

    for (const table of tables) {
      const rows = backup[table];
      if (rows.length === 0) continue;

      sql += `-- 表: ${table}\n`;
      sql += `DELETE FROM ${table};\n`;

      const cols = Object.keys(rows[0]);
      for (const row of rows) {
        const vals = cols.map(col => {
          const val = row[col];
          if (val === null) return 'NULL';
          if (typeof val === 'number') return val;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          // 转义单引号
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
      }
      sql += `\n`;
    }

    // 重置序列
    sql += `-- 重置自增序列\n`;
    for (const table of tables) {
      sql += `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 1));\n`;
    }

    sql += `\nCOMMIT;\n`;

    fs.writeFileSync(sqlFile, sql, 'utf8');

    // ===== 7. 输出统计 =====

    const jsonSize = (fs.statSync(jsonFile).size / 1024).toFixed(1);
    const sqlSize = (fs.statSync(sqlFile).size / 1024).toFixed(1);

    console.log('');
    console.log('✅ 备份完成!');
    console.log(`   JSON: ${jsonFile} (${jsonSize} KB)`);
    console.log(`   SQL:  ${sqlFile} (${sqlSize} KB)`);
    console.log(`   总计: ${totalRows} 行数据`);

  } finally {
    client.release();
    await pool.end();
  }
}

// ===== 8. 执行备份 =====

backup().catch(err => {
  console.error('');
  console.error('❌ 备份失败:', err.message);
  console.error('');
  if (err.message.includes('ECONNREFUSED')) {
    console.error('💡 提示: 无法连接到数据库,请检查:');
    console.error('   1. 网络连接是否正常');
    console.error('   2. 连接串中的主机名和端口是否正确');
    console.error('   3. Railway 的 Public Networking 是否已开启');
  } else if (err.message.includes('password authentication failed')) {
    console.error('💡 提示: 密码认证失败,请检查连接串中的密码是否正确');
  }
  process.exit(1);
});
