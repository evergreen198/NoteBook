import fs from 'node:fs';

const backupPath = process.argv[2];
if (!backupPath) {
  console.error('用法: node scripts/generate-import-sql.mjs <backup.json>');
  console.error('会生成 import.sql 文件,可直接粘贴到 Railway Postgres Query 页面执行');
  process.exit(1);
}

const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

let sql = `-- 从 SQLite 备份导入数据到 PostgreSQL
-- 生成时间: ${new Date().toISOString()}

-- 清空现有数据
DELETE FROM notes;
DELETE FROM users;

-- 导入用户
`;

for (const user of backup.users) {
  sql += `INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (${user.id}, '${user.username}', '${user.password_hash}', '${user.salt}', '${user.created_at}');\n`;
}

sql += `\n-- 导入笔记\n`;

for (const note of backup.notes) {
  sql += `INSERT INTO notes (id, user_id, ciphertext, iv, created_at, updated_at) VALUES (${note.id}, ${note.user_id}, '${note.ciphertext}', '${note.iv}', '${note.created_at}', '${note.updated_at}');\n`;
}

sql += `
-- 重置序列
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('notes_id_seq', (SELECT MAX(id) FROM notes));

-- 验证导入结果
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'notes', COUNT(*) FROM notes;
`;

fs.writeFileSync('import.sql', sql);
console.log('✅ 已生成 import.sql');
console.log(`   用户: ${backup.users.length} 个`);
console.log(`   笔记: ${backup.notes.length} 条`);
console.log('\n使用方法:');
console.log('1. 打开 Railway 控制台 → Postgres 服务 → Query 标签页');
console.log('2. 把 import.sql 的内容粘贴进去执行');
