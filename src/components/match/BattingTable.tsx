/**
 * Batting Table Component
 * Display current batsmen stats in table format
 */

import { InningsStats } from '@/types'

interface BattingTableProps {
  innings: InningsStats
}

export default function BattingTable({ innings }: BattingTableProps) {
  const striker = innings.batsmanStats?.find(b => b.batsmanId === innings.currentStrikerId)
  const nonStriker = innings.batsmanStats?.find(b => b.batsmanId === innings.nonStrikerId)
  const lastWicket = innings.fallOfWickets?.[innings.fallOfWickets.length - 1]

  if (!striker && !nonStriker) {
    return (
      <div className="bg-white rounded-lg p-6 text-center text-gray-500">
        No batsmen data available
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 text-xs font-bold text-gray-700 uppercase tracking-wide">
          <div>Batter</div>
          <div className="text-center">R (B)</div>
          <div className="text-center">4s</div>
          <div className="text-center">6s</div>
          <div className="text-center">SR</div>
        </div>
      </div>

      {/* Batsmen Rows */}
      <div className="divide-y divide-gray-100">
        {striker && (
          <div className="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-gray-900 font-semibold">{striker.batsmanName}</span>
              <span className="text-xs">✏️</span>
            </div>
            <div className="text-center text-gray-900 font-medium">
              {striker.runs} <span className="text-gray-600">({striker.balls})</span>
            </div>
            <div className="text-center text-gray-900">{striker.fours || 0}</div>
            <div className="text-center text-gray-900">{striker.sixes || 0}</div>
            <div className="text-center text-gray-900">{(striker.strikeRate || 0).toFixed(2)}</div>
          </div>
        )}

        {nonStriker && (
          <div className="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-gray-900 font-semibold">{nonStriker.batsmanName}</span>
            </div>
            <div className="text-center text-gray-900 font-medium">
              {nonStriker.runs} <span className="text-gray-600">({nonStriker.balls})</span>
            </div>
            <div className="text-center text-gray-900">{nonStriker.fours || 0}</div>
            <div className="text-center text-gray-900">{nonStriker.sixes || 0}</div>
            <div className="text-center text-gray-900">{(nonStriker.strikeRate || 0).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Partnership and Last Wicket */}
      {(innings.partnership || lastWicket) && (
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            {innings.partnership && (
              <div>
                <span className="text-gray-600 font-medium">P'ship:</span>{' '}
                <span className="text-gray-900 font-semibold">
                  {innings.partnership.runs} ({innings.partnership.balls})
                </span>
              </div>
            )}
            {lastWicket && (
              <div>
                <span className="text-gray-600 font-medium">Last wkt:</span>{' '}
                <span className="text-gray-900 font-semibold">
                  {lastWicket.batsmanName || 'Player'} {lastWicket.runs} ({lastWicket.over})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

