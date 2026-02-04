/**
 * Tournaments Redirect Page
 * Automatically redirects to the most relevant tournament details page.
 * Keeps the "Tournaments" route valid but skips the listing view per user request.
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'


export default function Tournaments() {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const findRedirectTarget = async () => {
      try {
        const all = await tournamentService.getAll()

        if (!all || all.length === 0) {
          setLoading(false)
          return
        }

        // Logic to find the "best" tournament to show
        // 1. First "ongoing" tournament
        // 2. Or, first "upcoming" tournament
        // 3. Or, most recent "completed" tournament by end date or year

        const ongoing = all.find(t => t.status === 'ongoing')
        if (ongoing) {
          setTargetId(ongoing.id)
          setLoading(false)
          return
        }

        const upcoming = all.find(t => t.status === 'upcoming')
        if (upcoming) {
          setTargetId(upcoming.id)
          setLoading(false)
          return
        }

        // Sort by year desc, then ID as fallback
        const sorted = [...all].sort((a, b) => (b.year || 0) - (a.year || 0))
        setTargetId(sorted[0].id)
      } catch (e) {
        console.error("Failed to load tournaments for redirect", e)
      } finally {
        setLoading(false)
      }
    }

    findRedirectTarget()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (targetId) {
    return <Navigate to={`/tournaments/${targetId}`} replace />
  }

  // Fallback if no tournaments exist
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="text-4xl mb-4">🏆</div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Series Available</h2>
      <p className="text-slate-500 text-sm">Check back later for cricket series updates.</p>
    </div>
  )
}
