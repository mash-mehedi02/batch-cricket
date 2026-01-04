/**
 * Quick Stats Row
 * Striker, Non-striker, Bowler, Partnership
 */

import { InningsStats } from '@/types'

interface QuickStatsRowProps {
  innings: InningsStats
}

export default function QuickStatsRow({ innings }: QuickStatsRowProps) {
  const striker = innings.batsmanStats?.find(b => b.batsmanId === innings.currentStrikerId)
  const nonStriker = innings.batsmanStats?.find(b => b.batsmanId === innings.nonStrikerId)
  const bowler = innings.bowlerStats?.find(b => b.bowlerId === innings.currentBowlerId)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Striker */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 shadow-lg border-2 border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Striker</div>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">ST</span>
          </div>
        </div>
        {striker ? (
          <div>
            <div className="font-bold text-slate-900 text-lg mb-1">{striker.batsmanName}</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              {striker.runs} <span className="text-slate-500">({striker.balls})</span>
            </div>
            <div className="text-xs font-medium text-blue-600">SR: {Number(striker.strikeRate || 0).toFixed(2)}</div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium">Not set</div>
        )}
      </div>

      {/* Non-Striker */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 shadow-lg border-2 border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Non-Striker</div>
          <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center">
            <span className="text-white text-xs font-bold">NS</span>
          </div>
        </div>
        {nonStriker ? (
          <div>
            <div className="font-bold text-slate-900 text-lg mb-1">{nonStriker.batsmanName}</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              {nonStriker.runs} <span className="text-slate-500">({nonStriker.balls})</span>
            </div>
            <div className="text-xs font-medium text-slate-600">SR: {Number(nonStriker.strikeRate || 0).toFixed(2)}</div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium">Not set</div>
        )}
      </div>

      {/* Bowler */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 shadow-lg border-2 border-purple-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">Bowler</div>
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">BW</span>
          </div>
        </div>
        {bowler ? (
          <div>
            <div className="font-bold text-slate-900 text-lg mb-1">{bowler.bowlerName}</div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              {bowler.overs} <span className="text-slate-500">({bowler.runsConceded}-{bowler.wickets})</span>
            </div>
            <div className="text-xs font-medium text-purple-600">Eco: {Number(bowler.economy || 0).toFixed(2)}</div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium">Not set</div>
        )}
      </div>

      {/* Partnership */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-xl p-5 shadow-lg border-2 border-emerald-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Partnership</div>
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">PT</span>
          </div>
        </div>
        {innings.partnership ? (
          <div>
            <div className="text-2xl font-extrabold text-slate-900 mb-1">
              {innings.partnership.runs || 0}
            </div>
            <div className="text-sm font-semibold text-slate-700 mb-1">
              {innings.partnership.overs || '0.0'}
            </div>
            <div className="text-xs font-medium text-emerald-600">
              {(innings.partnership.balls || 0)} balls
            </div>
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium">Not set</div>
        )}
      </div>
    </div>
  )
}

