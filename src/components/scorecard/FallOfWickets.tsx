/**
 * Fall of Wickets Component
 * Professional table showing wicket falls with batsman, score, and overs
 */

interface FallOfWicket {
  wicket: number
  score: number
  over: string
  batsmanId: string
  batsmanName: string
  dismissal: string
  dismissalText?: string
}

interface FallOfWicketsProps {
  fallOfWickets: FallOfWicket[]
}

const FallOfWickets = ({ fallOfWickets }: FallOfWicketsProps) => {
  if (!fallOfWickets || fallOfWickets.length === 0) {
    return (
      <div className="text-center text-gray-500 py-6">
        <p className="text-sm">No wickets fallen yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Fall of Wickets</h2>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Batsman
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Score
                </th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Overs
                </th>
              </tr>
            </thead>
            <tbody>
              {fallOfWickets.map((fow, index) => (
                <tr
                  key={fow.batsmanId || index}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {fow.batsmanName || 'Batsman'}
                      </span>
                      {fow.dismissalText && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          {fow.dismissalText}
                        </span>
                      )}
                      {fow.dismissal && !fow.dismissalText && (
                        <span className="text-xs text-gray-500 mt-0.5">
                          {fow.dismissal}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-right py-3 px-3 font-semibold text-gray-900">
                    {fow.score}-{fow.wicket}
                  </td>
                  <td className="text-right py-3 px-3 text-gray-700">
                    {fow.over}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default FallOfWickets

