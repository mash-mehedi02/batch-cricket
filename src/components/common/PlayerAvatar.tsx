import React from 'react';

interface PlayerAvatarProps {
    photoUrl?: string;
    name?: string;
    className?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ photoUrl, name, className = '', size = 'md' }) => {
    const sizeClasses = {
        xs: 'w-6 h-6',
        sm: 'w-8 h-8',
        md: 'w-10 h-10',
        lg: 'w-11 h-11 sm:w-12 sm:h-12',
        xl: 'w-16 h-16',
    };

    const currentSizeClass = sizeClasses[size] || sizeClasses.md;

    if (photoUrl) {
        return (
            <div className={`${currentSizeClass} rounded-full overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100 ${className}`}>
                <img
                    src={photoUrl}
                    alt={name || 'Player'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        // If image fails, revert to profile icon
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                            target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                            target.parentElement.innerHTML = `
                <svg class="w-2/3 h-2/3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              `;
                        }
                    }}
                />
            </div>
        );
    }

    return (
        <div className={`${currentSizeClass} rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 ${className}`}>
            <svg
                className="w-2/3 h-2/3 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
            </svg>
        </div>
    );
};

export default PlayerAvatar;
