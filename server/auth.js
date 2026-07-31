import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'change-me-to-a-long-random-string') {
  console.warn('[安全提示] JWT_SECRET 未配置或仍为默认值,请在 .env 中设置随机字符串!');
}

export const COOKIE_NAME = 'token';
export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  path: '/',
};

export function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

/** Express 中间件:验证 JWT Cookie,通过后将 req.user = { uid, username } */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { uid: payload.uid, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期,请重新登录' });
  }
}
