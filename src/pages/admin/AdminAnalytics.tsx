import { useState, useEffect, useMemo } from 'react'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { useAuthStore } from '@/store/authStore'
import { Match, Player } from '@/types'
import {
  BarChart3,
  TrendingUp,
  Activity,
  Trophy,
  Users,
  Calendar,
  Target,
  PieChart
} from 'lucide-react'

// --- SVG CHART COMPONENTS ---

const SimpleBarChart = ({ data, color = '#10b981' }: { data: number[], color?: string }) => {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end justify-between gap-2 h-full w-full">
      {data.map((value, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 group h-full justify-end">
          <div className="relative w-full bg-slate-100 rounded-t-md overflow-hidden h-full flex items-end">
            <div
              className="w-full transition-all duration-500 rounded-t-md group-hover:opacity-80"
              style={{ height: `${(value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-400">{value}</span>
        </div>
      ))}
    </div>
  );
};

const SimpleLineChart = ({ data, color = '#8b5cf6' }: { data: number[], color?: string }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = 5 + (i / (data.length - 1)) * 90;
    const y = 95 - ((val - min) / range) * 90;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full h-full relative">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          vectorEffect="non-scaling-stroke"
          className="drop-shadow-sm"
        />
        {data.map((val, i) => {
          const x = 5 + (i / (data.length - 1)) * 90;
          const y = 95 - ((val - min) / range) * 90;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="1.5"
              fill="#fff"
              stroke={color}
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className="hover:r-2 transition-all cursor-pointer"
            >
              <title>{val}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

const SimpleDonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  if (total === 0) return (
    <div className="w-full h-full rounded-full border-4 border-slate-100 flex items-center justify-center text-xs text-slate-300 font-bold">
      NO DATA
    </div>
  );

  let cumulativePercent = 0;

  return (
    <div className="relative w-32 h-32 md:w-48 md:h-48 mx-auto">
      <svg viewBox="0 0 32 32" className="w-full h-full -rotate-90">
        {data.map((slice, i) => {
          if (slice.value === 0) return null;
          const percent = slice.value / total;
          const offset = cumulativePercent * 100;
          cumulativePercent += percent;

          // Circle circumference approx 100 for r=15.9155
          return (
            <circle
              key={i}
              r="15.9155"
              cx="16"
              cy="16"
              fill="transparent"
              stroke={slice.color}
              strokeWidth="8" // Make it a donut
              strokeDasharray={`${percent * 100} 100`}
              strokeDashoffset={-offset} // Offset is counter-clockwise usually, check
              className="transition-all duration-500 hover:opacity-80 cursor-pointer"
            >
              <title>{slice.label}: {slice.value}</title>
            </circle>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-black text-slate-800">{total}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase">Matches</span>
      </div>
    </div>
  );
};

export default function AdminAnalytics() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      try {
        setLoading(true)
        const isSuperAdmin = user.role === 'super_admin'
        // Fetch ALL matches to populate dashboard properly
        // getByAdmin usually filters by adminId, but for analytics we want to see broader context if possible
        // But respecting the service logic:
        const [m, p] = await Promise.all([
          matchService.getByAdmin(user.uid, isSuperAdmin),
          playerService.getByAdmin(user.uid, isSuperAdmin)
        ])
        setMatches(m)
        setPlayers(p)
      } catch (error) {
        console.error("Failed to load analytics data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  // --- KPI CALCULATIONS ---
  const kpis = useMemo(() => {
    const finished = matches.filter(m => m.status === 'finished' || (m.status as string) === 'completed');
    // Calculate total runs from completed matches score
    const totalRuns = finished.reduce((acc, m) =>
      acc + (m.score?.teamA?.runs || 0) + (m.score?.teamB?.runs || 0), 0);
    // Calculate total wickets
    const totalWickets = finished.reduce((acc, m) =>
      acc + (m.score?.teamA?.wickets || 0) + (m.score?.teamB?.wickets || 0), 0);

    return {
      totalMatches: matches.length,
      totalPlayers: players.length,
      totalRuns,
      totalWickets,
      finishedCount: finished.length,
      liveCount: matches.filter(m => m.status?.toLowerCase() === 'live').length,
      upcomingCount: matches.filter(m => m.status === 'upcoming').length,
    }
  }, [matches, players]);

  // --- CHART DATA ---
  const last5Matches = [...matches]
    .filter(m => m.status === 'finished' || (m.status as string) === 'completed')
    .sort((a, b) => {
      // Sort by date ascending for chart (oldest -> newest)
      const da = new Date((a.date as any)?.toDate ? (a.date as any).toDate() : a.date).getTime();
      const db = new Date((b.date as any)?.toDate ? (b.date as any).toDate() : b.date).getTime();
      return da - db;
    })
    .slice(-5); // Take last 5

  const runTrendData = useMemo(() => {
    if (!last5Matches.length) return [0, 0, 0, 0, 0];
    return last5Matches.map(m => (m.score?.teamA?.runs || 0) + (m.score?.teamB?.runs || 0));
  }, [last5Matches]);

  const wicketTrendData = useMemo(() => {
    if (!last5Matches.length) return [0, 0, 0];
    return last5Matches.map(m => (m.score?.teamA?.wickets || 0) + (m.score?.teamB?.wickets || 0));
  }, [last5Matches]);

  const statusDistribution = [
    { label: 'Finished', value: kpis.finishedCount, color: '#10b981' }, // teal-500
    { label: 'Live', value: kpis.liveCount, color: '#ef4444' }, // red-500
    { label: 'Upcoming', value: kpis.upcomingCount, color: '#3b82f6' }, // blue-500
  ];

  // --- TOP PERFORMERS ---
  const topBatsmen = useMemo(() => [...players]
    .sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))
    .slice(0, 5), [players]);

  const topBowlers = useMemo(() => [...players]
    .sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0))
    .slice(0, 5), [players]);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
        <p className="text-slate-500 font-medium">Real-time performance metrics and insights</p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Matches', value: kpis.totalMatches, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Players', value: kpis.totalPlayers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Runs', value: kpis.totalRuns.toLocaleString(), icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Wickets', value: kpis.totalWickets, icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className={`p-3 w-fit rounded-xl mb-4 ${kpi.bg}`}>
              <kpi.icon size={20} className={kpi.color} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800">{kpi.value}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* TOP ROW CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* MATCH STATUS (DONUT) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
            <PieChart size={18} className="text-slate-400" /> Match Status
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            <SimpleDonutChart data={statusDistribution} />
            <div className="flex flex-wrap gap-4 justify-center mt-6">
              {statusDistribution.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                  <span className="text-xs font-bold text-slate-600">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RUN TRENDS (BAR) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col h-96 lg:h-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <BarChart3 size={18} className="text-slate-400" /> Run Trend (Last 5 Finished Matches)
            </h3>
          </div>
          <div className="flex-1 w-full flex flex-col">
            <div className="flex-1 w-full">
              {runTrendData.some(r => r > 0) ? (
                <SimpleBarChart data={runTrendData} color="#3b82f6" />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-300 font-bold italic bg-slate-50/50 rounded-xl">No Finished Match Data</div>
              )}
            </div>
            {/* Date Labels */}
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
              {last5Matches.map(m => (
                <div key={m.id} className="text-[10px] font-bold text-slate-400 text-center w-full truncate px-1">
                  {new Date((m.date as any)?.toDate ? (m.date as any).toDate() : m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </div>
              ))}
              {last5Matches.length === 0 && <span className="text-xs text-slate-300 w-full text-center">-</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECOND ROW CHARTS & LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WICKET TRENDS (LINE) */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col h-80">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp size={18} className="text-slate-400" /> Wickets Fall Trend
            </h3>
          </div>
          <div className="flex-1 px-4">
            {wicketTrendData.some(w => w > 0) ? (
              <SimpleLineChart data={wicketTrendData} color="#f59e0b" />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 font-bold italic bg-slate-50/50 rounded-xl">No Wicket Data</div>
            )}
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-2">Wickets per match (last 5)</p>
        </div>

        {/* TOP SCORER HIGHLIGHT (MINI CARD) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-0 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col text-white">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h3 className="font-bold text-yellow-400 flex items-center gap-2">
              <Trophy size={18} className="text-yellow-400" /> Star Performer
            </h3>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center items-center text-center relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 p-8 opacity-10"><Trophy size={120} /></div>

            {topBatsmen[0] ? (
              <>
                <div className="z-10 w-20 h-20 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center text-3xl font-black text-white mb-4 shadow-xl border-4 border-white/20">
                  {topBatsmen[0].name.charAt(0)}
                </div>
                <h4 className="z-10 text-xl font-black text-white mb-1">{topBatsmen[0].name}</h4>
                <p className="z-10 text-sm font-medium text-slate-400 mb-6">{topBatsmen[0].battingStyle || 'Batsman'}</p>
                <div className="z-10 px-8 py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-black text-2xl shadow-lg">
                  {topBatsmen[0].stats?.runs || 0} <span className="text-sm font-bold text-slate-400">Runs</span>
                </div>
              </>
            ) : (
              <p className="text-slate-500 italic z-10">No Leading Scorer Yet</p>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED TABLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BATSMEN TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Top Batsmen Leaderboard</h3>
            <Activity size={16} className="text-emerald-500" />
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {topBatsmen.map((p, i) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${i < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.batch || p.squadId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-slate-800 block text-base">{p.stats?.runs || 0}</span>
                  <span className="text-[10px] text-slate-400">runs</span>
                </div>
              </div>
            ))}
            {topBatsmen.length === 0 && <div className="p-8 text-center text-slate-400 italic">No players data available</div>}
          </div>
        </div>

        {/* BOWLERS TABLE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Top Bowlers Leaderboard</h3>
            <Target size={16} className="text-red-500" />
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {topBowlers.map((p, i) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black ${i < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 group-hover:text-red-600 transition-colors">{p.name}</span>
                    <span className="text-[10px] text-slate-400">{p.batch || p.squadId}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-slate-800 block text-base">{p.stats?.wickets || 0}</span>
                  <span className="text-[10px] text-slate-400">wickets</span>
                </div>
              </div>
            ))}
            {topBowlers.length === 0 && <div className="p-8 text-center text-slate-400 italic">No players data available</div>}
          </div>
        </div>
      </div>

    </div>
  )
}
