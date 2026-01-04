/**
 * Innings Tab Bar Component
 * Horizontal scrollable pill buttons for switching between innings
 */

interface InningsTab {
  id: string
  label: string
  inningId: 'teamA' | 'teamB'
  inningNumber: 1 | 2
}

interface InningsTabBarProps {
  tabs: InningsTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

const InningsTabBar = ({ tabs, activeTab, onTabChange }: InningsTabBarProps) => {
  if (tabs.length === 0) return null

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-2 min-w-max pb-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
                ${isActive
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default InningsTabBar

