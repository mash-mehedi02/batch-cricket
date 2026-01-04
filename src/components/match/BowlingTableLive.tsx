/**
 * Bowling Table Component for Live Page
 * Display current bowler stats in table format
 */

import { InningsStats } from '@/types'

interface BowlingTableLiveProps {
  innings: InningsStats
}

export default function BowlingTableLive({ innings }: BowlingTableLiveProps) {
  const bowler = innings.bowlerStats?.find(b => b.bowlerId === innings.currentBowlerId)

  if (!bowler) {
    return (
      <div className="bg-white rounded-lg p-6 text-center text-gray-500">
        No bowler data available
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4 px-6 py-3 text-xs font-bold text-gray-700 uppercase tracking-wide">
          <div>Bowler</div>
          <div className="text-center">W-R</div>
          <div className="text-center">Overs</div>
          <div className="text-center">Econ</div>
        </div>
      </div>

      {/* Bowler Row */}
      <div className="px-6 py-4 hover:bg-gray-50">
        <div className="grid grid-cols-4 gap-4 items-center">
          <div className="text-gray-900 font-semibold">{bowler.bowlerName}</div>
          <div className="text-center text-gray-900 font-medium">
            {bowler.wickets}-{bowler.runsConceded}
          </div>
          <div className="text-center text-gray-900">{bowler.overs || '0.0'}</div>
          <div className="text-center text-gray-900">{Number(bowler.economy || 0).toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}

