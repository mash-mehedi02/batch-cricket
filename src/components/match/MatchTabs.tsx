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
  stickyTop?: string
}

export default function MatchTabs({ tabs, activeTab, onTabChange, stickyTop = '64px' }: MatchTabsProps) {
  return (
    <div
      className="bg-[#0f172a] backdrop-blur-md border-b border-white/5 sticky z-40 shadow-lg"
      style={{ top: stickyTop }}
    >
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => (tab.disabled ? null : onTabChange(tab.id))}
              disabled={!!tab.disabled}
              className={`px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all relative group h-12 flex items-center justify-center ${activeTab === tab.id
                ? 'text-rose-500'
                : tab.disabled
                  ? 'text-slate-700 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-t-full shadow-[0_-2px_8px_rgba(244,63,94,0.4)] animate-in slide-in-from-bottom-1 duration-300"></div>
              )}
              {/* Subtle hover indicator */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.03] transition-colors rounded-lg mx-1 my-2"></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
