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
router.get('/', (req, res) => {
  const notes = db
    .prepare(
      'SELECT id, ciphertext, iv, created_at, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC, id DESC'
    )
    .all(req.user.uid);
  res.json({ notes });
});

/** 新建 */
router.post('/', (req, res) => {
  const { ciphertext, iv } = req.body ?? {};
  if (!isValidPayload(ciphertext, iv)) {
    return res.status(400).json({ error: '笔记数据格式不正确' });
  }
  const result = db
    .prepare('INSERT INTO notes (user_id, ciphertext, iv) VALUES (?, ?, ?)')
    .run(req.user.uid, ciphertext, iv);
  const note = db
    .prepare('SELECT id, ciphertext, iv, created_at, updated_at FROM notes WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ note });
});

/** 更新(仅本人) */
router.put('/:id', (req, res) => {
  const { ciphertext, iv } = req.body ?? {};
  if (!isValidPayload(ciphertext, iv)) {
    return res.status(400).json({ error: '笔记数据格式不正确' });
  }
  const result = db
    .prepare(
      "UPDATE notes SET ciphertext = ?, iv = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
    )
    .run(ciphertext, iv, req.params.id, req.user.uid);
  if (result.changes === 0) {
    return res.status(404).json({ error: '笔记不存在' });
  }
  const note = db
    .prepare('SELECT id, ciphertext, iv, created_at, updated_at FROM notes WHERE id = ?')
    .get(req.params.id);
  res.json({ note });
});

/** 删除(仅本人) */
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.uid);
  if (result.changes === 0) {
    return res.status(404).json({ error: '笔记不存在' });
  }
  res.json({ ok: true });
});

export default router;
