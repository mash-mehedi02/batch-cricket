/**
 * Win Probability Component
 * Shows win probability for teams
 */

interface WinProbabilityProps {
  teamAProbability: number
  teamBProbability: number
  drawProbability?: number
}

export default function WinProbability({ 
  teamAProbability, 
  teamBProbability, 
  drawProbability = 0 
}: WinProbabilityProps) {
  const tA = Number(teamAProbability || 0)
  const tB = Number(teamBProbability || 0)
  const tD = Number(drawProbability || 0)
  const total = tA + tB + tD
  const teamAPercent = total > 0 ? (tA / total) * 100 : 0
  const teamBPercent = total > 0 ? (tB / total) * 100 : 0
  const drawPercent = total > 0 ? (tD / total) * 100 : 0

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wide">Win Probability</h3>
      
      {/* Progress Bar */}
      <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div 
          className="absolute left-0 top-0 h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${teamAPercent}%` }}
        ></div>
        <div 
          className="absolute top-0 h-full bg-gray-400 transition-all duration-500"
          style={{ left: `${teamAPercent}%`, width: `${drawPercent}%` }}
        ></div>
        <div 
          className="absolute right-0 top-0 h-full bg-green-600 transition-all duration-500"
          style={{ width: `${teamBPercent}%` }}
        ></div>
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600"></div>
          <span className="font-semibold text-gray-900">Team A {teamAPercent.toFixed(0)}%</span>
        </div>
        {drawPercent > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            <span className="font-semibold text-gray-900">DRAW {drawPercent.toFixed(0)}%</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-600"></div>
          <span className="font-semibold text-gray-900">Team B {teamBPercent.toFixed(0)}%</span>
          <span className="text-gray-400">ℹ️</span>
        </div>
      </div>
    </div>
  )
}

