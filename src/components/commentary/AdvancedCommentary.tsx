/**
 * Advanced Commentary Component
 * With auto-commentary, manual updates, TTS, filters, and milestone tracking
 */

import { useEffect, useState, useRef } from 'react'
import { subscribeToCommentary, CommentaryEntry } from '@/services/commentary/commentaryService'
import { ttsService, TTSLanguage } from '@/utils/textToSpeech'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface AdvancedCommentaryProps {
  matchId: string
  inningId?: 'teamA' | 'teamB'
}

export default function AdvancedCommentary({ matchId, inningId }: AdvancedCommentaryProps) {
  const { user } = useAuthStore()
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'highlights' | 'overs' | 'wickets' | '6s' | '4s' | '1s'>('all')
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [ttsLanguage, setTtsLanguage] = useState<TTSLanguage>('en')
  const [showManualForm, setShowManualForm] = useState(false)
  const feedEndRef = useRef<HTMLDivElement>(null)
  const lastCommentaryId = useRef<string | null>(null)
  const isAdmin = user?.role === 'admin'

  // Subscribe to commentary
  useEffect(() => {
    if (!matchId) return

    const unsubscribe = subscribeToCommentary(matchId, (entries) => {
      // Filter by inning if specified
      const filtered = inningId 
        ? entries.filter(e => e.inningId === inningId)
        : entries
      
      setCommentary(filtered)

      // Auto-scroll to latest
      if (feedEndRef.current) {
        setTimeout(() => {
          feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }

      // Speak latest commentary if TTS enabled
      if (ttsEnabled && filtered.length > 0) {
        const latest = filtered[filtered.length - 1]
        if (latest.id !== lastCommentaryId.current) {
          lastCommentaryId.current = latest.id
          ttsService.speak(latest.text)
        }
      }
    })

    return () => unsubscribe()
  }, [matchId, inningId, ttsEnabled])

  // Filter commentary
  const filteredCommentary = commentary.filter((entry) => {
    switch (filter) {
      case 'highlights':
        return entry.isHighlight
      case 'wickets':
        return entry.isWicket
      case '6s':
        return entry.milestone === '6'
      case '4s':
        return entry.milestone === '4'
      case '1s':
        return entry.runs === 1
      default:
        return true
    }
  })

  // Handle TTS toggle
  const handleTtsToggle = (enabled: boolean) => {
    setTtsEnabled(enabled)
    ttsService.setEnabled(enabled)
    ttsService.setLanguage(ttsLanguage)
    if (!enabled) {
      ttsService.stop()
    }
  }

  const handleLanguageChange = (lang: TTSLanguage) => {
    setTtsLanguage(lang)
    ttsService.setLanguage(lang)
    if (ttsEnabled) {
      ttsService.stop()
      if (commentary.length > 0) {
        ttsService.speak(commentary[commentary.length - 1].text)
      }
    }
  }

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">Commentary</h2>
            <div className="flex items-center gap-2">
              {/* TTS Controls */}
              <button
                onClick={() => handleTtsToggle(!ttsEnabled)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  ttsEnabled
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={ttsEnabled ? 'Stop Audio' : 'Enable Audio'}
              >
                {ttsEnabled ? '🔊 On' : '🔇 Off'}
              </button>
              {ttsEnabled && (
                <select
                  value={ttsLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value as TTSLanguage)}
                  className="px-2 py-1.5 bg-gray-700 text-white rounded-lg text-sm border border-gray-600"
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা</option>
                </select>
              )}
              {isAdmin && (
                <button
                  onClick={() => setShowManualForm(!showManualForm)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                >
                  + Manual
                </button>
              )}
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'highlights', 'overs', 'wickets', '6s', '4s', '1s'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                  filter === f
                    ? 'bg-pink-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'highlights' ? 'Highlights' : f === 'overs' ? 'Overs' : f === 'wickets' ? 'W' : f === '6s' ? '6s' : f === '4s' ? '4s' : '1s'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Manual Commentary Form (Admin) */}
      {showManualForm && isAdmin && (
        <ManualCommentaryForm
          matchId={matchId}
          inningId={inningId || 'teamA'}
          onClose={() => setShowManualForm(false)}
        />
      )}

      {/* Commentary Feed */}
      <div className="px-4 py-4 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
        {filteredCommentary.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>No commentary yet</p>
            <p className="text-sm mt-2">Commentary will appear as the match progresses</p>
          </div>
        ) : (
          filteredCommentary.map((entry, idx) => (
            <CommentaryItem key={entry.id || idx} entry={entry} />
          ))
        )}
        <div ref={feedEndRef} />
      </div>
    </div>
  )
}

function CommentaryItem({ entry }: { entry: CommentaryEntry }) {
  const getMilestoneBadge = () => {
    if (entry.milestone === 'wicket') return '🔴 OUT'
    if (entry.milestone === '6') return '💥 SIX'
    if (entry.milestone === '4') return '⚡ FOUR'
    if (entry.milestone === '50') return '🌟 50'
    if (entry.milestone === '100') return '🏆 100'
    return null
  }

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${
        entry.isWicket
          ? 'bg-red-900/30 border-red-500'
          : entry.milestone === '6'
          ? 'bg-yellow-900/20 border-yellow-500'
          : entry.milestone === '4'
          ? 'bg-blue-900/20 border-blue-500'
          : entry.isHighlight
          ? 'bg-green-900/20 border-green-500'
          : 'bg-gray-800 border-gray-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="text-xs font-mono text-gray-400">
            {entry.over}
          </div>
          {entry.ball > 0 && (
            <div className="text-xs text-gray-500">Ball {entry.ball}</div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {getMilestoneBadge() && (
              <span className="px-2 py-1 bg-gray-700 rounded text-xs font-semibold">
                {getMilestoneBadge()}
              </span>
            )}
            {entry.runs > 0 && (
              <span className="text-xs text-gray-400">
                {entry.runs} run{entry.runs !== 1 ? 's' : ''}
              </span>
            )}
            {entry.manual && (
              <span className="px-2 py-0.5 bg-purple-600 rounded text-xs">Manual</span>
            )}
            {entry.aiGenerated && (
              <span className="px-2 py-0.5 bg-blue-600 rounded text-xs">AI</span>
            )}
          </div>
          <p className="text-white leading-relaxed">{entry.text}</p>
          {(entry.batsman || entry.bowler) && (
            <div className="text-xs text-gray-400 mt-2">
              {entry.batsman && <span>{entry.batsman}</span>}
              {entry.batsman && entry.bowler && <span> • </span>}
              {entry.bowler && <span>{entry.bowler}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ManualCommentaryForm({ 
  matchId, 
  inningId, 
  onClose 
}: { 
  matchId: string
  inningId: 'teamA' | 'teamB'
  onClose: () => void 
}) {
  const [text, setText] = useState('')
  const [over, setOver] = useState('')
  const [ball, setBall] = useState(0)
  const [runs, setRuns] = useState(0)
  const [isWicket, setIsWicket] = useState(false)
  const [isBoundary, setIsBoundary] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      toast.error('Commentary text is required')
      return
    }

    setSaving(true)
    try {
      const { addManualCommentary } = await import('@/services/commentary/commentaryService')
      await addManualCommentary(matchId, inningId, text, over, ball, runs, isWicket, isBoundary)
      toast.success('Commentary added successfully')
      setText('')
      setOver('')
      setBall(0)
      setRuns(0)
      setIsWicket(false)
      setIsBoundary(false)
      onClose()
    } catch (error: any) {
      console.error('Error adding commentary:', error)
      toast.error(error.message || 'Failed to add commentary')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Commentary Text *</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:ring-2 focus:ring-purple-500"
            placeholder="Enter commentary text..."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Over</label>
            <input
              type="text"
              value={over}
              onChange={(e) => setOver(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Ball</label>
            <input
              type="number"
              value={ball}
              onChange={(e) => setBall(parseInt(e.target.value) || 0)}
              min="0"
              max="6"
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Runs</label>
          <input
            type="number"
            value={runs}
            onChange={(e) => setRuns(parseInt(e.target.value) || 0)}
            min="0"
            className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600"
          />
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isWicket}
              onChange={(e) => setIsWicket(e.target.checked)}
              className="rounded"
            />
            Wicket
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={isBoundary}
              onChange={(e) => setIsBoundary(e.target.checked)}
              className="rounded"
            />
            Boundary
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Commentary'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

