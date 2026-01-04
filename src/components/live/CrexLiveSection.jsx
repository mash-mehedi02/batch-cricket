/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
import ProjectedScoreTable from './ProjectedScoreTable'
import WinProbability from './WinProbability'

const CrexLiveSection = ({
  striker,
  nonStriker,
  currentBowler,
  partnership,
  lastWicket,
  recentOvers,
  commentary,
  activeCommentaryFilter,
  onCommentaryFilterChange,
  currentRunRate,
  requiredRunRate,
  currentRuns,
  currentOvers,
  oversLimit,
  target,
  runsNeeded,
  ballsRemaining,
  matchStatus,
  matchPhase, // Add matchPhase prop
  currentInnings, // Add currentInnings prop
  currentWickets, // Add wickets prop
  teamAName, // Add team names for win probability
  teamBName,
  resultSummary, // Add resultSummary prop for winner display
  match, // Add match prop
}) => {
  // Format player display: "Name runs (balls)"
  const formatPlayer = (player) => {
    if (!player) return null
    return `${player.name || 'Player'} ${player.runs || 0} (${player.balls || 0})`
  }

  // Format bowler display: "Name wickets-runs (overs)"
  const formatBowler = (bowler) => {
    if (!bowler) return null
    const wickets = bowler.wickets || 0
    const runs = bowler.runsConceded || bowler.runs || 0
    const overs = bowler.overs || '0.0'
    return `${bowler.name || 'Bowler'} ${wickets}-${runs} (${overs})`
  }

  // Format partnership: "runs(balls)"
  const formatPartnership = () => {
    if (!partnership) return '0(0)'
    return `${partnership.runs || 0}(${partnership.balls || 0})`
  }

  // Format last wicket: "Name runs(balls)"
  const formatLastWicket = () => {
    if (!lastWicket) return null
    return `${lastWicket.batsmanName || 'Batsman'} ${lastWicket.runs || 0}(${lastWicket.balls || 0})`
  }

  // Get scrolling ref
  const scrollRef = React.useRef(null)

  // Auto-scroll to end when overs update
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [recentOvers])

  // Use full recent overs list for horizontal scroll
  const displayOvers = recentOvers || []

  // Commentary filters
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'highlights', label: 'Highlights' },
    { id: 'overs', label: 'Overs' },
    { id: 'wickets', label: 'W' },
    { id: 'sixes', label: '6s' },
    { id: 'fours', label: '4s' },
    { id: 'inn1', label: 'Inn 1' },
    { id: 'inn2', label: 'Inn 2' },
    { id: 'milestone', label: 'Milestone' },
  ]

  // Filter commentary based on active filter
  const filteredCommentary = commentary ? (() => {
    if (!activeCommentaryFilter || activeCommentaryFilter === 'all') {
      return commentary
    }
    return commentary.filter(item => {
      const text = (item.text || '').toLowerCase()
      switch (activeCommentaryFilter) {
        case 'wickets':
          return text.includes('out') || text.includes('wicket') || text.includes('dismissed')
        case 'sixes':
          return text.includes('six') || item.runs === 6
        case 'fours':
          return text.includes('four') || item.runs === 4
        case 'highlights':
          return item.isHighlight || item.runs >= 4 // Highlight 4s too
        case 'overs':
          return item.over || text.includes('over')
        default:
          return true
      }
    })
  })() : []

  // Get player photo or show player icon with initial
  const getPlayerAvatar = (player, size = 'md') => {
    if (!player) return null
    const sizeClasses = {
      sm: 'w-10 h-10 text-sm',
      md: 'w-12 h-12 text-base',
      lg: 'w-16 h-16 text-lg',
    }
    const sizeClass = sizeClasses[size] || sizeClasses.md
    const initials = player.name?.charAt(0)?.toUpperCase() || 'P'

    // Player icon SVG (fallback)
    const PlayerIcon = () => (
      <svg className="w-2/3 h-2/3 opacity-70" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      </svg>
    )

    if (player.photo) {
      return (
        <div className="relative">
          <img
            src={player.photo}
            alt={player.name}
            className={`${sizeClass.split(' ')[0]} ${sizeClass.split(' ')[1]} rounded-full object-cover border-2 border-gray-300 shadow-md`}
            onError={(e) => {
              e.target.style.display = 'none'
              const fallback = e.target.nextSibling
              if (fallback) {
                fallback.style.display = 'flex'
              }
            }}
          />
          {/* Fallback: Player Icon with Initials */}
          <div
            className={`${sizeClass.split(' ')[0]} ${sizeClass.split(' ')[1]} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold border-2 border-gray-300 shadow-md hidden relative`}
          >
            <PlayerIcon />
            <span className="absolute text-xs font-bold">{initials}</span>
          </div>
        </div>
      )
    }
    // No photo: Show player icon with initials
    return (
      <div className={`${sizeClass.split(' ')[0]} ${sizeClass.split(' ')[1]} rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold border-2 border-gray-300 shadow-md relative`}>
        <PlayerIcon />
        <span className="absolute text-xs font-bold">{initials}</span>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-2">

            {/* 1. Target/Runs Needed Strip - Prominent & Compact */}
            {matchPhase === 'SecondInnings' && target && runsNeeded !== null && (
              <div className="bg-[#fff7e6] text-[#92400e] py-2 px-4 rounded-md text-center text-sm font-bold border border-amber-100 shadow-sm mx-1">
                {runsNeeded > 0
                  ? `${(match.currentBatting === 'teamB' ? teamBName : teamAName)} need ${runsNeeded} runs in ${ballsRemaining} balls`
                  : resultSummary || 'Match Finished'
                }
              </div>
            )}

            {/* 2. Recent Overs - Horizontal Scrolling Strip */}
            {displayOvers.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 overflow-hidden">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Overs</span>
                </div>
                <div
                  ref={scrollRef}
                  className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
                >
                  {displayOvers.map((over, idx) => {
                    const overNo = (over?.overNumber ?? over?.number ?? over?.over ?? 0)
                    const total = Number(over?.totalRuns ?? over?.total ?? 0)
                    const normalizeDelivery = (b) => {
                      if (!b) return null
                      if (typeof b === 'string') return { value: b, type: 'run' }
                      return {
                        value: String(b?.value ?? b?.label ?? b?.runsOffBat ?? b?.runs ?? ''),
                        type: String(b?.type ?? (b?.isWicket ? 'wicket' : 'run')),
                        runsOffBat: b?.runsOffBat,
                        runs: b?.runs,
                        isLegal: b?.isLegal,
                      }
                    }
                    const deliveriesAll = (over?.deliveries && Array.isArray(over.deliveries))
                      ? over.deliveries.map(normalizeDelivery).filter(Boolean)
                      : (over?.balls && Array.isArray(over.balls))
                        ? over.balls.map(normalizeDelivery).filter(Boolean)
                        : []

                    const getBadgeColor = (val, type) => {
                      const v = String(val || '').trim()
                      if (type === 'wicket' || v.toUpperCase() === 'W') return 'bg-red-500 text-white border-red-500'
                      if (v === '4') return 'bg-blue-500 text-white border-blue-500'
                      if (v === '6') return 'bg-emerald-500 text-white border-emerald-500'
                      return 'bg-slate-50 text-slate-600 border-slate-200'
                    }

                    return (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50/50 px-3 py-2 rounded-lg border border-slate-100 flex-shrink-0 min-w-max">
                        <div className="text-xs font-bold text-slate-500 whitespace-nowrap">Over {overNo}</div>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-1.5">
                          {deliveriesAll.map((d, i) => {
                            const v = d ? (d.value ?? d.label ?? d.runsOffBat ?? d.runs ?? '') : ''
                            const type = d ? (d.type ?? 'run') : 'run'
                            return (
                              <div key={i} className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold shadow-sm ${getBadgeColor(v, type)}`}>
                                {v || '•'}
                              </div>
                            )
                          })}
                          {/* Total for over */}
                          <div className="ml-2 text-xs font-bold text-slate-900">= {total}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 3. Current Players Section - Professional Table Layout */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

              {/* Batting Table */}
              <div>
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batter</span>
                  <div className="flex gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    <span className="w-10">R (B)</span>
                    <span className="w-8 hidden sm:block">4s</span>
                    <span className="w-8 hidden sm:block">6s</span>
                    <span className="w-12 text-right">SR</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {striker && (
                    <div className="px-4 py-3 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">{striker.name || 'Striker'}</span>
                        <span className="text-pink-500 text-xs">🏏</span>
                      </div>
                      <div className="flex gap-4 text-sm font-medium text-slate-700 text-right">
                        <span className="w-10 font-bold text-slate-900">{striker.runs || 0} <span className="text-slate-400 font-normal">({striker.balls || 0})</span></span>
                        <span className="w-8 hidden sm:block text-slate-500">{striker.fours || 0}</span>
                        <span className="w-8 hidden sm:block text-slate-500">{striker.sixes || 0}</span>
                        <span className="w-12 text-right text-slate-500">{striker.strikeRate ? Number(striker.strikeRate).toFixed(1) : '0.0'}</span>
                      </div>
                    </div>
                  )}
                  {nonStriker && (
                    <div className="px-4 py-3 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-normal text-slate-600">{nonStriker.name || 'Non-Striker'}</span>
                      </div>
                      <div className="flex gap-4 text-sm font-medium text-slate-700 text-right">
                        <span className="w-10 font-bold text-slate-900">{nonStriker.runs || 0} <span className="text-slate-400 font-normal">({nonStriker.balls || 0})</span></span>
                        <span className="w-8 hidden sm:block text-slate-500">{nonStriker.fours || 0}</span>
                        <span className="w-8 hidden sm:block text-slate-500">{nonStriker.sixes || 0}</span>
                        <span className="w-12 text-right text-slate-500">{nonStriker.strikeRate ? Number(nonStriker.strikeRate).toFixed(1) : '0.0'}</span>
                      </div>
                    </div>
                  )}
                  {/* Partnership Row */}
                  <div className="px-4 py-2 bg-slate-50/50 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100">
                    <span className="font-semibold">P'ship:</span>
                    <span>{formatPartnership()}</span>
                    {lastWicket && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="font-semibold">Last Wkt:</span>
                        <span>{formatLastWicket()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Bowler Table */}
              <div className="border-t border-slate-200">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bowler</span>
                  <div className="flex gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                    <span className="w-12">O-M</span>
                    <span className="w-8">R</span>
                    <span className="w-8">W</span>
                    <span className="w-12 text-right">ECO</span>
                  </div>
                </div>
                <div className="bg-white">
                  {currentBowler ? (
                    <div className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">{currentBowler.name || 'Bowler'}</span>
                      </div>
                      <div className="flex gap-4 text-sm font-medium text-slate-700 text-right">
                        <span className="w-12 text-slate-500">{currentBowler.overs || '0.0'}-{currentBowler.maidens || 0}</span>
                        <span className="w-8 text-slate-500">{currentBowler.runsConceded || 0}</span>
                        <span className="w-8 font-bold text-slate-900">{currentBowler.wickets || 0}</span>
                        <span className="w-12 text-right text-slate-500">{currentBowler.economy ? Number(currentBowler.economy).toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-400 italic">No bowler selected</div>
                  )}
                </div>
              </div>
            </div>

            {/* Commentary Section - Enhanced */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gray-50 px-5 sm:px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Commentary</h3>
                  {matchStatus === 'Live' && (
                    <span className="flex items-center text-xs text-red-600 font-semibold">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
                      Live
                    </span>
                  )}
                </div>

                {/* Commentary Filters - Enhanced */}
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => onCommentaryFilterChange && onCommentaryFilterChange(filter.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeCommentaryFilter === filter.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Commentary List - Enhanced */}
              <div className="max-h-96 overflow-y-auto">
                {filteredCommentary.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {filteredCommentary.slice().reverse().map((item, idx) => (
                      <div
                        key={idx}
                        className="px-5 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-xs font-semibold text-gray-500 min-w-[50px] pt-0.5">
                            {item.over || '—'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 leading-relaxed">
                              {item.text || item.commentary || 'No commentary available'}
                            </div>
                            {item.runs !== undefined && item.runs > 0 && (
                              <div className="text-xs text-gray-500 mt-1.5">
                                {item.runs} run{item.runs !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <div className="text-4xl mb-3">📝</div>
                    <p className="text-sm">No commentary available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Projected Score (1st Innings) or Win Probability (2nd Innings) */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              {/* ICC Rule: Show Projected Score only in First Innings, Win Probability in Second Innings */}
              {matchPhase === 'SecondInnings' && target ? (
                <WinProbability
                  currentRuns={currentRuns || 0}
                  wickets={currentWickets || 0}
                  balls={Math.floor(parseFloat(currentOvers || '0.0') * 6)}
                  target={target}
                  oversLimit={oversLimit || 50}
                  teamAName={teamAName || 'Team A'}
                  teamBName={teamBName || 'Team B'}
                />
              ) : (
                <ProjectedScoreTable
                  currentRuns={currentRuns || 0}
                  currentOvers={currentOvers || '0.0'}
                  currentRunRate={currentRunRate || 0}
                  oversLimit={oversLimit || 50}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrexLiveSection
