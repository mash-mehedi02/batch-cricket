import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({
    title,
    subtitle,
    backLink,
    rightContent
}: {
    title?: React.ReactNode
    subtitle?: string
    backLink?: string
    rightContent?: React.ReactNode
}) {
    const navigate = useNavigate()

    return (
        <>
            {/* Header Content - Premium Indigo/Dark Theme */}
            <div className="hide-in-screenshot relative z-[100] pt-[var(--status-bar-height)] pb-2.5 flex items-center justify-between px-4 bg-[#050B18] border-b border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300">

                {/* Background Accent */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none"></div>

                {/* Left: Back Button + Title Group */}
                <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
                    <button
                        onClick={() => backLink ? navigate(backLink) : navigate(-1)}
                        className="hide-in-screenshot group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 active:scale-95 bg-white/5 border border-white/5 text-white hover:bg-white/10 hover:border-white/10 shadow-lg backdrop-blur-sm shrink-0"
                    >
                        <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-0.5" />
                    </button>

                    {/* Title (Always Visible) */}
                    <div className="flex flex-col justify-center min-w-0">
                        {title && (
                            <h1 className="text-white font-black text-sm uppercase tracking-widest leading-none truncate pr-2">
                                {title}
                            </h1>
                        )}
                        {subtitle && (
                            <div className="flex items-center gap-2 mt-1.5 translate-y-[-1px]">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse"></div>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.25em] truncate leading-none">
                                    {subtitle}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content */}
                <div className="hide-in-screenshot pointer-events-auto flex items-center gap-1.5 relative z-10">
                    {rightContent}
                </div>
            </div>
        </>
    )
}
