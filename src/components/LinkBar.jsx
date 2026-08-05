/**
 * 底部关联编辑栏
 *
 * 两种模式:
 * - editing: 关联编辑模式,显示 [选中] [删除组] [√] [×]
 * - view:    查看模式(点击划线文字),显示 [编辑此组] 入口
 *
 * Props:
 *   mode: 'editing' | 'view'
 *   linkType: 'same' | 'related'  (决定提示文案和高亮颜色)
 *   canAddText: bool  (当前是否有选中文字可加入组)
 *   onAddText: fn     (点"选中",把当前选区文字加入组)
 *   onDeleteGroup: fn (点"删除组")
 *   onConfirm: fn     (点"√")
 *   onCancel: fn      (点"×")
 *   onEditGroup: fn   (点"编辑此组", view 模式)
 *   onClose: fn       (点"×"关闭 view 模式)
 */
export default function LinkBar({
  mode,
  linkType,
  canAddText,
  onAddText,
  onDeleteGroup,
  onConfirm,
  onCancel,
  onEditGroup,
  onClose,
}) {
  const colorClass = linkType === 'same' ? 'link-bar-green' : 'link-bar-blue';
  const typeLabel = linkType === 'same' ? '同一对象' : '相关对象';

  return (
    <div className={`link-bar ${colorClass}`}>
      {mode === 'editing' ? (
        <>
          <span className="link-bar-label">
            关联编辑 · {typeLabel}
          </span>
          <div className="link-bar-actions">
            <button
              className="link-bar-btn"
              onClick={onAddText}
              disabled={!canAddText}
              title={canAddText ? '将选中文字加入组' : '请先在编辑器中选中文字'}
            >
              选中
            </button>
            <button className="link-bar-btn link-bar-danger" onClick={onDeleteGroup}>
              删除组
            </button>
            <button className="link-bar-btn link-bar-confirm" onClick={onConfirm} title="确定保存">
              √
            </button>
            <button className="link-bar-btn link-bar-cancel" onClick={onCancel} title="取消编辑">
              ×
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="link-bar-label">
            {typeLabel}关联组
          </span>
          <div className="link-bar-actions">
            <button className="link-bar-btn" onClick={onEditGroup}>
              编辑此组
            </button>
            <button className="link-bar-btn link-bar-cancel" onClick={onClose} title="关闭">
              ×
            </button>
          </div>
        </>
      )}
    </div>
  );
}
