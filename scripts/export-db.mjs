/**
 * 数据库导出工具(无需 sqlite3 命令行)
 * 用法: node scripts/export-db.mjs [db路径] [输出文件]
 *   默认: node scripts/export-db.mjs ./data/notebook.db ./backup.sql
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.argv[2] || './data/notebook.db';
const outFile = process.argv[3] || './backup.sql';

if (!fs.existsSync(dbPath)) {
  console.error(`❌ 数据库文件不存在: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// 导出为 SQL dump 格式(兼容 SQLite 和 PostgreSQL 手动迁移)
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

let sql = `-- Notebook 数据库备份
-- 导出时间: ${new Date().toISOString()}
-- 原数据库: ${path.resolve(dbPath)}
-- 表数量: ${tables.length}

BEGIN TRANSACTION;

`;

for (const { name } of tables) {
  // 建表语句
  const { sql: createSql } = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name);
  sql += `-- 表: ${name}\n${createSql};\n\n`;

  // 数据
  const rows = db.prepare(`SELECT * FROM ${name}`).all();
  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    for (const row of rows) {
      const vals = cols.map(c => {
        const v = row[c];
        if (v === null) return 'NULL';
        if (typeof v === 'number') return v;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
    }
    sql += `\n`;
  }
}

sql += `COMMIT;\n`;

fs.writeFileSync(outFile, sql, 'utf8');

// 同时输出 JSON 格式(更通用,方便迁移到 PostgreSQL)
const jsonFile = outFile.replace(/\.sql$/, '.json');
const jsonData = {};
for (const { name } of tables) {
  jsonData[name] = db.prepare(`SELECT * FROM ${name}`).all();
}
fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');

db.close();

console.log(`✅ 导出完成:`);
console.log(`   SQL:  ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(1)} KB)`);
console.log(`   JSON: ${jsonFile} (${(fs.statSync(jsonFile).size / 1024).toFixed(1)} KB)`);
console.log(`   表:   ${tables.map(t => t.name).join(', ')}`);
