import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToLiveMatches } from '../services/matchesService'
import { matchesAPI, playersAPI } from '../services/api'
import { adminLogin } from '../services/adminsService'
import { useFirebase } from '../contexts/FirebaseContext'
import {
  processBallEvent,
  DELIVERY_TYPES,
  WICKET_TYPES as ICC_WICKET_TYPES,
  shouldRotateStrike,
  isOverComplete,
  formatOvers as formatOversICC,
  isWicketAllowedOnFreeHit,
} from '../utils/iccEngine/ruleEngine'
import { ScoreButton, StatCard } from '../components/ui'

const MAX_PLAYING_XI = 11

// Keep local constants for backward compatibility
const WICKET_TYPES = [
  'Bowled',
  'Caught',
  'Caught & Bowled',
  'LBW',
  'Run Out',
  'Stumped',
  'Hit Wicket',
]

const EXTRA_TYPES = {
  NO_BALL: 'no-ball',
  WIDE: 'wide',
  LEG_BYE: 'leg-bye',
  BYE: 'bye',
}

const OVER_COMPLETED_MESSAGE = 'Over completed. Select a new bowler for the next over.'
const INNINGS_BREAK_MESSAGE = 'First innings complete. Select new batters and a bowler to start the chase.'
const MAX_WICKETS = 10

const ballsToOvers = (balls = 0) => {
  const totalBalls = Number.isFinite(balls) ? balls : 0
  const overs = Math.floor(totalBalls / 6)
  const remainingBalls = totalBalls % 6
  return `${overs}.${remainingBalls}`
}

const oversToBalls = (oversValue = '0.0') => {
  if (oversValue === undefined || oversValue === null) return 0
  const value = typeof oversValue === 'number' ? oversValue.toString() : oversValue
  const [oversPart, ballsPart] = value.split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

const cloneLineup = (lineup = []) => lineup.map((player) => ({ ...player }))

const sortLineupByBattingOrder = (lineup = []) =>
  [...lineup].sort((a, b) => (a.battingPosition || 0) - (b.battingPosition || 0))

const initialiseLineupEntry = (player, battingPosition) => ({
  playerId: player.id,
  name: player.name,
  role: player.role || '',
  photo: player.photo || '',
  battingPosition,
  isCaptain: false,
  isKeeper: false,
  status: 'pending', // pending | batting | out | retired
  isOnStrike: false,
  isOnCrease: false,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  strikeRate: 0,
  bowlingBalls: 0,
  bowlingRuns: 0,
  bowlingWickets: 0,
  economy: 0,
})

const AdminPanel = () => {
  const { currentAdmin, loading } = useFirebase()
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  
  // Match selection
  const [liveMatches, setLiveMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const liveMatchesRef = useRef([])
  const upcomingMatchesRef = useRef([])
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [matchLoading, setMatchLoading] = useState(false)
  const [upcomingLoading, setUpcomingLoading] = useState(false)
  
  // Score state
  const [activeTeam, setActiveTeam] = useState('teamA') // 'teamA' or 'teamB'
  const [scoreLoading, setScoreLoading] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupInfo, setSetupInfo] = useState('')
  const [lineupSaving, setLineupSaving] = useState(false)
  const [stateSaving, setStateSaving] = useState(false)
  
  // Commentary
  const [commentary, setCommentary] = useState('')

  // Squad players and lineup modals
  const [teamAPlayers, setTeamAPlayers] = useState([])
  const [teamBPlayers, setTeamBPlayers] = useState([])
  const playerCacheRef = useRef(new Map())
  const [lineupModalState, setLineupModalState] = useState({
    open: false,
    team: 'teamA',
    selection: {},
    captainId: '',
    keeperId: '',
  })
  const [extraModalState, setExtraModalState] = useState({
    open: false,
    type: null,
    runs: '0',
    batRuns: '0',
  })
  const [wicketModalState, setWicketModalState] = useState({
    open: false,
    type: 'Bowled',
    dismissedPlayerId: '',
    nextBatsmanId: '',
    runs: 0,
    creditToBowler: true,
    creditRunsToBatsman: false,
    assistPlayerId: '',
    assistName: '',
    customAssist: '',
    deliveryType: 'legal',
  })
  const [currentPlayerSelection, setCurrentPlayerSelection] = useState({
    strikerId: '',
    nonStrikerId: '',
    bowlerId: '',
  })
  const [tossSettings, setTossSettings] = useState({
    winner: '',
    decision: '',
  })
const [tossSaving, setTossSaving] = useState(false)
const [tossError, setTossError] = useState('')
  
  // Fast Scoring Interface States
  const [moreOptionsModal, setMoreOptionsModal] = useState({
    open: false,
    type: null, // 'extras' | 'wicket'
  })
  const [strikeChangeModal, setStrikeChangeModal] = useState({
    open: false,
    shouldChange: null,
  })
  const [lastBallHistory, setLastBallHistory] = useState([]) // For undo functionality
  const [editOverModal, setEditOverModal] = useState({
    open: false,
    overNumber: null,
  })
  const [manualAdjustModal, setManualAdjustModal] = useState({
    open: false,
    runs: '',
    wickets: '',
    overs: '',
  })

  const getTeamLineupKey = (team) => (team === 'teamA' ? 'teamAPlayingXI' : 'teamBPlayingXI')

  const getTeamLineup = (match, team = 'teamA') => {
    const key = getTeamLineupKey(team)
    return sortLineupByBattingOrder(match?.[key] || [])
  }

  const getOpponentTeam = (team) => (team === 'teamA' ? 'teamB' : 'teamA')

  const determineBattingTeam = (match) => {
    if (!match) return 'teamA'
    if (match.innings === 'teamA' || match.innings === 'teamB') {
      return match.innings
    }
    const teamAName = match.teamAName || match.team1 || match.teamA
    return match.currentBatting === teamAName ? 'teamA' : 'teamB'
  }

  const updatePlayerCache = (players = []) => {
    players.forEach((player) => {
      if (player?.id) {
        playerCacheRef.current.set(player.id, player)
      }
    })
  }

  const fetchSquadPlayers = useCallback(async (squadId) => {
    if (!squadId) return []
    const response = await playersAPI.getAll({ squadId })
    const playerList = response.data || []
    updatePlayerCache(playerList)
    return playerList
  }, [])

  const loadPlayersForMatch = useCallback(async (match) => {
    if (!match) return
    try {
      const [teamAList, teamBList] = await Promise.all([
        fetchSquadPlayers(match.teamASquadId),
        fetchSquadPlayers(match.teamBSquadId),
      ])
      setTeamAPlayers(Array.isArray(teamAList) ? teamAList : [])
      setTeamBPlayers(Array.isArray(teamBList) ? teamBList : [])
      setError('')
    } catch (playerError) {
      console.error('Error loading squad players:', playerError)
      setError('Failed to load squad players. Please refresh.')
      setTeamAPlayers([])
      setTeamBPlayers([])
    }
  }, [fetchSquadPlayers])

  const openLineupModal = (team) => {
    if (!selectedMatch) return
    
    // Prevent editing if lineup is already set
    const lineupSet = team === 'teamA' ? selectedMatch.teamALineupSet : selectedMatch.teamBLineupSet
    if (lineupSet) {
      setError('Playing XI is already set and cannot be changed.')
      return
    }
    
    setSetupError('')
    setSetupInfo('')
    const lineup = getTeamLineup(selectedMatch, team)
    const selection = {}
    lineup.forEach((player) => {
      if (!player?.playerId) return
      selection[player.playerId] = {
        selected: true,
        battingPosition: player.battingPosition || 0,
      }
    })

    const sourcePlayers = (team === 'teamA' ? teamAPlayers : teamBPlayers) || []

    if (!Array.isArray(sourcePlayers) || sourcePlayers.length === 0) {
      setSetupError('No players found in this squad. Please add players and refresh.')
      setLineupModalState((prev) => ({ ...prev, open: false }))
      return
    }

    if (lineup.length === 0) {
      const autoSelected = sourcePlayers
        .filter((player) => player && player.id)
        .slice(0, MAX_PLAYING_XI)
      autoSelected.forEach((player, index) => {
        selection[player.id] = {
          selected: true,
          battingPosition: index + 1,
        }
      })
      if (sourcePlayers.length > MAX_PLAYING_XI) {
        setSetupInfo(`Auto-selected first ${MAX_PLAYING_XI} players from the squad. Adjust order or replace as needed.`)
      } else {
        setSetupInfo('Squad players auto-filled. Review and update order if required.')
      }
    }

    if (Object.keys(selection).length === 0) {
      setSetupError('Unable to auto-select players. Please choose players manually.')
      setLineupModalState((prev) => ({ ...prev, open: false }))
      return
    }

    const orderedIds = Object.entries(selection)
      .filter(([, value]) => value.selected)
      .sort((a, b) => (a[1].battingPosition || 0) - (b[1].battingPosition || 0))
      .map(([playerId]) => playerId)

    const teamCaptainId =
      (team === 'teamA' ? selectedMatch.teamACaptainId : selectedMatch.teamBCaptainId) ||
      lineup.find((player) => player.isCaptain)?.playerId ||
      orderedIds[0] ||
      ''

    const teamKeeperId =
      (team === 'teamA' ? selectedMatch.teamAKeeperId : selectedMatch.teamBKeeperId) ||
      lineup.find((player) => player.isKeeper)?.playerId ||
      orderedIds[0] ||
      ''

    setLineupModalState({
      open: true,
      team,
      selection,
      captainId: teamCaptainId,
      keeperId: teamKeeperId,
    })
  }

  const closeLineupModal = () => {
    setLineupModalState((prev) => ({
      ...prev,
      open: false,
    }))
    setSetupError('')
    setSetupInfo('')
  }

  const updateSelectionOrdering = (rawSelection) => {
    const selectedEntries = Object.entries(rawSelection)
      .filter(([, value]) => value?.selected)
      .sort((a, b) => (a[1].battingPosition || 0) - (b[1].battingPosition || 0))

    const resequenced = {}
    selectedEntries.forEach(([playerId], index) => {
      resequenced[playerId] = {
        selected: true,
        battingPosition: index + 1,
      }
    })
    return resequenced
  }

  const handleToggleLineupPlayer = (player) => {
    setLineupModalState((prev) => {
      const updatedSelection = { ...prev.selection }
      if (updatedSelection[player.id]?.selected) {
        delete updatedSelection[player.id]
      } else {
        const selectedCount = Object.values(updatedSelection).filter((value) => value.selected).length
        if (selectedCount >= MAX_PLAYING_XI) {
          setSetupError(`You can select up to ${MAX_PLAYING_XI} players for the Playing XI.`)
          return prev
        }
        updatedSelection[player.id] = {
          selected: true,
          battingPosition: selectedCount + 1,
        }
      }

      const resequenced = updateSelectionOrdering(updatedSelection)
      const captainId = resequenced[prev.captainId] ? prev.captainId : ''
      const keeperId = resequenced[prev.keeperId] ? prev.keeperId : ''

      return {
        ...prev,
        selection: resequenced,
        captainId,
        keeperId,
      }
    })
  }

  const handleLineupBattingPositionChange = (playerId, position) => {
    const numericPosition = Math.max(1, Math.min(MAX_PLAYING_XI, Number(position) || 1))
    setLineupModalState((prev) => {
      const selection = { ...prev.selection }
      if (!selection[playerId]) {
        return prev
      }

      selection[playerId] = {
        ...selection[playerId],
        battingPosition: numericPosition,
      }

      const resequenced = updateSelectionOrdering(selection)
      return {
        ...prev,
        selection: resequenced,
      }
    })
  }

  const handleSaveLineup = async () => {
    if (!selectedMatch) return
    const { team, selection, captainId, keeperId } = lineupModalState
    const selectedIds = Object.keys(selection || {})
    if (selectedIds.length === 0) {
      setSetupError('Select at least one player to create the Playing XI.')
      return
    }
    if (selectedIds.length > MAX_PLAYING_XI) {
      setSetupError(`Maximum ${MAX_PLAYING_XI} players can be part of the Playing XI.`)
      return
    }
    if (!captainId) {
      setSetupError('Please choose a captain.')
      return
    }
    if (!keeperId) {
      setSetupError('Please choose a wicketkeeper.')
      return
    }
    
    // Check if both teams have same number of players
    const otherTeam = team === 'teamA' ? 'teamB' : 'teamA'
    const otherTeamLineup = getTeamLineup(selectedMatch, otherTeam)
    const otherTeamLineupSet = otherTeam === 'teamA' ? selectedMatch.teamALineupSet : selectedMatch.teamBLineupSet
    
    // If other team's lineup is already set, validate same number
    if (otherTeamLineupSet && otherTeamLineup.length > 0) {
      if (selectedIds.length !== otherTeamLineup.length) {
        setSetupError(
          `Both teams must have the same number of players. The other team has ${otherTeamLineup.length} players. Please select ${otherTeamLineup.length} players.`
        )
        return
      }
    }

    const orderedPlayers = updateSelectionOrdering(selection)
    const selectedPlayers = sortLineupByBattingOrder(
      Object.entries(orderedPlayers).map(([playerId, value]) => {
        const sourcePlayers = team === 'teamA' ? teamAPlayers : teamBPlayers
        const player = sourcePlayers.find((item) => item.id === playerId)
        if (!player) {
          return null
        }
        return {
          ...initialiseLineupEntry(player, value.battingPosition),
          isCaptain: captainId === player.id,
          isKeeper: keeperId === player.id,
        }
      })
    ).filter(Boolean)

    try {
      setLineupSaving(true)
      const teamKey = getTeamLineupKey(team)
      const payload = {
        [teamKey]: selectedPlayers,
        [`${team}LineupSet`]: true,
        [`${team}CaptainId`]: captainId,
        [`${team}KeeperId`]: keeperId,
        updatedAt: new Date(),
      }
    if (selectedMatch.matchPhase === 'InningsBreak' && team === 'teamB') {
      payload.matchPhase = 'SecondInnings'
      payload.inningsBreakMessage = ''
    }
      await matchesAPI.update(selectedMatchId, payload)
      setSuccess(`${team === 'teamA' ? 'Team A' : 'Team B'} Playing XI updated successfully`)
      setTimeout(() => setSuccess(''), 3000)
      closeLineupModal()
      // Refresh match data and upcoming matches list to update refs
      await loadMatchData(selectedMatchId)
      await loadUpcomingMatches()
    } catch (saveError) {
      console.error('Error saving lineup:', saveError)
      setSetupError(saveError.message || 'Failed to save Playing XI. Please try again.')
    } finally {
      setLineupSaving(false)
    }
  }

  const transformBatter = (
    entry,
    {
      runsAdded = 0,
      ballsAdded = 0,
      foursAdded = 0,
      sixesAdded = 0,
      status,
      isOnStrike,
      isOnCrease,
      dismissalText,
    } = {}
  ) => {
    const runs = (entry.runs || 0) + runsAdded
    const balls = (entry.balls || 0) + ballsAdded
    const fours = (entry.fours || 0) + foursAdded
    const sixes = (entry.sixes || 0) + sixesAdded
    return {
      ...entry,
      runs,
      balls,
      fours,
      sixes,
      strikeRate: balls > 0 ? (runs / balls) * 100 : entry.strikeRate || 0,
      status: status || entry.status,
      isOnStrike: typeof isOnStrike === 'boolean' ? isOnStrike : entry.isOnStrike,
      isOnCrease: typeof isOnCrease === 'boolean' ? isOnCrease : entry.isOnCrease,
      ...(dismissalText !== undefined ? { dismissalText } : {}),
    }
  }

  const transformBowler = (entry, { ballsAdded = 0, runsConcededAdded = 0, wicketsAdded = 0 } = {}) => {
    const bowlingBalls = (entry.bowlingBalls || 0) + ballsAdded
    const bowlingRuns = (entry.bowlingRuns || 0) + runsConcededAdded
    const bowlingWickets = (entry.bowlingWickets || 0) + wicketsAdded
    return {
      ...entry,
      bowlingBalls,
      bowlingRuns,
      bowlingWickets,
      economy: bowlingBalls > 0 ? bowlingRuns / (bowlingBalls / 6) : entry.economy || 0,
      bowlingActive: true,
    }
  }

const buildDismissalDescription = (type, bowlerName = '', fielderName = '') => {
  const bowlerPart = bowlerName ? `b ${bowlerName}` : ''
  const fieldPart = fielderName ? fielderName : ''
  switch (type) {
    case 'Bowled':
      return bowlerPart || 'bowled'
    case 'LBW':
    case 'lbw':
      return `lbw ${bowlerName}`.trim()
    case 'Caught':
      return fieldPart ? `c ${fieldPart} ${bowlerPart}`.trim() : `c & b ${bowlerName}`.trim()
    case 'Caught & Bowled':
      return `c & b ${bowlerName}`.trim()
    case 'Run Out':
      return fieldPart ? `run out (${fieldPart})` : 'run out'
    case 'Stumped':
      return `st ${fielderName || ''} ${bowlerPart}`.trim()
    case 'Hit Wicket':
      return `hit wicket ${bowlerPart}`.trim()
    case 'Retired':
      return 'retired hurt'
    default:
      return type
  }
}

  const handleCurrentPlayerChange = (field, value) => {
    setSetupError('')
    
    // ICC Rule: Prevent same player for striker and non-striker
    if (field === 'strikerId') {
      if (value && value === currentPlayerSelection.nonStrikerId) {
        setSetupError('⚠️ Striker and Non-striker cannot be the same player (ICC Rule).')
        return
      }
    } else if (field === 'nonStrikerId') {
      if (value && value === currentPlayerSelection.strikerId) {
        setSetupError('⚠️ Striker and Non-striker cannot be the same player (ICC Rule).')
        return
      }
    }
    
    // ICC Rule: Prevent same bowler in consecutive overs
    if (field === 'bowlerId') {
      if (
        value &&
        selectedMatch &&
        !selectedMatch.currentBowlerId &&
        selectedMatch.lastOverBowlerId &&
        selectedMatch.lastOverBowlerId === value
      ) {
        setSetupError('⚠️ New over requires a different bowler than the previous over (ICC Rule).')
        return
      }
    }
    
    setCurrentPlayerSelection((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveCurrentPlayers = async () => {
    if (!selectedMatch) return
    setSetupError('')
    const { strikerId, nonStrikerId, bowlerId } = currentPlayerSelection
    if (!strikerId || !nonStrikerId || !bowlerId) {
      setSetupError('Select striker, non-striker, and bowler before saving.')
      return
    }
    // ICC Rule: Validate striker and non-striker are different
    if (strikerId === nonStrikerId) {
      setSetupError('⚠️ Striker and Non-striker cannot be the same player (ICC Rule).')
      return
    }

    const lastOverBowlerId = selectedMatch?.lastOverBowlerId || ''
    if (
      !selectedMatch?.currentBowlerId &&
      lastOverBowlerId &&
      bowlerId === lastOverBowlerId
    ) {
      setSetupError('New over requires a different bowler than the previous over.')
      return
    }

    const battingTeam = activeTeam
    const bowlingTeam = getOpponentTeam(battingTeam)
    const battingLineupKey = getTeamLineupKey(battingTeam)
    const bowlingLineupKey = getTeamLineupKey(bowlingTeam)

    const battingLineup = cloneLineup(selectedMatch[battingLineupKey] || [])
    const bowlingLineup = cloneLineup(selectedMatch[bowlingLineupKey] || [])

    const updatedBattingLineup = battingLineup.map((player) => {
      // ICC Rule: Only 2 players can be on crease at a time (striker and non-striker)
      if (player.playerId === strikerId) {
        return {
          ...player,
          status: 'batting',
          isOnStrike: true,
          isOnCrease: true,
        }
      }
      if (player.playerId === nonStrikerId) {
        return {
          ...player,
          status: 'batting',
          isOnStrike: false,
          isOnCrease: true,
        }
      }
      // ICC Rule: All other players must NOT be on crease
      return {
        ...player,
        isOnStrike: false,
        isOnCrease: false, // Explicitly set to false to prevent multiple players on crease
      }
    })

    const updatedBowlingLineup = bowlingLineup.map((player) => ({
      ...player,
      bowlingActive: player.playerId === bowlerId,
    }))

    const currentBattingName =
      battingTeam === 'teamA'
        ? selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA
        : selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB

    try {
      setStateSaving(true)
      await matchesAPI.update(selectedMatchId, {
        currentStrikerId: strikerId,
        nonStrikerId: nonStrikerId,
        currentBowlerId: bowlerId,
        innings: battingTeam,
        currentBatting: currentBattingName,
        [battingLineupKey]: updatedBattingLineup,
        [bowlingLineupKey]: updatedBowlingLineup,
        pendingBowlerChange: false,
        updatedAt: new Date(),
      })
      setSuccess('Current on-field players updated successfully.')
      setTimeout(() => setSuccess(''), 3000)
      setSetupInfo((prev) => (prev === OVER_COMPLETED_MESSAGE ? '' : prev))
      await loadMatchData(selectedMatchId)
    } catch (stateError) {
      console.error('Error updating current players:', stateError)
      setSetupError(stateError.message || 'Failed to set current players.')
    } finally {
      setStateSaving(false)
    }
  }

  const handleTossChange = (field, value) => {
    setTossError('')
    setTossSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const saveTossSettings = async () => {
    if (!selectedMatch || !selectedMatchId) return
    if (!tossEditable) {
      setTossError('Toss can no longer be edited after the match has started.')
      return
    }
    if (!tossSettings.winner) {
      setTossError('Select the toss-winning team first.')
      return
    }
    if (!tossSettings.decision) {
      setTossError('Select the toss decision.')
      return
    }
    setTossError('')
    setTossSaving(true)
    try {
      const decisionNormalised =
        tossSettings.decision === 'field' ? 'bowl' : tossSettings.decision
      
      // Determine which team should bat first based on toss
      const tossWinnerIsTeamA = tossSettings.winner === selectedMatch.teamASquadId
      const battingTeam = decisionNormalised === 'bat' 
        ? (tossWinnerIsTeamA ? 'teamA' : 'teamB')
        : (tossWinnerIsTeamA ? 'teamB' : 'teamA')
      
      const updatePayload = {
        tossWinnerSquadId: tossSettings.winner,
        tossDecision: decisionNormalised,
        tossSetAt: new Date(),
      }
      
      // ICC Rule: If toss winner chooses to bat, automatically start first innings
      if (decisionNormalised === 'bat' && selectedMatch.status === 'Upcoming') {
        updatePayload.innings = battingTeam
        updatePayload.status = 'Live'
        updatePayload.matchPhase = 'FirstInnings'
        updatePayload.currentBatting = battingTeam === 'teamA' 
          ? (selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA)
          : (selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB)
        
        // Initialize score for batting team if not exists
        if (battingTeam === 'teamA') {
          updatePayload.score = {
            ...selectedMatch.score,
            teamA: {
              runs: 0,
              wickets: 0,
              balls: 0,
              overs: '0.0',
              ...selectedMatch.score?.teamA,
            },
          }
        } else {
          updatePayload.score = {
            ...selectedMatch.score,
            teamB: {
              runs: 0,
              wickets: 0,
              balls: 0,
              overs: '0.0',
              ...selectedMatch.score?.teamB,
            },
          }
        }
      } else if (decisionNormalised === 'bowl' && selectedMatch.status === 'Upcoming') {
        // If toss winner chooses to bowl, set the other team to bat first
        updatePayload.innings = battingTeam
        updatePayload.currentBatting = battingTeam === 'teamA' 
          ? (selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA)
          : (selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB)
      }
      
      await matchesAPI.update(selectedMatchId, updatePayload)
      
      // ICC Rule: Automatically set activeTeam based on toss decision (bat or bowl)
      if (selectedMatch.status === 'Upcoming') {
        // If bat: toss winner bats first, so battingTeam is the winner
        // If bowl: toss winner bowls first, so battingTeam is the opposite team
        setActiveTeam(battingTeam)
      }
      
      setSuccess('Toss details updated.')
      setTimeout(() => setSuccess(''), 2500)
      await loadMatchData(selectedMatchId)
    } catch (tossUpdateError) {
      console.error('Error saving toss settings:', tossUpdateError)
      setTossError(tossUpdateError.message || 'Failed to update toss details.')
    } finally {
      setTossSaving(false)
    }
  }

  const clearTossSettings = async () => {
    if (!selectedMatch || !selectedMatchId) return
    if (!tossEditable) {
      setTossError('Toss can no longer be edited after the match has started.')
      return
    }
    setTossError('')
    setTossSaving(true)
    try {
      await matchesAPI.update(selectedMatchId, {
        tossWinnerSquadId: '',
      })
      setTossSettings({ winner: '', decision: '' })
      setSuccess('Toss details cleared.')
      setTimeout(() => setSuccess(''), 2500)
      await loadMatchData(selectedMatchId)
    } catch (clearError) {
      console.error('Error clearing toss settings:', clearError)
      setTossError(clearError.message || 'Failed to clear toss details.')
    } finally {
      setTossSaving(false)
    }
  }

  const loadMatchData = useCallback(async (matchId) => {
    try {
      setMatchLoading(true)
      const response = await matchesAPI.getById(matchId)
      const match = response.data
      setSelectedMatch(match)
      setTossSettings({
        winner: match.tossWinnerSquadId || '',
        decision: match.tossDecision || '',
      })
      setTossError('')
      setCurrentPlayerSelection({
        strikerId: match.currentStrikerId || '',
        nonStrikerId: match.nonStrikerId || '',
        bowlerId: match.currentBowlerId || '',
      })
      await loadPlayersForMatch(match)

      // Set active team based on innings (ICC Rule: locked based on toss decision)
      if (match.innings === 'teamA' || match.innings === 'teamB') {
        setActiveTeam(match.innings)
      } else if (match.currentBatting === (match.teamAName || match.team1 || match.teamA)) {
        setActiveTeam('teamA')
      } else {
        setActiveTeam('teamB')
      }
      setSetupInfo((prev) => {
        if (!match.currentBowlerId && match.lastOverBowlerId) {
          return OVER_COMPLETED_MESSAGE
        }
        if (prev === OVER_COMPLETED_MESSAGE) {
          return ''
        }
        return prev
      })
    } catch (error) {
      console.error('Error loading match:', error)
      setError('Failed to load match data')
    } finally {
      setMatchLoading(false)
    }
  }, [loadPlayersForMatch])

  const ensureMatchSelection = useCallback(() => {
    setSelectedMatchId((prev) => {
      if (prev) return prev
      if (liveMatchesRef.current.length > 0) {
        return liveMatchesRef.current[0].id
      }
      if (upcomingMatchesRef.current.length > 0) {
        return upcomingMatchesRef.current[0].id
      }
      return ''
    })
  }, [])

  const loadUpcomingMatches = useCallback(async () => {
    try {
      setUpcomingLoading(true)
      const response = await matchesAPI.getAll({ status: 'Upcoming' })
      const data = response.data || []
      upcomingMatchesRef.current = data
      setUpcomingMatches(data)
      ensureMatchSelection()
    } catch (err) {
      console.error('Error loading upcoming matches:', err)
      setError('Failed to load upcoming matches')
    } finally {
      setUpcomingLoading(false)
    }
  }, [ensureMatchSelection])
  
  // Subscribe to live matches
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!currentAdmin) return

    loadUpcomingMatches()

    const unsubscribe = subscribeToLiveMatches((matches) => {
      liveMatchesRef.current = matches || []
      setLiveMatches(matches || [])
      setSelectedMatchId((prev) => (prev ? prev : matches?.[0]?.id || ''))
    })

    return () => unsubscribe()
  }, [currentAdmin, loadUpcomingMatches])

  // Load match data when selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedMatchId) {
      loadMatchData(selectedMatchId)
    } else {
      setSelectedMatch(null)
    }
  }, [selectedMatchId, loadMatchData])

  // ICC Rule: Sync activeTeam with match.innings when match is Live and toss is set
  // Only lock during innings, allow switching during innings break
  useEffect(() => {
    if (selectedMatch && selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId) {
      // During innings (FirstInnings or SecondInnings), lock to current batting team
      if (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') {
        if (selectedMatch.innings === 'teamA' || selectedMatch.innings === 'teamB') {
          if (activeTeam !== selectedMatch.innings) {
            setActiveTeam(selectedMatch.innings)
          }
        }
      }
      // During innings break, allow switching (but don't force sync)
    }
  }, [selectedMatch, activeTeam])

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      await adminLogin(loginEmail, loginPassword)
      setLoginEmail('')
      setLoginPassword('')
    } catch (error) {
      setLoginError(error.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoginLoading(false)
    }
  }

  // Handle logout
  // Logout handled in dashboard

  const getScoreState = (match, teamKey) => {
    if (!match) {
      const runsField = teamKey === 'teamA' ? 'runs1' : 'runs2'
      const wicketsField = teamKey === 'teamA' ? 'wickets1' : 'wickets2'
      const ballsField = teamKey === 'teamA' ? 'balls1' : 'balls2'
      const oversField = teamKey === 'teamA' ? 'overs1' : 'overs2'
      return {
        runs: 0,
        wickets: 0,
        balls: 0,
        overs: '0.0',
        runsField,
        wicketsField,
        ballsField,
        oversField,
        scoreField: teamKey === 'teamA' ? 'score1' : 'score2',
        scorePathPrefix: teamKey === 'teamA' ? 'score.teamA' : 'score.teamB',
      }
    }
    const runsField = teamKey === 'teamA' ? 'runs1' : 'runs2'
    const wicketsField = teamKey === 'teamA' ? 'wickets1' : 'wickets2'
    const ballsField = teamKey === 'teamA' ? 'balls1' : 'balls2'
    const oversField = teamKey === 'teamA' ? 'overs1' : 'overs2'
    // Check both legacy fields (balls1/balls2) and new structure (score.teamA.balls/score.teamB.balls)
    const scorePath = teamKey === 'teamA' ? 'score.teamA' : 'score.teamB'
    const scoreBalls = match?.score?.[teamKey]?.balls
    const recordedBalls = match[ballsField]
    // Prioritize score.teamA.balls/score.teamB.balls if available, otherwise use legacy fields
    const balls =
      (typeof scoreBalls === 'number' && !Number.isNaN(scoreBalls))
        ? scoreBalls
        : (typeof recordedBalls === 'number' && !Number.isNaN(recordedBalls))
        ? recordedBalls
        : oversToBalls(match[oversField] || '0.0')
    return {
      runs: match[runsField] || 0,
      wickets: match[wicketsField] || 0,
      balls,
      overs: match[oversField] || ballsToOvers(balls),
      runsField,
      wicketsField,
      ballsField,
      oversField,
      scoreField: teamKey === 'teamA' ? 'score1' : 'score2',
      scorePathPrefix: teamKey === 'teamA' ? 'score.teamA' : 'score.teamB',
    }
  }

  const getCurrentPlayers = (match) => ({
    strikerId: match?.currentStrikerId || '',
    nonStrikerId: match?.nonStrikerId || '',
    bowlerId: match?.currentBowlerId || '',
  })

  const ensureScoringPreconditions = (teamKey = activeTeam, countsBall = true) => {
    if (!selectedMatch) {
      setError('Please select a match first.')
      return { ok: false }
    }
    if (selectedMatch.status !== 'Live') {
      setError('Match must be Live before updating the score. Use "Start Match" to go live.')
      return { ok: false }
    }
    const lineupSet =
      teamKey === 'teamA' ? selectedMatch.teamALineupSet : selectedMatch.teamBLineupSet
    if (!lineupSet) {
      setSetupError('Set Playing XI for this team before scoring begins.')
      return { ok: false }
    }
    const players = getCurrentPlayers(selectedMatch)
    if (!players.strikerId || !players.nonStrikerId || !players.bowlerId) {
      setSetupError('Select striker, non-striker, and bowler before updating the score.')
      return { ok: false }
    }
    const scoreState = getScoreState(selectedMatch, teamKey)
    // Note: We don't check overs limit here because:
    // 1. For wide/no-ball (countsBall=false), limit doesn't apply
    // 2. The projectedBalls check in applyBallChange is more accurate
    // 3. It allows the last ball (60th) when current balls = 59
    // Removed early check to allow last ball input
    return {
      ok: true,
      battingTeam: teamKey,
      bowlingTeam: getOpponentTeam(teamKey),
      scoreState,
      ...players,
    }
  }

  const getPlayerDataById = async (playerId) => {
    if (!playerId) return null
    if (playerCacheRef.current.has(playerId)) {
      return playerCacheRef.current.get(playerId)
    }
    try {
      const response = await playersAPI.getById(playerId)
      const player = response.data
      if (player) {
        playerCacheRef.current.set(playerId, player)
      }
      return player
    } catch (fetchError) {
      console.error('Error fetching player data:', fetchError)
      return null
    }
  }

  const updatePlayerStatsById = async (playerId, statsDelta = {}) => {
    if (!playerId) return
    try {
      const player = await getPlayerDataById(playerId)
      if (!player) return
      const currentStats = player.stats || {}
      const currentMatchStats = player.matchStats || {}
      const updatedStats = {
        ...currentStats,
        runs: (currentStats.runs || 0) + (statsDelta.runs || 0),
        wickets: (currentStats.wickets || 0) + (statsDelta.wickets || 0),
        balls: (currentStats.balls || 0) + (statsDelta.ballsFaced || 0),
        fours: (currentStats.fours || 0) + (statsDelta.fours || 0),
        sixes: (currentStats.sixes || 0) + (statsDelta.sixes || 0),
        runsConceded: (currentStats.runsConceded || 0) + (statsDelta.runsConceded || 0),
        ballsBowled: (currentStats.ballsBowled || 0) + (statsDelta.ballsBowled || 0),
      }
      if ((updatedStats.balls || 0) > 0) {
        updatedStats.strikeRate = ((updatedStats.runs || 0) / updatedStats.balls) * 100
      }
      if ((updatedStats.ballsBowled || 0) > 0) {
        updatedStats.economy = (updatedStats.runsConceded || 0) / (updatedStats.ballsBowled / 6)
      }
      const updatedMatchStats = {
        ...currentMatchStats,
        runs: (currentMatchStats.runs || 0) + (statsDelta.runs || 0),
        balls: (currentMatchStats.balls || 0) + (statsDelta.ballsFaced || 0),
        wickets: (currentMatchStats.wickets || 0) + (statsDelta.wickets || 0),
        fours: (currentMatchStats.fours || 0) + (statsDelta.fours || 0),
        sixes: (currentMatchStats.sixes || 0) + (statsDelta.sixes || 0),
        runsConceded: (currentMatchStats.runsConceded || 0) + (statsDelta.runsConceded || 0),
        ballsBowled: (currentMatchStats.ballsBowled || 0) + (statsDelta.ballsBowled || 0),
      }
      updatedMatchStats.overs = ballsToOvers(updatedMatchStats.ballsBowled || 0)
      if ((updatedMatchStats.balls || 0) > 0) {
        updatedMatchStats.strikeRate = (updatedMatchStats.runs || 0) / updatedMatchStats.balls * 100
      }
      if ((updatedMatchStats.ballsBowled || 0) > 0) {
        updatedMatchStats.economy =
          (updatedMatchStats.runsConceded || 0) / ((updatedMatchStats.ballsBowled || 0) / 6)
      }
      await playersAPI.update(playerId, {
        stats: updatedStats,
        matchStats: updatedMatchStats,
      })
      playerCacheRef.current.set(playerId, {
        ...player,
        stats: updatedStats,
        matchStats: updatedMatchStats,
      })
    } catch (statsError) {
      console.error('Error updating player statistics:', statsError)
    }
  }

  const applyBallChange = async ({
    totalRuns = 0,
    batRuns = 0,
    countsBall = true,
    addBallToBatsman = true,
    swapStrikeOnOddRuns = true,
    fours = 0,
    sixes = 0,
    extraType = null,
    creditRunsToBowler = true,
    wicket = false,
    wicketInfo = null,
    setFreeHit = false,
    message = 'Ball recorded successfully.',
  } = {}) => {
    const readiness = ensureScoringPreconditions(activeTeam, countsBall)
    if (!readiness.ok) return
    setError('')
    setSetupError('')
    
    // Store state before applying change (for undo)
    const undoState = {
      matchId: selectedMatchId,
      timestamp: Date.now(),
      scoreState: { ...readiness.scoreState },
      battingLineup: cloneLineup(selectedMatch[getTeamLineupKey(readiness.battingTeam)] || []),
      bowlingLineup: cloneLineup(selectedMatch[getTeamLineupKey(readiness.bowlingTeam)] || []),
      currentStrikerId: readiness.strikerId,
      currentNonStrikerId: readiness.nonStrikerId,
      currentBowlerId: readiness.bowlerId,
      freeHit: selectedMatch?.freeHit || false,
      recentBalls: Array.isArray(selectedMatch?.recentBalls) ? [...selectedMatch.recentBalls] : [],
      ballEventsCount: selectedMatch?.ballEventsCount || 0,
    }
    setLastBallHistory((prev) => [undoState, ...prev].slice(0, 10)) // Keep last 10 states
    
    setScoreLoading(true)
    const { battingTeam, bowlingTeam, scoreState, strikerId, nonStrikerId, bowlerId } = readiness
    const battingLineupKey = getTeamLineupKey(battingTeam)
    const bowlingLineupKey = getTeamLineupKey(bowlingTeam)
    const battingLineup = cloneLineup(selectedMatch[battingLineupKey] || [])
    const bowlingLineup = cloneLineup(selectedMatch[bowlingLineupKey] || [])
    const strikerIndex = battingLineup.findIndex((player) => player.playerId === strikerId)
    const nonStrikerIndex = battingLineup.findIndex((player) => player.playerId === nonStrikerId)
    const bowlerIndex = bowlingLineup.findIndex((player) => player.playerId === bowlerId)
    const bowlerEntry = bowlerIndex !== -1 ? bowlingLineup[bowlerIndex] : null
    const bowlerName = bowlerEntry?.name || ''
    if (strikerIndex === -1 || nonStrikerIndex === -1 || bowlerIndex === -1) {
      setSetupError('Current on-field players are not present in the Playing XI.')
      setScoreLoading(false)
      return
    }
    // Use ICC Rule Engine to process the ball
    const deliveryType = extraType === EXTRA_TYPES.NO_BALL ? DELIVERY_TYPES.NO_BALL
      : extraType === EXTRA_TYPES.WIDE ? DELIVERY_TYPES.WIDE
      : extraType === EXTRA_TYPES.LEG_BYE ? DELIVERY_TYPES.LEG_BYE
      : extraType === EXTRA_TYPES.BYE ? DELIVERY_TYPES.BYE
      : DELIVERY_TYPES.LEGAL
    
    const isBoundary = fours > 0 || sixes > 0
    const currentFreeHit = selectedMatch.freeHit || false
    
    // Validate free hit wicket
    if (currentFreeHit && wicket && wicketInfo) {
      const wicketType = wicketInfo.wicketType || 'Bowled'
      if (!isWicketAllowedOnFreeHit(wicketType)) {
        setError(`Wicket type "${wicketType}" is not allowed on a free hit. Only Run Out, Stumped, Hit Wicket, or Obstructing the Field are allowed.`)
        setScoreLoading(false)
        return
      }
    }
    
    const ruleResult = processBallEvent({
      deliveryType,
      runs: totalRuns,
      isWicket: wicket,
      wicketType: wicketInfo?.wicketType || null,
      isBoundary,
      currentBalls: scoreState.balls,
      currentRuns: scoreState.runs,
      currentWickets: scoreState.wickets,
      freeHit: currentFreeHit,
    })
    
    // Use rule engine results
    const actualCountsBall = ruleResult.countsBall
    // ICC Rule: For no-ball with leg bye, bat runs should be 0 (leg bye doesn't count as bat runs)
    // Override rule engine's batRuns with actual batRuns passed to applyBallChange
    // Rule engine assumes runs > 1 means bat runs, but for leg bye it's wrong
    const actualBatRuns = batRuns !== undefined ? batRuns : ruleResult.batRuns
    const actualCreditToBowler = ruleResult.creditToBowler
    const shouldRotate = ruleResult.shouldRotate
    
    // ICC Rule: Check over limitation before processing ball
    // Allow the last ball (60th ball for 10 overs, 6th ball for 1 over) to be entered
    const oversLimitBalls = Number(selectedMatch.oversLimit || 10) * 6
    // Calculate projected balls: current balls + 1 if this ball counts
    // Use scoreState.balls which is the current state BEFORE this ball
    // Ensure we're using the actual current balls count (handle both balls1/balls2 and score.teamA.balls/score.teamB.balls)
    const currentBalls = scoreState.balls || 0
    const projectedBalls = currentBalls + (actualCountsBall ? 1 : 0)
    // Allow ball if it's exactly the last ball (projectedBalls === oversLimitBalls)
    // Block only if it exceeds the limit (projectedBalls > oversLimitBalls)
    // For 1 over match (6 balls): 
    //   - When balls = 3, projectedBalls = 4, 4 > 6 = false → allow ✓
    //   - When balls = 5, projectedBalls = 6, 6 > 6 = false → allow (last ball) ✓
    //   - When balls = 6, projectedBalls = 7, 7 > 6 = true → block ✓
    if (actualCountsBall && projectedBalls > oversLimitBalls) {
      setScoreLoading(false)
      setError(`Overs limit reached for this innings (${selectedMatch.oversLimit || 10} overs = ${oversLimitBalls} balls).`)
      return
    }
    
    const newRuns = ruleResult.newRuns
    const newWickets = ruleResult.newWickets
    const newBalls = ruleResult.newBalls
    const newOversString = ruleResult.overs
    let nextStrikerId = strikerId
    let nextNonStrikerId = nonStrikerId
    // ICC Rule: Free hit is activated on no-ball
    // Use rule engine result, but also respect setFreeHit parameter if explicitly set
    const nextFreeHit = setFreeHit ? true : ruleResult.nextFreeHit
    const partnership = selectedMatch.partnership || { runs: 0, balls: 0 }
    let updatedPartnership = {
      runs: partnership.runs + totalRuns,
      balls: partnership.balls + (actualCountsBall ? 1 : 0),
    }
    let fallOfWickets = [...(selectedMatch.fallOfWickets || [])]
    
    // ICC Rule: Handle wicket FIRST before updating stats or rotating strike
    let dismissalText = ''
    let dismissedPlayerName = ''
    let dismissedId = ''
    let dismissedWasStriker = false
    let dismissedWasNonStriker = false
    
    if (wicket && wicketInfo) {
      dismissedId = wicketInfo.dismissedPlayerId
      const newBatsmanId = wicketInfo.newBatsmanId
      dismissedWasStriker = dismissedId === strikerId
      dismissedWasNonStriker = dismissedId === nonStrikerId
      const assistName = wicketInfo.assistName || ''
      const dismissalType = wicketInfo.wicketType || 'Wicket'
      dismissalText = buildDismissalDescription(dismissalType, bowlerName, assistName)
      
      // Get dismissed player name BEFORE marking them as out
      const dismissedEntryBefore =
        battingLineup.find((player) => player.playerId === dismissedId) || null
      dismissedPlayerName = dismissedEntryBefore?.name || ''
      
      // Mark dismissed player as out
      battingLineup.forEach((player, idx) => {
        if (player.playerId === dismissedId) {
          battingLineup[idx] = {
            ...player,
            status: 'out',
            isOnStrike: false,
            isOnCrease: false,
            dismissalText,
          }
        }
      })
      
      // Add new batsman if provided
      if (newBatsmanId) {
        let newIndex = battingLineup.findIndex((player) => player.playerId === newBatsmanId)
        if (newIndex === -1) {
          const sourcePlayers = battingTeam === 'teamA' ? teamAPlayers : teamBPlayers
          const newPlayerData = sourcePlayers.find((p) => p.id === newBatsmanId)
          if (newPlayerData) {
            battingLineup.push(
              transformBatter(initialiseLineupEntry(newPlayerData, battingLineup.length + 1), {
                status: 'batting',
                isOnStrike: dismissedWasStriker, // New batsman takes dismissed player's position
                isOnCrease: true,
              })
            )
            newIndex = battingLineup.length - 1
          }
        } else {
          battingLineup[newIndex] = transformBatter(battingLineup[newIndex], {
            status: 'batting',
            isOnStrike: dismissedWasStriker, // New batsman takes dismissed player's position
            isOnCrease: true,
          })
        }
      }
      
      // ICC Rule: Set next striker/non-striker based on who was dismissed
      if (dismissedWasStriker) {
        // Striker dismissed: new batsman comes in as striker, non-striker stays
        nextStrikerId = newBatsmanId || ''
        // Non-striker remains the same (unless they were also dismissed, which shouldn't happen)
        if (!dismissedWasNonStriker) {
          nextNonStrikerId = nonStrikerId
        }
      } else if (dismissedWasNonStriker) {
        // Non-striker dismissed: new batsman comes in as non-striker, striker stays
        nextNonStrikerId = newBatsmanId || ''
        nextStrikerId = strikerId
      }
      
      // Add to fall of wickets
      fallOfWickets = [
        ...fallOfWickets,
        {
          id: `${Date.now()}`,
          team: battingTeam,
          runs: newRuns,
          wicket: newWickets,
          over: newOversString,
          batsmanId: dismissedId,
          batsmanName: dismissedPlayerName, // Use name captured before marking as out
          wicketType: wicketInfo.wicketType || 'Wicket',
          dismissalText,
          bowlerName,
          assistName,
        },
      ]
      updatedPartnership = { runs: 0, balls: 0 }
      if (selectedMatch.freeHit && actualCountsBall) {
        // Free hit consumed on wicket
      }
    }
    
    // Update batsman stats ONLY for players who are NOT dismissed
    // ICC Rule: Don't update stats for dismissed player
    if (!dismissedWasStriker && strikerIndex !== -1) {
      // ICC Rule: For no-ball/wide, ball is added to batsman even if it doesn't count for the over
      // addBallToBatsman = true means the batsman faced this delivery (regardless of countsBall)
      // actualCountsBall = false means it doesn't count for the over (no-ball/wide)
      const ballsToAdd = addBallToBatsman ? 1 : 0
      battingLineup[strikerIndex] = transformBatter(battingLineup[strikerIndex], {
        runsAdded: actualBatRuns,
        ballsAdded: ballsToAdd,
        foursAdded: fours,
        sixesAdded: sixes,
        status: 'batting',
        isOnStrike: true,
        isOnCrease: true,
      })
    }
    if (nonStrikerIndex !== strikerIndex && !dismissedWasNonStriker && nonStrikerIndex !== -1) {
      battingLineup[nonStrikerIndex] = transformBatter(battingLineup[nonStrikerIndex], {
        status: 'batting',
        isOnStrike: false,
        isOnCrease: true,
      })
    }
    
    // ICC Rule: Strike rotation based on runs and delivery type
    // Only rotate if NO wicket fell, OR if non-striker was dismissed (striker stays, no rotation needed)
    // If striker was dismissed, new batsman already set as striker above
    if (!wicket && shouldRotate) {
      nextStrikerId = nonStrikerId
      nextNonStrikerId = strikerId
      battingLineup[strikerIndex] = { ...battingLineup[strikerIndex], isOnStrike: false }
      if (nonStrikerIndex !== -1) {
        battingLineup[nonStrikerIndex] = { ...battingLineup[nonStrikerIndex], isOnStrike: true }
      }
    }
    
    const runsConceded = actualCreditToBowler ? totalRuns : 0
    const wicketsForBowler = wicket && wicketInfo?.creditToBowler ? 1 : 0
    bowlingLineup[bowlerIndex] = transformBowler(bowlingLineup[bowlerIndex], {
      ballsAdded: actualCountsBall ? 1 : 0,
      runsConcededAdded: runsConceded,
      wicketsAdded: wicketsForBowler,
    })
    if (!actualCountsBall) {
      bowlingLineup[bowlerIndex].bowlingActive = true
    }
    
    // Use ICC rule engine for over completion check
    const isEndOfOver = ruleResult.overComplete
    if (isEndOfOver) {
      const tempStriker = nextStrikerId
      nextStrikerId = nextNonStrikerId
      nextNonStrikerId = tempStriker
    }
    
    // ICC Rule: Ensure only 2 players are on crease (striker and non-striker)
    // First, clear isOnCrease for all players to prevent multiple players on crease
    battingLineup.forEach((player, idx) => {
      if (player.playerId !== nextStrikerId && player.playerId !== nextNonStrikerId) {
        battingLineup[idx] = {
          ...player,
          isOnCrease: false,
          isOnStrike: false,
        }
      }
    })
    
    const orderedBattingLineup = sortLineupByBattingOrder(
      battingLineup.map((player) => {
        // ICC Rule: Dismissed players cannot be on strike or on crease
        if (player.status === 'out') {
          return {
            ...player,
            isOnStrike: false,
            isOnCrease: false,
          }
        }
        // ICC Rule: Only 2 players can be on crease at a time (striker and non-striker)
        // Set striker
        if (player.playerId === nextStrikerId && nextStrikerId) {
          return {
            ...player,
            isOnStrike: true,
            isOnCrease: true,
          }
        }
        // Set non-striker
        if (player.playerId === nextNonStrikerId && nextNonStrikerId) {
          return {
            ...player,
            isOnStrike: false,
            isOnCrease: true,
          }
        }
        // ICC Rule: All other players must NOT be on crease
        return {
          ...player,
          isOnStrike: false,
          isOnCrease: false, // Explicitly set to false to prevent multiple players on crease
        }
      })
    )
    const updatedBowlingLineup = bowlingLineup.map((player) => ({
      ...player,
      bowlingActive: !isEndOfOver && player.playerId === bowlerId,
    }))
    let battingPayload = orderedBattingLineup
    let bowlingPayload = updatedBowlingLineup
    const updatePayload = {
      [scoreState.runsField]: newRuns,
      [scoreState.wicketsField]: newWickets,
      [scoreState.ballsField]: newBalls,
      [scoreState.oversField]: newOversString,
      [scoreState.scoreField]: `${newRuns}/${newWickets}`,
      [`${scoreState.scorePathPrefix}.runs`]: newRuns,
      [`${scoreState.scorePathPrefix}.wickets`]: newWickets,
      [`${scoreState.scorePathPrefix}.overs`]: newOversString,
      [`${scoreState.scorePathPrefix}.balls`]: newBalls,
      [`${scoreState.scorePathPrefix}.lastUpdate`]: new Date().toISOString(),
      partnership: updatedPartnership,
      freeHit: nextFreeHit,
      currentStrikerId: nextStrikerId,
      nonStrikerId: nextNonStrikerId,
      innings: activeTeam,
      currentBatting:
        activeTeam === 'teamA'
          ? selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA
          : selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB,
      ballEventsCount: (selectedMatch.ballEventsCount || 0) + 1,
      fallOfWickets,
      updatedAt: new Date(),
    }
    // Calculate over and ball number for this event
    // IMPORTANT: Over numbers are 1-based (Over 1, Over 2, etc.)
    // Ball numbers are 1-6 within each over
    const previousBallsCount = scoreState.balls || 0
    
    // Determine which over this ball belongs to
    // ICC Rule: Wide/No-ball that doesn't count goes to the current over
    // But if previous over just completed, it goes to the new over
    let ballsForOverCalculation
    if (actualCountsBall) {
      // Legal ball: use newBalls (after adding this ball)
      ballsForOverCalculation = newBalls
    } else {
      // Wide/No-ball that doesn't count: check if previous over is complete
      // If previous over is complete (previousBallsCount % 6 === 0), wide goes to next over
      if (previousBallsCount > 0 && previousBallsCount % 6 === 0) {
        // Previous over just completed, wide goes to new over
        ballsForOverCalculation = previousBallsCount + 1
      } else {
        // Previous over not complete, wide goes to current over
        ballsForOverCalculation = previousBallsCount
      }
    }
    
    // Calculate over number (1-based)
    // ballsForOverCalculation represents total balls AFTER this ball
    // So: 1-6 balls = Over 1, 7-12 balls = Over 2, etc.
    // Formula: Math.floor((ballsForOverCalculation - 1) / 6) + 1
    // This gives: 1-6→1, 7-12→2, 13-18→3, etc.
    const overNumber = Math.floor((ballsForOverCalculation - 1) / 6) + 1
    
    // Calculate ball number within the current over (1-6)
    // For wide/no-ball: if previous over is complete, it's ball 0 (will be placed after wide badge)
    // For legal balls: calculate based on ballsForOverCalculation
    let eventBallNumber = 0
    if (actualCountsBall) {
      // Legal ball: calculate position in over
      eventBallNumber = ((ballsForOverCalculation - 1) % 6) + 1
    } else {
      // Wide/No-ball: if previous over just completed, it's in new over (ball 0, will be placed first)
      // Otherwise, it's in current over (ball 0, will be placed after current balls)
      if (previousBallsCount > 0 && previousBallsCount % 6 === 0) {
        // Previous over complete, wide is in new over - position it as first ball (1)
        eventBallNumber = 1
      } else {
        // In current over - position after current balls
        eventBallNumber = ((previousBallsCount % 6) + 1)
      }
    }
    
    // Format over display (e.g., "1.0", "1.1", "2.0")
    // This uses the standard format: overs.balls (where balls is 0-5)
    const eventOverDisplay = ballsToOvers(ballsForOverCalculation)
    const strikerForEvent =
      dismissedPlayerName ||
      battingLineup.find((player) => player.playerId === strikerId)?.name ||
      ''
    const runsPart = (() => {
      if (wicket && dismissalText) return dismissalText
      if (batRuns > 0) {
        return `${batRuns} run${batRuns === 1 ? '' : 's'} to ${strikerForEvent || 'batter'}`
      }
      if (extraType === EXTRA_TYPES.NO_BALL) {
        const penalty = totalRuns - batRuns
        return `No-ball ${penalty > 1 ? `+${penalty - 1}` : ''} run${penalty - 1 === 1 ? '' : 's'}`
      }
      if (extraType === EXTRA_TYPES.WIDE) {
        return `Wide ${totalRuns - 1 > 0 ? `+${totalRuns - 1}` : ''}`.trim()
      }
      if (extraType === EXTRA_TYPES.LEG_BYE || extraType === EXTRA_TYPES.BYE) {
        return `${totalRuns} leg-bye${totalRuns === 1 ? '' : 's'}`
      }
      if (totalRuns === 0) return 'Dot ball'
      return `${totalRuns} run${totalRuns === 1 ? '' : 's'}`
    })()
    const ballEventSummary =
      `${strikerForEvent || 'Batter'} vs ${bowlerName || 'Bowler'} — ${runsPart}`.trim()
    const ballEvent = {
      id: `${Date.now()}`,
      over: eventOverDisplay,
      overNumber: overNumber, // Store over number separately for easier processing (1-based)
      ball: eventBallNumber,
      runs: totalRuns,
      batRuns,
      extraType,
      isWicket: Boolean(wicket),
      isBoundary: batRuns === 4 || batRuns === 6,
      countsBall: actualCountsBall, // Use actualCountsBall from rule engine
      batsman: strikerForEvent,
      bowler: bowlerName,
      dismissal: dismissalText || '',
      dismissedBatsman: dismissedPlayerName || '',
      text: ballEventSummary,
      timestamp: new Date().toISOString(),
      team: activeTeam, // Store which team was batting (teamA or teamB)
      innings: activeTeam, // Same as team for consistency
      matchPhase: selectedMatch.matchPhase || 'FirstInnings', // Store match phase
    }
    const existingRecentBalls = Array.isArray(selectedMatch.recentBalls)
      ? selectedMatch.recentBalls
      : []
    updatePayload.recentBalls = [ballEvent, ...existingRecentBalls].slice(0, 36)
    if (isEndOfOver) {
      updatePayload.currentBowlerId = ''
      updatePayload.lastOverBowlerId = bowlerId
      updatePayload.pendingBowlerChange = true
    } else {
      updatePayload.currentBowlerId = bowlerId
      updatePayload.pendingBowlerChange = false
      if (selectedMatch?.lastOverBowlerId) {
        updatePayload.lastOverBowlerId = selectedMatch.lastOverBowlerId
      }
    }

    const teamAName = selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA || 'Team A'
    const teamBName = selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB || 'Team B'
    const inningsCompletedByOvers = actualCountsBall && newBalls >= oversLimitBalls
    const inningsCompletedByAllOut = newWickets >= MAX_WICKETS
    const storedTargetRuns = selectedMatch.targetRuns
    const baseTargetRuns =
      storedTargetRuns ||
      ((selectedMatch.score?.teamA?.runs ?? selectedMatch.runs1 ?? 0) + 1)
    
    // ICC Rule: Chase can only be achieved in SecondInnings, not FirstInnings
    // Also, Team A must have completed their innings (has runs or 10 wickets)
    const teamACompleted = (selectedMatch.score?.teamA?.runs ?? selectedMatch.runs1 ?? 0) > 0 || 
                           (selectedMatch.score?.teamA?.wickets ?? selectedMatch.wickets1 ?? 0) >= 10
    const isSecondInnings = selectedMatch.matchPhase === 'SecondInnings'
    const chaseAchieved = activeTeam === 'teamB' && isSecondInnings && teamACompleted && newRuns >= baseTargetRuns
    let inningsBreakTriggered = false
    let matchFinished = false
    let resultSummary = ''
    let winnerSquadId = ''
    let loserSquadId = ''

    if (activeTeam === 'teamA' && (inningsCompletedByOvers || inningsCompletedByAllOut)) {
      inningsBreakTriggered = true
      nextStrikerId = ''
      nextNonStrikerId = ''
      const targetRuns = newRuns + 1
      battingPayload = battingLineup.map((player) => ({
        ...player,
        isOnStrike: false,
        isOnCrease: false,
      }))
      bowlingPayload = bowlingLineup.map((player) => ({
        ...player,
        bowlingActive: false,
      }))
      updatePayload.currentStrikerId = ''
      updatePayload.nonStrikerId = ''
      updatePayload.currentBowlerId = ''
      updatePayload.lastOverBowlerId = ''
      updatePayload.pendingBowlerChange = false
      updatePayload.freeHit = false
      updatePayload.innings = 'teamB'
      updatePayload.currentBatting = teamBName
      // ICC Rule: Automatically transition to SecondInnings (no manual break needed)
      updatePayload.matchPhase = 'SecondInnings'
      updatePayload.targetRuns = targetRuns
      updatePayload.inningsBreakMessage = '' // Clear break message, start second innings
      updatePayload.partnership = { runs: 0, balls: 0 }
      
      // Initialize Team B's score for second innings if not exists
      if (!selectedMatch.score?.teamB || selectedMatch.score.teamB.balls === 0) {
        updatePayload.score = {
          ...selectedMatch.score,
          teamB: {
            runs: 0,
            wickets: 0,
            balls: 0,
            overs: '0.0',
            ...selectedMatch.score?.teamB,
          },
        }
      }
      
      // Automatically set activeTeam to teamB for second innings
      // This will be synced by useEffect after match update
    }

    // ICC Rule: Match can only finish in SecondInnings, not FirstInnings
    if (activeTeam === 'teamB' && isSecondInnings && (chaseAchieved || inningsCompletedByOvers || inningsCompletedByAllOut)) {
      matchFinished = true
      const teamARuns = baseTargetRuns - 1
      const teamBRuns = newRuns
      if (teamBRuns > teamARuns) {
        const wicketsRemaining = Math.max(1, MAX_WICKETS - newWickets)
        resultSummary = `${teamBName} won by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? '' : 's'}`
        winnerSquadId = selectedMatch.teamBSquadId || ''
        loserSquadId = selectedMatch.teamASquadId || ''
      } else if (teamBRuns === teamARuns) {
        resultSummary = 'Match tied'
        winnerSquadId = ''
        loserSquadId = ''
      } else {
        const margin = teamARuns - teamBRuns
        resultSummary = `${teamAName} won by ${margin} run${margin === 1 ? '' : 's'}`
        winnerSquadId = selectedMatch.teamASquadId || ''
        loserSquadId = selectedMatch.teamBSquadId || ''
      }
      updatePayload.status = 'Finished'
      updatePayload.matchPhase = 'Completed'
      updatePayload.resultSummary = resultSummary
      updatePayload.inningsBreakMessage = ''
      updatePayload.pendingBowlerChange = false
      updatePayload.freeHit = false
      if (winnerSquadId) {
        updatePayload.winnerSquadId = winnerSquadId
      }
      if (loserSquadId) {
        updatePayload.loserSquadId = loserSquadId
      }
    }

    updatePayload[battingLineupKey] = battingPayload
    updatePayload[bowlingLineupKey] = bowlingPayload

    const showOverMessage = isEndOfOver && !inningsBreakTriggered && !matchFinished
    if (!inningsBreakTriggered && !matchFinished) {
      setCurrentPlayerSelection({
        strikerId: nextStrikerId,
        nonStrikerId: nextNonStrikerId,
        bowlerId: isEndOfOver ? '' : bowlerId,
      })
    }
    try {
      if (inningsBreakTriggered) {
        setSetupInfo(INNINGS_BREAK_MESSAGE)
      } else if (matchFinished) {
        setSetupInfo(resultSummary || 'Match finished.')
      } else if (showOverMessage) {
        setSetupInfo(OVER_COMPLETED_MESSAGE)
      } else if (!isEndOfOver) {
        setSetupInfo((prev) => (prev === OVER_COMPLETED_MESSAGE ? '' : prev))
      }
      await matchesAPI.updateScore(selectedMatchId, updatePayload)
      if (batRuns > 0 || addBallToBatsman) {
        await updatePlayerStatsById(strikerId, {
          runs: batRuns,
          ballsFaced: addBallToBatsman ? 1 : 0,
          fours,
          sixes,
        })
      }
      if (wicket && wicketInfo?.dismissedPlayerId && wicketInfo.dismissedPlayerId !== strikerId) {
        await updatePlayerStatsById(wicketInfo.dismissedPlayerId, {
          ballsFaced: countsBall ? 1 : 0,
        })
      }
      await updatePlayerStatsById(bowlerId, {
        runsConceded: creditRunsToBowler ? totalRuns : 0,
        ballsBowled: countsBall ? 1 : 0,
        wickets: wicketsForBowler,
      })
      const successMessage = matchFinished
        ? resultSummary || 'Match finished.'
        : inningsBreakTriggered
        ? `End of first innings. ${teamBName} need ${newRuns + 1} to win.`
        : message
      setSuccess(successMessage)
      if (!matchFinished && !inningsBreakTriggered) {
        setTimeout(() => setSuccess(''), 2500)
      }
      if (inningsBreakTriggered) {
        setCurrentPlayerSelection({
          strikerId: '',
          nonStrikerId: '',
          bowlerId: '',
        })
        // Automatically set activeTeam to teamB for second innings
        // This will be synced by useEffect after loadMatchData
        setActiveTeam('teamB')
      }
      await loadMatchData(selectedMatchId)
      // After loading match data, ensure activeTeam is synced with match.innings
      if (inningsBreakTriggered) {
        // Force sync activeTeam after match data is loaded
        setTimeout(() => {
          setActiveTeam('teamB')
        }, 100)
      }
    } catch (scoreError) {
      console.error('Error updating match score:', scoreError)
      setError(scoreError.message || 'Failed to update score.')
    } finally {
      setScoreLoading(false)
    }
  }

  // Undo Last Ball Handler
  const handleUndoLastBall = async () => {
    if (lastBallHistory.length === 0) {
      setError('No ball history to undo.')
      return
    }
    const undoState = lastBallHistory[0]
    if (!undoState || undoState.matchId !== selectedMatchId) {
      setError('Cannot undo: Match state mismatch.')
      return
    }
    try {
      setScoreLoading(true)
      setError('')
      const battingTeam = determineBattingTeam(selectedMatch)
      const bowlingTeam = getOpponentTeam(battingTeam)
      const scoreState = getScoreState(selectedMatch, battingTeam)
      const battingLineupKey = getTeamLineupKey(battingTeam)
      const bowlingLineupKey = getTeamLineupKey(bowlingTeam)
      
      const updatePayload = {
        [scoreState.runsField]: undoState.scoreState.runs,
        [scoreState.wicketsField]: undoState.scoreState.wickets,
        [scoreState.ballsField]: undoState.scoreState.balls,
        [scoreState.oversField]: undoState.scoreState.overs,
        [scoreState.scoreField]: `${undoState.scoreState.runs}/${undoState.scoreState.wickets}`,
        [`${scoreState.scorePathPrefix}.runs`]: undoState.scoreState.runs,
        [`${scoreState.scorePathPrefix}.wickets`]: undoState.scoreState.wickets,
        [`${scoreState.scorePathPrefix}.overs`]: undoState.scoreState.overs,
        [`${scoreState.scorePathPrefix}.balls`]: undoState.scoreState.balls,
        [battingLineupKey]: undoState.battingLineup,
        [bowlingLineupKey]: undoState.bowlingLineup,
        currentStrikerId: undoState.currentStrikerId,
        nonStrikerId: undoState.currentNonStrikerId,
        currentBowlerId: undoState.currentBowlerId,
        freeHit: undoState.freeHit,
        recentBalls: undoState.recentBalls,
        ballEventsCount: undoState.ballEventsCount,
        updatedAt: new Date(),
      }
      
      await matchesAPI.updateScore(selectedMatchId, updatePayload)
      setLastBallHistory((prev) => prev.slice(1)) // Remove the undone state
      setSuccess('Last ball undone successfully.')
      setTimeout(() => setSuccess(''), 2500)
      await loadMatchData(selectedMatchId)
    } catch (undoError) {
      console.error('Error undoing last ball:', undoError)
      setError('Failed to undo last ball.')
    } finally {
      setScoreLoading(false)
    }
  }

  const handleRunEvent = (runs) => {
    applyBallChange({
      totalRuns: runs,
      batRuns: runs,
      countsBall: true,
      addBallToBatsman: true,
      swapStrikeOnOddRuns: runs % 2 === 1,
      fours: runs === 4 ? 1 : 0,
      sixes: runs === 6 ? 1 : 0,
      message: runs === 0 ? 'Dot ball recorded.' : `+${runs} run${runs !== 1 ? 's' : ''} added.`,
    })
  }

  const handleDotBall = () => handleRunEvent(0)

  const handleWide = () => openExtraModal(EXTRA_TYPES.WIDE)

  const openExtraModal = (type) => {
    if (!type) return
    if (type === EXTRA_TYPES.NO_BALL) {
      setExtraModalState({
        open: true,
        type,
        runs: '0',
        batRuns: '0',
      })
      return
    }
    if (type === EXTRA_TYPES.WIDE) {
      setExtraModalState({
        open: true,
        type,
        runs: '0',
        batRuns: 0,
      })
      return
    }
    if (type === EXTRA_TYPES.LEG_BYE) {
      setExtraModalState({
        open: true,
        type,
        runs: '1lb',
        batRuns: 0,
      })
    }
  }

  const closeExtraModal = () => {
    setExtraModalState((prev) => ({
      ...prev,
      open: false,
    }))
  }

  const submitExtraModal = async () => {
    const { type, runs, batRuns } = extraModalState
    if (type === EXTRA_TYPES.NO_BALL) {
      const rawValue = (batRuns || '0').toString()
      const isLegBye = rawValue.endsWith('lb')
      const legByeRuns = isLegBye ? Number(rawValue.replace('lb', '')) || 0 : 0
      const bat = !isLegBye ? Number(rawValue) || 0 : 0
      const totalRuns = 1 + bat + legByeRuns // 1 (no-ball penalty) + bat runs + leg bye runs
      // ICC Rule: For no-ball with leg bye, strike rotates based on total runs (excluding no-ball penalty)
      // Total runs excluding penalty = bat + legByeRuns
      const runsForRotation = bat + legByeRuns
      let message = 'No-ball. Free hit coming up.'
      if (bat > 0) {
        message = `No-ball with ${bat} run${bat !== 1 ? 's' : ''} to the bat. Free hit coming up.`
      } else if (legByeRuns > 0) {
        message = `No-ball + ${legByeRuns} leg-bye${legByeRuns === 1 ? '' : 's'}. Free hit coming up.`
      }
      // IMPORTANT: extraType should be NO_BALL (not LEG_BYE) so rule engine activates free hit
      // The leg bye runs are just the type of runs scored, but delivery type is still NO_BALL
      await applyBallChange({
        totalRuns,
        batRuns: bat,
        countsBall: false,
        addBallToBatsman: true,
        // ICC Rule: Strike rotates if odd runs (bat + leg bye) excluding no-ball penalty
        swapStrikeOnOddRuns: runsForRotation % 2 === 1,
        fours: bat === 4 ? 1 : 0,
        sixes: bat === 6 ? 1 : 0,
        extraType: EXTRA_TYPES.NO_BALL, // Always NO_BALL for no-ball delivery (even if leg bye runs)
        creditRunsToBowler: true,
        setFreeHit: true, // This will be handled by rule engine, but set it here too for clarity
        message,
      })
    } else if (type === EXTRA_TYPES.WIDE) {
      const wideRuns = Number(runs) || 0
      const totalRuns = wideRuns + 1
      const additionalRuns = wideRuns
      await applyBallChange({
        totalRuns,
        batRuns: 0,
        countsBall: false,
        addBallToBatsman: false,
        swapStrikeOnOddRuns: additionalRuns % 2 === 1,
        extraType: EXTRA_TYPES.WIDE,
        creditRunsToBowler: true,
        message:
          wideRuns === 0
            ? 'Wide ball - 1 wide recorded.'
            : `Wide ball - ${totalRuns} wides recorded.`,
      })
    } else if (type === EXTRA_TYPES.LEG_BYE) {
      const legByeRuns = runs.endsWith('lb') ? Number(runs.replace('lb', '')) : Number(runs)
      const value = Number.isFinite(legByeRuns) ? legByeRuns : 1
      await applyBallChange({
        totalRuns: value,
        batRuns: 0,
        countsBall: true,
        addBallToBatsman: true,
        swapStrikeOnOddRuns: value % 2 === 1,
        extraType: EXTRA_TYPES.LEG_BYE,
        creditRunsToBowler: false,
        message: `Leg bye for ${value} run${value !== 1 ? 's' : ''}.`,
      })
    }
    closeExtraModal()
  }

  const openNoBallModal = () => openExtraModal(EXTRA_TYPES.NO_BALL)
  const openLegByeModal = () => openExtraModal(EXTRA_TYPES.LEG_BYE)

  const openWicketModal = (type = 'Bowled') => {
    if (!selectedMatch) return
    const currentPlayers = getCurrentPlayers(selectedMatch)
    const battingTeam = determineBattingTeam(selectedMatch)
    const lineup = getTeamLineup(selectedMatch, battingTeam)
    const nextBatsmanSuggestion = lineup.find(
      (player) => player.status === 'pending' || (!player.isOnCrease && player.status !== 'out')
    )
    const keeperCandidate = bowlingLineupMemo.find((player) => player.isKeeper)
    // ICC Rule: Only Run Out allows selection, other wickets always dismiss striker
    const dismissedPlayerId = type === 'Run Out' 
      ? (currentPlayers.strikerId || '') // Run Out: default to striker, but allow selection
      : (currentPlayers.strikerId || '') // Other wickets: always striker (no selection)
    setWicketModalState({
      open: true,
      type,
      dismissedPlayerId,
      nextBatsmanId: nextBatsmanSuggestion?.playerId || '',
      runs: 0,
      creditToBowler: type !== 'Run Out',
      creditRunsToBatsman: false,
      assistPlayerId: type === 'Stumped' ? keeperCandidate?.playerId || '' : '',
      assistName: type === 'Stumped' ? keeperCandidate?.name || '' : '',
      customAssist: '',
      deliveryType: 'legal',
    })
    setSetupError('')
  }

  const closeWicketModal = () => {
    setWicketModalState((prev) => ({
      ...prev,
      open: false,
    }))
  }

  const submitWicketModal = async () => {
    if (!selectedMatch) return
    const {
      dismissedPlayerId,
      nextBatsmanId,
      runs,
      type,
      creditToBowler,
      creditRunsToBatsman,
      assistPlayerId,
      assistName,
      customAssist,
      deliveryType,
    } = wicketModalState
    if (!dismissedPlayerId) {
      setSetupError('Select the dismissed player.')
      return
    }
    if (selectedMatch?.freeHit && type !== 'Run Out') {
      setSetupError('Free hit delivery te only run out record kora jai.')
      return
    }
    const totalRuns = Math.max(0, Number(runs) || 0)
    const assistPlayer =
      (assistPlayerId &&
        bowlingLineupMemo.find((player) => player.playerId === assistPlayerId)?.name) ||
      ''
    const assistDisplay = customAssist
      ? customAssist.trim()
      : assistName?.trim() || assistPlayer
    const delivery = deliveryType || 'legal'
    const isNoBall = delivery === EXTRA_TYPES.NO_BALL
    const isWide = delivery === EXTRA_TYPES.WIDE
    const isLegBye = delivery === EXTRA_TYPES.LEG_BYE
    const isBye = delivery === EXTRA_TYPES.BYE
    const countsBall = !(isNoBall || isWide)
    const addBallToBatsman = countsBall
    const extraType = isNoBall
      ? EXTRA_TYPES.NO_BALL
      : isWide
      ? EXTRA_TYPES.WIDE
      : isLegBye
      ? EXTRA_TYPES.LEG_BYE
      : isBye
      ? EXTRA_TYPES.BYE
      : null
    let creditRunsToBowler = true
    if (isLegBye || isBye) {
      creditRunsToBowler = false
    }

    await applyBallChange({
      totalRuns,
      batRuns: creditRunsToBatsman ? totalRuns : 0,
      countsBall,
      addBallToBatsman,
      swapStrikeOnOddRuns: false,
      extraType,
      creditRunsToBowler,
      wicket: true,
      wicketInfo: {
        dismissedPlayerId,
        newBatsmanId: nextBatsmanId,
        wicketType: type,
        creditToBowler,
        assistPlayerId: assistPlayerId || '',
        assistName: assistDisplay || '',
      },
      message: `${type} recorded.`,
    })
    closeWicketModal()
  }

  // Submit commentary
  const handleSubmitCommentary = async (e) => {
    e.preventDefault()
    
    if (!selectedMatch) {
      setError('Please select a match first')
      return
    }

    if (selectedMatch.status !== 'Live') {
      setError('Match must be Live before adding commentary. Use "Start Match" to go live.')
      return
    }

    if (!commentary.trim()) {
      setError('Please enter commentary text')
      return
    }

    setError('')
    setScoreLoading(true)

    try {
      const battingTeamKey = determineBattingTeam(selectedMatch)
      const scoreState = getScoreState(selectedMatch, battingTeamKey)
      const currentBallCount = scoreState.balls
      const overValue = Math.floor(currentBallCount / 6) + (currentBallCount % 6) / 10
      const ballNumber = (currentBallCount % 6) + 1
      const playersOnField = getCurrentPlayers(selectedMatch)
      const battingLineup = getTeamLineup(selectedMatch, battingTeamKey)
      const bowlingLineup = getTeamLineup(selectedMatch, getOpponentTeam(battingTeamKey))
      const striker =
        battingLineup.find((player) => player.playerId === playersOnField.strikerId) || null
      const bowler =
        bowlingLineup.find((player) => player.playerId === playersOnField.bowlerId) || null

      await matchesAPI.addCommentary(selectedMatchId, {
        text: commentary.trim(),
        batsman: striker?.name || 'Batsman',
        bowler: bowler?.name || 'Bowler',
        over: overValue.toFixed(1),
        ball: ballNumber,
        runs: 0,
        isWicket: false,
        isBoundary: false,
      })

      setSuccess('Commentary added successfully!')
      setCommentary('')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding commentary:', error)
      setError(error.message || 'Failed to add commentary')
    } finally {
      setScoreLoading(false)
    }
  }

  // All hooks must be called before any early returns
  const battingTeamKey = useMemo(() => activeTeam, [activeTeam])
  const battingLineupMemo = useMemo(() => getTeamLineup(selectedMatch, battingTeamKey), [selectedMatch, battingTeamKey])
  const bowlingLineupMemo = useMemo(() => getTeamLineup(selectedMatch, getOpponentTeam(battingTeamKey)), [selectedMatch, battingTeamKey])
  const currentPlayersMemo = useMemo(() => getCurrentPlayers(selectedMatch), [selectedMatch])
  
  const tossOptions = useMemo(() => {
    if (!selectedMatch) return []
    const options = []
    if (selectedMatch.teamASquadId) {
      options.push({
        value: selectedMatch.teamASquadId,
        label:
          selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA || 'Team A',
      })
    }
    if (selectedMatch.teamBSquadId) {
      options.push({
        value: selectedMatch.teamBSquadId,
        label:
          selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB || 'Team B',
      })
    }
    return options
  }, [selectedMatch])

  const tossSummary = useMemo(() => {
    if (!selectedMatch?.tossWinnerSquadId || !selectedMatch?.tossDecision) return ''
    const winnerName =
      selectedMatch.tossWinnerName ||
      (selectedMatch.tossWinnerSquadId === selectedMatch.teamASquadId
        ? selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA
        : selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB)
    const decision = selectedMatch.tossDecision === 'bat' ? 'bat' : 'bowl'
    const readableDecision = decision === 'bat' ? 'bat first' : 'bowl first'
    return `${winnerName} won the toss and chose to ${readableDecision}.`
  }, [selectedMatch])

  const tossEditable = useMemo(
    () => (selectedMatch ? (selectedMatch.ballEventsCount || 0) === 0 : false),
    [selectedMatch]
  )

  // Get fall of wickets for the current batting team's innings
  const currentInningsFallOfWickets = useMemo(() => 
    (selectedMatch?.fallOfWickets || []).filter((fow) => fow.team === battingTeamKey),
    [selectedMatch, battingTeamKey]
  )
  const currentInningsOutPlayerIds = useMemo(() => 
    new Set(currentInningsFallOfWickets.map((fow) => fow.batsmanId).filter(Boolean)),
    [currentInningsFallOfWickets]
  )
  
  const availableBenchBatters = useMemo(() => 
    battingLineupMemo.filter((player) => {
      if (player.isOnCrease) return false
      // Exclude players who are marked as out OR were out in current innings (from fallOfWickets)
      if (player.status === 'out' || currentInningsOutPlayerIds.has(player.playerId)) {
        return false
      }
      return true
    }),
    [battingLineupMemo, currentInningsOutPlayerIds]
  )
  const creaseBatters = useMemo(() => 
    battingLineupMemo.filter((player) => player.isOnCrease),
    [battingLineupMemo]
  )
  const strikerInfo = useMemo(() =>
    battingLineupMemo.find((player) => player.playerId === currentPlayersMemo.strikerId) || null,
    [battingLineupMemo, currentPlayersMemo.strikerId]
  )
  const nonStrikerInfo = useMemo(() =>
    battingLineupMemo.find((player) => player.playerId === currentPlayersMemo.nonStrikerId) || null,
    [battingLineupMemo, currentPlayersMemo.nonStrikerId]
  )
  const bowlerInfo = useMemo(() =>
    bowlingLineupMemo.find((player) => player.playerId === currentPlayersMemo.bowlerId) || null,
    [bowlingLineupMemo, currentPlayersMemo.bowlerId]
  )

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login form if not logged in
  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Login</h1>
            <p className="text-gray-600">Login to access admin panel</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{loginError}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                placeholder="admin@school.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-cricbuzz-green text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Make sure you have created an admin user in Firebase Authentication and Firestore.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const currentTeam = activeTeam === 'teamA'
    ? {
        name: selectedMatch?.teamAName || selectedMatch?.team1 || selectedMatch?.teamA || 'Team A',
        runs: selectedMatch?.runs1 || 0,
        wickets: selectedMatch?.wickets1 || 0,
        overs: selectedMatch?.overs1 || '0.0',
      }
    : {
        name: selectedMatch?.teamBName || selectedMatch?.team2 || selectedMatch?.teamB || 'Team B',
        runs: selectedMatch?.runs2 || 0,
        wickets: selectedMatch?.wickets2 || 0,
        overs: selectedMatch?.overs2 || '0.0',
      }

  const handleStatusChange = async (matchId, status) => {
    try {
      setStatusChanging(true)
      setError('')
      if (status === 'Live') {
        // Always fetch fresh match data to check Playing XI status
        let targetMatch = selectedMatch?.id === matchId ? selectedMatch : null
        if (!targetMatch || targetMatch.id !== matchId) {
          try {
            const matchResponse = await matchesAPI.getById(matchId)
            targetMatch = matchResponse.data
          } catch (fetchError) {
            console.error('Error fetching match data:', fetchError)
            // Fallback to refs if API call fails
            targetMatch =
              liveMatchesRef.current.find((match) => match.id === matchId) ||
              upcomingMatchesRef.current.find((match) => match.id === matchId) ||
              null
          }
        }
        
        if (targetMatch && (!targetMatch.teamALineupSet || !targetMatch.teamBLineupSet)) {
          setError('Set Playing XI for both teams before starting the match.')
          setStatusChanging(false)
          return
        }
      }
      await matchesAPI.updateStatus(matchId, status)
      if (status === 'Live') {
        setSelectedMatchId(matchId)
        setSuccess('Match is now Live')
      } else if (status === 'Finished' || status === 'Completed') {
        setSuccess('Match marked as finished')
      }
      await loadUpcomingMatches()
      await loadMatchData(matchId)
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error updating match status:', err)
      setError(err.message || 'Failed to update match status')
    } finally {
      setStatusChanging(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Live Scoring Admin
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">Update live match scores and commentary</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link
              to="/admin/dashboard"
              className="flex-1 sm:flex-none bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-semibold text-center"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Match Selection */}
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Select Match</h2>
            <button
              onClick={loadUpcomingMatches}
              className="text-sm text-cricbuzz-green hover:text-green-700 font-semibold"
              disabled={upcomingLoading || statusChanging}
            >
              {upcomingLoading ? 'Refreshing...' : 'Refresh list'}
            </button>
          </div>

          {liveMatches.length === 0 && upcomingMatches.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-5xl mb-4">📅</div>
              <p className="text-gray-500">No matches available</p>
              <Link
                to="/admin/matches"
                className="mt-4 inline-block text-cricbuzz-green hover:text-green-700 font-semibold"
              >
                Create a match →
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-2">Live Matches</h3>
                {liveMatches.length === 0 ? (
                  <p className="text-sm text-gray-500">No live matches right now. Start an upcoming match to go live.</p>
                ) : (
                  <div className="space-y-3">
                    {liveMatches.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => setSelectedMatchId(match.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          selectedMatchId === match.id
                            ? 'border-cricbuzz-green bg-green-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        disabled={scoreLoading || statusChanging}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">
                              {match.teamAName || match.team1} vs {match.teamBName || match.team2}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 uppercase">Live</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                              LIVE
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(match.id, 'Finished')
                              }}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold"
                              disabled={statusChanging}
                            >
                              End Match
                            </button>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">Upcoming Matches</h3>
                {upcomingMatches.length === 0 ? (
                  <p className="text-sm text-gray-500">No upcoming matches scheduled.</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingMatches.map((match) => (
                      <div
                        key={match.id}
                        className={`px-4 py-3 rounded-lg border transition-colors ${
                          selectedMatchId === match.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setSelectedMatchId(match.id)}
                        >
                          <div>
                            <p className="font-semibold text-gray-800">
                              {match.teamAName || match.team1} vs {match.teamBName || match.team2}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(`${match.date}T${match.time || '00:00'}`).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(match.id, 'Live')
                            }}
                            className="text-xs text-cricbuzz-green hover:text-green-700 font-semibold"
                            disabled={statusChanging}
                          >
                            Start Match
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {matchLoading && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center mb-6">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-500">Loading match data...</p>
          </div>
        )}

        {selectedMatch && !matchLoading && (
          <>
            {/* Current Scores Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div
                className={`bg-white rounded-xl shadow-md p-4 sm:p-6 border-2 transition-all ${
                  activeTeam === 'teamA' ? 'border-cricbuzz-green shadow-lg' : 'border-transparent'
                } ${
                  // ICC Rule: Lock non-batting team during innings
                  // Allow switching if it's the batting team or if matchPhase is InningsBreak
                  selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                  (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                  selectedMatch.innings !== 'teamA'
                    ? 'cursor-not-allowed opacity-70'
                    : 'cursor-pointer'
                }`}
                onClick={() => {
                  // ICC Rule: Allow switching to batting team, lock non-batting team
                  if (selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                      (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                      selectedMatch.innings !== 'teamA') {
                    return
                  }
                  setActiveTeam('teamA')
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700">
                    {selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeTeam === 'teamA' && (
                      <span className="text-xs bg-cricbuzz-green text-white px-2 py-1 rounded-full font-semibold">
                        Active
                      </span>
                    )}
                    {selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                     (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                     selectedMatch.innings !== 'teamA' && (
                      <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-full font-semibold">
                        🔒 Locked
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  {selectedMatch.score1 || `${selectedMatch.runs1 || 0}/${selectedMatch.wickets1 || 0}`}
                </div>
                <div className="text-sm text-gray-600">
                  ({selectedMatch.overs1 || '0.0'} overs)
                </div>
              </div>

              <div
                className={`bg-white rounded-xl shadow-md p-4 sm:p-6 border-2 transition-all ${
                  activeTeam === 'teamB' ? 'border-cricbuzz-green shadow-lg' : 'border-transparent'
                } ${
                  // ICC Rule: Lock non-batting team during innings
                  // Allow switching if it's the batting team or if matchPhase is InningsBreak
                  selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                  (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                  selectedMatch.innings !== 'teamB'
                    ? 'cursor-not-allowed opacity-70'
                    : 'cursor-pointer'
                }`}
                onClick={() => {
                  // ICC Rule: Allow switching to batting team, lock non-batting team
                  if (selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                      (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                      selectedMatch.innings !== 'teamB') {
                    return
                  }
                  setActiveTeam('teamB')
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700">
                    {selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeTeam === 'teamB' && (
                      <span className="text-xs bg-cricbuzz-green text-white px-2 py-1 rounded-full font-semibold">
                        Active
                      </span>
                    )}
                    {selectedMatch.status === 'Live' && selectedMatch.tossWinnerSquadId && 
                     (selectedMatch.matchPhase === 'FirstInnings' || selectedMatch.matchPhase === 'SecondInnings') &&
                     selectedMatch.innings !== 'teamB' && (
                      <span className="text-xs bg-gray-400 text-white px-2 py-1 rounded-full font-semibold">
                        🔒 Locked
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  {selectedMatch.score2 || `${selectedMatch.runs2 || 0}/${selectedMatch.wickets2 || 0}`}
                </div>
                <div className="text-sm text-gray-600">
                  ({selectedMatch.overs2 || '0.0'} overs)
                </div>
              </div>
            </div>

            {/* Playing XI Section - Only show if not both lineups are set */}
            {(!selectedMatch?.teamALineupSet || !selectedMatch?.teamBLineupSet) && (
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Playing XI Setup</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Set Playing XI for both teams before starting the match (ICC Rule: 11 players per team).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { team: 'teamA', teamName: selectedMatch?.teamAName || selectedMatch?.team1 || selectedMatch?.teamA || 'Team A' },
                    { team: 'teamB', teamName: selectedMatch?.teamBName || selectedMatch?.team2 || selectedMatch?.teamB || 'Team B' },
                  ].map(({ team, teamName }) => {
                    const lineup = getTeamLineup(selectedMatch, team)
                    const lineupSet = team === 'teamA' ? selectedMatch.teamALineupSet : selectedMatch.teamBLineupSet
                    return (
                      <div
                        key={team}
                        className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold text-gray-800">{teamName}</h3>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                lineupSet ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {lineupSet ? 'Ready' : 'Not Set'}
                            </span>
                          </div>
                          <ul className="space-y-1 text-sm text-gray-600 max-h-32 overflow-y-auto">
                            {lineup.length === 0 ? (
                              <li className="italic text-gray-400">No players selected</li>
                            ) : (
                              lineup.map((player) => (
                                <li key={player.playerId}>
                                  {player.battingPosition}. {player.name}
                                  {player.isCaptain && <span className="text-xs text-blue-500 ml-1">(C)</span>}
                                  {player.isKeeper && <span className="text-xs text-green-500 ml-1">(WK)</span>}
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => openLineupModal(team)}
                          disabled={lineupSet}
                          className={`mt-4 w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                            lineupSet
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-cricbuzz-blue text-white hover:bg-blue-600'
                          }`}
                        >
                          {lineupSet ? 'Playing XI Locked' : 'Manage Playing XI'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Toss Section - Only show if toss is not set yet */}
            {!selectedMatch?.tossWinnerSquadId && (
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Pre-match Toss</h2>
                    <p className="text-xs text-gray-500">
                      Set toss winner and decision. If winner chooses to bat, innings will start automatically.
                    </p>
                  </div>
                </div>

                {tossError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {tossError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Toss Winner
                    </label>
                    <select
                      value={tossSettings.winner}
                      onChange={(e) => handleTossChange('winner', e.target.value)}
                      disabled={!tossEditable || tossSaving}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select team</option>
                      {tossOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Decision
                    </label>
                    <select
                      value={tossSettings.decision}
                      onChange={(e) => handleTossChange('decision', e.target.value)}
                      disabled={!tossEditable || tossSaving || !tossSettings.winner}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select decision</option>
                      <option value="bat">Bat first</option>
                      <option value="bowl">Field first</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={saveTossSettings}
                      disabled={
                        tossSaving ||
                        !tossEditable ||
                        !tossSettings.winner ||
                        !tossSettings.decision
                      }
                      className="px-4 py-2 rounded-lg bg-cricbuzz-green text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tossSaving ? 'Saving...' : 'Save Toss'}
                    </button>
                  </div>
                  {!tossEditable && (
                    <p className="text-xs text-gray-500">Toss locked because play has started.</p>
                  )}
                </div>
              </div>
            )}

            {/* Toss Summary - Show if toss is set */}
            {selectedMatch?.tossWinnerSquadId && (
              <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">Toss Result</h2>
                    <p className="text-sm text-gray-600 mt-1">{tossSummary}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                  On-field Setup
                </h2>
                {!selectedMatch?.teamALineupSet || !selectedMatch?.teamBLineupSet ? (
                  <span className="text-xs font-semibold text-red-500">
                    Set Playing XI for both teams first
                  </span>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Striker <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentPlayerSelection.strikerId}
                    onChange={(e) => handleCurrentPlayerChange('strikerId', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${
                      currentPlayerSelection.strikerId && 
                      currentPlayerSelection.strikerId === currentPlayerSelection.nonStrikerId
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    disabled={!selectedMatch?.teamALineupSet || !selectedMatch?.teamBLineupSet}
                  >
                    <option value="">Select striker</option>
                    {battingLineupMemo
                      .filter((player) => 
                        player.status !== 'out' && 
                        player.playerId !== currentPlayerSelection.nonStrikerId
                      )
                      .map((player) => (
                        <option key={player.playerId} value={player.playerId}>
                          {player.battingPosition}. {player.name}
                        </option>
                      ))}
                  </select>
                  {currentPlayerSelection.strikerId && 
                   currentPlayerSelection.strikerId === currentPlayerSelection.nonStrikerId && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">
                      ⚠️ Cannot select same player as non-striker
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Non-striker <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentPlayerSelection.nonStrikerId}
                    onChange={(e) => handleCurrentPlayerChange('nonStrikerId', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${
                      currentPlayerSelection.nonStrikerId && 
                      currentPlayerSelection.nonStrikerId === currentPlayerSelection.strikerId
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-300'
                    }`}
                    disabled={!selectedMatch?.teamALineupSet || !selectedMatch?.teamBLineupSet}
                  >
                    <option value="">Select non-striker</option>
                    {battingLineupMemo
                      .filter((player) => 
                        player.status !== 'out' && 
                        player.playerId !== currentPlayerSelection.strikerId
                      )
                      .map((player) => (
                        <option key={player.playerId} value={player.playerId}>
                          {player.battingPosition}. {player.name}
                        </option>
                      ))}
                  </select>
                  {currentPlayerSelection.nonStrikerId && 
                   currentPlayerSelection.nonStrikerId === currentPlayerSelection.strikerId && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">
                      ⚠️ Cannot select same player as striker
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bowler
                  </label>
                  <select
                    value={currentPlayerSelection.bowlerId}
                    onChange={(e) => handleCurrentPlayerChange('bowlerId', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    disabled={!selectedMatch?.teamALineupSet || !selectedMatch?.teamBLineupSet}
                  >
                    <option value="">Select bowler</option>
                    {bowlingLineupMemo
                      .filter((player) => player.status !== 'out')
                      .map((player) => (
                        <option key={player.playerId} value={player.playerId}>
                          {player.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-xs text-gray-500">
                  Pick the current batters and bowler before recording a delivery. Suggestions use the Playing XI order.
                </p>
                <button
                  type="button"
                  onClick={saveCurrentPlayers}
                  disabled={
                    stateSaving ||
                    !selectedMatch?.teamALineupSet ||
                    !selectedMatch?.teamBLineupSet ||
                    !currentPlayerSelection.strikerId ||
                    !currentPlayerSelection.nonStrikerId ||
                    !currentPlayerSelection.bowlerId
                  }
                  className="px-4 py-2 rounded-lg bg-cricbuzz-blue text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stateSaving ? 'Saving...' : 'Save On-field Players'}
                </button>
              </div>
            </div>

            {/* ⭐ FAST SCORING INTERFACE - Professional One-Tap Scoring */}
            {selectedMatch?.status === 'Live' && (
              <>
                {/* 1️⃣ Top Bar - Current Match Info - Premium Design */}
                <div className="bg-gradient-to-r from-[#0D8F61] via-[#1FA06B] to-[#0D8F61] rounded-xl shadow-2xl p-4 sm:p-6 mb-4 text-white relative overflow-hidden">
                  {/* Animated background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-xl sm:text-2xl font-black mb-2 drop-shadow-lg">
                          {selectedMatch?.teamAName || selectedMatch?.team1 || 'Team A'} vs{' '}
                          {selectedMatch?.teamBName || selectedMatch?.team2 || 'Team B'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-4 text-sm sm:text-base">
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 font-bold">
                            <span className="opacity-90">Over:</span> <span className="text-lg">{currentTeam.overs}</span>
                          </div>
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 font-bold">
                            <span className="opacity-90">Score:</span> <span className="text-lg">{currentTeam.runs}/{currentTeam.wickets}</span>
                          </div>
                          {selectedMatch?.partnership && (
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 font-bold">
                              <span className="opacity-90">Partnership:</span> <span className="text-lg">{selectedMatch.partnership.runs || 0}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-sm min-w-[200px]">
                        {strikerInfo && (
                          <div className="bg-white/25 backdrop-blur-md rounded-lg px-4 py-2.5 border border-white/30">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold opacity-90">Striker:</span>
                              <span className="font-bold">{strikerInfo.name}</span>
                            </div>
                            <div className="text-xs mt-1 opacity-80">
                              {strikerInfo.runs || 0}* ({strikerInfo.balls || 0} balls)
                              {strikerInfo.balls > 0 && (
                                <span className="ml-2">SR: {((strikerInfo.runs || 0) / (strikerInfo.balls || 1) * 100).toFixed(1)}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {bowlerInfo && (
                          <div className="bg-white/25 backdrop-blur-md rounded-lg px-4 py-2.5 border border-white/30">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold opacity-90">Bowler:</span>
                              <span className="font-bold">{bowlerInfo.name}</span>
                            </div>
                            <div className="text-xs mt-1 opacity-80">
                              {ballsToOvers(bowlerInfo.bowlingBalls || 0)} - {bowlerInfo.bowlingRuns || 0} - {bowlerInfo.bowlingWickets || 0}
                              {bowlerInfo.bowlingBalls > 0 && (
                                <span className="ml-2">Econ: {(bowlerInfo.bowlingRuns / (bowlerInfo.bowlingBalls / 6)).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedMatch?.freeHit && (
                      <div className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 rounded-lg text-sm font-black text-white shadow-2xl animate-pulse border-2 border-white/50">
                        <span className="text-xl animate-bounce">🔥</span>
                        <span className="uppercase tracking-wider">FREE HIT ACTIVE</span>
                        <span className="text-xs opacity-90 font-normal">(Only Run Out, Stumped, Hit Wicket allowed)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2️⃣ Ball Input Grid - BIG BUTTONS (70px × 70px) */}
                <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
                    Ball Input - One Tap Scoring
                  </h3>
                  <div className="grid grid-cols-5 gap-3 sm:gap-4 max-w-2xl mx-auto">
                    {/* Row 1: 0, 1, 2, 3, 4 */}
                    <ScoreButton
                      label="Dot"
                      value="0"
                      onClick={handleDotBall}
                      variant="secondary"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Single"
                      value="1"
                      onClick={() => handleRunEvent(1)}
                      variant="success"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Two"
                      value="2"
                      onClick={() => handleRunEvent(2)}
                      variant="success"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Three"
                      value="3"
                      onClick={() => handleRunEvent(3)}
                      variant="success"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Four"
                      value="4"
                      onClick={() => handleRunEvent(4)}
                      variant="primary"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    {/* Row 2: 6, W, wd, nb, + */}
                    <ScoreButton
                      label="Six"
                      value="6"
                      onClick={() => handleRunEvent(6)}
                      variant="success"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Wicket"
                      value="W"
                      onClick={() => openWicketModal()}
                      variant="danger"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="Wide"
                      value="wd"
                      onClick={handleWide}
                      variant="warning"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="No Ball"
                      value="nb"
                      onClick={openNoBallModal}
                      variant="warning"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                    <ScoreButton
                      label="More"
                      value="+"
                      onClick={() => setMoreOptionsModal({ open: true, type: 'extras' })}
                      variant="ghost"
                      size="xl"
                      disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                    />
                  </div>
                  {scoreLoading && (
                    <div className="mt-4 text-center text-sm text-gray-600">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-[#0D8F61] border-t-transparent rounded-full animate-spin"></div>
                        Updating score...
                      </div>
                    </div>
                  )}
                </div>

                {/* 6️⃣ Live Over Timeline Preview */}
                {selectedMatch?.recentBalls && selectedMatch.recentBalls.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-4">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Current Over Timeline
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const recentBalls = Array.isArray(selectedMatch.recentBalls)
                          ? selectedMatch.recentBalls.slice(0, 12).reverse()
                          : []
                        const currentOver = Math.floor(oversToBalls(currentTeam.overs) / 6)
                        const currentOverBalls = recentBalls.filter((ball) => {
                          const ballOver = Math.floor(oversToBalls(ball.over || '0.0') / 6)
                          return ballOver === currentOver
                        })
                        return (
                          <>
                            <span className="text-sm font-semibold text-gray-600">
                              Over {currentOver + 1}:
                            </span>
                            {currentOverBalls.length > 0 ? (
                              currentOverBalls.map((ball, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    ball.runs === 4
                                      ? 'bg-blue-100 text-blue-700'
                                      : ball.runs === 6
                                      ? 'bg-green-100 text-green-700'
                                      : ball.isWicket
                                      ? 'bg-red-100 text-red-700'
                                      : ball.extraType === 'wide' || ball.extraType === 'no-ball'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {ball.isWicket
                                    ? 'W'
                                    : ball.extraType === 'wide'
                                    ? 'wd'
                                    : ball.extraType === 'no-ball'
                                    ? 'nb'
                                    : ball.runs || '0'}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 text-xs">No balls yet</span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* 7️⃣ Summary Cards - Batting & Bowling */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Batting Card */}
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                      Batting
                    </h3>
                    <div className="space-y-3">
                      {strikerInfo && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{strikerInfo.name}</span>
                            {strikerInfo.isOnStrike && (
                              <span className="px-2 py-0.5 bg-[#0D8F61] text-white text-xs font-bold rounded-full">
                                STRIKE
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">
                              {strikerInfo.runs || 0}*
                            </div>
                            <div className="text-xs text-gray-600">
                              {strikerInfo.balls || 0} balls
                            </div>
                            {strikerInfo.balls > 0 && (
                              <div className="text-xs text-green-600 font-semibold">
                                SR: {((strikerInfo.runs || 0) / (strikerInfo.balls || 1) * 100).toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {nonStrikerInfo && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="font-semibold text-gray-800">{nonStrikerInfo.name}</span>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">
                              {nonStrikerInfo.runs || 0}
                            </div>
                            <div className="text-xs text-gray-600">
                              {nonStrikerInfo.balls || 0} balls
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bowling Card */}
                  <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                      Bowling
                    </h3>
                    <div className="space-y-3">
                      {bowlerInfo && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-gray-900">{bowlerInfo.name}</span>
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                              BOWLING
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <div className="text-xs text-gray-600">Overs</div>
                              <div className="font-bold text-gray-900">
                                {ballsToOvers(bowlerInfo.bowlingBalls || 0)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Runs</div>
                              <div className="font-bold text-gray-900">
                                {bowlerInfo.bowlingRuns || 0}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Wickets</div>
                              <div className="font-bold text-red-600">
                                {bowlerInfo.bowlingWickets || 0}
                              </div>
                            </div>
                          </div>
                          {bowlerInfo.bowlingBalls > 0 && (
                            <div className="mt-2 text-center text-xs text-blue-600 font-semibold">
                              Economy: {(bowlerInfo.bowlingRuns / (bowlerInfo.bowlingBalls / 6)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 5️⃣ Quick Edit Toolbar - Premium Design */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-lg p-4 mb-4 border border-gray-200">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleUndoLastBall}
                      disabled={scoreLoading || lastBallHistory.length === 0}
                      className="px-5 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 flex items-center gap-2"
                    >
                      <span className="text-lg">↶</span>
                      <span>Undo Last Ball</span>
                      {lastBallHistory.length > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          {lastBallHistory.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentOver = Math.floor(oversToBalls(currentTeam.overs) / 6)
                        setEditOverModal({ open: true, overNumber: currentOver })
                      }}
                      disabled={scoreLoading || !selectedMatch}
                      className="px-5 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 flex items-center gap-2"
                    >
                      <span className="text-lg">✏️</span>
                      <span>Edit Over</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualAdjustModal({
                          open: true,
                          runs: currentTeam.runs.toString(),
                          wickets: currentTeam.wickets.toString(),
                          overs: currentTeam.overs,
                        })
                      }}
                      disabled={scoreLoading || !selectedMatch}
                      className="px-5 py-2.5 bg-white text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 flex items-center gap-2"
                    >
                      <span className="text-lg">⚙️</span>
                      <span>Manual Adjust</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {extraModalState.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4"
                onClick={closeExtraModal}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-semibold text-gray-800">
                    {extraModalState.type === EXTRA_TYPES.NO_BALL
                      ? 'Record No-Ball'
                      : extraModalState.type === EXTRA_TYPES.WIDE
                      ? 'Record Wide'
                      : 'Record Leg Bye'}
                  </h3>
                  {extraModalState.type === EXTRA_TYPES.NO_BALL && (
                    <>
                      <p className="text-sm text-gray-600">
                        No-ball shathe always 1 run add hoy. Bat run ba leg-bye run (LB) select kor.
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {['0', '1', '2', '3', '4', '6', '1lb', '2lb', '3lb'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setExtraModalState((prev) => ({
                                ...prev,
                                batRuns: option,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                              extraModalState.batRuns === option
                                ? 'bg-cricbuzz-green text-white border-cricbuzz-green'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-cricbuzz-green'
                            }`}
                          >
                            {option.includes('lb')
                              ? `${option.replace('lb', '')} LB`
                              : option}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        LB mane leg-bye run (batsman er khatay jabena). Selection + 1 penalty run add hobe.
                      </p>
                    </>
                  )}
                  {extraModalState.type === EXTRA_TYPES.WIDE && (
                    <>
                      <p className="text-sm text-gray-600">
                        Wide-te 1 run automatic. Extra wides (0-6) select kor.
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {['0', '1', '2', '3', '4', '6'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setExtraModalState((prev) => ({
                                ...prev,
                                runs: option,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                              extraModalState.runs === option
                                ? 'bg-cricbuzz-green text-white border-cricbuzz-green'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-cricbuzz-green'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {extraModalState.type === EXTRA_TYPES.LEG_BYE && (
                    <>
                      <p className="text-sm text-gray-600">
                        Pure leg-bye scenario te runs select kor (1-3 only).
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        {['1lb', '2lb', '3lb'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setExtraModalState((prev) => ({
                                ...prev,
                                runs: option,
                              }))
                            }
                            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                              extraModalState.runs === option
                                ? 'bg-cricbuzz-green text-white border-cricbuzz-green'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-cricbuzz-green'
                            }`}
                          >
                            {option.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Ei run gulo batsman-er khatay jabena, kintu ball count hobe.
                      </p>
                    </>
                  )}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeExtraModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitExtraModal}
                      disabled={scoreLoading}
                      className="px-4 py-2 rounded-lg bg-cricbuzz-green text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Record
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wicketModalState.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
                onClick={closeWicketModal}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">Record Wicket</h3>
                    <button
                      type="button"
                      onClick={closeWicketModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wicket Type
                      </label>
                      <select
                        value={wicketModalState.type}
                        onChange={(e) => {
                          const newType = e.target.value
                          const keeperCandidate = bowlingLineupMemo.find((player) => player.isKeeper)
                          setWicketModalState((prev) => ({
                            ...prev,
                            type: newType,
                            creditToBowler: newType === 'Run Out' ? false : true,
                            assistPlayerId:
                              newType === 'Stumped'
                                ? keeperCandidate?.playerId || ''
                                : newType === 'Caught'
                                ? prev.assistPlayerId
                                : '',
                            assistName:
                              newType === 'Stumped'
                                ? keeperCandidate?.name || ''
                                : newType === 'Caught'
                                ? prev.assistName
                                : '',
                            customAssist: newType === 'Run Out' ? prev.customAssist : '',
                          }))
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      >
                        {WICKET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Runs scored on this ball
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="6"
                        value={wicketModalState.runs}
                        onChange={(e) =>
                          setWicketModalState((prev) => ({
                            ...prev,
                            runs: Math.max(0, Math.min(6, Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-gray-700 mb-2">
                      Dismissed Player
                    </span>
                    {/* ICC Rule: Only Run Out allows selection, other wickets always dismiss striker */}
                    {wicketModalState.type === 'Run Out' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {creaseBatters.map((player) => (
                          <label
                            key={player.playerId}
                            className={`flex items-center justify-between border rounded-lg px-4 py-2 cursor-pointer ${
                              wicketModalState.dismissedPlayerId === player.playerId
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200'
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-gray-800">{player.name}</p>
                              <p className="text-xs text-gray-500">{player.role}</p>
                            </div>
                            <input
                              type="radio"
                              name="dismissedPlayer"
                              value={player.playerId}
                              checked={wicketModalState.dismissedPlayerId === player.playerId}
                              onChange={(e) =>
                                setWicketModalState((prev) => ({
                                  ...prev,
                                  dismissedPlayerId: e.target.value,
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="border rounded-lg px-4 py-3 bg-gray-50">
                        <p className="font-semibold text-gray-800">
                          {creaseBatters.find(p => p.playerId === wicketModalState.dismissedPlayerId)?.name || 'Striker'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ICC Rule: {wicketModalState.type} always dismisses the striker
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Incoming Batter
                    </label>
                    <select
                      value={wicketModalState.nextBatsmanId}
                      onChange={(e) =>
                        setWicketModalState((prev) => ({
                          ...prev,
                          nextBatsmanId: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    >
                      <option value="">No replacement / Innings closed</option>
                      {availableBenchBatters.map((player) => (
                        <option key={player.playerId} value={player.playerId}>
                          {player.battingPosition}. {player.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Suggestion: {availableBenchBatters[0]?.name || 'None available'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={wicketModalState.creditToBowler}
                        disabled={wicketModalState.type === 'Run Out'}
                        onChange={(e) =>
                          setWicketModalState((prev) => ({
                            ...prev,
                            creditToBowler: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm text-gray-700">Credit wicket to bowler</span>
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={wicketModalState.creditRunsToBatsman}
                        onChange={(e) =>
                          setWicketModalState((prev) => ({
                            ...prev,
                            creditRunsToBatsman: e.target.checked,
                          }))
                        }
                      />
                      <span className="text-sm text-gray-700">Runs go to batsman</span>
                    </label>
                  </div>

                  {(wicketModalState.type === 'Caught' ||
                    wicketModalState.type === 'Run Out' ||
                    wicketModalState.type === 'Stumped') && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {wicketModalState.type === 'Stumped' ? 'Wicketkeeper' : 'Fielder'}
                        </label>
                        <select
                          value={wicketModalState.assistPlayerId}
                          onChange={(e) => {
                            const selectedId = e.target.value
                            const player =
                              bowlingLineupMemo.find((p) => p.playerId === selectedId) || null
                            setWicketModalState((prev) => ({
                              ...prev,
                              assistPlayerId: selectedId,
                              assistName: player?.name || '',
                            }))
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        >
                          <option value="">
                            {wicketModalState.type === 'Stumped'
                              ? 'Select wicketkeeper'
                              : 'Select fielder'}
                          </option>
                          {bowlingLineupMemo.map((player) => (
                            <option key={player.playerId} value={player.playerId}>
                              {player.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {wicketModalState.type === 'Run Out' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fielder Note (optional)
                          </label>
                          <input
                            type="text"
                            value={wicketModalState.customAssist}
                            onChange={(e) =>
                              setWicketModalState((prev) => ({
                                ...prev,
                                customAssist: e.target.value,
                              }))
                            }
                            placeholder="e.g., Direct hit from deep"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeWicketModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitWicketModal}
                      disabled={scoreLoading}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Record Wicket
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3️⃣ More Options Modal - Advanced Events */}
            {moreOptionsModal.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
                onClick={() => setMoreOptionsModal({ open: false, type: null })}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">More Options</h3>
                    <button
                      type="button"
                      onClick={() => setMoreOptionsModal({ open: false, type: null })}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {moreOptionsModal.type === 'extras' && (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Extras</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setMoreOptionsModal({ open: false, type: null })
                              openLegByeModal()
                            }}
                            className="px-4 py-3 bg-amber-100 text-amber-700 rounded-lg font-semibold hover:bg-amber-200 transition-colors"
                          >
                            Leg Byes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoreOptionsModal({ open: false, type: null })
                              // TODO: Implement Byes
                              setError('Byes functionality coming soon')
                            }}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Byes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoreOptionsModal({ open: false, type: null })
                              // TODO: Implement Overthrow
                              setError('Overthrow functionality coming soon')
                            }}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Overthrow
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMoreOptionsModal({ open: false, type: null })
                              // TODO: Implement Penalty Runs
                              setError('Penalty runs functionality coming soon')
                            }}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Penalty Runs
                          </button>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Free Hit</h4>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedMatch) return
                              try {
                                await matchesAPI.updateScore(selectedMatchId, { freeHit: true })
                                setSuccess('Free hit activated')
                                setMoreOptionsModal({ open: false, type: null })
                              } catch (err) {
                                setError('Failed to activate free hit')
                              }
                            }}
                            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-semibold hover:bg-orange-200 transition-colors"
                          >
                            Activate Free Hit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!selectedMatch) return
                              try {
                                await matchesAPI.updateScore(selectedMatchId, { freeHit: false })
                                setSuccess('Free hit deactivated')
                                setMoreOptionsModal({ open: false, type: null })
                              } catch (err) {
                                setError('Failed to deactivate free hit')
                              }
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                          >
                            Deactivate Free Hit
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {moreOptionsModal.type === 'wicket' && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Wicket Types</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {WICKET_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setMoreOptionsModal({ open: false, type: null })
                              openWicketModal(type)
                            }}
                            className="px-4 py-3 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setMoreOptionsModal({ open: false, type: null })}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Over Modal */}
            {editOverModal.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
                onClick={() => setEditOverModal({ open: false, overNumber: null })}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 space-y-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Edit Over {editOverModal.overNumber + 1}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setEditOverModal({ open: false, overNumber: null })}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ <strong>Warning:</strong> Editing an over will recalculate all statistics. This action cannot be easily undone. Use with caution.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Over editing functionality is complex and requires recalculating all subsequent balls. 
                      For now, please use "Undo Last Ball" to correct recent mistakes, or use "Manual Adjust" for emergency corrections.
                    </p>
                    <p className="text-xs text-gray-500">
                      Full over editing will be available in a future update.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditOverModal({ open: false, overNumber: null })}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Adjust Modal */}
            {manualAdjustModal.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
                onClick={() => setManualAdjustModal({ open: false, runs: '', wickets: '', overs: '' })}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-800">Manual Score Adjustment</h3>
                    <button
                      type="button"
                      onClick={() => setManualAdjustModal({ open: false, runs: '', wickets: '', overs: '' })}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      ⚠️ <strong>Emergency Use Only:</strong> Manual adjustments bypass normal scoring logic. Use only for critical corrections.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Runs
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={manualAdjustModal.runs}
                        onChange={(e) =>
                          setManualAdjustModal((prev) => ({
                            ...prev,
                            runs: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Wickets
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={manualAdjustModal.wickets}
                        onChange={(e) =>
                          setManualAdjustModal((prev) => ({
                            ...prev,
                            wickets: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Overs (e.g., 7.4)
                      </label>
                      <input
                        type="text"
                        pattern="[0-9]+\\.[0-5]"
                        value={manualAdjustModal.overs}
                        onChange={(e) =>
                          setManualAdjustModal((prev) => ({
                            ...prev,
                            overs: e.target.value,
                          }))
                        }
                        placeholder="7.4"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: overs.balls (e.g., 7.4 means 7 overs and 4 balls)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setManualAdjustModal({ open: false, runs: '', wickets: '', overs: '' })}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedMatch) return
                        try {
                          setScoreLoading(true)
                          const runs = Number.parseInt(manualAdjustModal.runs, 10) || 0
                          const wickets = Number.parseInt(manualAdjustModal.wickets, 10) || 0
                          const oversValue = manualAdjustModal.overs || '0.0'
                          const balls = oversToBalls(oversValue)
                          
                          if (runs < 0 || wickets < 0 || wickets > 10 || balls < 0) {
                            setError('Invalid values. Please check your inputs.')
                            setScoreLoading(false)
                            return
                          }
                          
                          const battingTeam = determineBattingTeam(selectedMatch)
                          const scoreState = getScoreState(selectedMatch, battingTeam)
                          
                          const updatePayload = {
                            [scoreState.runsField]: runs,
                            [scoreState.wicketsField]: wickets,
                            [scoreState.ballsField]: balls,
                            [scoreState.oversField]: oversValue,
                            [scoreState.scoreField]: `${runs}/${wickets}`,
                            [`${scoreState.scorePathPrefix}.runs`]: runs,
                            [`${scoreState.scorePathPrefix}.wickets`]: wickets,
                            [`${scoreState.scorePathPrefix}.overs`]: oversValue,
                            [`${scoreState.scorePathPrefix}.balls`]: balls,
                            updatedAt: new Date(),
                          }
                          
                          await matchesAPI.updateScore(selectedMatchId, updatePayload)
                          setSuccess('Score manually adjusted successfully.')
                          setManualAdjustModal({ open: false, runs: '', wickets: '', overs: '' })
                          setTimeout(() => setSuccess(''), 2500)
                          await loadMatchData(selectedMatchId)
                        } catch (adjustError) {
                          console.error('Error manually adjusting score:', adjustError)
                          setError('Failed to adjust score.')
                        } finally {
                          setScoreLoading(false)
                        }
                      }}
                      disabled={scoreLoading}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply Adjustment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {lineupModalState.open && (
              <div
                className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 px-4"
                onClick={closeLineupModal}
              >
                <div
                  className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6 space-y-5 overflow-y-auto max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800">
                        Manage Playing XI —{' '}
                        {lineupModalState.team === 'teamA'
                          ? selectedMatch.teamAName || selectedMatch.team1 || selectedMatch.teamA
                          : selectedMatch.teamBName || selectedMatch.team2 || selectedMatch.teamB}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Select up to {MAX_PLAYING_XI} players, assign batting order, captain, and wicketkeeper.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeLineupModal}
                      className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  {setupError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {setupError}
                    </div>
                  )}
                  {!setupError && setupInfo && (
                    <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 text-sm text-blue-700">
                      {setupInfo}
                    </div>
                  )}

                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Select
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Player
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Batting Order
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Captain
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Wicketkeeper
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(lineupModalState.team === 'teamA' ? teamAPlayers : teamBPlayers).map((player) => {
                          const selected = lineupModalState.selection[player.id]
                          return (
                            <tr key={player.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selected?.selected)}
                                  onChange={() => handleToggleLineupPlayer(player)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-semibold text-gray-800">{player.name}</div>
                                <div className="text-xs text-gray-500">
                                  {player.role} • {player.village || player.batch || 'N/A'}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {selected?.selected ? (
                                  <input
                                    type="number"
                                    min="1"
                                    max={MAX_PLAYING_XI}
                                    value={selected.battingPosition}
                                    onChange={(e) =>
                                      handleLineupBattingPositionChange(player.id, e.target.value)
                                    }
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {selected?.selected ? (
                                  <input
                                    type="radio"
                                    name="captain"
                                    checked={lineupModalState.captainId === player.id}
                                    onChange={() =>
                                      setLineupModalState((prev) => ({
                                        ...prev,
                                        captainId: player.id,
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {selected?.selected ? (
                                  <input
                                    type="radio"
                                    name="keeper"
                                    checked={lineupModalState.keeperId === player.id}
                                    onChange={() =>
                                      setLineupModalState((prev) => ({
                                        ...prev,
                                        keeperId: player.id,
                                      }))
                                    }
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeLineupModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveLineup}
                      disabled={lineupSaving}
                      className="px-4 py-2 rounded-lg bg-cricbuzz-green text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {lineupSaving ? 'Saving...' : 'Save Playing XI'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Commentary Section */}
            <form onSubmit={handleSubmitCommentary} className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Add Commentary</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commentary Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={commentary}
                    onChange={(e) => setCommentary(e.target.value)}
                    placeholder="Enter ball-by-ball commentary..."
                    rows="3"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green resize-none text-base"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs uppercase text-gray-500">Striker</p>
                    <p className="text-sm font-semibold text-gray-800">{strikerInfo?.name || 'Not set'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs uppercase text-gray-500">Non-Striker</p>
                    <p className="text-sm font-semibold text-gray-800">{nonStrikerInfo?.name || 'Not set'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-xs uppercase text-gray-500">Bowler</p>
                    <p className="text-sm font-semibold text-gray-800">{bowlerInfo?.name || 'Not set'}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-cricbuzz-green text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={scoreLoading || !selectedMatch || selectedMatch.status !== 'Live'}
                >
                  {scoreLoading ? 'Submitting...' : 'Add Commentary'}
                </button>
              </div>
            </form>

            {/* Match Info & Actions */}
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Match Information</h2>
              <div className="space-y-2 text-sm sm:text-base">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Venue:</span>
                  <span className="text-gray-900">{selectedMatch.venue || 'Main Ground'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Format:</span>
                  <span className="text-gray-900">{selectedMatch.format || 'T20'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Overs per innings:</span>
                  <span className="text-gray-900">{selectedMatch.oversLimit || 10}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-700">Status:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedMatch.status === 'Live'
                        ? 'bg-red-100 text-red-800'
                        : selectedMatch.status === 'Completed'
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedMatch.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/live/${selectedMatchId}`}
                  className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-base sm:text-lg"
                >
                  View Live Match Page →
                </Link>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Auto-Sync:</strong> All score updates and commentary are automatically synced with the live match page and player statistics.
              </p>
            </div>
          </>
        )}

        {!selectedMatch && !matchLoading && liveMatches.length === 0 && upcomingMatches.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏏</div>
            <p className="text-gray-500 text-lg">Select a match to start scoring</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPanel
