/**
 * Bowling Table Component
 * Professional bowling statistics table
 */

interface Bowler {
  bowlerId: string
  bowlerName: string
  ballsBowled: number
  overs: string
  runsConceded: number
  wickets: number
  economy: number
  average: number | null
  strikeRate: number | null
  maidens?: number
}

interface BowlingTableProps {
  bowlers: Bowler[]
  currentBowlerId?: string
}

const BowlingTable = ({ bowlers, currentBowlerId }: BowlingTableProps) => {
  if (bowlers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No bowling data available</p>
      </div>
    )
  }

  // Sort bowlers by overs bowled (descending)
  const sortedBowlers = [...bowlers].sort((a, b) => {
    const oversA = parseFloat(a.overs || '0.0')
    const oversB = parseFloat(b.overs || '0.0')
    return oversB - oversA
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Bowler ↓
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              O
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              M
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              R
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              W
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              ER
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedBowlers.map((bowler, index) => {
            const isActive = bowler.bowlerId === currentBowlerId
            const overs = bowler.overs || '0.0'
            const maidens = bowler.maidens || 0

            return (
              <tr
                key={bowler.bowlerId || index}
                className={`
                  border-b border-gray-100 transition-colors
                  ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                `}
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {bowler.bowlerName}
                    </span>
                    {isActive && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                        Bowling
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right py-3 px-3 font-semibold text-gray-900">
                  {overs}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {maidens}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {bowler.runsConceded}
                </td>
                <td className="text-right py-3 px-3 font-semibold text-gray-900">
                  {bowler.wickets}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {bowler.economy.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default BowlingTable

