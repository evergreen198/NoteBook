import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api } from '../api.js';
import { encryptNote, decryptNote } from '../crypto.js';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text) {
  return { __html: DOMPurify.sanitize(marked.parse(text || '')) };
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotesPage({ username, cryptoKey, onLogout }) {
  const [notes, setNotes] = useState([]); // [{ id, title, content, updated_at }]
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const saveTimer = useRef(null);
  const tickTimer = useRef(null);

  /** 加载并解密全部笔记 */
  useEffect(() => {
    (async () => {
      try {
        const { notes: raw } = await api.listNotes();
        const decrypted = [];
        for (const n of raw) {
          try {
            const { title, content } = await decryptNote(cryptoKey, n.ciphertext, n.iv);
            decrypted.push({ id: n.id, title, content, updated_at: n.updated_at });
          } catch {
            decrypted.push({
              id: n.id,
              title: '⚠ 无法解密',
              content: '',
              updated_at: n.updated_at,
              broken: true,
            });
          }
        }
        setNotes(decrypted);
        if (decrypted.length > 0) {
          setSelectedId(decrypted[0].id);
          setDraft({ title: decrypted[0].title, content: decrypted[0].content });
        }
      } catch (err) {
        setLoadError(err.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 保存(新建或更新) */
  const save = useCallback(async () => {
    const id = selectedIdRef.current;
    const { title, content } = draftRef.current;
    if (!dirtyRef.current || saving) return;
    if (!id && !title.trim() && !content.trim()) return;

    setSaving(true);
    try {
      const payload = await encryptNote(cryptoKey, { title, content });
      if (id) {
        const { note } = await api.updateNote(id, payload);
        setNotes((prev) =>
          prev
            .map((n) => (n.id === id ? { ...n, title, content, updated_at: note.updated_at } : n))
            .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        );
      } else {
        const { note } = await api.createNote(payload);
        const item = { id: note.id, title, content, updated_at: note.updated_at };
        setNotes((prev) => [item, ...prev]);
        setSelectedId(note.id);
      }
      setDirty(false);
      setSavedTick(true);
      clearTimeout(tickTimer.current);
      tickTimer.current = setTimeout(() => setSavedTick(false), 1500);
    } catch (err) {
      alert('保存失败:' + err.message);
    } finally {
      setSaving(false);
    }
  }, [cryptoKey, saving]);

  /** 内容变化:标脏 + 1.5s 防抖自动保存 */
  function updateDraft(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 1500);
  }

  /** 切换笔记(先保存当前) */
  async function selectNote(note) {
    if (note.id === selectedId) return;
    clearTimeout(saveTimer.current);
    await save();
    setConfirmDelete(false);
    setSelectedId(note.id);
    setDraft({ title: note.title, content: note.content });
    setDirty(false);
    setPreview(false);
  }

  /** 新建 */
  async function createNote() {
    clearTimeout(saveTimer.current);
    await save();
    setConfirmDelete(false);
    setSelectedId(null);
    setDraft({ title: '', content: '' });
    setDirty(false);
    setPreview(false);
  }

  /** 删除 */
  async function removeNote() {
    if (!selectedId) return;
    try {
      await api.deleteNote(selectedId);
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== selectedId);
        if (next.length > 0) {
          setSelectedId(next[0].id);
          setDraft({ title: next[0].title, content: next[0].content });
        } else {
          setSelectedId(null);
          setDraft({ title: '', content: '' });
        }
        return next;
      });
      setDirty(false);
      setConfirmDelete(false);
    } catch (err) {
      alert('删除失败:' + err.message);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-mark" />
        <p className="boot-text">正在解密笔记…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="boot">
        <p className="form-error">加载失败:{loadError}</p>
        <button className="btn-ghost" onClick={onLogout}>退出登录</button>
      </div>
    );
  }

  const selectedExists = selectedId !== null;

  return (
    <div className="layout">
      {/* ===== 顶栏 ===== */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-name">Notebook</span>
          <span className="brand-rule" />
        </div>
        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索笔记…"
        />
        <div className="topbar-right">
          <span className="username">{username}</span>
          <button className="btn-ghost" onClick={onLogout}>退出</button>
        </div>
      </header>

      <div className="main">
        {/* ===== 左侧列表 ===== */}
        <aside className="sidebar">
          <button className="btn-new" onClick={createNote}>+ 新建笔记</button>
          <div className="note-list">
            {filtered.length === 0 && (
              <p className="list-empty">{search ? '没有匹配的笔记' : '还没有笔记,开始记录吧'}</p>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                className={`note-item ${n.id === selectedId ? 'active' : ''}`}
                onClick={() => selectNote(n)}
              >
                <span className="note-item-title">{n.title || '无标题'}</span>
                <span className="note-item-meta">{formatTime(n.updated_at)}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ===== 右侧编辑器 ===== */}
        <section className="editor">
          <div className="editor-toolbar">
            <div className="toolbar-left">
              <button
                className={`tab ${!preview ? 'active' : ''}`}
                onClick={() => setPreview(false)}
              >
                编辑
              </button>
              <button
                className={`tab ${preview ? 'active' : ''}`}
                onClick={() => setPreview(true)}
              >
                预览
              </button>
            </div>
            <div className="toolbar-right">
              <span className="save-status">
                {saving ? '保存中…' : savedTick ? '已保存 ✓' : dirty ? '未保存' : ''}
              </span>
              <button className="btn-ghost" onClick={save} disabled={saving || !dirty}>
                保存
              </button>
              {selectedExists &&
                (confirmDelete ? (
                  <>
                    <button className="btn-danger" onClick={removeNote}>确认删除</button>
                    <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>取消</button>
                  </>
                ) : (
                  <button className="btn-ghost" onClick={() => setConfirmDelete(true)}>删除</button>
                ))}
            </div>
          </div>

          {!preview ? (
            <>
              <input
                className="editor-title"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
                placeholder="标题"
                maxLength={200}
              />
              <textarea
                className="editor-content"
                value={draft.content}
                onChange={(e) => updateDraft({ content: e.target.value })}
                placeholder="开始书写… 支持 Markdown 语法"
              />
            </>
          ) : (
            <div className="preview">
              <h1 className="preview-title">{draft.title || '无标题'}</h1>
              <div
                className="markdown"
                dangerouslySetInnerHTML={renderMarkdown(draft.content)}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
