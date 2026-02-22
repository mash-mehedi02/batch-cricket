import React, { useState, useEffect } from 'react';
import { voteService } from '@/services/firestore/voteService';

const MatchVoting = ({ matchId, teamAName, teamBName, teamABatch, teamBBatch }) => {
    const [votes, setVotes] = useState({ teamAVotes: 0, teamBVotes: 0, totalVotes: 0 });
    const [userVote, setUserVote] = useState(null);
    const [isCasting, setIsCasting] = useState(false);

    useEffect(() => {
        if (!matchId) return;

        // Load user's vote from localStorage
        const savedVote = voteService.getUserVote(matchId);
        setUserVote(savedVote);

        // Subscribe to live vote updates
        const unsubscribe = voteService.subscribeToVotes(matchId, (data) => {
            setVotes(data);
        });

        return () => unsubscribe();
    }, [matchId]);

    const handleVote = async (team) => {
        if (userVote || isCasting) return;

        setIsCasting(true);
        const success = await voteService.castVote(matchId, team);
        if (success) {
            setUserVote(team);
        }
        setIsCasting(false);
    };

    const aPercent = votes.totalVotes > 0
        ? Math.round((votes.teamAVotes / votes.totalVotes) * 100)
        : 50;
    const bPercent = 100 - aPercent;

    const getTeamLabel = (name, batch) => {
        const shortName = name?.split(' ')[0]?.substring(0, 3)?.toUpperCase() || 'TM';
        if (batch) {
            const shortBatch = String(batch).length > 2 ? String(batch).slice(-2) : batch;
            return `${shortName} - ${shortBatch}`;
        }
        return name?.split(' ')[0]?.substring(0, 4)?.toUpperCase() || 'TEAM';
    };

    return (
        <div className="p-4 bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight">Who will win?</h3>
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Total Votes: {votes.totalVotes.toLocaleString()}
                </div>
            </div>

            <div className="flex gap-3 h-12">
                {/* Team A Button */}
                <button
                    onClick={() => handleVote('teamA')}
                    disabled={!!userVote || isCasting}
                    className={`relative flex-1 rounded-xl border transition-all duration-300 overflow-hidden ${userVote === 'teamA'
                        ? 'border-blue-500 bg-blue-500/5'
                        : userVote
                            ? 'border-slate-100 dark:border-white/5 bg-transparent'
                            : 'border-slate-200 dark:border-white/10 hover:border-blue-400 active:scale-95'
                        }`}
                >
                    {userVote && (
                        <div
                            className="absolute bottom-0 left-0 h-1 bg-blue-500/30 transition-all duration-1000"
                            style={{ width: `${aPercent}%` }}
                        />
                    )}
                    <div className="relative z-10 flex items-center justify-center h-full px-2">
                        <span className={`text-sm font-black uppercase tracking-widest ${userVote === 'teamA' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                            {getTeamLabel(teamAName, teamABatch)} {userVote && `: ${aPercent}%`}
                        </span>
                    </div>
                </button>

                {/* Team B Button */}
                <button
                    onClick={() => handleVote('teamB')}
                    disabled={!!userVote || isCasting}
                    className={`relative flex-1 rounded-xl border transition-all duration-300 overflow-hidden ${userVote === 'teamB'
                        ? 'border-blue-500 bg-blue-500/5'
                        : userVote
                            ? 'border-slate-100 dark:border-white/5 bg-transparent'
                            : 'border-slate-200 dark:border-white/10 hover:border-blue-400 active:scale-95'
                        }`}
                >
                    {userVote && (
                        <div
                            className="absolute bottom-0 left-0 h-1 bg-blue-500/30 transition-all duration-1000"
                            style={{ width: `${bPercent}%` }}
                        />
                    )}
                    <div className="relative z-10 flex items-center justify-center h-full px-2">
                        <span className={`text-sm font-black uppercase tracking-widest ${userVote === 'teamB' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
                            }`}>
                            {getTeamLabel(teamBName, teamBBatch)} {userVote && `: ${bPercent}%`}
                        </span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default MatchVoting;
