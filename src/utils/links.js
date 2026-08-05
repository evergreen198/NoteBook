/**
 * 句段关联数据工具
 *
 * 数据格式:
 * links: [
 *   { id: 'l1', type: 'same',    texts: ['机器学习'],              color: 'green' },
 *   { id: 'l2', type: 'related', texts: ['机器学习','深度学习'],   color: 'blue'  }
 * ]
 *
 * - same:    同一对象,自动匹配全文所有相同文字
 * - related: 相关对象,组内多个不同文字,手动添加
 */

let _nextId = 1;

/** 生成唯一 ID */
export function genLinkId() {
  return 'link_' + Date.now() + '_' + _nextId++;
}

/** 创建 same 类型关联组 */
export function createSameLink(text) {
  return { id: genLinkId(), type: 'same', texts: [text], color: 'green' };
}

/** 创建 related 类型关联组 */
export function createRelatedLink(text) {
  return { id: genLinkId(), type: 'related', texts: [text], color: 'blue' };
}

/**
 * 在文本中查找某个词的所有出现位置
 * 返回 [{ start, end, text }]
 */
export function findOccurrences(content, text) {
  if (!content || !text) return [];
  const results = [];
  let idx = 0;
  while (true) {
    idx = content.indexOf(text, idx);
    if (idx === -1) break;
    results.push({ start: idx, end: idx + text.length, text });
    idx += text.length;
  }
  return results;
}

/**
 * 获取所有关联组在文本中的所有匹配位置(用于渲染虚线)
 * 返回 [{ start, end, text, linkId, color, type }]
 */
export function findAllMatches(content, links) {
  if (!content || !links || links.length === 0) return [];
  const matches = [];

  for (const link of links) {
    if (link.type === 'same') {
      // same: 匹配全文所有相同文字
      const text = link.texts[0];
      if (!text) continue;
      const occurrences = findOccurrences(content, text);
      for (const occ of occurrences) {
        matches.push({ ...occ, linkId: link.id, color: link.color, type: link.type });
      }
    } else {
      // related: 匹配组内每个文字
      for (const text of link.texts) {
        if (!text) continue;
        const occurrences = findOccurrences(content, text);
        for (const occ of occurrences) {
          matches.push({ ...occ, linkId: link.id, color: link.color, type: link.type });
        }
      }
    }
  }

  // 按 start 排序,方便渲染
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * 检查某个位置是否在某个关联组内
 * 返回所在的 linkId 或 null
 */
export function getLinkIdAtPosition(matches, position) {
  for (const m of matches) {
    if (position >= m.start && position < m.end) {
      return m.linkId;
    }
  }
  return null;
}

/**
 * 根据 linkId 获取该组的所有匹配位置
 */
export function getMatchesByLinkId(matches, linkId) {
  return matches.filter((m) => m.linkId === linkId);
}

/**
 * 清理空组(texts 为空或全部文字在正文中不存在)
 */
export function cleanupLinks(content, links) {
  return links.filter((link) => {
    if (!link.texts || link.texts.length === 0) return false;
    if (link.type === 'same') {
      return link.texts[0] && content.includes(link.texts[0]);
    }
    // related: 至少有一个文字还存在
    return link.texts.some((t) => t && content.includes(t));
  });
}

/**
 * 从 links 数组中删除指定组
 */
export function removeLink(links, linkId) {
  return links.filter((l) => l.id !== linkId);
}

/**
 * 向组内添加文字(去重)
 */
export function addTextToLink(links, linkId, text) {
  return links.map((l) => {
    if (l.id !== linkId) return l;
    if (l.texts.includes(text)) return l;
    return { ...l, texts: [...l.texts, text] };
  });
}
