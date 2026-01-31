import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PageHeader({
    title,
    subtitle,
    backLink,
    rightContent
}: {
    title?: string
    subtitle?: string
    backLink?: string
    rightContent?: React.ReactNode
}) {
    const navigate = useNavigate()

    return (
        <>
            {/* Header Content - Dark background */}
            <div className="relative z-[100] h-[60px] flex items-center justify-between px-4 bg-[#0f172a]">

                {/* Left: Back Button + Title Group */}
                <div className="flex items-center gap-4 max-w-[80%]">
                    <button
                        onClick={() => backLink ? navigate(backLink) : navigate(-1)}
                        className="group relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 bg-slate-700/80 text-white hover:bg-slate-600"
                    >
                        <ArrowLeft size={20} className="transition-transform group-hover:-translate-x-0.5" />
                    </button>

                    {/* Title (Always Visible) */}
                    <div className="flex flex-col justify-center">
                        {title && (
                            <h1 className="text-white font-black text-[13px] uppercase tracking-wider leading-none truncate pr-2">
                                {title}
                            </h1>
                        )}
                        {subtitle && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] truncate leading-none">
                                    {subtitle}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content */}
                <div className="pointer-events-auto flex items-center gap-2">
                    {rightContent}
                </div>
            </div>
        </>
    )
}
