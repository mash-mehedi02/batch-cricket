/**
 * Projected Score Table Component (as per RR)
 * Screenshot-style layout:
 * - Row 1: "Run Rate" + 4 RR columns (current RR* + round figures)
 * - Row 2: "{oversLimit} Overs" + projected totals for those RR columns
 * - Starts after the first ball (not after full over)
 */

const ProjectedScoreTable = ({ currentRuns = 0, currentOvers = 0, currentRunRate = 0, oversLimit = 50 }) => {
  // Convert currentOvers to number if it's a string (e.g., "13.4" -> 13.67)
  const parseOvers = (overs) => {
    if (typeof overs === 'number') return overs
    if (typeof overs === 'string') {
      const parts = overs.split('.')
      const wholeOvers = parseInt(parts[0]) || 0
      const balls = parseInt(parts[1]) || 0
      return wholeOvers + (balls / 6)
    }
    return 0
  }

  const currentOversDecimal = parseOvers(currentOvers)
  // Use engine CRR if present; fallback to computed CRR from runs/overs (so it works from 1 ball).
  const rrFromProp = Number.parseFloat(currentRunRate) || 0
  const rrFromRuns = currentOversDecimal > 0 ? (Number(currentRuns || 0) / currentOversDecimal) : 0
  const runRate = rrFromProp > 0 ? rrFromProp : rrFromRuns
  
  // Debug logging (safe in Vite/browser environments where `process` may be undefined)
  try {
    if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
      console.log('[ProjectedScoreTable] Props:', {
        currentRuns,
        currentOvers,
        currentOversDecimal,
        currentRunRate,
        runRate,
        oversLimit,
      })
    }
  } catch {
    // ignore
  }

  const limitOvers = Number(oversLimit || 0)
  const remainingOvers = Math.max(0, limitOvers - currentOversDecimal)
  const canProject = currentOversDecimal > 0 && Number.isFinite(runRate) && runRate > 0 && Number.isFinite(limitOvers) && limitOvers > 0 && remainingOvers > 0

  // Projected score rule (as you described):
  // Projected = currentRuns + (RR * remainingOvers)
  const projectTotalAtRR = (rr) => {
    if (!Number.isFinite(rr) || rr <= 0) return Math.round(Number(currentRuns || 0))
    return Math.round(Number(currentRuns || 0) + (rr * remainingOvers))
  }

  const formatRRUser = (rr, isPrimary = false) => {
    if (!Number.isFinite(rr)) return '—'
    // User examples:
    // - integer CRR: 6,7,8,10
    // - decimal CRR: 6.2, 8,9,11 / 9.8, 11,12,14
    // So: show CRR with 1 decimal if needed; scenario RRs as integers.
    const n = Number(rr)
    const isInt = Number.isInteger(n)
    if (isPrimary) return isInt ? `${n}` : `${Number(n.toFixed(1))}`
    return `${Math.round(n)}`
  }

  // RR columns (CRR-based, as you specified):
  // - If CRR=6     => 6*, 7, 8, 10
  // - If CRR=6.2   => 6.2*, 8, 9, 11   (ceil=7 => +1=8, +2=9, +4=11)
  // - If CRR=9.8   => 9.8*, 11, 12, 14 (ceil=10 => +1=11, +2=12, +4=14)
  const buildRRColumns = () => {
    const ceilRR = Math.ceil(runRate)
    const rr1 = runRate
    const rr2 = ceilRR + 1
    const rr3 = ceilRR + 2
    const rr4 = ceilRR + 4

    return [
      { key: 'cur', rr: rr1, label: `${formatRRUser(rr1, true)}*`, isPrimary: true },
      { key: 'rr2', rr: rr2, label: formatRRUser(rr2, false), isPrimary: false },
      { key: 'rr3', rr: rr3, label: formatRRUser(rr3, false), isPrimary: false },
      { key: 'rr4', rr: rr4, label: formatRRUser(rr4, false), isPrimary: false },
    ]
  }

  const rrColumns = buildRRColumns()

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <div className="text-sm font-semibold text-gray-900">Projected Score</div>
        <div className="text-xs text-gray-500">as per RR.</div>
      </div>

      {!canProject ? (
        <div className="py-4 text-center text-gray-500 text-sm">
          Projections will appear after the first ball.
        </div>
      ) : (
        <div>
          {/* Row 1: Run Rate */}
          <div
            className="grid bg-gray-50 border border-gray-200 rounded-lg overflow-hidden"
            style={{ gridTemplateColumns: `140px repeat(${rrColumns.length}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-3 text-sm font-semibold text-gray-600">Run Rate</div>
            {rrColumns.map((c) => (
              <div
                key={c.key}
                className={`px-3 py-3 text-center text-sm font-semibold tabular-nums ${c.isPrimary ? 'text-gray-900' : 'text-gray-600'}`}
              >
                {c.label}
              </div>
            ))}
          </div>

          {/* Row 2: OversLimit */}
          <div
            className="grid border-x border-b border-gray-200 rounded-b-lg"
            style={{ gridTemplateColumns: `140px repeat(${rrColumns.length}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-4 text-sm font-semibold text-gray-700">{Number(oversLimit || 0)} Overs</div>
            {rrColumns.map((c) => (
              <div key={c.key} className="px-3 py-4 text-center text-sm font-bold text-gray-900 tabular-nums">
                {projectTotalAtRR(c.rr)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {runRate > 0 ? (
            <>* Based on current run rate of <span className="font-semibold">{runRate.toFixed(2)}</span> (Current: {currentRuns} runs in {currentOversDecimal.toFixed(1)} overs)</>
          ) : (
            <>Current: {currentRuns} runs in {currentOversDecimal > 0 ? currentOversDecimal.toFixed(1) : '0.0'} overs</>
          )}
        </p>
      </div>
    </div>
  )
}

export default ProjectedScoreTable
