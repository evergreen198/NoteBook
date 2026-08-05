import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { api } from '../api.js';
import { encryptNote, decryptNote } from '../crypto.js';
import { extractHeadings, addHeadingIds, scrollToHeading } from '../utils/toc.js';
import {
  createSameLink,
  createRelatedLink,
  findAllMatches,
  getLinkIdAtPosition,
  cleanupLinks,
  removeLink,
  addTextToLink,
} from '../utils/links.js';
import TableOfContents from '../components/TableOfContents.jsx';
import TocFab from '../components/TocFab.jsx';
import LinkBar from '../components/LinkBar.jsx';
import OverlayEditor from '../components/OverlayEditor.jsx';

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text, headings) {
  let html = marked.parse(text || '');
  if (headings && headings.length > 0) {
    html = addHeadingIds(html, headings);
  }
  return {
    __html: DOMPurify.sanitize(html, {
      ADD_ATTR: ['id'],
    }),
  };
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotesPage({ username, cryptoKey, onLogout }) {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [links, setLinks] = useState([]); // 关联组
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState('');
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 1200);
  const [tocCollapsed, setTocCollapsed] = useState(
    () => localStorage.getItem('toc-collapsed') === '1'
  );

  // ===== 关联编辑状态 =====
  // linkMode: null | 'editing' | 'view'
  const [linkMode, setLinkMode] = useState(null);
  const [editingLinkId, setEditingLinkId] = useState(null); // 正在编辑/查看的组
  const [activeLinkId, setActiveLinkId] = useState(null);   // 当前高亮的组
  const [selStart, setSelStart] = useState(0);
  const [selEnd, setSelEnd] = useState(0);
  const [linkBackup, setLinkBackup] = useState(null); // 编辑前备份(用于取消)

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const linksRef = useRef(links);
  linksRef.current = links;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const saveTimer = useRef(null);
  const tickTimer = useRef(null);
  const textareaRef = useRef(null);

  /** 提取当前笔记的标题 */
  const headings = useMemo(() => extractHeadings(draft.content), [draft.content]);

  /** 所有匹配位置 */
  const allMatches = useMemo(() => findAllMatches(draft.content, links), [draft.content, links]);

  /** 当前编辑的组 */
  const editingLink = useMemo(
    () => links.find((l) => l.id === editingLinkId) || null,
    [links, editingLinkId]
  );

  /** 当前选区文字 */
  const selectedText = useMemo(() => {
    if (selStart === selEnd) return '';
    return draft.content.slice(selStart, selEnd);
  }, [draft.content, selStart, selEnd]);

  /** 是否有可加入组的选中文字 */
  const canAddText = useMemo(() => {
    if (linkMode !== 'editing' || !selectedText) return false;
    if (!editingLink) return false;
    return !editingLink.texts.includes(selectedText);
  }, [linkMode, selectedText, editingLink]);

  /** 切换目录收起/展开 */
  function toggleToc() {
    setTocCollapsed((prev) => {
      localStorage.setItem('toc-collapsed', prev ? '0' : '1');
      return !prev;
    });
  }

  /** 监听窗口大小变化 */
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1200);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** 监听滚动,高亮当前标题(仅预览模式) */
  useEffect(() => {
    if (!preview || headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHeadingId(entry.target.id);
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );
    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [headings, preview]);

  /** 点击导览项 */
  function handleTocClick(heading) {
    if (!preview) {
      setPreview(true);
      setTimeout(() => scrollToHeading(heading.id), 50);
    } else {
      scrollToHeading(heading.id);
    }
  }

  /** 加载并解密全部笔记 */
  useEffect(() => {
    (async () => {
      try {
        const { notes: raw } = await api.listNotes();
        const decrypted = [];
        for (const n of raw) {
          try {
            const { title, content, links: noteLinks } = await decryptNote(cryptoKey, n.ciphertext, n.iv);
            decrypted.push({
              id: n.id, title, content,
              links: noteLinks || [],
              updated_at: n.updated_at,
            });
          } catch {
            decrypted.push({
              id: n.id, title: '⚠ 无法解密', content: '',
              links: [], updated_at: n.updated_at, broken: true,
            });
          }
        }
        setNotes(decrypted);
        if (decrypted.length > 0) {
          setSelectedId(decrypted[0].id);
          setDraft({ title: decrypted[0].title, content: decrypted[0].content });
          setLinks(decrypted[0].links || []);
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
    const currentLinks = linksRef.current;
    if (!dirtyRef.current || saving) return;
    if (!id && !title.trim() && !content.trim()) return;

    setSaving(true);
    try {
      const cleanedLinks = cleanupLinks(content, currentLinks);
      const payload = await encryptNote(cryptoKey, { title, content, links: cleanedLinks });
      if (id) {
        const { note } = await api.updateNote(id, payload);
        setNotes((prev) =>
          prev
            .map((n) => (n.id === id ? { ...n, title, content, links: cleanedLinks, updated_at: note.updated_at } : n))
            .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
        );
      } else {
        const { note } = await api.createNote(payload);
        const item = { id: note.id, title, content, links: cleanedLinks, updated_at: note.updated_at };
        setNotes((prev) => [item, ...prev]);
        setSelectedId(note.id);
      }
      setLinks(cleanedLinks);
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

  /** 更新关联数据 */
  function updateLinks(newLinks) {
    setLinks(newLinks);
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 1500);
  }

  /** 切换笔记 */
  async function selectNote(note) {
    if (note.id === selectedId) return;
    clearTimeout(saveTimer.current);
    await save();
    setConfirmDelete(false);
    setLinkMode(null);
    setEditingLinkId(null);
    setActiveLinkId(null);
    setSelectedId(note.id);
    setDraft({ title: note.title, content: note.content });
    setLinks(note.links || []);
    setDirty(false);
    setPreview(false);
  }

  /** 新建 */
  async function createNote() {
    clearTimeout(saveTimer.current);
    await save();
    setConfirmDelete(false);
    setLinkMode(null);
    setEditingLinkId(null);
    setActiveLinkId(null);
    setSelectedId(null);
    setDraft({ title: '', content: '' });
    setLinks([]);
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
          setLinks(next[0].links || []);
        } else {
          setSelectedId(null);
          setDraft({ title: '', content: '' });
          setLinks([]);
        }
        return next;
      });
      setDirty(false);
      setConfirmDelete(false);
    } catch (err) {
      alert('删除失败:' + err.message);
    }
  }

  // ===== 关联功能 =====

  /** 进入关联编辑模式 */
  function enterLinkEdit(type) {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    if (s === e) return; // 没有选中文字

    const text = draft.content.slice(s, e);
    if (!text.trim()) return;

    // 如果已经在编辑模式,退出
    if (linkMode === 'editing') {
      cancelLinkEdit();
      return;
    }

    // 创建新组
    const newLink = type === 'same' ? createSameLink(text) : createRelatedLink(text);
    setLinkBackup(null); // 新组无备份
    updateLinks([...links, newLink]);
    setEditingLinkId(newLink.id);
    setActiveLinkId(newLink.id);
    setLinkMode('editing');
  }

  /** 添加选中文字到当前组 */
  function handleAddText() {
    if (!editingLinkId || !selectedText) return;
    updateLinks(addTextToLink(links, editingLinkId, selectedText));
  }

  /** 删除当前组 */
  function handleDeleteGroup() {
    if (!editingLinkId) return;
    if (!window.confirm('确定删除此关联组?')) return;
    updateLinks(removeLink(links, editingLinkId));
    setLinkMode(null);
    setEditingLinkId(null);
    setActiveLinkId(null);
    setLinkBackup(null);
  }

  /** 确认编辑 */
  function handleConfirmLink() {
    setLinkMode(null);
    setEditingLinkId(null);
    setLinkBackup(null);
    // 保持 activeLinkId 让高亮渐隐
    setTimeout(() => setActiveLinkId(null), 300);
  }

  /** 取消编辑 */
  function cancelLinkEdit() {
    if (linkBackup) {
      // 恢复备份
      setLinks(linkBackup);
    } else if (editingLinkId) {
      // 新建的组,直接删除
      setLinks((prev) => removeLink(prev, editingLinkId));
    }
    setLinkMode(null);
    setEditingLinkId(null);
    setActiveLinkId(null);
    setLinkBackup(null);
  }

  /** 点击划线文字(编辑模式) */
  function handleClickPosition(pos) {
    if (linkMode === 'editing') return; // 编辑中不处理

    const linkId = getLinkIdAtPosition(allMatches, pos);
    if (linkId) {
      // 点击了划线文字: 高亮该组 + 显示查看栏
      setActiveLinkId(linkId);
      setEditingLinkId(linkId);
      setLinkMode('view');
    } else {
      // 点击了普通文字: 关闭查看栏
      if (linkMode === 'view') {
        setLinkMode(null);
        setEditingLinkId(null);
        setActiveLinkId(null);
      }
    }
  }

  /** 从查看模式进入编辑模式 */
  function handleEditGroup() {
    if (!editingLinkId) return;
    setLinkBackup([...links]); // 备份当前状态
    setLinkMode('editing');
  }

  /** 关闭查看栏 */
  function handleCloseView() {
    setLinkMode(null);
    setEditingLinkId(null);
    setActiveLinkId(null);
  }

  /** 选区变化回调 */
  function handleSelectPosition(start, end) {
    setSelStart(start);
    setSelEnd(end);
  }

  /** 快捷键监听 */
  useEffect(() => {
    function handleKeyDown(e) {
      // Alt+Q = 同一对象关联
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        enterLinkEdit('same');
      }
      // Alt+W = 相关对象关联
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        enterLinkEdit('related');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkMode, links, draft.content, editingLinkId]);

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
              <OverlayEditor
                value={draft.content}
                onChange={(e) => updateDraft({ content: e.target.value })}
                placeholder="开始书写… 支持 Markdown 语法"
                links={links}
                activeLinkId={activeLinkId}
                onSelectPosition={handleSelectPosition}
                onClickPosition={handleClickPosition}
                textareaRef={textareaRef}
              />
            </>
          ) : (
            <PreviewWithLinks
              draft={draft}
              headings={headings}
              links={links}
              activeLinkId={activeLinkId}
              onClickLink={(linkId) => {
                setActiveLinkId(linkId);
                setEditingLinkId(linkId);
                setLinkMode('view');
              }}
            />
          )}

          {/* ===== 底部关联编辑栏 ===== */}
          {linkMode && (
            <LinkBar
              mode={linkMode}
              linkType={editingLink?.type || 'same'}
              canAddText={canAddText}
              onAddText={handleAddText}
              onDeleteGroup={handleDeleteGroup}
              onConfirm={handleConfirmLink}
              onCancel={cancelLinkEdit}
              onEditGroup={handleEditGroup}
              onClose={handleCloseView}
            />
          )}
        </section>

        {/* ===== 右侧导览 ===== */}
        {!isNarrow ? (
          <TableOfContents
            headings={headings}
            activeId={activeHeadingId}
            onItemClick={handleTocClick}
            collapsed={tocCollapsed}
            onToggle={toggleToc}
          />
        ) : (
          <TocFab
            headings={headings}
            activeId={activeHeadingId}
            onItemClick={handleTocClick}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 预览模式(带关联划线和点击高亮)
 */
function PreviewWithLinks({ draft, headings, links, activeLinkId, onClickLink }) {
  const previewRef = useRef(null);

  // 渲染 Markdown HTML
  const baseHtml = useMemo(() => {
    return renderMarkdown(draft.content, headings).__html;
  }, [draft.content, headings]);

  // 在 HTML 中注入关联划线
  const htmlWithLinks = useMemo(() => {
    if (!links || links.length === 0) return baseHtml;

    // 创建临时 DOM 来操作 HTML
    const div = document.createElement('div');
    div.innerHTML = baseHtml;

    const matches = findAllMatches(draft.content, links);
    if (matches.length === 0) return baseHtml;

    // 遍历所有文本节点,查找并包装关联文字
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    let offset = 0;
    const nodeMap = []; // [{ node, start, end }]
    for (const tn of textNodes) {
      nodeMap.push({ node: tn, start: offset, end: offset + tn.textContent.length });
      offset += tn.textContent.length;
    }

    // 从后往前替换,避免偏移量变化
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      const isActive = m.linkId === activeLinkId;
      const classes = ['preview-link', `preview-${m.color}`];
      if (isActive) classes.push('preview-active');

      // 找到包含此匹配的文本节点
      for (const nm of nodeMap) {
        if (m.start >= nm.start && m.end <= nm.end) {
          const localStart = m.start - nm.start;
          const localEnd = m.end - nm.start;
          const text = nm.node.textContent;
          const before = text.slice(0, localStart);
          const matchText = text.slice(localStart, localEnd);
          const after = text.slice(localEnd);

          const span = document.createElement('span');
          span.className = classes.join(' ');
          span.setAttribute('data-link-id', m.linkId);
          span.textContent = matchText;

          const parent = nm.node.parentNode;
          nm.node.textContent = before;
          parent.insertBefore(span, nm.node.nextSibling);
          if (after) {
            const afterNode = document.createTextNode(after);
            parent.insertBefore(afterNode, span.nextSibling);
          }
          break;
        }
      }
    }

    return div.innerHTML;
  }, [baseHtml, draft.content, links, activeLinkId]);

  // 点击事件委托
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    function handleClick(e) {
      const span = e.target.closest('[data-link-id]');
      if (span) {
        e.preventDefault();
        onClickLink(span.getAttribute('data-link-id'));
      }
    }

    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [onClickLink]);

  return (
    <div className="preview" ref={previewRef}>
      <h1 className="preview-title">{draft.title || '无标题'}</h1>
      <div
        className="markdown"
        dangerouslySetInnerHTML={{ __html: htmlWithLinks }}
      />
    </div>
  );
}
