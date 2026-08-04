import { useState } from 'react';

/**
 * 浮动目录按钮(窄屏使用)
 * 点击展开/收起目录抽屉
 */
export default function TocFab({ headings, activeId, onItemClick }) {
  const [open, setOpen] = useState(false);

  const handleItemClick = (heading) => {
    onItemClick(heading);
    setOpen(false); // 点击后关闭抽屉
  };

  return (
    <>
      {/* 浮动按钮 */}
      <button
        className="toc-fab"
        onClick={() => setOpen(!open)}
        aria-label="打开目录"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="15" y2="12" />
          <line x1="3" y1="18" x2="18" y2="18" />
        </svg>
      </button>

      {/* 抽屉式目录 */}
      {open && (
        <>
          <div className="toc-drawer-overlay" onClick={() => setOpen(false)} />
          <div className="toc-drawer">
            <div className="toc-drawer-header">
              <span>目录</span>
              <button
                className="toc-drawer-close"
                onClick={() => setOpen(false)}
                aria-label="关闭目录"
              >
                ×
              </button>
            </div>
            <nav className="toc-drawer-list">
              {headings.length === 0 ? (
                <p className="toc-empty">暂无标题</p>
              ) : (
                headings.map((heading) => (
                  <button
                    key={heading.id}
                    className={`toc-item toc-level-${heading.level} ${
                      heading.id === activeId ? 'active' : ''
                    }`}
                    onClick={() => handleItemClick(heading)}
                  >
                    {heading.text}
                  </button>
                ))
              )}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
