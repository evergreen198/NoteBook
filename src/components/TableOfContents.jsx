/**
 * 目录导航组件
 * 显示笔记的多级标题,支持点击跳转
 */
export default function TableOfContents({ headings, activeId, onItemClick }) {
  if (!headings || headings.length === 0) {
    return (
      <aside className="toc">
        <div className="toc-header">目录</div>
        <div className="toc-empty">

        </div>
      </aside>
    );
  }

  return (
    <aside className="toc">
      <div className="toc-header">目录</div>
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
    </aside>
  );
}
