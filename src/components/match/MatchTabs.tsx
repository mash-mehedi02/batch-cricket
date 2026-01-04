/**
 * Match Tabs Component
 * Tab navigation for Live, Commentary, Scorecard, etc.
 */

interface Tab {
  id: string
  label: string
  disabled?: boolean
}

interface MatchTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function MatchTabs({ tabs, activeTab, onTabChange }: MatchTabsProps) {
  return (
    <div className="bg-white border-b-2 border-gray-200 sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => (tab.disabled ? null : onTabChange(tab.id))}
              disabled={!!tab.disabled}
              className={`px-8 py-4 text-sm font-bold whitespace-nowrap transition-all relative ${activeTab === tab.id
                  ? 'text-red-500 border-b-[3px] border-red-500'
                  : tab.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
