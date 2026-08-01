import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth, COOKIE_NAME, COOKIE_OPTS } from '../auth.js';

const router = Router();

const allowRegistration = () => process.env.ALLOW_REGISTRATION !== 'false';

/** 当前登录状态(前端据此决定渲染登录页还是笔记页) */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT username, salt FROM users WHERE id = $1',
      [req.user.uid]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: '用户不存在' });
    res.json({
      username: user.username,
      salt: user.salt,
      registrationOpen: allowRegistration(),
    });
  } catch (err) {
    console.error('GET /me 错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/register', async (req, res) => {
  if (!allowRegistration()) {
    return res.status(403).json({ error: '注册已关闭' });
  }
  const { username, password, salt } = req.body ?? {};

  if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{3,32}$/.test(username.trim())) {
    return res.status(400).json({ error: '用户名需为 3-32 位字母、数字、_ 或 -' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: '密码长度需为 8-128 位' });
  }
  if (typeof salt !== 'string' || !/^[a-f0-9]{32}$/.test(salt)) {
    return res.status(400).json({ error: '加密盐格式不正确' });
  }

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: '用户名已被占用' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash, salt) VALUES ($1, $2, $3) RETURNING id, username',
      [username.trim(), passwordHash, salt]
    );
    const user = rows[0];

    res.cookie(COOKIE_NAME, signToken(user), COOKIE_OPTS);
    res.status(201).json({ username: user.username, salt });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }

  try {
    const { rows } = await db.query(
      'SELECT id, username, password_hash, salt FROM users WHERE username = $1',
      [username.trim()]
    );
    const user = rows[0];

    // 统一错误信息,避免暴露用户名是否存在
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    res.cookie(COOKIE_NAME, signToken(user), COOKIE_OPTS);
    res.json({ username: user.username, salt: user.salt });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

/** 导出全部数据(需登录,用于备份/迁移) */
router.get('/admin/export', requireAuth, async (req, res) => {
  try {
    const { rows: users } = await db.query('SELECT * FROM users');
    const { rows: notes } = await db.query('SELECT * FROM notes');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=notebook_backup_${new Date().toISOString().slice(0,10)}.json`);
    res.json({ exported_at: new Date().toISOString(), version: 1, users, notes });
  } catch (err) {
    console.error('导出错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
