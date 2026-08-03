# 📦 数据库备份指南

本文档说明如何管理和使用 PostgreSQL 数据库备份系统。

---

## 🎯 快速开始

### 手动备份
```bash
npm run backup
```

备份文件保存在 `backups/` 目录,格式:
- `backup_YYYY-MM-DD_HH-MM.json` - JSON 格式(易读)
- `backup_YYYY-MM-DD_HH-MM.sql` - SQL 格式(可恢复)

---

## ⏰ 定时备份配置

### 当前配置:每周三、周五、周日凌晨 2 点

#### 创建/更新定时任务

在**管理员 PowerShell** 中执行:

```powershell
# 1. 删除旧任务(如果存在)
schtasks /delete /tn "NoteBook数据库备份" /f

# 2. 创建新任务(每周三、五、日凌晨 2 点)
schtasks /create /tn "NoteBook数据库备份" /tr "cmd /c cd /d \"c:\Users\evergreen\Desktop\实验室\react\notebook\" && npm run backup >> backups\backup.log 2>&1" /sc weekly /d WED,FRI,SUN /st 02:00 /f
```

#### 验证任务

```powershell
# 查看任务详情
schtasks /query /tn "NoteBook数据库备份" /v /fo list

# 立即运行一次测试
schtasks /run /tn "NoteBook数据库备份"
```

#### 图形界面方式

1. **Win+R** 输入 `taskschd.msc` 打开任务计划程序
2. 左侧点击 **"任务计划程序库"**
3. 找到 **"NoteBook数据库备份"** 双击
4. 点 **"触发器"** 标签修改时间/频率
5. 点 **"确定"** 保存

---

## 🔧 常用定时配置示例

### 每天备份
```powershell
schtasks /create /tn "NoteBook数据库备份" /tr "cmd /c cd /d \"c:\Users\evergreen\Desktop\实验室\react\notebook\" && npm run backup >> backups\backup.log 2>&1" /sc daily /st 02:00 /f
```

### 每 6 小时备份
```powershell
schtasks /create /tn "NoteBook数据库备份" /tr "cmd /c cd /d \"c:\Users\evergreen\Desktop\实验室\react\notebook\" && npm run backup >> backups\backup.log 2>&1" /sc hourly /mo 6 /f
```

### 每周一备份
```powershell
schtasks /create /tn "NoteBook数据库备份" /tr "cmd /c cd /d \"c:\Users\evergreen\Desktop\实验室\react\notebook\" && npm run backup >> backups\backup.log 2>&1" /sc weekly /d MON /st 02:00 /f
```

### 每月 1 号备份
```powershell
schtasks /create /tn "NoteBook数据库备份" /tr "cmd /c cd /d \"c:\Users\evergreen\Desktop\实验室\react\notebook\" && npm run backup >> backups\backup.log 2>&1" /sc monthly /d 1 /st 02:00 /f
```

---

## 📋 参数说明

### 频率参数(`/sc`)
- `daily` - 每天
- `weekly` - 每周
- `monthly` - 每月
- `hourly` - 每小时

### 星期参数(`/d`)
- `MON` - 周一
- `TUE` - 周二
- `WED` - 周三
- `THU` - 周四
- `FRI` - 周五
- `SAT` - 周六
- `SUN` - 周日
- 多选用逗号分隔: `MON,WED,FRI`

### 时间参数(`/st`)
- 格式: `HH:MM`(24 小时制)
- 示例: `02:00`(凌晨 2 点)、`14:30`(下午 2 点半)

---

## 🗑️ 删除定时任务

```powershell
schtasks /delete /tn "NoteBook数据库备份" /f
```

---

## 📂 备份文件管理

### 查看备份文件
```bash
ls backups/
```

### 清理旧备份(保留最近 10 个)
```powershell
# PowerShell
ls backups/backup_*.json | sort LastWriteTime -Descending | select -Skip 10 | rm
ls backups/backup_*.sql | sort LastWriteTime -Descending | select -Skip 10 | rm
```

### 备份文件位置
```
backups/
├── backup_2026-08-03_02-36.json
├── backup_2026-08-03_02-36.sql
├── backup_2026-08-04_02-00.json
├── backup_2026-08-04_02-00.sql
└── backup.log  (定时任务日志)
```

---

## 🔄 恢复数据

### 方法 1: 使用 SQL 文件恢复

1. 打开 Railway 控制台 → Postgres → Console
2. 复制 `.sql` 备份文件内容
3. 粘贴到 Console 执行

### 方法 2: 使用 pgAdmin 恢复

1. 打开 pgAdmin,连接到 Railway 数据库
2. 右键 `railway` 数据库 → **Query Tool**
3. 打开 `.sql` 备份文件
4. 点击 **Execute**(▶️ 按钮)

---

## 🔐 配置文件

### `.env.backup`
存储数据库连接串(已加入 `.gitignore`):
```env
DATABASE_PUBLIC_URL=postgresql://postgres:密码@sakura.proxy.rlwy.net:端口/railway
```

从 Railway 控制台 → Postgres → Variables → `DATABASE_PUBLIC_URL` 复制。

---

## 🖥️ pgAdmin 图形界面

### 连接配置
- **Host**: `sakura.proxy.rlwy.net`
- **Port**: 从 `DATABASE_PUBLIC_URL` 中获取(5 位数字)
- **Database**: `railway`
- **Username**: `postgres`
- **Password**: 你的数据库密码
- **SSL Mode**: Prefer 或 Require

### 查看数据
1. 展开 **Servers** → **railway** → **Databases** → **railway** → **Schemas** → **public** → **Tables**
2. 右键 `users` 或 `notes` 表 → **View/Edit Data** → **All Rows**

---

## ⚠️ 注意事项

1. **数据加密**: 笔记内容是端到端加密的,备份文件中的 `ciphertext` 是密文
2. **密码安全**: `.env.backup` 包含数据库密码,不要提交到 Git
3. **备份安全**: `backups/` 目录已加入 `.gitignore`,不会被提交
4. **磁盘空间**: 定期清理旧备份文件,避免占用过多磁盘空间
5. **网络连接**: 定时备份需要网络连接,确保电脑在备份时间处于联网状态

---

## 🆘 故障排查

### 备份失败: "未找到数据库连接串"
- 检查 `.env.backup` 文件是否存在
- 检查 `DATABASE_PUBLIC_URL` 是否正确配置

### 备份失败: "ECONNREFUSED"
- 检查网络连接
- 检查 Railway 的 Public Networking 是否开启
- 检查连接串中的主机名和端口是否正确

### 定时任务不执行
- 检查任务计划程序中任务是否启用
- 检查 `backups/backup.log` 查看错误日志
- 确认电脑在备份时间处于开机状态

### 查看备份日志
```bash
cat backups/backup.log
```

---

## 📞 相关链接

- GitHub 仓库: https://github.com/evergreen198/NoteBook
- Railway 控制台: https://railway.app/
- 备份脚本: `scripts/backup-pg.mjs`
