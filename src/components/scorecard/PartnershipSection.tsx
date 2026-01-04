/**
 * Partnership Section Component
 * Shows partnership details with visual bar graph
 */

interface Partnership {
  runs: number
  balls: number
  overs?: string
  batsman1?: {
    name: string
    runs: number
    balls: number
  }
  batsman2?: {
    name: string
    runs: number
    balls: number
  }
}

interface PartnershipSectionProps {
  partnerships: Array<{
    wicket: number
    partnership: Partnership
    batsman1: { name: string; runs: number; balls: number }
    batsman2: { name: string; runs: number; balls: number }
  }>
  currentPartnership?: Partnership
}

const PartnershipSection = ({ partnerships, currentPartnership }: PartnershipSectionProps) => {
  // Combine current partnership with historical partnerships
  const allPartnerships = currentPartnership 
    ? [{ wicket: 0, partnership: currentPartnership, batsman1: currentPartnership.batsman1, batsman2: currentPartnership.batsman2 }]
    : []
  
  const displayPartnerships = [...allPartnerships, ...partnerships].slice(0, 5) // Show last 5 partnerships

  if (displayPartnerships.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Partnership</h2>
      </div>
      <div className="p-6 space-y-6">
        {displayPartnerships.map((part, idx) => {
          const totalRuns = part.partnership.runs || 0
          const totalBalls = part.partnership.balls || 0
          const batsman1Runs = part.batsman1?.runs || 0
          const batsman2Runs = part.batsman2?.runs || 0
          const batsman1Balls = part.batsman1?.balls || 0
          const batsman2Balls = part.batsman2?.balls || 0
          
          // Calculate percentages for visual representation
          const batsman1Percent = totalRuns > 0 ? (batsman1Runs / totalRuns) * 100 : 50
          const batsman2Percent = totalRuns > 0 ? (batsman2Runs / totalRuns) * 100 : 50

          return (
            <div key={idx} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                {part.wicket === 0 ? 'CURRENT' : `${part.wicket}${part.wicket === 1 ? 'ST' : part.wicket === 2 ? 'ND' : part.wicket === 3 ? 'RD' : 'TH'} WICKET`}
              </div>
              
              <div className="space-y-3">
                {/* Batsmen Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {part.batsman1?.name || 'Batsman 1'}
                    </div>
                    <div className="text-gray-600">
                      {batsman1Runs} runs ({batsman1Balls} balls)
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 mb-1">
                      {part.batsman2?.name || 'Batsman 2'}
                    </div>
                    <div className="text-gray-600">
                      {batsman2Runs} runs ({batsman2Balls} balls)
                    </div>
                  </div>
                </div>

                {/* Visual Bar Graph */}
                {totalRuns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Partnership: {totalRuns} runs ({totalBalls} balls)</span>
                      {part.partnership.overs && (
                        <span>{part.partnership.overs} overs</span>
                      )}
                    </div>
                    <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex">
                      {batsman1Runs > 0 && (
                        <div
                          className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-semibold transition-all"
                          style={{ width: `${batsman1Percent}%` }}
                        >
                          {batsman1Percent > 15 && `${batsman1Runs}`}
                        </div>
                      )}
                      {batsman2Runs > 0 && (
                        <div
                          className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-semibold transition-all"
                          style={{ width: `${batsman2Percent}%` }}
                        >
                          {batsman2Percent > 15 && `${batsman2Runs}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-green-500 rounded"></span>
                        {part.batsman1?.name || 'Batsman 1'}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-500 rounded"></span>
                        {part.batsman2?.name || 'Batsman 2'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PartnershipSection

