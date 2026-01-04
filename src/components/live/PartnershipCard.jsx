/**
 * Partnership Card Component
 * Shows current partnership stats
 */
const PartnershipCard = ({ partnership, lastWicket }) => {
  const runs = partnership?.runs || 0
  const balls = partnership?.balls || 0
  const overs = balls > 0 ? `${Math.floor(balls / 6)}.${balls % 6}` : '0.0'

  return (
    <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 rounded-xl shadow-lg p-5 border-2 border-emerald-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">PT</span>
          </div>
          <h3 className="text-base font-bold text-emerald-900">Partnership</h3>
        </div>
        <div className="text-xs text-emerald-700 font-medium bg-emerald-200/50 px-2 py-1 rounded">Since last wicket</div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1">Runs</div>
          <div className="text-3xl font-extrabold text-slate-900">{runs}</div>
        </div>
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1">Balls</div>
          <div className="text-3xl font-extrabold text-slate-900">{balls}</div>
        </div>
        <div className="bg-white/70 rounded-lg p-3 text-center">
          <div className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold mb-1">Overs</div>
          <div className="text-3xl font-extrabold text-slate-900">{overs}</div>
        </div>
      </div>

      {lastWicket && (
        <div className="mt-4 pt-4 border-t-2 border-emerald-200 bg-white/40 rounded-lg p-3">
          <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wide mb-1">Last Wicket</div>
          <div className="text-sm font-bold text-slate-800">
            {lastWicket.batsman || 'Unknown'} <span className="text-slate-600 font-normal">{lastWicket.runs || 0} ({lastWicket.balls || 0})</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default PartnershipCard

