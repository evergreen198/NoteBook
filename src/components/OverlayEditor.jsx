import { useRef, useEffect, useCallback, useMemo } from 'react';
import { findAllMatches } from '../utils/links.js';

/**
 * 双层叠加编辑器
 *
 * 底层: 渲染层 (div) — 显示带虚线下划线/高亮的文字
 * 顶层: textarea (文字透明) — 负责输入、光标、选区
 *
 * Props:
 *   value: string
 *   onChange: fn(e)
 *   placeholder: string
 *   links: array          — 关联组数组
 *   activeLinkId: string|null  — 当前高亮的组 ID
 *   onSelectPosition: fn(start, end)  — 选区变化回调
 *   onClickPosition: fn(pos)  — 点击位置回调
 *   textareaRef: ref      — 暴露给父组件操作选区
 */
export default function OverlayEditor({
  value,
  onChange,
  placeholder,
  links,
  activeLinkId,
  onSelectPosition,
  onClickPosition,
  textareaRef: externalRef,
}) {
  const internalRef = useRef(null);
  const renderRef = useRef(null);
  const taRef = externalRef || internalRef;

  /** 计算所有匹配位置 */
  const matches = useMemo(() => findAllMatches(value, links), [value, links]);

  /** 同步滚动: textarea 滚动时渲染层同步 */
  const handleScroll = useCallback(() => {
    const ta = taRef.current;
    const rd = renderRef.current;
    if (ta && rd) {
      rd.scrollTop = ta.scrollTop;
    }
  }, [taRef]);

  /** 选区变化时通知父组件 */
  const handleSelect = useCallback(() => {
    const ta = taRef.current;
    if (ta && onSelectPosition) {
      onSelectPosition(ta.selectionStart, ta.selectionEnd);
    }
  }, [taRef, onSelectPosition]);

  /** 点击时通知父组件点击位置 */
  const handleClick = useCallback(() => {
    const ta = taRef.current;
    if (ta && onClickPosition) {
      onClickPosition(ta.selectionStart);
    }
  }, [taRef, onClickPosition]);

  /** 构建渲染层的 HTML */
  const renderHtml = useMemo(() => {
    if (!value) return '<span class="overlay-placeholder">' + escapeHtml(placeholder || '') + '</span>';

    let html = '';
    let lastIdx = 0;

    for (const m of matches) {
      // 普通文字
      if (m.start > lastIdx) {
        html += escapeHtml(value.slice(lastIdx, m.start));
      }
      // 关联文字
      const isActive = m.linkId === activeLinkId;
      const classes = ['overlay-link', `overlay-${m.color}`];
      if (isActive) classes.push('overlay-active');
      html += `<span class="${classes.join(' ')}" data-link-id="${m.linkId}">${escapeHtml(m.text)}</span>`;
      lastIdx = m.end;
    }

    // 剩余文字
    if (lastIdx < value.length) {
      html += escapeHtml(value.slice(lastIdx));
    }

    return html;
  }, [value, matches, activeLinkId, placeholder]);

  /** 渲染层滚动同步(初始) */
  useEffect(() => {
    handleScroll();
  }, [value, handleScroll]);

  return (
    <div className="overlay-editor">
      {/* 底层渲染 */}
      <div
        ref={renderRef}
        className="overlay-render"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: renderHtml }}
      />
      {/* 顶层 textarea (文字透明) */}
      <textarea
        ref={taRef}
        className="overlay-textarea"
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        onSelect={handleSelect}
        onClick={handleClick}
        placeholder=""
        spellCheck={false}
      />
    </div>
  );
}

function escapeHtml(str) {
  var amp = String.fromCharCode(38);
  return str
    .replace(/&/g, amp + 'amp;')
    .replace(/</g, amp + 'lt;')
    .replace(/>/g, amp + 'gt;')
    .replace(/"/g, amp + 'quot;')
    .replace(/\n/g, '<br>');
}
