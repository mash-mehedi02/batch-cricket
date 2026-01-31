import React, { useEffect, useRef, useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { format, getDaysInMonth, setMonth, setYear, isValid, parseISO } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface WheelDatePickerProps {
    value: string // ISO Format YYYY-MM-DD
    onChange: (value: string) => void
    minYear?: number
    maxYear?: number
}

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export default function WheelDatePicker({
    value,
    onChange,
    minYear = 1970,
    maxYear = new Date().getFullYear()
}: WheelDatePickerProps) {
    // Parse initial date
    const initialDate = useMemo(() => {
        const d = parseISO(value)
        return isValid(d) ? d : new Date()
    }, [value])

    const [selectedDay, setSelectedDay] = useState(initialDate.getDate())
    const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth())
    const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear())

    // Years array (reversed to show latest first or as requested)
    const years = useMemo(() => {
        const arr = []
        for (let i = maxYear; i >= minYear; i--) arr.push(i)
        return arr
    }, [minYear, maxYear])

    // Days in selected month/year
    const daysInMonth = useMemo(() => {
        return getDaysInMonth(new Date(selectedYear, selectedMonth))
    }, [selectedMonth, selectedYear])

    const days = useMemo(() => {
        const arr = []
        for (let i = 1; i <= daysInMonth; i++) arr.push(i)
        return arr
    }, [daysInMonth])

    // Update effect
    useEffect(() => {
        const date = new Date(selectedYear, selectedMonth, Math.min(selectedDay, daysInMonth))
        const formatted = format(date, 'yyyy-MM-dd')
        if (formatted !== value) {
            onChange(formatted)
        }
    }, [selectedDay, selectedMonth, selectedYear, daysInMonth, onChange, value])

    return (
        <div className="flex bg-white rounded-3xl border border-slate-100 p-2 shadow-sm overflow-hidden h-[240px] items-center justify-center">
            <div className="flex w-full items-center justify-center relative">
                {/* Selection Center Overlay */}
                <div className="absolute left-0 right-0 h-12 bg-slate-50 border-y border-slate-100 pointer-events-none z-0"></div>

                <Wheel
                    items={MONTHS}
                    value={MONTHS[selectedMonth]}
                    onChange={(val) => setSelectedMonth(MONTHS.indexOf(val))}
                    width="w-24"
                />
                <Wheel
                    items={days}
                    value={selectedDay}
                    onChange={setSelectedDay}
                    width="w-16"
                />
                <Wheel
                    items={years}
                    value={selectedYear}
                    onChange={setSelectedYear}
                    width="w-24"
                />
            </div>
        </div>
    )
}

interface WheelProps {
    items: (string | number)[]
    value: string | number
    onChange: (val: any) => void
    width: string
}

function Wheel({ items, value, onChange, width }: WheelProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll to selected item on mount or value change from outside
    useEffect(() => {
        const index = items.indexOf(value)
        if (index !== -1 && scrollRef.current) {
            const itemHeight = 48 // h-12
            scrollRef.current.scrollTop = index * itemHeight
        }
    }, [value, items])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget
        const itemHeight = 48
        const index = Math.round(container.scrollTop / itemHeight)

        if (items[index] !== undefined && items[index] !== value) {
            onChange(items[index])
        }
    }

    return (
        <div className={clsx("relative h-[240px] overflow-hidden", width)} style={{ maskImage: 'linear-gradient(to bottom, transparent, black 40%, black 60%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%, black 60%, transparent)' }}>
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto scrollbar-none snap-y snap-mandatory py-[96px]" // 240/2 - 48/2 = 96
                style={{ scrollBehavior: 'smooth' }}
            >
                {items.map((item, idx) => {
                    const isActive = item === value
                    return (
                        <div
                            key={idx}
                            className={clsx(
                                "h-12 flex items-center justify-center snap-center transition-all duration-300",
                                isActive ? "text-slate-900 font-bold text-lg scale-110" : "text-slate-300 text-sm"
                            )}
                        >
                            {item}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
