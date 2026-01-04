/**
 * Extras Section Component
 * Displays extras breakdown (byes, leg byes, wides, no-balls, penalty)
 */

interface Extras {
  byes?: number
  legByes?: number
  wides?: number
  noBalls?: number
  penalty?: number
}

interface ExtrasSectionProps {
  extras: Extras
}

const ExtrasSection = ({ extras }: ExtrasSectionProps) => {
  const byes = extras.byes || 0
  const legByes = extras.legByes || 0
  const wides = extras.wides || 0
  const noBalls = extras.noBalls || 0
  const penalty = extras.penalty || 0

  const total = byes + legByes + wides + noBalls + penalty

  // CREX Style: Always show all parts "8 (b 0, lb 1, w 7, nb 0, p 0)"
  const parts = [
    `b ${byes}`,
    `lb ${legByes}`,
    `w ${wides}`,
    `nb ${noBalls}`,
    `p ${penalty}`
  ]
  
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700 py-2">
      <span className="font-semibold">Extras</span>
      <span className="font-medium">
        {total} ({parts.join(', ')})
      </span>
    </div>
  )
}

export default ExtrasSection

