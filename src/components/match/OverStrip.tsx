/**
 * OverStrip Component
 * Horizontal strip that shows last overs like: Over 18 0 wd 0 0 4 1 0 = 6
 */

import { useEffect, useRef } from 'react'
import { RecentOver } from '@/types'

function ballClass(type: string): string {
  switch (type) {
    case 'wicket':
      return 'bg-red-600 text-white'
    case 'four':
      return 'bg-blue-600 text-white'
    case 'six':
      return 'bg-green-600 text-white'
    case 'wide':
      return 'bg-yellow-600 text-white'
    case 'noball':
      return 'bg-orange-600 text-white'
    case 'dot':
      return 'bg-gray-700 text-white'
    default:
      return 'bg-gray-600 text-white'
  }
}

type Props = {
  overs: Array<Pick<RecentOver, 'overNumber' | 'balls' | 'deliveries' | 'totalRuns' | 'extras'>>
}

export default function OverStrip({ overs }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const safeOvers = overs || []
  const lastOverNumber = safeOvers[safeOvers.length - 1]?.overNumber

  // Auto-scroll to latest over (right side)
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    if (safeOvers.length === 0) return
    el.scrollLeft = el.scrollWidth
  }, [lastOverNumber, safeOvers.length])

  if (safeOvers.length === 0) return null

  return (
    <div
      ref={stripRef}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-x-auto"
    >
      <div className="flex items-center gap-6 min-w-max">
        {safeOvers.map((over, idx) => {
          const deliveries =
            (over as any).deliveries && (over as any).deliveries.length > 0
              ? (over as any).deliveries
              : [
                  ...(over.balls || []).map((b: any) => ({ value: b.value, type: b.type, isLegal: true })),
                  ...((over as any).extras || []).map((e: any) => ({ value: e.badge, type: String(e.badge || '').toLowerCase().startsWith('wd') ? 'wide' : 'noball', isLegal: false })),
                ]

          return (
            <div
              key={over.overNumber}
              className={`flex items-center gap-3 px-2 py-1 rounded-xl ${
                over.overNumber === lastOverNumber ? 'bg-slate-50 border border-slate-200' : ''
              }`}
            >
              <div className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                Over {over.overNumber}
              </div>
              <div className="flex items-center gap-2">
                {deliveries.map((d: any, i: number) => (
                  <div
                    key={i}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${ballClass(d.type)}`}
                    title={d.value}
                  >
                    {d.value}
                  </div>
                ))}
                <div className="text-slate-600 font-semibold whitespace-nowrap">= {over.totalRuns}</div>
              </div>

              {idx < safeOvers.length - 1 && <div className="h-8 w-px bg-slate-200" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}


