/**
 * Yet To Bat Grid Component
 * Shows players who haven't batted yet with avatars and career averages
 */

interface YetToBatGridProps {
  yetToBat: Array<{ playerId: string; name: string }>
  playingXI: Array<{
    playerId?: string
    id?: string
    name: string
    photo?: string
    role?: string
  }>
  batsmanStats: Array<{
    batsmanId: string
    batsmanName: string
    runs: number
    balls: number
  }>
  squad?: {
    players?: Array<{
      id: string
      name: string
      photo?: string
      battingAverage?: number
      careerStats?: {
        batting?: {
          average?: number
        }
      }
    }>
  }
}

const YetToBatGrid = ({ yetToBat, playingXI, batsmanStats, squad }: YetToBatGridProps) => {
  // Get list of players who have batted (by ID)
  const battedPlayerIds = new Set(
    batsmanStats.map((b) => b.batsmanId).filter(Boolean)
  )

  // Get players who haven't batted yet
  const playersYetToBat = playingXI.filter((player) => {
    const playerId = player.playerId || player.id
    return playerId && !battedPlayerIds.has(playerId)
  })

  if (playersYetToBat.length === 0) {
    return null
  }

  // Get player data from squad for averages and photos
  const getPlayerData = (playerId: string) => {
    if (!squad?.players) return null
    return squad.players.find((p) => p.id === playerId)
  }

  // Calculate average from career stats or use provided average
  const getAverage = (playerId: string): number | null => {
    const playerData = getPlayerData(playerId)
    if (playerData?.battingAverage) return playerData.battingAverage
    if (playerData?.careerStats?.batting?.average) {
      return playerData.careerStats.batting.average
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Yet to bat</h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {playersYetToBat.map((player) => {
            const playerId = player.playerId || player.id
            const playerData = getPlayerData(playerId || '')
            const photo = player.photo || playerData?.photo
            const average = playerId ? getAverage(playerId) : null

            return (
              <div
                key={playerId || player.name}
                className="flex flex-col items-center"
              >
                {/* Avatar - Smaller size like CREX */}
                {photo ? (
                  <img
                    src={photo}
                    alt={player.name}
                    className="w-12 h-12 rounded-full object-cover border border-gray-200 mb-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm border border-gray-200 mb-1">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Name */}
                <div className="text-xs font-medium text-gray-900 text-center mb-0.5">
                  {player.name}
                </div>

                {/* Average */}
                {average !== null ? (
                  <div className="text-xs text-gray-500">
                    Avg: {average.toFixed(1)}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">—</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default YetToBatGrid

