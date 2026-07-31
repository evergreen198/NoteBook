import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import cors from 'cors'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use(cors({
  origin: "https://note-book-gamma-five.vercel.app/"
}));
// API 404
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));

// 生产模式:托管前端打包产物
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// 统一错误处理
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`[notebook] 服务器已启动: http://localhost:${PORT}`);
  console.log(
    `[notebook] 注册开关: ${process.env.ALLOW_REGISTRATION !== 'false' ? '开放' : '关闭'}`
  );
});
