import { motion } from 'framer-motion';

interface SkeletonProps {
    className?: string;
    variant?: 'rectangle' | 'circle' | 'text' | 'rounded';
}

export default function Skeleton({ className = '', variant = 'rectangle' }: SkeletonProps) {
    const getVariantClass = () => {
        switch (variant) {
            case 'circle': return 'rounded-full';
            case 'text': return 'rounded h-3 w-full';
            case 'rounded': return 'rounded-2xl';
            default: return 'rounded-lg';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "linear"
            }}
            className={`bg-slate-200 dark:bg-slate-800/50 overflow-hidden relative shadow-inner ${getVariantClass()} ${className}`}
        >
            <motion.div
                animate={{
                    x: ['-100%', '100%']
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent skew-x-12"
            />
        </motion.div>
    );
}
