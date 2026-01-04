import { Link } from 'react-router-dom'

interface PlayerLinkProps {
    playerId: string
    playerName: string
    className?: string
}

export default function PlayerLink({ playerId, playerName, className = '' }: PlayerLinkProps) {
    if (!playerId) {
        return <span className={className}>{playerName}</span>
    }

    return (
        <Link
            to={`/players/${playerId}`}
            className={`hover:text-blue-600 hover:underline transition-colors cursor-pointer ${className}`}
            onClick={(e) => e.stopPropagation()}
        >
            {playerName}
        </Link>
    )
}
