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
      className="hide-in-screenshot bg-[#0f172a] backdrop-blur-md border-b border-white/5 sticky z-40 shadow-lg"
      style={{ top: stickyTop }}
    >
      <div className="max-w-7xl mx-auto px-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => (tab.disabled ? null : onTabChange(tab.id))}
              disabled={!!tab.disabled}
              className={`px-5 py-2 text-[11px] sm:text-xs font-black uppercase tracking-[0.12em] whitespace-nowrap transition-all relative group h-12 flex items-center justify-center ${activeTab === tab.id
                ? 'text-white'
                : tab.disabled
                  ? 'text-slate-700 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span className="relative z-10 transition-transform group-active:scale-95">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-full shadow-[0_-4px_12px_rgba(37,99,235,0.4)] animate-in slide-in-from-bottom-2 duration-300"></div>
              )}
              {/* Subtle active background */}
              {activeTab === tab.id && (
                <div className="absolute inset-0 bg-blue-600/10 rounded-xl mx-0.5 my-1.5 border border-white/5"></div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
