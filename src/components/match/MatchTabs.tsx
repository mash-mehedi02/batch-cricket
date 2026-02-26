import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeTabRef.current && containerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  }, [activeTab])

  return (
    <div
      className="hide-in-screenshot bg-[#0f172a] backdrop-blur-md border-b border-white/5 sticky z-40 shadow-lg"
      style={{ top: stickyTop }}
    >
      <div className="max-w-7xl mx-auto px-2">
        <div
          ref={containerRef}
          className="flex gap-1 overflow-x-auto scrollbar-hide py-1 snap-x"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={activeTab === tab.id ? activeTabRef : null}
              onClick={() => (tab.disabled ? null : onTabChange(tab.id))}
              disabled={!!tab.disabled}
              className={`px-5 py-2 text-[12px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all relative h-12 flex items-center justify-center snap-start ${activeTab === tab.id
                ? 'text-white'
                : tab.disabled
                  ? 'text-slate-700 cursor-not-allowed'
                  : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <span className="relative z-10">{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#FF4D4D] z-20"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
