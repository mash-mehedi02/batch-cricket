/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
import ProjectedScoreTable from './ProjectedScoreTable'
import WinProbability from './WinProbability'

// Helper function to get first word of name
const getFirstName = (fullName) => {
  const words = String(fullName || '').trim().split(/\s+/)
  return words[0] || fullName
}

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
  teamAInnings,
  teamBInnings,
  resultSummary, // Add resultSummary prop for winner display
  match, // Add match prop
  firstSide, // 'teamA' or 'teamB'
  secondSide,
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

  // Check if mobile view
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
        case 'inn1':
          return item.innings === firstSide
        case 'inn2':
          return item.innings === secondSide
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

    if (player.photoUrl || player.photo) {
      return (
        <div className="relative">
          <img
            src={player.photoUrl || player.photo}
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

  const isFinishedMatch = matchStatus === 'Finished' || matchStatus === 'Completed';

  return (
    <div className="bg-[#f8fafc] min-h-screen">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-2 md:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-4">

            {/* Match Status Card (Chasing) */}
            {matchPhase === 'SecondInnings' && target && runsNeeded !== null && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden group">
                <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 skew-x-[-20deg] translate-x-10 group-hover:translate-x-5 transition-transform duration-700"></div>
                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl animate-pulse">🎯</div>
                    <div>
                      <h4 className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-1">Chasing Target</h4>
                      <p className="text-xl md:text-2xl font-black tracking-tight whitespace-nowrap">
                        Need <span className="text-yellow-200">{runsNeeded}</span> runs in <span className="text-yellow-200">{ballsRemaining}</span> <span className="text-sm font-bold opacity-80 uppercase tracking-widest">balls</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-px bg-white/20 hidden sm:block"></div>
                    <div className="text-center sm:text-right">
                      <span className="block text-[10px] font-bold text-white/60 uppercase tracking-widest">Required Rate</span>
                      <span className="text-xl font-black">{requiredRunRate ? Number(requiredRunRate).toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Overs - Premium Horizontal Scrolling */}
            {displayOvers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1 h-3 bg-slate-300 rounded-full"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Timeline</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Scroll for history →</div>
                </div>
                <div
                  ref={scrollRef}
                  className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
                >
                  {displayOvers.map((over, idx) => {
                    const overNo = (over?.overNumber ?? over?.number ?? over?.over ?? 0)
                    const total = Number(over?.totalRuns ?? over?.total ?? 0)
                    const deliveriesAll = (over?.deliveries || over?.balls || []).map(b => {
                      if (!b) return null
                      if (typeof b === 'string') return { value: b, type: 'run' }
                      return {
                        value: String(b?.value ?? b?.label ?? b?.runsOffBat ?? b?.runs ?? ''),
                        type: String(b?.type ?? (b?.isWicket ? 'wicket' : 'run')),
                      }
                    }).filter(Boolean)

                    const getBadgeColor = (val, type) => {
                      const v = String(val || '').trim()
                      if (type === 'wicket' || v.toUpperCase() === 'W') return 'bg-rose-500 text-white shadow-rose-200'
                      if (v === '4') return 'bg-blue-600 text-white shadow-blue-200'
                      if (v === '6') return 'bg-emerald-600 text-white shadow-emerald-200'
                      return 'bg-slate-100 text-slate-700 border-slate-200'
                    }

                    return (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50/80 px-4 py-2.5 rounded-2xl border border-slate-100 flex-shrink-0">
                        <div className="text-xs font-black text-slate-400 uppercase tracking-tighter">OV {overNo}</div>
                        <div className="h-5 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                          {deliveriesAll.map((d, i) => (
                            <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm transform hover:scale-110 transition-transform ${getBadgeColor(d.value, d.type)}`}>
                              {d.value === '' || d.value === '0' ? '0' : d.value}
                            </div>
                          ))}
                          {Array.from({ length: Math.max(0, 6 - deliveriesAll.length) }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-7 h-7 rounded-full border-2 border-dashed border-slate-200 bg-white/50 animate-pulse"></div>
                          ))}
                          <div className="ml-3 px-2 py-1 bg-white rounded-lg shadow-sm border border-slate-100">
                            <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Runs:</span>
                            <span className="text-xs font-black text-slate-900">{total}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Players Area - CREX Premium Table Style */}
            {!isFinishedMatch && (
              <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {/* Batting Side */}
                  <div className="p-4 md:p-5 border-b md:border-b-0 md:border-r border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-black">BAT</div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Batting</h4>
                      </div>
                      <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                        <span className="w-14">R (B)</span>
                        <span className="w-8 hidden sm:block">4s/6s</span>
                        <span className="w-10">SR</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {striker && (
                        <div className="flex justify-between items-center group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                {striker.photoUrl ? <img src={striker.photoUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{striker.name?.charAt(0)}</span>}
                              </div>
                              <div className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[8px] text-white">🏏</div>
                            </div>
                            <span className="text-sm font-black text-slate-900 truncate" title={striker.name}>{isMobile ? getFirstName(striker.name) : striker.name}</span>
                          </div>
                          <div className="flex gap-4 text-sm font-bold text-slate-700 text-right shrink-0">
                            <span className="w-14 text-slate-900">{striker.runs || 0} <span className="text-[10px] text-slate-400 font-normal">({striker.balls || 0})</span></span>
                            <span className="w-8 hidden sm:block text-slate-400 text-xs">{striker.fours || 0}/{striker.sixes || 0}</span>
                            <span className="w-10 text-slate-500 font-mono text-xs">{striker.strikeRate ? Number(striker.strikeRate).toFixed(1) : '0.0'}</span>
                          </div>
                        </div>
                      )}
                      {nonStriker && (
                        <div className="flex justify-between items-center opacity-60 hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-3 min-w-0 ml-1">
                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200">
                              {nonStriker.photoUrl ? <img src={nonStriker.photoUrl} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-400">{nonStriker.name?.charAt(0)}</span>}
                            </div>
                            <span className="text-sm font-bold text-slate-600 truncate" title={nonStriker.name}>{isMobile ? getFirstName(nonStriker.name) : nonStriker.name}</span>
                          </div>
                          <div className="flex gap-4 text-sm font-medium text-slate-600 text-right shrink-0">
                            <span className="w-14">{nonStriker.runs || 0} <span className="text-[10px] text-slate-400 font-normal">({nonStriker.balls || 0})</span></span>
                            <span className="w-8 hidden sm:block text-slate-400 text-xs">{nonStriker.fours || 0}/{nonStriker.sixes || 0}</span>
                            <span className="w-10 text-slate-400 font-mono text-xs">{nonStriker.strikeRate ? Number(nonStriker.strikeRate).toFixed(1) : '0.0'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <div className="flex gap-4">
                        <span>Partnership: <span className="text-slate-900">{formatPartnership()}</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Bowling Side */}
                  <div className="p-4 md:p-5 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-black">BOWL</div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bowling</h4>
                      </div>
                      <div className="flex gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">
                        <span className="w-8">O</span>
                        <span className="w-8">R-W</span>
                        <span className="w-10">ECO</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {currentBowler ? (
                        <div className="flex justify-between items-center group">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm">
                              {currentBowler.photoUrl ? <img src={currentBowler.photoUrl} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{currentBowler.name?.charAt(0)}</span>}
                            </div>
                            <span className="text-sm font-black text-slate-900 truncate" title={currentBowler.name}>{isMobile ? getFirstName(currentBowler.name) : currentBowler.name}</span>
                          </div>
                          <div className="flex gap-4 text-sm font-bold text-slate-700 text-right shrink-0">
                            <span className="w-8 text-slate-500 font-mono">{currentBowler.overs || '0.0'}</span>
                            <span className="w-8 text-slate-900">{currentBowler.runsConceded || 0}-{currentBowler.wickets || 0}</span>
                            <span className="w-10 text-orange-600 font-mono text-xs">{currentBowler.economy ? Number(currentBowler.economy).toFixed(1) : '0.0'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 text-xs text-slate-400 italic font-medium">No bowler currently bowling</div>
                      )}
                      {lastWicket && (
                        <div className="pt-2 flex items-center gap-2">
                          <div className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded tracking-widest">Last Wicket</div>
                          <span className="text-[10px] font-bold text-slate-500 truncate">{formatLastWicket()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Commentary Section - Refined Feed Style */}
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
              <div className="bg-white px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Commentary</h3>
                </div>
                <div className="flex items-center gap-4">
                  {!isFinishedMatch && (
                    <span className="flex items-center text-[10px] text-rose-600 font-black tracking-widest uppercase">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-1.5 animate-pulse"></span>
                      Real-time
                    </span>
                  )}
                </div>
              </div>

              {/* Filters Scroll Area */}
              <div className="px-5 py-3 border-b border-slate-50 overflow-x-auto scrollbar-hide flex items-center gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => onCommentaryFilterChange && onCommentaryFilterChange(filter.id)}
                    className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full whitespace-nowrap transition-all duration-300 ${activeCommentaryFilter === filter.id
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Commentary Feed */}
              <div className="max-h-[500px] overflow-y-auto bg-slate-50/30">
                {filteredCommentary.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredCommentary.slice().reverse().map((item, idx) => {
                      const isWicket = String(item.text || '').toLowerCase().includes('out') || item.isWicket;
                      const isBoundary = item.runs === 4 || item.runs === 6;

                      return (
                        <div
                          key={idx}
                          className={`px-6 py-5 transition-colors border-l-4 ${isWicket ? 'border-l-rose-500 bg-rose-50/20' : isBoundary ? 'border-l-blue-500 bg-blue-50/10' : 'border-l-transparent hover:bg-white'}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center gap-1 min-w-[45px]">
                              <span className="text-xs font-black text-slate-400 leading-none">{item.over || '—'}</span>
                              {item.runs !== undefined && (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm ${item.runs === 4 ? 'bg-blue-600 text-white' : item.runs === 6 ? 'bg-emerald-600 text-white' : item.isWicket ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 border border-slate-100'}`}>
                                  {item.isWicket ? 'W' : item.runs}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm ${isWicket ? 'font-bold text-rose-900' : 'text-slate-800'} leading-relaxed`}>
                                {item.text || item.commentary || '...'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-slate-300 py-20">
                    <div className="text-6xl mb-4 opacity-10">📜</div>
                    <p className="text-xs font-bold uppercase tracking-widest">No commentary matches this filter</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Matrix / Prob */}
          <div className="lg:col-span-1 space-y-4">
            <div className="sticky top-4">
              {/* ICC Rule: Matrix only for Live/FirstInnings, Win Prob for Live/SecondInnings */}
              {(!isFinishedMatch && matchPhase === 'SecondInnings' && target) ? (
                <div className="bg-white rounded-2xl shadow-lg shadow-slate-100 border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Analysis</h4>
                  </div>
                  <WinProbability
                    currentRuns={currentRuns || 0}
                    wickets={currentWickets || 0}
                    balls={Math.floor(parseFloat(currentOvers || '0.0') * 6)}
                    target={target}
                    oversLimit={oversLimit || 20}
                    teamAName={teamAName || 'Team A'}
                    teamBName={teamBName || 'Team B'}
                  />
                </div>
              ) : !isFinishedMatch ? (
                <div className="bg-white rounded-2xl shadow-lg shadow-slate-100 border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Projection Matrix</h4>
                  </div>
                  <ProjectedScoreTable
                    currentRuns={currentRuns || 0}
                    currentOvers={currentOvers || '0.0'}
                    currentRunRate={currentRunRate || 0}
                    oversLimit={oversLimit || 20}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl grayscale opacity-50">🏆</div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Match History</h4>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">This match has concluded. Full match highlights and stats are available in the Scorecard tab.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrexLiveSection
