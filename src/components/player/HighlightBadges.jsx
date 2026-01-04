/**
 * Highlight Badges Component
 * Shows player achievements and rankings
 */
const HighlightBadges = ({ player, stats, allPlayersStats = [] }) => {
  const badges = []

  // Calculate rankings if we have all players stats
  if (allPlayersStats.length > 0 && stats) {
    // Top Batter by runs
    const sortedByRuns = [...allPlayersStats].sort((a, b) => (b.batting?.runs || 0) - (a.batting?.runs || 0))
    const runsRank = sortedByRuns.findIndex(p => p.playerId === player.id) + 1
    if (runsRank === 1 && stats.batting?.runs > 0) {
      badges.push({
        text: '#1 Batter in School Cricket',
        color: 'from-yellow-500 to-orange-500',
        icon: '🏆',
      })
    }

    // Top All-rounder (runs + wickets)
    const sortedByAllRound = [...allPlayersStats].sort((a, b) => {
      const aTotal = (a.batting?.runs || 0) + (a.bowling?.wickets || 0) * 20
      const bTotal = (b.batting?.runs || 0) + (b.bowling?.wickets || 0) * 20
      return bTotal - aTotal
    })
    const allRoundRank = sortedByAllRound.findIndex(p => p.playerId === player.id) + 1
    if (allRoundRank === 1 && (stats.batting?.runs > 0 || stats.bowling?.wickets > 0)) {
      badges.push({
        text: '#Top All-rounder of 2025',
        color: 'from-purple-500 to-pink-500',
        icon: '⭐',
      })
    }

    // Top Wicket Taker
    const sortedByWickets = [...allPlayersStats].sort((a, b) => (b.bowling?.wickets || 0) - (a.bowling?.wickets || 0))
    const wicketsRank = sortedByWickets.findIndex(p => p.playerId === player.id) + 1
    if (wicketsRank === 1 && stats.bowling?.wickets > 0) {
      badges.push({
        text: '#1 Wicket Taker',
        color: 'from-blue-500 to-cyan-500',
        icon: '🎯',
      })
    }
  }

  // High average badge
  if (stats.batting?.average && stats.batting.average > 30 && stats.batting.innings >= 5) {
    badges.push({
      text: `Avg ${stats.batting.average.toFixed(1)}`,
      color: 'from-green-500 to-emerald-500',
      icon: '📈',
    })
  }

  if (badges.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-3">
        {badges.map((badge, idx) => (
          <div
            key={idx}
            className={`bg-gradient-to-r ${badge.color} text-white px-4 py-2 rounded-full text-sm font-semibold shadow-md flex items-center gap-2`}
          >
            <span>{badge.icon}</span>
            <span>{badge.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HighlightBadges

