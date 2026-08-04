/**
 * 从 Markdown 文本中提取标题(H1-H5)
 * @param {string} markdown - Markdown 文本
 * @returns {Array} 标题数组 [{ level, text, id, line }]
 */
export function extractHeadings(markdown) {
  if (!markdown) return [];
  
  const lines = markdown.split('\n');
  const headings = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // 匹配 H1-H5: # 标题, ## 标题, ..., ##### 标题
    const match = line.match(/^(#{1,5})\s+(.+)$/);
    
    if (match) {
      const level = match[1].length; // 1-5
      const text = match[2].trim();
      const id = generateHeadingId(text, headings.length);
      
      headings.push({
        level,
        text,
        id,
        line: i
      });
    }
  }
  
  return headings;
}

/**
 * 生成标题的唯一 ID
 * @param {string} text - 标题文本
 * @param {number} index - 索引
 * @returns {string} 唯一 ID
 */
function generateHeadingId(text, index) {
  // 转换为 slug: 小写,空格和特殊字符转为连字符
  const slug = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-') // 保留中文、英文、数字
    .replace(/^-+|-+$/g, ''); // 去除首尾连字符
  
  return `heading-${index}-${slug || 'untitled'}`;
}

/**
 * 为 Markdown 渲染的 HTML 中的标题添加 ID
 * @param {string} html - 渲染后的 HTML
 * @param {Array} headings - 标题数组
 * @returns {string} 添加 ID 后的 HTML
 */
export function addHeadingIds(html, headings) {
  let result = html;
  
  headings.forEach((heading) => {
    // 匹配 <h1>文本</h1>, <h2>文本</h2> 等
    const regex = new RegExp(
      `<h${heading.level}>${escapeRegex(heading.text)}</h${heading.level}>`,
      'g'
    );
    
    result = result.replace(
      regex,
      `<h${heading.level} id="${heading.id}">${heading.text}</h${heading.level}>`
    );
  });
  
  return result;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 滚动到指定标题
 * @param {string} id - 标题 ID
 */
export function scrollToHeading(id) {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start',
      inline: 'nearest'
    });
  }
}
