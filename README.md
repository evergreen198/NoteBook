# Notebook — 端到端加密的个人笔记本

一个**零知识架构**的个人笔记应用:笔记在你的浏览器里加密后才上传,服务器和数据库里存的全是密文。即使数据库泄露,没有你的密码也无法读出任何内容。

## 特性

-**端到端加密(E2EE)**:PBKDF2-SHA256(60 万次迭代)从密码派生 AES-256-GCM 密钥,加解密全部在浏览器完成
-**服务器零知识**:服务器只存密文 + IV,密钥从不离开浏览器(仅以原始字节暂存 sessionStorage,关闭标签页即清除)
-**认证体系**:bcrypt 哈希密码 + JWT(httpOnly Cookie,防 XSS 窃取)
-**Markdown 支持**:marked 渲染 + DOMPurify 消毒(防 XSS)
-**轻量部署**:Express + PostgreSQL,支持 Railway 等云平台一键部署
-**界面**:React 18,白底 + 淡暖黄的"线性美学"设计
-**可拓展**:数据按用户隔离,默认单用户(注册后可关闭注册),也支持多用户

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5,Web Crypto API(零加密依赖) |
| 后端 | Node.js + Express 4 |
| 数据库 | PostgreSQL(pg) |
| 认证 | bcryptjs + jsonwebtoken(httpOnly Cookie) |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
#    编辑 .env,务必把 JWT_SECRET 改成长随机串:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. 开发模式(同时起后端 :3001 和前端 :5173,前端代理 API)
npm run dev
```

打开 http://localhost:5173 → 注册账号 → 开始写笔记。

## 生产部署

```bash
# 构建前端到 dist/,然后由 Express 统一伺服(API + 静态文件,单端口)
npm run build
npm start          # NODE_ENV=production,Cookie 自动加 Secure(需 HTTPS)
```

访问 http://localhost:3001 即可。**单用户模式**:注册完自己的账号后,把 `.env` 里 `ALLOW_REGISTRATION=false` 并重启,注册接口随即关闭。

### 部署注意事项

- **必须 HTTPS**:生产环境 Cookie 带 `Secure` 标记,且 E2EE 密钥只在浏览器内存/sessionStorage;请放在 Nginx/Caddy 反代之后或直接用支持 TLS 的平台。
- **数据备份**:使用 `pg_dump` 或在 Railway 控制台导出数据库快照。
- **忘记密码 = 数据不可恢复**:这是零知识加密的固有属性,请在界面和心里都牢记。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册(提交 `salt`),受 `ALLOW_REGISTRATION` 控制 |
| POST | `/api/auth/login` | 登录,返回用户 `salt` 供前端派生密钥 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前登录用户 |
| GET | `/api/notes` | 笔记列表(密文) |
| POST | `/api/notes` | 新建笔记(提交 `ciphertext` + `iv`) |
| PUT | `/api/notes/:id` | 更新笔记 |
| DELETE | `/api/notes/:id` | 删除笔记 |

所有笔记接口需登录,且严格按 `user_id` 隔离。

## 加密流程

```
注册: 浏览器生成随机 salt → 上传 { username, bcrypt(密码) 由服务器完成, salt }
登录: 服务器返回 salt → 浏览器 PBKDF2(密码, salt, 600k) → AES-256-GCM 密钥
写入: encryptNote(密钥, {title, content}) → { ciphertext, iv } → 上传
读取: 下载密文 → decryptNote(密钥, ciphertext, iv) → 明文只存在于浏览器
```

- 密钥不可导出地派生,仅在关闭标签页前以原始字节缓存于 `sessionStorage` 供刷新恢复。
- GCM 自带完整性校验:篡改密文或密钥错误都会导致解密失败(已在测试中验证)。

## 测试

```bash
# 先启动服务器(npm run dev:server),再运行端到端 API 测试(18 项)
node scripts/test-api.mjs
```

覆盖:未授权拦截、注册/登录/登出、错误密码、笔记 CRUD、多用户隔离、重复用户名、非法 salt。

## 项目结构

```
├── index.html / vite.config.js   # 前端入口与构建配置
├── src/
│   ├── main.jsx / App.jsx        # React 入口与路由
│   ├── crypto.js                 # ★ 端到端加密模块(Web Crypto)
│   ├── api.js                    # 前端 API 封装
│   ├── pages/AuthPage.jsx        # 登录/注册
│   ├── pages/NotesPage.jsx       # 笔记列表 + 编辑器
│   └── styles.css                # 线性美学样式
├── server/
│   ├── index.js                  # Express 入口(API + 静态伺服)
│   ├── db.js                     # PostgreSQL 连接池与 Schema
│   ├── auth.js                   # JWT 中间件
│   └── routes/auth.js, notes.js  # 路由
├── scripts/test-api.mjs          # API 端到端测试
├── scripts/export-db.mjs         # 数据导出脚本
├── scripts/import-to-pg.mjs      # PostgreSQL 导入脚本
└── .env.example                  # 环境变量模板
```

## 免责声明

个人学习/自用项目。密码学实现基于标准 Web Crypto API,但未经过第三方安全审计,请勿用于高敏感场景。
