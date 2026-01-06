/**
 * Quick Stats Row Component
 * Striker, Non-Striker, Bowler, Partnership cards
 * Visible without scroll - top-first design
 */

interface PlayerMiniCardProps {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  isStriker?: boolean
  isBowler?: boolean
  overs?: string
  wickets?: number
  economy?: number
  runsConceded?: number
}

const PlayerMiniCard = ({
  name,
  runs,
  balls,
  fours,
  sixes,
  strikeRate,
  isStriker = false,
  isBowler = false,
  overs,
  wickets,
  economy,
  runsConceded,
}: PlayerMiniCardProps) => {
  if (isBowler) {
    return (
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{name}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
              Bowling
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-slate-500 mb-0.5">O</div>
            <div className="font-bold text-slate-900">{overs || '0.0'}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">R</div>
            <div className="font-bold text-slate-900">{runsConceded || 0}</div>
          </div>
          <div>
            <div className="text-slate-500 mb-0.5">W</div>
            <div className="font-bold text-slate-900">{wickets || 0}</div>
          </div>
        </div>
        <div className="mt-2 text-xs">
          <span className="text-slate-500">Econ: </span>
          <span className="font-semibold text-slate-900">{economy?.toFixed(2) || '0.00'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-md border p-4 hover:shadow-lg transition-shadow ${isStriker ? 'border-yellow-300 bg-yellow-50/30' : 'border-slate-200'
      }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">{name}</span>
          {isStriker && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full font-medium">
              On Strike
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-slate-900">{runs}</span>
        <span className="text-sm text-slate-500">({balls})</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <div>
          <span className="text-slate-500">4s: </span>
          <span className="font-semibold text-slate-900">{fours}</span>
        </div>
        <div>
          <span className="text-slate-500">6s: </span>
          <span className="font-semibold text-slate-900">{sixes}</span>
        </div>
        <div>
          <span className="text-slate-500">SR: </span>
          <span className="font-semibold text-slate-900">{strikeRate.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

interface PartnershipCardProps {
  runs: number
  balls: number
  overs: string
  lastWicket?: {
    score: number
    over: string
  }
}

const PartnershipCard = ({ runs, balls, overs, lastWicket }: PartnershipCardProps) => {
  return (
    <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl shadow-md border border-gray-800 p-4 text-white">
      <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
        Partnership
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-white">{runs}</span>
        <span className="text-sm text-gray-400">runs</span>
      </div>
      <div className="text-xs text-gray-400">
        {balls} balls • {overs} overs
      </div>
      {lastWicket && (
        <div className="mt-2 pt-2 border-t border-gray-800 text-xs text-gray-500">
          Last wicket: {lastWicket.score}/{lastWicket.over}
        </div>
      )}
    </div>
  )
}

interface QuickStatsRowProps {
  striker: PlayerMiniCardProps | null
  nonStriker: PlayerMiniCardProps | null
  bowler: PlayerMiniCardProps | null
  partnership: PartnershipCardProps
  recommendedBowler?: {
    name: string
    reason: string
  }
}

const QuickStatsRow = ({
  striker,
  nonStriker,
  bowler,
  partnership,
  recommendedBowler,
}: QuickStatsRowProps) => {
  return (
    <div className="space-y-4">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {striker && (
          <PlayerMiniCard {...striker} isStriker={true} />
        )}
        {nonStriker && (
          <PlayerMiniCard {...nonStriker} />
        )}
        {bowler && (
          <PlayerMiniCard {...bowler} isBowler={true} />
        )}
        <PartnershipCard {...partnership} />
      </div>

      {/* Recommended Bowler (AI Insight) */}
      {recommendedBowler && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="flex items-start gap-2">
            <div className="text-blue-600 text-lg">💡</div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-blue-900 mb-1">AI Recommendation</div>
              <div className="text-sm text-blue-800">
                <span className="font-medium">{recommendedBowler.name}</span>
                {' '}— {recommendedBowler.reason}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickStatsRow

