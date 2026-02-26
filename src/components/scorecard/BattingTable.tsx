/**
 * Batting Table Component
 * Professional batting statistics table with dismissal info
 */

interface Batsman {
  batsmanId: string
  batsmanName: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  dismissal?: string
  notOut: boolean
}

interface BattingTableProps {
  batsmen: Batsman[]
  currentStrikerId?: string
  currentNonStrikerId?: string
}

const BattingTable = ({ batsmen, currentStrikerId, currentNonStrikerId }: BattingTableProps) => {
  if (batsmen.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p>No batting data available</p>
      </div>
    )
  }

  // Sort batsmen by batting position (who came in first appears first)
  const sortedBatsmen = [...batsmen].sort((a: any, b: any) => {
    if (a.battingPosition !== undefined && b.battingPosition !== undefined) {
      return a.battingPosition - b.battingPosition;
    }
    return 0;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Batter
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              R
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              B
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              4s
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              6s
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              SR
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedBatsmen.map((batsman, index) => {
            const isStriker = batsman.batsmanId === currentStrikerId
            const isNonStriker = batsman.batsmanId === currentNonStrikerId
            const isActive = isStriker || isNonStriker

            return (
              <tr
                key={batsman.batsmanId || index}
                className={`
                  border-b border-gray-100 transition-colors
                  ${isActive ? 'bg-yellow-50' : 'hover:bg-gray-50'}
                `}
              >
                <td className="py-3 px-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-gray-900 ${isStriker ? 'font-semibold' : ''}`}>
                        {batsman.batsmanName}
                        {batsman.notOut && !batsman.dismissal && '*'}
                      </span>
                      {isStriker && (
                        <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold">
                          Batting
                        </span>
                      )}
                    </div>
                    {batsman.dismissal ? (
                      <span className="text-xs text-gray-600 mt-0.5">
                        {batsman.dismissal}
                      </span>
                    ) : batsman.notOut && !isStriker ? (
                      <span className="text-xs text-gray-500 mt-0.5 italic">
                        Not out
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="text-right py-3 px-3 font-semibold text-gray-900">
                  {batsman.runs}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {batsman.balls}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {batsman.fours}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {batsman.sixes}
                </td>
                <td className="text-right py-3 px-3 text-gray-700">
                  {batsman.strikeRate.toFixed(2)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default BattingTable

