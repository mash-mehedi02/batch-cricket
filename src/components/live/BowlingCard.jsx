/**
 * Bowling Card Component
 * Shows current bowler stats
 */
import { Link } from 'react-router-dom'

const BowlingCard = ({ player }) => {
  if (!player) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-5 border-2 border-dashed border-purple-200">
        <div className="text-center text-slate-400 text-sm font-medium">No bowler selected</div>
      </div>
    )
  }

  const wickets = player.wickets || 0
  const runs = player.runsConceded || 0
  const balls = player.ballsBowled || 0
  const overs = balls > 0 ? `${Math.floor(balls / 6)}.${balls % 6}` : '0.0'
  const economy = balls > 0 ? (runs / (balls / 6)).toFixed(2) : '0.00'
  const playerId = player.id || player.playerId || player.bowlerId

  return (
    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-5 border-2 border-purple-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {player.name?.charAt(0) || 'B'}
          </div>
          <div>
            {playerId ? (
              <Link
                to={`/players/${playerId}`}
                className="font-bold text-slate-900 text-base hover:text-purple-600 transition-colors"
              >
                {player.name || 'Bowler'}
              </Link>
            ) : (
              <div className="font-bold text-slate-900 text-base">{player.name || 'Bowler'}</div>
            )}
            <div className="text-xs text-purple-600 font-semibold mt-0.5">Bowling</div>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide shadow-sm">
          Bowler
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center bg-white/60 rounded-lg p-3">
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">W-R</div>
          <div className="text-xl font-extrabold text-slate-900">
            {wickets}-{runs}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Overs</div>
          <div className="text-xl font-extrabold text-slate-900">{overs}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Econ</div>
          <div className="text-xl font-extrabold text-purple-600">{economy}</div>
        </div>
      </div>
    </div>
  )
}

export default BowlingCard

