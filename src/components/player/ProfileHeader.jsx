/**
 * Player Profile Header Component
 * Cricbuzz-style header with avatar, name, role, age, squad
 */
const ProfileHeader = ({ player, squad }) => {
  const getRoleDisplay = (role) => {
    const roleMap = {
      'Batsman': 'Right handed Batter',
      'Bowler': 'Right arm Bowler',
      'All-rounder': 'All-rounder',
      'Wicketkeeper': 'Wicket-keeper Batter',
    }
    return roleMap[role] || role
  }

  const getAge = () => {
    if (player.batch && player.year) {
      const currentYear = new Date().getFullYear()
      const batchYear = parseInt(player.batch)
      const age = currentYear - batchYear + 18 // Approximate age calculation
      return age
    }
    return null
  }

  const age = getAge()
  const roleDisplay = getRoleDisplay(player.role || 'Player')
  const squadName = squad?.teamName || squad?.name || player.squadName || 'No Squad'

  return (
    <div className="bg-gradient-to-br from-green-600 via-green-500 to-emerald-600 text-white rounded-b-3xl shadow-xl overflow-hidden">
      <div className="px-6 py-8 md:px-8 md:py-10">
        <div className="flex items-start justify-between">
          {/* Left: Player Info */}
          <div className="flex-1">
            <div className="mb-2">
              <div className="text-sm font-medium text-green-100 mb-1">
                {player.name?.split(' ')[0] || 'Player'}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {player.name?.split(' ').slice(1).join(' ') || player.name || 'Unknown Player'}
              </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
              <div className="flex items-center gap-2">
                <span className="font-medium">{roleDisplay}</span>
                {age && (
                  <>
                    <span className="text-green-200">•</span>
                    <span>Age {age}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-medium text-green-100">{squadName}</span>
            </div>
          </div>

          {/* Right: Avatar */}
          <div className="ml-4">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/30 overflow-hidden shadow-lg">
              {player.photo ? (
                <img
                  src={player.photo}
                  alt={player.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
              ) : null}
              <div className="w-full h-full flex items-center justify-center text-4xl md:text-5xl font-bold text-white/80" style={{ display: player.photo ? 'none' : 'flex' }}>
                {player.name?.charAt(0)?.toUpperCase() || 'P'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileHeader

