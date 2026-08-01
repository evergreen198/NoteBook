import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const MAX_PAYLOAD = 512 * 1024; // 单条笔记密文最大 512KB

function isValidPayload(ciphertext, iv) {
  return (
    typeof ciphertext === 'string' &&
    typeof iv === 'string' &&
    /^[a-f0-9]{24}$/.test(iv) &&
    ciphertext.length > 0 &&
    ciphertext.length <= MAX_PAYLOAD * 2 // hex 编码后长度翻倍
  );
}

/** 列表(最新更新的在前) */
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, ciphertext, iv, created_at, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC, id DESC',
      [req.user.uid]
    );
    res.json({ notes: rows });
  } catch (err) {
    console.error('获取笔记列表错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/** 新建 */
router.post('/', async (req, res) => {
  const { ciphertext, iv } = req.body ?? {};
  if (!isValidPayload(ciphertext, iv)) {
    return res.status(400).json({ error: '笔记数据格式不正确' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO notes (user_id, ciphertext, iv) VALUES ($1, $2, $3) RETURNING id, ciphertext, iv, created_at, updated_at',
      [req.user.uid, ciphertext, iv]
    );
    res.status(201).json({ note: rows[0] });
  } catch (err) {
    console.error('创建笔记错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/** 更新(仅本人) */
router.put('/:id', async (req, res) => {
  const { ciphertext, iv } = req.body ?? {};
  if (!isValidPayload(ciphertext, iv)) {
    return res.status(400).json({ error: '笔记数据格式不正确' });
  }
  try {
    const { rows } = await db.query(
      `UPDATE notes SET ciphertext = $1, iv = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, ciphertext, iv, created_at, updated_at`,
      [ciphertext, iv, req.params.id, req.user.uid]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    res.json({ note: rows[0] });
  } catch (err) {
    console.error('更新笔记错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

/** 删除(仅本人) */
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.uid]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: '笔记不存在' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('删除笔记错误:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

export default router;
