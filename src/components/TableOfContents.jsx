/**
 * 目录导航组件
 * 显示笔记的多级标题,支持点击跳转、收起/展开
 */
export default function TableOfContents({ headings, activeId, onItemClick, collapsed, onToggle }) {
  /** 收起状态: 显示一条细边条,点击展开 */
  if (collapsed) {
    return (
      <button
        className="toc-expand-strip"
        onClick={onToggle}
        title="展开目录"
        aria-label="展开目录"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    );
  }

  const empty = !headings || headings.length === 0;

  return (
    <aside className="toc">
      <div className="toc-header">
        <span>目录</span>
        <button
          className="toc-toggle"
          onClick={onToggle}
          title="收起目录"
          aria-label="收起目录"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      {empty ? (
        <div className="toc-empty">
         
        </div>
      ) : (
        <nav className="toc-list">
          {headings.map((heading) => (
            <button
              key={heading.id}
              className={`toc-item toc-level-${heading.level} ${
                heading.id === activeId ? 'active' : ''
              }`}
              onClick={() => onItemClick(heading)}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
