/**
 * Commentary Service
 * Advanced commentary system with auto-generation, manual updates, and TTS
 */

import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/services/firestore/collections'
import { generateCommentary, CommentaryInput } from '@/services/ai/aiCommentary'
import { Commentary } from '@/types'

export interface CommentaryEntry extends Commentary {
  manual?: boolean // true if manually added by admin
  milestone?: '4' | '6' | 'wicket' | '50' | '100' | null
  aiGenerated?: boolean
  // Link commentary to a specific ball so Undo can remove it
  ballDocId?: string
  sequence?: number
  overNumber?: number // The chronological over number (1, 2, 3...)
}

/**
 * Subscribe to commentary updates
 */
export function subscribeToCommentary(
  matchId: string,
  callback: (commentary: CommentaryEntry[]) => void
): () => void {
  const commentaryRef = collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.COMMENTARY)
  const q = query(commentaryRef, orderBy('timestamp', 'desc'))

  return onSnapshot(q, (snapshot) => {
    const commentary = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CommentaryEntry))
    callback(commentary.reverse()) // Reverse to show chronological order
  })
}

/**
 * Generate auto commentary for a ball event
 */
export async function generateAutoCommentary(
  matchId: string,
  inningId: 'teamA' | 'teamB',
  input: CommentaryInput & { ballDocId?: string; sequence?: number; style?: 'tv' | 'simple'; overNumber?: number; totalRuns?: number }
): Promise<string> {
  const tone: any = (input.isFour || input.isSix || input.wicketType) ? 'excited' : 'normal'
  const result = generateCommentary(input, tone)

  const usedTotalRuns = typeof input.totalRuns === 'number' ? input.totalRuns : input.runs

  // Determine milestone
  let milestone: '4' | '6' | 'wicket' | '50' | '100' | null = null
  if (input.isSix) milestone = '6'
  else if (input.isFour) milestone = '4'
  else if (input.wicketType) milestone = 'wicket'
  else if (usedTotalRuns === 50) milestone = '50'
  else if (usedTotalRuns === 100) milestone = '100'

  // Save to Firebase
  const commentaryRef = collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.COMMENTARY)
  await addDoc(commentaryRef, {
    matchId,
    inningId,
    text: result.text,
    over: input.over || '0.0',
    ball: input.ball || 0,
    runs: usedTotalRuns || 0,
    isWicket: Boolean(input.wicketType),
    isBoundary: input.isBoundary || false,
    batsman: input.batsman || '',
    bowler: input.bowler || '',
    tone: result.tone,
    isHighlight: result.isHighlight,
    milestone,
    ballType: input.ballType || 'normal',
    aiGenerated: true,
    manual: false,
    ballDocId: input.ballDocId || null,
    sequence: typeof input.sequence === 'number' ? input.sequence : null,
    overNumber: input.overNumber || null,
    timestamp: Timestamp.now(),
    createdAt: new Date().toISOString(),
  })

  return result.text
}

/**
 * Delete commentary entries linked to a ball (used by Undo)
 */
export async function deleteCommentaryForBall(matchId: string, ballDocId: string): Promise<void> {
  const { getDocs, deleteDoc, doc: docRef } = await import('firebase/firestore')
  const commentaryRef = collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.COMMENTARY)
  // Keep query index-free (avoid composite index requirements)
  const q = query(commentaryRef, where('ballDocId', '==', ballDocId))
  const snap = await getDocs(q)
  const deletions = snap.docs.map((d) => deleteDoc(docRef(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.COMMENTARY, d.id)))
  await Promise.all(deletions)
}

/**
 * Add manual commentary (Admin only)
 */
export async function addManualCommentary(
  matchId: string,
  inningId: 'teamA' | 'teamB',
  text: string,
  over: string = '0.0',
  ball: number = 0,
  runs: number = 0,
  isWicket: boolean = false,
  isBoundary: boolean = false,
  batsman?: string,
  bowler?: string
): Promise<void> {
  const commentaryRef = collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.COMMENTARY)

  // Determine milestone
  let milestone: '4' | '6' | 'wicket' | '50' | '100' | null = null
  if (isWicket) milestone = 'wicket'
  else if (runs === 6) milestone = '6'
  else if (runs === 4) milestone = '4'

  await addDoc(commentaryRef, {
    matchId,
    inningId,
    text,
    over,
    ball,
    runs,
    isWicket,
    isBoundary,
    batsman: batsman || '',
    bowler: bowler || '',
    tone: 'neutral',
    isHighlight: isWicket || isBoundary || runs >= 4,
    milestone,
    aiGenerated: false,
    manual: true,
    timestamp: Timestamp.now(),
    createdAt: new Date().toISOString(),
  })
}

