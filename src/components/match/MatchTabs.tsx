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
    <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-16 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => (tab.disabled ? null : onTabChange(tab.id))}
              disabled={!!tab.disabled}
              className={`px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all relative group h-10 ${activeTab === tab.id
                ? 'text-red-600'
                : tab.disabled
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-500 hover:text-red-500'
                }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-t-full shadow-[0_-1px_4px_rgba(220,38,38,0.4)] animate-in slide-in-from-bottom-1 duration-300"></div>
              )}
              {/* Subtle hover indicator */}
              <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/[0.03] transition-colors rounded-lg mx-1 my-1.5"></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
