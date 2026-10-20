export default function UndoToast({ undoItem, onUndo }) {
  if (!undoItem) return null
  return (
    <div role="status" className="undo-toast">
      <span>{undoItem.message}</span>
      <span aria-hidden="true">·</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  )
}
