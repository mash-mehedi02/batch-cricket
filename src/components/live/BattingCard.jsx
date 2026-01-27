/**
 * Batting Card Component
 * Shows current batsman stats
 */
import { Link } from 'react-router-dom'

const BattingCard = ({ player, isStriker = false }) => {
  if (!player) {
    return (
      <div className={`bg-gradient-to-br ${isStriker ? 'from-blue-50 to-blue-100 border-blue-200' : 'from-slate-50 to-slate-100 border-slate-200'} rounded-xl shadow-lg p-5 border-2 border-dashed`}>
        <div className="text-center text-slate-400 text-sm font-medium">No batsman selected</div>
      </div>
    )
  }

  const runs = player.runs || 0
  const balls = player.balls || 0
  const fours = player.fours || 0
  const sixes = player.sixes || 0
  const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00'
  const playerId = player.id || player.playerId || player.batsmanId

  return (
    <div className={`bg-gradient-to-br ${isStriker ? 'from-blue-50 to-blue-100 border-blue-300' : 'from-slate-50 to-slate-100 border-slate-200'} rounded-xl shadow-lg p-5 border-2`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${isStriker ? 'bg-blue-500' : 'bg-slate-400'} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
            {player.name?.charAt(0) || 'B'}
          </div>
          <div>
            {playerId ? (
              <Link
                to={`/players/${playerId}`}
                className="font-bold text-slate-900 text-base hover:text-blue-600 transition-colors"
              >
                {player.name || 'Batsman'}
              </Link>
            ) : (
              <div className="font-bold text-slate-900 text-base">{player.name || 'Batsman'}</div>
            )}
            {isStriker && (
              <div className="text-xs text-blue-600 font-semibold mt-0.5">On Strike</div>
            )}
            {!isStriker && player.role === 'Wicketkeeper' && (
              <div className="text-xs text-slate-500 font-medium mt-0.5">WK</div>
            )}
          </div>
        </div>
        {isStriker && (
          <div className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm">
            Striker
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 text-center bg-white/60 rounded-lg p-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Runs</div>
          <div className="text-xl font-extrabold text-slate-900">
            {runs}
          </div>
          <div className="text-xs text-slate-500 font-medium">({balls}b)</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">4s</div>
          <div className="text-xl font-extrabold text-blue-600">{fours}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">6s</div>
          <div className="text-xl font-extrabold text-green-600">{sixes}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">SR</div>
          <div className="text-xl font-extrabold text-slate-900">{strikeRate}</div>
        </div>
      </div>
    </div>
  )
}

export default BattingCard

