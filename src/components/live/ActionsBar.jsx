/**
 * Actions Bar Component
 * Undo, Edit, Add ball buttons + Live match tags
 */

const ActionsBar = ({
  onUndo,
  onEdit,
  onAddBall,
  showAddBall = true,
  oversLeft,
  ballsRemaining,
  canUndo = true,
  canEdit = true,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Action Buttons - Only show if user is admin (showAddBall = true) */}
        {showAddBall && (
          <div className="flex items-center gap-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                canUndo
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              ↶ Undo Last Ball
            </button>
            <button
              onClick={onEdit}
              disabled={!canEdit}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                canEdit
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              ✏️ Edit Last Ball
            </button>
            {onAddBall && (
              <button
                onClick={onAddBall}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-black text-white hover:bg-gray-900 transition-all shadow-sm border border-gray-700"
              >
                + Add Ball
              </button>
            )}
          </div>
        )}

        {/* Live Match Tags */}
        <div className="flex items-center gap-3">
          {oversLeft !== undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="text-xs text-slate-600 font-medium">Overs Left:</span>
              <span className="text-sm font-bold text-slate-900">{oversLeft.toFixed(1)}</span>
            </div>
          )}
          {ballsRemaining !== undefined && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
              <span className="text-xs text-slate-600 font-medium">Balls Remaining:</span>
              <span className="text-sm font-bold text-slate-900">{ballsRemaining}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ActionsBar

