/**
 * Player Profile Page
 * Screenshot-based design with dark green header, tabs, recent form, career stats
 */

import { useEffect, useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import { signOut } from 'firebase/auth'
import { squadService } from '@/services/firestore/squads'
import { Player, SocialLink, PlayerRole, BattingStyle, BowlingStyle } from '@/types'
import PlayerProfileSkeleton from '@/components/skeletons/PlayerProfileSkeleton'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import PageHeader from '@/components/common/PageHeader'
import cricketBatIcon from '@/assets/cricket-bat.png'
import cricketBallIcon from '@/assets/cricket-ball.png'
import { useAuthStore } from '@/store/authStore'
import { verifyPlayerAccess, handleGoogleRedirectResult, finalizeClaim } from '@/services/firestore/playerClaim'
import toast from 'react-hot-toast'
import { Edit, Camera, Facebook, Instagram, Twitter, Linkedin, Globe, ChevronDown, X, Upload } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/utils/cropImage'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadImage } from '@/services/cloudinary/uploader'
import WheelDatePicker from '@/components/common/WheelDatePicker'

const detectPlatform = (url: string): 'instagram' | 'facebook' | 'x' | 'linkedin' | null => {
  const lower = url.toLowerCase()
  if (lower.includes('instagram.com')) return 'instagram'
  if (lower.includes('facebook.com')) return 'facebook'
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'x'
  if (lower.includes('linkedin.com')) return 'linkedin'
  return null
}

const extractUsername = (url: string) => {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.pathname.split('/').filter(p => p && p !== 'in' && p !== 'profile')
    return parts[parts.length - 1] || 'Link'
  } catch {
    return 'Link'
  }
}




// Helper to format opponent name
function formatOpponentName(rawName: string): string {
  if (!rawName || rawName === 'Opponent' || rawName === 'Unknown') return 'OPP'

  const parts = rawName.split('-')
  const teamPart = parts[0].trim()
  const suffix = parts.length > 1 ? ` - ${parts.slice(1).join('-').trim()}` : ''

  // Clean up common prefixes/suffixes
  const cleanName = teamPart.replace(/(Academy|Cricket Club|School|High School|XI)/gi, '').trim() || teamPart

  const words = cleanName.split(/\s+/)
  let shortName = ''

  if (words.length === 1) {
    shortName = words[0].substring(0, 3).toUpperCase()
  } else {
    shortName = words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
  }

  return `${shortName}${suffix}`
}

const INITIAL_EDIT_FORM_STATE = {
  name: '',
  username: '',
  bio: '',
  photoUrl: '',
  dateOfBirth: '',
  socialLinks: [],
  address: '',
  school: '',
  role: 'batsman' as PlayerRole,
  battingStyle: 'right-handed' as BattingStyle,
  bowlingStyle: 'right-arm-medium' as BowlingStyle
}

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [player, setPlayer] = useState<Player | null>(null)
  const [squadName, setSquadName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  // Claim & Edit Handlers


  const handleAddLink = () => {
    if (!newLinkUrl) return
    if (editForm.socialLinks.length >= 3) {
      toast.error('Maximum 3 social links allowed')
      return
    }
    const platform = detectPlatform(newLinkUrl)
    if (!platform) {
      toast.error('Only Instagram, Facebook, X (Twitter), and LinkedIn are supported')
      return
    }
    const username = extractUsername(newLinkUrl)
    setEditForm(prev => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { platform, url: newLinkUrl, username }]
    }))
    setNewLinkUrl('')
  }

  const handleRemoveLink = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index)
    }))
  }

  const handleEditSave = async () => {
    if (!playerId) return
    setSaving(true)
    try {
      await updatePlayerPersonalInfo(playerId, {
        name: editForm.name,
        username: editForm.username,
        bio: editForm.bio,
        photoUrl: editForm.photoUrl,
        dateOfBirth: editForm.dateOfBirth,
        socialLinks: editForm.socialLinks,
        address: editForm.address,
        school: editForm.school,
        role: editForm.role,
        battingStyle: editForm.battingStyle,
        bowlingStyle: editForm.bowlingStyle
      })
      toast.success('Profile updated! You have been logged out for security.')
      setIsEditing(false)
      await signOut(auth) // Auto-logout after save
    } catch (e: any) {
      console.error(e)
      toast.error(e.message || 'Update failed. Ensure you are the owner.')
    } finally {
      setSaving(false)
    }
  }
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState<'batting' | 'bowling'>('batting')
  const [isEditing, setIsEditing] = useState(false)

  // Claim & Edit States
  const { user } = useAuthStore()


  // Edit Form State
  const [editForm, setEditForm] = useState<{
    name: string
    username: string
    bio: string
    photoUrl: string
    dateOfBirth: string
    socialLinks: SocialLink[]
    address: string
    school: string
    role: PlayerRole,
    battingStyle: BattingStyle,
    bowlingStyle: BowlingStyle
  }>(INITIAL_EDIT_FORM_STATE)
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Cropper State
  const [imageFile, setImageFile] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)

  const onCropComplete = (_croppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setImageFile(reader.result as string)
        setIsCropping(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCropSave = async () => {
    if (!imageFile || !croppedAreaPixels) return
    setUploadingPhoto(true)
    try {
      const croppedImageBlob = await getCroppedImg(imageFile, croppedAreaPixels)
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' })
        const url = await uploadImage(file, (p) => console.log(`Upload: ${p}%`))
        setEditForm(prev => ({ ...prev, photoUrl: url }))
        toast.success('Photo updated!')
      }
    } catch (err) {
      console.error('Crop save error:', err)
      toast.error('Failed to process image')
    } finally {
      setUploadingPhoto(false)
      setIsCropping(false)
      setImageFile(null)
    }
  }
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // Session & Redirect Checker
  useEffect(() => {
    const checkAuth = async () => {
      // 1. Check for Redirect result (Important for Capacitor/Android)
      try {
        const redirectResult = await handleGoogleRedirectResult();
        if (redirectResult) {
          // Use localStorage and fallback to current route playerId
          const pendingPlayerId = localStorage.getItem('pending_claim_player_id') || playerId;

          if (pendingPlayerId) {
            try {
              console.log('[Auth] Finalizing claim for:', pendingPlayerId);
              const res = await finalizeClaim(pendingPlayerId, redirectResult.user);
              if (res.success) {
                toast.success('Identity verified via Google!');
              }
            } catch (finalizeErr: any) {
              console.error('Finalize claim from redirect failed:', finalizeErr);
              toast.error(finalizeErr.message || 'Verification failed.');
            } finally {
              localStorage.removeItem('pending_claim_player_id');
            }
          }
        }
      } catch (err: any) {
        console.error('Redirect handler failed:', err);
        localStorage.removeItem('pending_claim_player_id');
      }

      // 2. Check Session Access
      if (!user || !player) {
        setHasActiveSession(false)
        if (isEditing) setIsEditing(false)
        return
      }

      const { hasAccess } = await verifyPlayerAccess(player)
      setHasActiveSession(hasAccess)

      // CRITICAL: Proactively sync name and photo if they differ from the official player doc
      // This fixes the "Mehedi Hasan Sourav" vs "Mehedi Hasan" discrepancy instantly
      if (hasAccess && player && user) {
        const officialName = player.name;
        const officialPhoto = player.photoUrl || (player as any).photo;

        if (officialName && (user.displayName !== officialName || (officialPhoto && user.photoURL !== officialPhoto))) {
          console.log("[Profile] Syncing account details with official player data...");
          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, {
            displayName: officialName,
            photoURL: officialPhoto || user.photoURL || null,
            updatedAt: serverTimestamp()
          }).then(() => {
            // Update local state in store for immediate feedback
            useAuthStore.setState((state) => ({
              user: state.user ? {
                ...state.user,
                displayName: officialName,
                photoURL: officialPhoto || state.user.photoURL
              } : null
            }));
          }).catch(e => console.warn("[Profile] Auto-sync failed:", e));
        }

      }
    }
    checkAuth()
  }, [user, player])

  // Split effect for Edit Mode activation - much more responsive
  useEffect(() => {
    if (!player || !hasActiveSession) return;

    const urlParams = new URLSearchParams(location.search);
    const shouldEdit = urlParams.get('edit') === 'true';

    if (shouldEdit && !isEditing) {
      console.log('[Profile] Activating Edit Mode via URL param');
      setEditForm({
        name: player.name || '',
        username: (player as any).username || player.name || '',
        bio: player.bio || '',
        photoUrl: player.photoUrl || (player as any).photo || '',
        dateOfBirth: player.dateOfBirth || '',
        socialLinks: player.socialLinks || [],
        address: player.address || '',
        school: player.school || '',
        role: player.role || 'batsman',
        battingStyle: player.battingStyle || 'right-handed',
        bowlingStyle: player.bowlingStyle || 'right-arm-medium'
      });
      setIsEditing(true);

      // Clean URL after a short delay to ensure state has settled
      const timer = setTimeout(() => {
        navigate(location.pathname, { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.search, player, hasActiveSession, isEditing, navigate, location.pathname])

  // Reset date picker visibility when edit mode changes
  useEffect(() => {
    if (!isEditing) setShowDatePicker(false)
  }, [isEditing])

  // Real-time states
  const [allMatches, setAllMatches] = useState<any[]>([])
  const [dbStats, setDbStats] = useState<any[]>([])
  const [liveData, setLiveData] = useState<Record<string, any>>({})
  const [tournaments, setTournaments] = useState<Record<string, any>>({})

  // 0. Listen to Tournaments (to resolve IDs to names)
  useEffect(() => {
    const q = collection(db, 'tournaments')
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tourneys: Record<string, any> = {}
      snapshot.docs.forEach(doc => {
        tourneys[doc.id] = { id: doc.id, ...doc.data() }
      })
      setTournaments(tourneys)
    })
    return () => unsubscribe()
  }, [])

  // 1. Listen to the Player document in real-time
  useEffect(() => {
    if (!playerId) return
    const docRef = doc(db, 'players', playerId)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const playerData = { id: docSnap.id, ...docSnap.data() } as Player
        setPlayer(playerData)
        if (playerData.squadId) {
          squadService.getById(playerData.squadId).then(s => s && setSquadName(s.name))
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [playerId])

  // 2. Listen to ALL matches (to handle deletions instantly)
  useEffect(() => {
    const q = collection(db, 'matches')
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setAllMatches(matches)
    })
    return () => unsubscribe()
  }, [])

  // 3. Listen to playerMatchStats for this player
  useEffect(() => {
    if (!playerId) return
    const q = query(collection(db, 'playerMatchStats'), where('playerId', '==', playerId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => doc.data())
      setDbStats(stats)
    })
    return () => unsubscribe()
  }, [playerId])

  // 4. Managed Innings Listeners for Participating Matches
  useEffect(() => {
    if (!playerId || allMatches.length === 0) return

    const participatingMatches = allMatches.filter(m => {
      const inXI = (m.teamAPlayingXI || []).includes(playerId) || (m.teamBPlayingXI || []).includes(playerId)
      return inXI
    })

    const unsubscribes: (() => void)[] = []

    participatingMatches.forEach(m => {
      // Team A
      unsubscribes.push(onSnapshot(doc(db, 'matches', m.id, 'innings', 'teamA'), (ds) => {
        if (ds.exists()) setLiveData(prev => ({ ...prev, [`${m.id}_teamA`]: ds.data() }))
      }))
      // Team B
      unsubscribes.push(onSnapshot(doc(db, 'matches', m.id, 'innings', 'teamB'), (ds) => {
        if (ds.exists()) setLiveData(prev => ({ ...prev, [`${m.id}_teamB`]: ds.data() }))
      }))
    })

    return () => unsubscribes.forEach(unsub => unsub())
  }, [playerId, allMatches])

  // 5. CALCULATE EVERYTHING REACTIVELY
  const { mergedMatches, careerStats } = useMemo(() => {
    if (!player) return { mergedMatches: [], careerStats: null }

    const validMatchMap = new Map(allMatches.map(m => [m.id, m]))
    // Process Live Data for this player
    const processedLiveEntries: any[] = []
    allMatches.forEach(m => {
      // Rule 1: Match must have started (at least one innings doc must exist or match marked as live)
      const status = m.status?.toLowerCase()
      const hasStarted = status === 'live' || status === 'completed' || status === 'finished' || status === 'innings break' || m.ballsBowled > 0 || m.overs > 0
      if (!hasStarted) return

      const xiA: string[] = m.teamAPlayingXI || []
      const xiB: string[] = m.teamBPlayingXI || []
      const inA = xiA.includes(playerId || '')
      const inB = xiB.includes(playerId || '')
      if (!inA && !inB) return

      const mySide = inA ? 'teamA' : 'teamB'
      const oppSide = inA ? 'teamB' : 'teamA'
      const myInnings = liveData[`${m.id}_${mySide}`]
      const oppInnings = liveData[`${m.id}_${oppSide}`]

      const batsStat = myInnings?.batsmanStats?.find((b: any) => b.batsmanId === playerId)
      const isOut = (myInnings?.fallOfWickets || []).some((f: any) => f.batsmanId === playerId)
      const bowlStat = oppInnings?.bowlerStats?.find((bw: any) => bw.bowlerId === playerId)

      const opponentName = inA ? (m.teamBName || m.teamB || 'Opponent') : (m.teamAName || m.teamA || 'Opponent')

      const b = Number(batsStat?.balls || 0)
      const bb = Number(bowlStat?.ballsBowled || 0)

      const entry = {
        matchId: m.id,
        opponentName,
        date: m.date || new Date().toISOString(),
        result: m.result || (m.status?.toLowerCase() === 'live' ? 'Live' : ''),
        isLive: m.status?.toLowerCase() === 'live',
        runs: Number(batsStat?.runs || 0),
        balls: b,
        fours: Number(batsStat?.fours || 0),
        sixes: Number(batsStat?.sixes || 0),
        notOut: Boolean(batsStat) && !isOut,
        out: isOut,
        wickets: Number(bowlStat?.wickets || 0),
        runsConceded: Number(bowlStat?.runsConceded || 0),
        ballsBowled: bb,
        oversBowled: bowlStat?.overs || (bb / 6),
        // Strict Participation Rules (Only counts as innings if they actually did something)
        batted: b > 0 || isOut,
        bowled: bb > 0 || (bowlStat?.overs && Number(bowlStat.overs) > 0),
        inPlayingXI: true // Rule: they are in Playing XI and match started
      }
      processedLiveEntries.push(entry)
    })

    // Filter DB stats for only existing matches (handle deletions)
    const validDbStatsFiltered = dbStats.filter(s => validMatchMap.has(s.matchId))

    // To prevent double counting and ensure matches count even if no stats documented yet in playerMatchStats
    // We combine them but use matchId as unique key
    const uniqueMatchStats = new Map<string, any>()

    // 1. Add DB stats first
    validDbStatsFiltered.forEach(s => {
      uniqueMatchStats.set(s.matchId, { ...s, inPlayingXI: true })
    })

    // 2. Add/Override with Live stats
    processedLiveEntries.forEach(l => {
      uniqueMatchStats.set(l.matchId, l)
    })

    const finalCombinedList = Array.from(uniqueMatchStats.values())

    // Recalculate Career Totals
    let batt = { innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, highest: 0, isHighestNotOut: false, fifties: 0, hundreds: 0, ducks: 0, highestScoreMatchId: '' }
    let bowl = { innings: 0, balls: 0, runs: 0, wickets: 0, bestW: 0, bestR: 0, threeW: 0, fiveW: 0, maidens: 0 }

    finalCombinedList.forEach(s => {
      const r = Number(s.runs || 0)
      const b = Number(s.balls || 0)
      const isActuallyOut = s.out === true
      const isActuallyNotOut = !isActuallyOut && (s.notOut === true || b > 0)

      // Batting Innings Rule: Only if faced ball or dismissed
      if (b > 0 || isActuallyOut) {
        batt.innings++
        batt.runs += r
        batt.balls += b
        batt.fours += Number(s.fours || 0)
        batt.sixes += Number(s.sixes || 0)
        if (isActuallyOut) batt.outs++

        if (r > batt.highest) {
          batt.highest = r
          batt.isHighestNotOut = isActuallyNotOut
          batt.highestScoreMatchId = s.matchId
        } else if (r === batt.highest && isActuallyNotOut) {
          batt.isHighestNotOut = true
          // If equal score but this one is not out, update matchId (optional preference)
          batt.highestScoreMatchId = s.matchId
        }

        if (r >= 100) batt.hundreds++
        else if (r >= 50) batt.fifties++

        if (r === 0 && isActuallyOut) batt.ducks++
      }

      // Bowling Innings Rule: Only if bowled a ball
      const bb = Number(s.ballsBowled || (Number(s.oversBowled || 0) * 6) || 0)
      if (bb > 0) {
        bowl.innings++
        bowl.balls += bb
        const rc = Number(s.runsConceded || 0)
        const wkts = Number(s.wickets || 0)
        bowl.runs += rc
        bowl.wickets += wkts

        // Best Bowling Figures
        if (wkts > bowl.bestW) {
          bowl.bestW = wkts
          bowl.bestR = rc
        } else if (wkts === bowl.bestW) {
          if (bowl.bestW > 0 && rc < bowl.bestR) {
            bowl.bestR = rc
          } else if (bowl.bestW === 0) {
            // If still 0 wickets, just track the one with least runs
            if (bowl.bestR === 0 || rc < bowl.bestR) bowl.bestR = rc
          }
        }

        if (wkts >= 5) bowl.fiveW++
        else if (wkts >= 3) bowl.threeW++

        // Maidens logic: if overs recorded and runs conceded is 0 for that over (simplified)
        // In full engine, we'd check over-by-over, but here we can check s.maidens if provided by backend
        bowl.maidens += Number(s.maidens || (wkts > 0 && rc === 0 ? 1 : 0))
      }
    })

    const bowlBest = bowl.bestW > 0 || bowl.bestR > 0 ? `${bowl.bestW}-${bowl.bestR}` : '0-0'

    const career = {
      matches: finalCombinedList.length,
      batting: {
        ...batt,
        average: batt.outs > 0 ? batt.runs / batt.outs : (batt.runs > 0 ? batt.runs : 0),
        strikeRate: batt.balls > 0 ? (batt.runs / batt.balls) * 100 : 0,
        highestScore: batt.highest,
        isHighestNotOut: batt.isHighestNotOut,
        highestScoreMatchId: batt.highestScoreMatchId
      },
      bowling: {
        ...bowl,
        overs: bowl.balls / 6,
        economy: bowl.balls > 0 ? (bowl.runs / (bowl.balls / 6)) : 0,
        average: bowl.wickets > 0 ? bowl.runs / bowl.wickets : 0,
        best: bowlBest,
        wickets: bowl.wickets,
        runsConceded: bowl.runs
      }
    }

    // Prepare match list for display
    const mergedForDisplay = finalCombinedList.map(s => {
      const m = validMatchMap.get(s.matchId)
      const t = m?.tournamentId ? tournaments[m.tournamentId] : null
      return {
        ...s,
        opponentName: s.opponentName || (m ? (m.teamAId === player.squadId ? (m.teamBName || m.teamB) : (m.teamAName || m.teamA)) : 'Opponent'),
        date: s.date || m?.date,
        result: s.result || m?.result || '',
        tournamentName: t?.name || m?.tournamentName || m?.series || 'BatchCrick League',
        isLive: s.isLive || m?.status?.toLowerCase() === 'live'
      }
    })
      .sort((a, b) => {
        if (a.isLive && !b.isLive) return -1
        if (!a.isLive && b.isLive) return 1

        const getMillis = (d: any) => {
          if (!d) return 0
          if (d && typeof d.toDate === 'function') return d.toDate().getTime() // Handle Firestore Timestamp
          if (d instanceof Date) return d.getTime()
          const p = new Date(d).getTime()
          return isNaN(p) ? 0 : p
        }

        return getMillis(b.date) - getMillis(a.date)
      })

    return { mergedMatches: mergedForDisplay, careerStats: career }
  }, [player, allMatches, dbStats, liveData, playerId, tournaments])

  if (loading) {
    return <PlayerProfileSkeleton />
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Player not found</p>
          <Link
            to="/players"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Players
          </Link>
        </div>
      </div>
    )
  }

  const age = player.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Matches' },
    { id: 'player-info', label: 'Player Info' },
  ]

  // Filter matches based on viewMode - only show if they actually participated (min 1 ball)
  const filteredMatches = mergedMatches
    .filter((m: any) => {
      if (viewMode === 'batting') {
        const b = Number(m.balls || 0)
        return b > 0 || m.out
      }
      if (viewMode === 'bowling') {
        const bb = Number(m.ballsBowled || (Number(m.oversBowled || 0) * 6) || 0)
        return bb > 0
      }
      return true
    })

  // Get recent matches for form display
  const recentForm = filteredMatches
    .slice(0, 10) // Show up to 10 last matches
    .map((match: any) => {
      return {
        runs: Number(match.runs || 0),
        balls: Number(match.balls || 0),
        isNotOut: match.notOut === true || (match.out === false && Number(match.balls || 0) > 0),
        wickets: Number(match.wickets || 0),
        runsConceded: Number(match.runsConceded || 0),
        opponent: match.opponentName || 'Opponent',
        matchId: match.matchId,
      }
    })

  // Prioritize calculated stats derived from history & live data
  const matchesCount = Number(careerStats?.matches || 0)
  const battingStats = careerStats?.batting
  const bowlingStats = careerStats?.bowling

  // Batting Stats
  const battingInnings = Number(battingStats?.innings || 0)
  const runs = Number(battingStats?.runs || 0)
  const averageValue = Number(battingStats?.average || 0)
  const average = averageValue > 0 ? averageValue.toFixed(1) : (runs > 0 ? runs : '-')
  const strikeRate = Number(battingStats?.strikeRate || 0).toFixed(1)
  const highestScoreRaw = battingStats?.highestScore
  const isHighestNotOut = battingStats?.isHighestNotOut
  const highestScoreMatchId = battingStats?.highestScoreMatchId

  const highestScore = highestScoreRaw !== undefined ? (
    <span className="relative">
      {highestScoreRaw}
      {isHighestNotOut && <span className="absolute -top-1 -right-2 text-[10px] text-slate-900 font-bold">*</span>}
    </span>
  ) : '-'

  const hundreds = Number(battingStats?.hundreds || 0)
  const fifties = Number(battingStats?.fifties || 0)
  const fours = Number(battingStats?.fours || 0)
  const sixes = Number(battingStats?.sixes || 0)

  // Bowling Stats
  const bowlingInnings = Number(bowlingStats?.innings || 0)
  const wickets = Number(bowlingStats?.wickets || 0)
  const economy = Number(bowlingStats?.economy || 0).toFixed(1)
  const bowlingAverage = wickets > 0 ? Number(bowlingStats?.average || 0).toFixed(1) : '-'
  const bowlingBest = bowlingStats?.best || '0-0'
  const threeW = Number(bowlingStats?.threeW || 0)
  const fiveW = Number(bowlingStats?.fiveW || 0)
  const maidens = Number(bowlingStats?.maidens || 0)
  const ducks = Number(battingStats?.ducks || 0)

  // Internal component for career grid cells
  const StatCell = ({ label, value, highlight, labelSmall, matchId }: { label: string, value: any, highlight?: boolean, labelSmall?: boolean, matchId?: string }) => {
    const className = clsx("flex flex-col items-center justify-center py-7 px-1 text-center transition-all", matchId && "hover:bg-slate-50 cursor-pointer group")
    const content = (
      <>
        <div className={`text-2xl font-bold mb-1 ${highlight ? 'text-sky-600 group-hover:text-sky-700' : 'text-slate-800'}`}>
          {value}
        </div>
        <div className={`${labelSmall ? 'text-[11px]' : 'text-[13px]'} font-bold text-slate-500 uppercase tracking-tight`}>
          {label}
        </div>
      </>
    )

    if (matchId) {
      return (
        <Link to={`/match/${matchId}`} className={className}>
          {content}
        </Link>
      )
    }

    return (
      <div className={className}>
        {content}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white relative pb-24">
      <PageHeader
        title={player.name}
        subtitle={squadName || "Player Profile"}
      />

      {/* Sticky Identity Section (Hero + Tabs) */}
      <div className="sticky top-[var(--status-bar-height)] z-[60] shadow-2xl transition-all duration-300">
        <div className="bg-slate-950 text-white relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-6 relative z-10">

            {/* Action Button - Top Right */}
            {/* Removed action buttons from header */}

            <div className="flex flex-row items-center gap-4 md:gap-8">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-52 md:h-52 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border-2 md:border-4 border-slate-950 relative z-10 shadow-[0_0_25px_rgba(16,185,129,0.25)] md:shadow-[0_0_50px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_70px_rgba(16,185,129,0.5)] transition-all duration-700">
                  <PlayerAvatar
                    photoUrl={player.photoUrl || (player as any).photo}
                    name={player.name}
                    size="xl"
                    className="w-full h-full border-none shadow-none bg-transparent"
                  />
                </div>
                {/* Outer Pulse */}
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-20 pointer-events-none"></div>
              </div>

              <div className="flex-1 text-left min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tighter leading-none truncate">
                    {player.name}
                  </h1>

                  {/* HEADER ACTIONS - Edit Button for Owner */}
                  {hasActiveSession && !isEditing && (
                    <div className="flex gap-2 animate-in fade-in zoom-in duration-500">
                      <button
                        onClick={() => {
                          setEditForm({
                            name: player.name || '',
                            username: (player as any).username || player.name || '',
                            bio: player.bio || '',
                            photoUrl: player.photoUrl || (player as any).photo || '',
                            dateOfBirth: player.dateOfBirth || '',
                            socialLinks: player.socialLinks || [],
                            address: player.address || '',
                            school: player.school || '',
                            role: player.role || 'batsman',
                            battingStyle: player.battingStyle || 'right-handed',
                            bowlingStyle: player.bowlingStyle || 'right-arm-medium'
                          })
                          setIsEditing(true)
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-white text-slate-950 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-50"
                      >
                        <Edit className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-600" />
                        Edit Profile
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-6 text-slate-400 font-medium">
                  {player.batch && (
                    <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-100">
                      <span className="text-emerald-500 text-xs md:text-base">📚</span>
                      <span className="text-[10px] md:text-sm whitespace-nowrap">Batch {player.batch}</span>
                    </span>
                  )}
                  {squadName && (
                    <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-200">
                      <span className="text-emerald-500 text-xs md:text-base">👥</span>
                      <span className="text-[10px] md:text-sm whitespace-nowrap">{squadName}</span>
                    </span>
                  )}
                  {age && (
                    <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-300">
                      <span className="text-emerald-500 text-xs md:text-base">🎂</span>
                      <span className="text-[10px] md:text-sm whitespace-nowrap">{age} Yrs</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Refined Tabs (Now part of the same sticky container) */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-4 text-sm font-bold relative transition-all ${activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-t-full shadow-[0_-2px_8px_rgba(16,185,129,0.3)]"></span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {recentForm.length > 0 && (
              <div className="animate-in slide-in-from-bottom-4 duration-700 mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Recent Form <span className="text-slate-400 font-bold text-sm ml-1">(Last 10)</span>
                  </h3>
                  <button onClick={() => setActiveTab('matches')} className="text-blue-600 text-sm font-bold hover:underline">
                    See More
                  </button>
                </div>
                <div className="flex flex-nowrap overflow-x-auto gap-3 pb-2 scrollbar-none">
                  {recentForm.map((form, idx) => (
                    <Link
                      key={idx}
                      to={`/match/${form.matchId}`}
                      className="group flex flex-col justify-center items-center p-4 bg-white rounded-2xl shrink-0 min-w-[125px] h-[105px] text-center shadow-sm border border-slate-100 transition-all hover:shadow-md hover:border-blue-200"
                    >
                      <div className="flex items-baseline justify-center gap-1.5 mb-2">
                        {viewMode === 'batting' ? (
                          <>
                            <span className="text-slate-800 text-2xl font-bold relative leading-none">
                              {form.runs}
                              {form.isNotOut && (
                                <span className="absolute -top-1 -right-3 text-[14px] font-bold text-slate-900">
                                  *
                                </span>
                              )}
                            </span>
                            <span className="text-[12px] font-bold text-slate-600 leading-none">({form.balls})</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-800 text-2xl font-bold leading-none">
                              {form.wickets}
                            </span>
                            <span className="text-slate-400 text-lg font-bold leading-none mx-0.5">-</span>
                            <span className="text-slate-800 text-xl font-bold leading-none">
                              {form.runsConceded}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-slate-600 text-[11px] font-bold uppercase tracking-tight truncate w-full px-1">
                        {formatOpponentName(form.opponent)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Career Title */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="capitalize">{viewMode} Career</span>
                <img src={viewMode === 'batting' ? cricketBatIcon : cricketBallIcon} className="w-5 h-5 object-contain" alt="" />
              </h3>
            </div>

            {/* Premium Career Grid Design */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
              {viewMode === 'batting' ? (
                <div className="divide-y divide-slate-200">
                  {/* Row 1 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Matches" value={matchesCount} />
                    <StatCell label="Innings" value={battingInnings} />
                    <StatCell label="Runs" value={runs} />
                    <StatCell label="Highest Score" value={highestScore} highlight labelSmall matchId={highestScoreMatchId} />
                  </div>
                  {/* Row 2 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="100s" value={hundreds} />
                    <StatCell label="50s" value={fifties} />
                    <StatCell label="SR" value={strikeRate} />
                    <StatCell label="Avg" value={average} />
                  </div>
                  {/* Row 3 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Fours" value={fours} />
                    <StatCell label="Sixes" value={sixes} />
                    <StatCell label="Duck Out" value={ducks} />
                    <StatCell label="Rank" value="#--" />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {/* Row 1 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Matches" value={matchesCount} />
                    <StatCell label="Innings" value={bowlingInnings} />
                    <StatCell label="Wickets" value={wickets} />
                    <StatCell label="Best" value={bowlingBest} />
                  </div>
                  {/* Row 2 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Econ" value={economy} />
                    <StatCell label="3 Wkt" value={threeW} />
                    <StatCell label="5 Wkt" value={fiveW} />
                    <StatCell label="Avg" value={bowlingAverage} />
                  </div>
                  {/* Row 3 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="SR" value={bowlingAverage !== '-' ? (Number(bowlingInnings * 6) / (wickets || 1)).toFixed(1) : '-'} />
                    <StatCell label="Maiden" value={maidens > 0 ? maidens : '--'} />
                    <StatCell label="Rank" value="#--" />
                    <StatCell label="" value="" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Performance History
              </h3>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {viewMode === 'batting' ? 'Batting Records' : 'Bowling Records'}
              </div>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl text-slate-300">📊</span>
                </div>
                <h4 className="text-slate-900 font-bold mb-1">No matches found</h4>
                <p className="text-slate-400 text-sm">This player hasn't appeared in any recorded matches yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredMatches.map((match: any, idx: number) => {
                  const matchId = match.matchId || match.id
                  if (!matchId) return null
                  const isNotOut = match.notOut === true || (match.out === false && Number(match.balls || 0) > 0)
                  const runs = match.runs ?? match.batting?.runs ?? 0
                  const balls = match.balls ?? match.batting?.balls ?? 0
                  const wickets = match.bowlingWickets ?? match.bowling?.wickets ?? 0
                  const runsConceded = match.bowlingRuns ?? match.bowling?.runsConceded ?? 0
                  const overs = match.overs ?? match.bowling?.overs ?? '0.0'

                  // Match date logic
                  const matchDate = match.date
                  const dateObj = matchDate?.toDate ? matchDate.toDate() : new Date(matchDate)
                  const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) : 'Unknown Date'

                  return (
                    <Link
                      key={idx}
                      to={`/match/${matchId}`}
                      className="group bg-white rounded-3xl border border-slate-100 p-5 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          {/* Date Block */}
                          <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 shrink-0 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {!isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString(undefined, { month: 'short' }) : '---'}
                            </span>
                            <span className="text-lg font-black text-slate-700 leading-none">
                              {!isNaN(dateObj.getTime()) ? dateObj.getDate() : '--'}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                vs {match.opponentName || 'Opponent'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">{formattedDate}</span>
                            </div>
                            <h4 className="text-base sm:text-lg font-bold text-slate-800 truncate">
                              {match.tournamentName}
                            </h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                          {/* Main Stats */}
                          <div className="text-right">
                            {viewMode === 'batting' ? (
                              <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                                    {runs}
                                  </span>
                                  {isNotOut && <span className="text-lg font-black text-emerald-600 leading-none">*</span>}
                                  <span className="text-[11px] font-bold text-slate-400 ml-1">({balls})</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Runs Scored</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-end">
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                                    {wickets}
                                  </span>
                                  <span className="text-lg font-bold text-slate-300 mx-0.5">/</span>
                                  <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                                    {runsConceded}
                                  </span>
                                  <span className="text-[11px] font-bold text-slate-400 ml-1">({overs})</span>
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Bowling Figure</span>
                              </div>
                            )}
                          </div>

                          {/* Result Indicator */}
                          <div className="hidden sm:block">
                            {match.result?.toLowerCase() === 'won' && (
                              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                                <span className="text-[10px] font-black italic">W</span>
                              </div>
                            )}
                            {match.result?.toLowerCase() === 'lost' && (
                              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                                <span className="text-[10px] font-black italic">L</span>
                              </div>
                            )}
                            {(!match.result || match.result?.toLowerCase() === 'tied' || match.result?.toLowerCase() === 'n/r') && (
                              <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-white">
                                <span className="text-[10px] font-black italic">-</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'player-info' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-20">

            {/* Photo Edit (Only if editing) */}
            {isEditing && (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center">
                <div className="relative inline-block group">
                  <div className="w-32 h-32 rounded-full bg-slate-50 border-4 border-white shadow-xl overflow-hidden">
                    {uploadingPhoto ? (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50">
                        <span className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin"></span>
                      </div>
                    ) : (
                      <img src={editForm.photoUrl || (player as any).photo || "https://placehold.co/200"} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 w-10 h-10 bg-emerald-500 rounded-full shadow-lg border-2 border-white flex items-center justify-center cursor-pointer hover:bg-emerald-400 transition-all hover:scale-110 active:scale-95">
                    <Camera className="w-5 h-5 text-white" />
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">Profile Photo</p>
              </div>
            )}

            {/* PLAYER PROFILE CROPPER MODAL */}
            {isCropping && (
              <div className="fixed inset-0 z-[1000] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
                <div className="relative w-full aspect-square max-w-sm bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                  <Cropper
                    image={imageFile || ''}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    cropShape="round"
                    showGrid={false}
                  />
                </div>

                <div className="mt-8 w-full max-w-sm space-y-6 px-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-center">Zoom & Position</p>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsCropping(false)}
                      className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs border border-white/5"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCropSave}
                      disabled={uploadingPhoto}
                      className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all uppercase tracking-widest text-xs shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {uploadingPhoto ? 'Processing...' : 'Save Photo'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Playing Info Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
              <div className="px-8 py-2">
                <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Role:</span>
                  {isEditing ? (
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as PlayerRole })}
                      className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                    >
                      <option value="batsman">Batsman</option>
                      <option value="bowler">Bowler</option>
                      <option value="all-rounder">All Rounder</option>
                      <option value="wicket-keeper">Wicket Keeper</option>
                    </select>
                  ) : (
                    <span className="text-sm font-bold text-slate-800 capitalize">{player.role || 'Batter'}</span>
                  )}
                </div>
                <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Bats:</span>
                  {isEditing ? (
                    <select
                      value={editForm.battingStyle}
                      onChange={(e) => setEditForm({ ...editForm, battingStyle: e.target.value as BattingStyle })}
                      className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                    >
                      <option value="right-handed">Right Handed</option>
                      <option value="left-handed">Left Handed</option>
                    </select>
                  ) : (
                    <span className="text-sm font-bold text-slate-800 capitalize">{player.battingStyle || 'Right Handed'}</span>
                  )}
                </div>
                <div className={clsx("flex items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Bowl:</span>
                  {isEditing ? (
                    <select
                      value={editForm.bowlingStyle}
                      onChange={(e) => setEditForm({ ...editForm, bowlingStyle: e.target.value as BowlingStyle })}
                      className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                    >
                      <option value="right-arm-fast">Right Arm Fast</option>
                      <option value="right-arm-medium">Right Arm Medium</option>
                      <option value="right-arm-spin">Right Arm Spin</option>
                      <option value="left-arm-fast">Left Arm Fast</option>
                      <option value="left-arm-medium">Left Arm Medium</option>
                      <option value="left-arm-spin">Left Arm Spin</option>
                    </select>
                  ) : (
                    <span className="text-sm font-bold text-slate-800 capitalize">{player.bowlingStyle || 'Right Arm Medium'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Info Card */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 px-2 flex items-center gap-2">
                {isEditing ? 'Personal Details' : `About ${player.name.split(' ')[0]}`}
              </h3>
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
                <div className="px-8 py-2">
                  <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Name:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-800">{player.name}</span>
                    )}
                  </div>
                  <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Birth:</span>
                    {isEditing ? (
                      <div className="w-full mt-2">
                        <button
                          type="button"
                          onClick={() => setShowDatePicker(!showDatePicker)}
                          className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 outline-none w-full text-left flex items-center justify-between"
                        >
                          <span>{editForm.dateOfBirth ? new Date(editForm.dateOfBirth).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}</span>
                          <ChevronDown size={14} className={clsx("transition-transform duration-200", showDatePicker && "rotate-180")} />
                        </button>
                        <AnimatePresence>
                          {showDatePicker && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="pt-3">
                                <WheelDatePicker
                                  value={editForm.dateOfBirth || new Date().toISOString().split('T')[0]}
                                  onChange={(val) => setEditForm({ ...editForm, dateOfBirth: val })}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-slate-800">
                        {player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    )}
                  </div>
                  <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">School:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.school}
                        onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                        className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-800">{player.school || 'N/A'}</span>
                    )}
                  </div>
                  <div className="flex py-5 border-b border-slate-50 items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Squad:</span>
                    <span className="text-sm font-bold text-emerald-600 uppercase italic tracking-tighter">{squadName || 'N/A'}</span>
                  </div>
                  <div className={clsx("flex border-b border-slate-50 items-center justify-between gap-4", isEditing ? "flex-col items-start py-2" : "py-5")}>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0">Address:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-2 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full text-left"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-800">{player.address || 'N/A'}</span>
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex py-5 flex-col items-start gap-4">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 mt-2">Bio:</span>
                      <textarea
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        className="text-sm font-bold text-slate-800 bg-slate-50 px-3 py-3 rounded-lg border-none outline-none focus:ring-2 focus:ring-emerald-500/20 w-full min-h-[100px] resize-none"
                        placeholder="Add a bio..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Social Edit Hub (Only if editing) */}
            {isEditing && (
              <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/60">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Connect Hub</h3>
                  <span className="text-[10px] font-black text-white bg-slate-900 px-3 py-1 rounded-full uppercase tracking-widest">{editForm.socialLinks.length}/3 Socials</span>
                </div>
                <div className="space-y-3">
                  {editForm.socialLinks.map((link, idx) => {
                    const Icon = link.platform === 'facebook' ? Facebook :
                      link.platform === 'instagram' ? Instagram :
                        link.platform === 'x' ? Twitter :
                          link.platform === 'linkedin' ? Linkedin : Globe
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 group transition-all">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-600 border border-slate-100 shadow-sm">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-black text-slate-800 truncate">@{link.username}</div>
                          <div className="text-[9px] font-bold text-slate-400 truncate tracking-tight">{link.url}</div>
                        </div>
                        <button onClick={() => handleRemoveLink(idx)} className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 rounded-lg text-rose-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}

                  {editForm.socialLinks.length < 3 && (
                    <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 border-dashed">
                      <input
                        type="text"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        placeholder="Paste Profile URL"
                        className="flex-1 px-4 py-2.5 bg-transparent outline-none text-[11px] font-medium"
                      />
                      <button
                        onClick={handleAddLink}
                        disabled={!newLinkUrl}
                        className="px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-95 uppercase tracking-widest"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Bio Section (Non-Editing) */}
            {!isEditing && player.bio && (
              <div className="bg-white/50 backdrop-blur-md rounded-3xl p-8 border border-white/50 shadow-sm">
                <p className="text-sm text-slate-600 leading-relaxed font-medium italic">
                  "{player.bio}"
                </p>
              </div>
            )}

            {/* Social Connect (Floating Style - Non Editing) */}
            {!isEditing && player.socialLinks && player.socialLinks.length > 0 && (
              <div className="flex items-center justify-center gap-6 py-4">
                {player.socialLinks.map((link: SocialLink, idx: number) => {
                  const Icon = link.platform === 'facebook' ? Facebook :
                    link.platform === 'instagram' ? Instagram :
                      link.platform === 'x' ? Twitter :
                        link.platform === 'linkedin' ? Linkedin : Globe;

                  return (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-500 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-all border border-slate-50">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest">
                        {link.platform}
                      </span>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Inline Action Section (Toggle Edit) - MOVED TO BOTTOM */}
            {!isEditing && hasActiveSession && (
              <div className="flex justify-center px-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditForm({
                      name: player.name || '',
                      username: (player as any).username || player.name || '',
                      bio: player.bio || '',
                      photoUrl: player.photoUrl || (player as any).photo || '',
                      dateOfBirth: player.dateOfBirth || '',
                      socialLinks: player.socialLinks || [],
                      address: player.address || '',
                      school: player.school || '',
                      role: player.role || 'batsman',
                      battingStyle: player.battingStyle || 'right-handed',
                      bowlingStyle: player.bowlingStyle || 'right-arm-medium'
                    })
                    setIsEditing(true)
                  }}
                  className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 transition-all active:scale-95 hover:bg-slate-800"
                >
                  <Edit className="w-4 h-4 text-sky-400" />
                  Edit My Profile
                </button>
              </div>
            )}

            {/* Save Buttons at bottom (Floating when editing) */}
            {isEditing && (
              <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 p-4 z-[110] flex gap-4 max-w-2xl mx-auto rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.1)]">
                <button
                  onClick={async () => {
                    setIsEditing(false)
                    await signOut(auth)
                  }}
                  className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 font-black text-[10px] rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-[0.2em] active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black text-[10px] rounded-2xl hover:from-emerald-500 hover:to-teal-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 uppercase tracking-[0.2em] active:scale-95"
                >
                  {saving ? 'Saving...' : 'Confirm Changes'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Floating Toggle FAB (CREX Style) - HORIZONTAL BOTTOM RIGHT */}
      <div className="fixed bottom-6 right-6 z-[100] bg-slate-900/90 backdrop-blur-xl rounded-2xl p-1 shadow-2xl border border-white/10 flex flex-row items-center gap-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <button
          onClick={() => setViewMode('batting')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'batting'
            ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40 transform scale-110'
            : 'hover:bg-white/5 opacity-50'
            }`}
          title="Batting Stats"
        >
          <img src={cricketBatIcon} alt="Batting" className="w-7 h-7 object-contain" />
        </button>
        <button
          onClick={() => setViewMode('bowling')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'bowling'
            ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40 transform scale-110'
            : 'hover:bg-white/5 opacity-50'
            }`}
          title="Bowling Stats"
        >
          <img src={cricketBallIcon} alt="Bowling" className="w-7 h-7 object-contain" />
        </button>
      </div>


    </div>
  )
}

