/**
 * CREX-Style Quick Stats Row
 * Shows Striker, Non-striker, Current Bowler, Partnership, Recommended Bowler
 */

import PlayerAvatar from '../common/PlayerAvatar'

interface CrexQuickStatsRowProps {
  currentInningsData: any
  playersMap: Map<string, any>
}

export default function CrexQuickStatsRow({
  currentInningsData,
  playersMap,
}: CrexQuickStatsRowProps) {
  const strikerId = currentInningsData?.currentStrikerId
  const nonStrikerId = currentInningsData?.nonStrikerId
  const bowlerId = currentInningsData?.currentBowlerId

  const striker = strikerId ? playersMap.get(strikerId) : null
  const nonStriker = nonStrikerId ? playersMap.get(nonStrikerId) : null
  const bowler = bowlerId ? playersMap.get(bowlerId) : null

  // Get batsman stats from innings
  const strikerStats = currentInningsData?.batsmanStats?.find(
    (b: any) => b.batsmanId === strikerId
  )
  const nonStrikerStats = currentInningsData?.batsmanStats?.find(
    (b: any) => b.batsmanId === nonStrikerId
  )

  // Get bowler stats
  const bowlerStats = currentInningsData?.bowlerStats?.find(
    (b: any) => b.bowlerId === bowlerId
  )

  const partnership = currentInningsData?.partnership || { runs: 0, balls: 0, overs: '0.0' }

  const StatCard = ({
    title,
    playerName,
    player,
    stats,
    isBowler = false,
  }: {
    title: string
    playerName: string | null
    player?: any
    stats?: any
    isBowler?: boolean
  }) => (
    <div className="bg-white rounded-lg p-4 shadow-md border border-crex-gray-200">
      <div className="text-xs text-crex-gray-500 uppercase tracking-wide mb-2">{title}</div>
      {playerName ? (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PlayerAvatar
              photoUrl={player?.photoUrl || (player as any)?.photo}
              name={playerName}
              size="sm"
            />
            <div className="font-semibold text-crex-gray-900 truncate">{playerName}</div>
          </div>
          {stats && (
            <div className="text-sm text-crex-gray-600 mt-2">
              {isBowler ? (
                <>
                  <div>{stats.overs} ({stats.runsConceded}-{stats.wickets})</div>
                  <div className="text-xs text-crex-gray-500">Eco: {stats.economy?.toFixed(2)}</div>
                </>
              ) : (
                <>
                  <div>{stats.runs} ({stats.balls})</div>
                  <div className="text-xs text-crex-gray-500">SR: {stats.strikeRate?.toFixed(2)}</div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-crex-gray-400 text-sm">Not set</div>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <StatCard
        title="Striker"
        playerName={striker?.name || strikerStats?.batsmanName}
        player={striker}
        stats={strikerStats}
      />
      <StatCard
        title="Non-Striker"
        playerName={nonStriker?.name || nonStrikerStats?.batsmanName}
        player={nonStriker}
        stats={nonStrikerStats}
      />
      <StatCard
        title="Bowler"
        playerName={bowler?.name || bowlerStats?.bowlerName}
        player={bowler}
        stats={bowlerStats}
        isBowler={true}
      />
      <div className="bg-white rounded-lg p-4 shadow-md border border-crex-gray-200">
        <div className="text-xs text-crex-gray-500 uppercase tracking-wide mb-2">Partnership</div>
        <div className="text-lg font-bold text-crex-gray-900">
          {partnership.runs} <span className="text-crex-gray-500 text-sm">({partnership.overs})</span>
        </div>
        <div className="text-xs text-crex-gray-500 mt-1">
          {partnership.balls} balls
        </div>
      </div>
      {/* Recommended Bowler - TODO: Implement recommendation logic */}
      <div className="bg-crex-teal/10 rounded-lg p-4 shadow-md border border-crex-teal/20">
        <div className="text-xs text-crex-teal-dark uppercase tracking-wide mb-2">
          Recommended
        </div>
        <div className="text-crex-gray-600 text-sm">
          Next bowler suggestion
        </div>
      </div>
    </div>
  )
}

