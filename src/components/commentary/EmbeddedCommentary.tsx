/**
 * Embedded Commentary Feed (Admin)
 * Compact version for admin scoring panel
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { subscribeToCommentary, CommentaryEntry } from '@/services/commentary/commentaryService'

type Props = {
  matchId: string
  inningId?: 'teamA' | 'teamB'
  title?: string
  maxItems?: number
}

export default function EmbeddedCommentary({ matchId, inningId, title = 'AI Commentary', maxItems = 30 }: Props) {
  const [items, setItems] = useState<CommentaryEntry[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!matchId) return
    const unsub = subscribeToCommentary(matchId, (entries) => {
      const filtered = inningId ? entries.filter((e) => e.inningId === inningId) : entries
      setItems(filtered.slice(-maxItems))
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return () => unsub()
  }, [matchId, inningId, maxItems])

  const visible = useMemo(() => items.slice(-maxItems), [items, maxItems])

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500">TV-style auto updates</div>
        </div>
        <div className="text-[11px] font-semibold text-gray-500">
          {visible.length} items
        </div>
      </div>

      <div className="max-h-[520px] overflow-y-auto p-4 space-y-3">
        {visible.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            No commentary yet.
          </div>
        ) : (
          visible.map((e, idx) => (
            <div
              key={e.id || idx}
              className={`rounded-lg p-3 border ${
                e.isWicket
                  ? 'border-red-200 bg-red-50'
                  : e.milestone === '6'
                    ? 'border-yellow-200 bg-yellow-50'
                    : e.milestone === '4'
                      ? 'border-blue-200 bg-blue-50'
                      : e.isHighlight
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 text-[11px] font-mono text-gray-600 pt-0.5">
                  {e.over || '0.0'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-gray-900 leading-relaxed">
                    {e.text}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                    {e.aiGenerated ? <span className="font-semibold">AI</span> : <span className="font-semibold">Manual</span>}
                    {e.batsman ? <span className="truncate">• {e.batsman}</span> : null}
                    {e.bowler ? <span className="truncate">• {e.bowler}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}


