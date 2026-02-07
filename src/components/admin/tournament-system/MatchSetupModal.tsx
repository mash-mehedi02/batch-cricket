import { useState, useEffect, useMemo } from 'react';
import { Match } from '@/types';
import { X, Trophy, Users, Mic, Save, Lock, Check, AlertTriangle } from 'lucide-react';
import { matchService } from '@/services/firestore/matches';
import { playerService } from '@/services/firestore/players';
import { squadService } from '@/services/firestore/squads';
import { addManualCommentary } from '@/services/commentary/commentaryService';
import { Timestamp } from 'firebase/firestore';
import { oneSignalService } from '@/services/oneSignalService';
import toast from 'react-hot-toast';

interface MatchSetupModalProps {
    match: Match;
    onClose: () => void;
    onUpdate?: () => void;
}

export default function MatchSetupModal({ match, onClose, onUpdate }: MatchSetupModalProps) {
    const [activeTab, setActiveTab] = useState<'toss' | 'xi' | 'commentary'>('toss');
    const [loading, setLoading] = useState(false);

    // Toss State - Use 'teamA' or 'teamB' for reliability
    const [tossData, setTossData] = useState(() => {
        let winner = match.tossWinner || '';
        // If saved as ID, resolve to key
        if (winner && winner.length > 10) {
            const teamAId = String((match as any).teamASquadId || match.teamAId || (match as any).teamA || '').trim();
            winner = (String(winner).trim() === teamAId) ? 'teamA' : 'teamB';
        }
        return {
            tossWinner: winner as 'teamA' | 'teamB' | '',
            tossDecision: (match as any).tossDecision || (match as any).electedTo || 'bat'
        };
    });

    // Playing XI State
    const [teamAPlayers, setTeamAPlayers] = useState<any[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<any[]>([]);
    const [teamAPlayingXI, setTeamAPlayingXI] = useState<string[]>((match as any).teamAPlayingXI || []);
    const [teamBPlayingXI, setTeamBPlayingXI] = useState<string[]>((match as any).teamBPlayingXI || []);


    const [captains, setCaptains] = useState({
        teamACaptainId: (match as any).teamACaptainId || '',
        teamAKeeperId: (match as any).teamAKeeperId || '',
        teamBCaptainId: (match as any).teamBCaptainId || '',
        teamBKeeperId: (match as any).teamBKeeperId || ''
    });

    // Commentary State
    const [commentaryText, setCommentaryText] = useState('');
    const [sendingComm, setSendingComm] = useState(false);

    // Lock functionality constraint: If Playing XI exists in DB, lock editing.
    // Using useMemo instead of useState so it recalculates when match prop changes
    const isXILocked = useMemo(() => {
        // Primary check: Database lock flag
        if ((match as any).isPlayingXILocked === true) {
            console.log('[MatchSetupModal] Lock State: LOCKED (via DB flag)');
            return true;
        }

        // Fallback check: If Playing XI data exists
        const hasA = Array.isArray((match as any).teamAPlayingXI) && (match as any).teamAPlayingXI.length > 0;
        const hasB = Array.isArray((match as any).teamBPlayingXI) && (match as any).teamBPlayingXI.length > 0;
        const locked = hasA || hasB;
        console.log('[MatchSetupModal] Lock State Check:', {
            teamAPlayingXI: (match as any).teamAPlayingXI,
            teamBPlayingXI: (match as any).teamBPlayingXI,
            hasA,
            hasB,
            isLocked: locked
        });
        return locked;
    }, [match]);

    // Sync states when match prop changes (e.g., after save)
    useEffect(() => {
        setTeamAPlayingXI((match as any).teamAPlayingXI || []);
        setTeamBPlayingXI((match as any).teamBPlayingXI || []);
        setTossData({
            tossWinner: match.tossWinner || '',
            tossDecision: (match as any).tossDecision || 'bat'
        });
        setCaptains({
            teamACaptainId: (match as any).teamACaptainId || '',
            teamAKeeperId: (match as any).teamAKeeperId || '',
            teamBCaptainId: (match as any).teamBCaptainId || '',
            teamBKeeperId: (match as any).teamBKeeperId || ''
        });
    }, [match]);

    // Initial Load
    useEffect(() => {
        const loadPlayers = async () => {
            setLoading(true);
            try {
                // Determine squad IDs
                const teamAId = (match as any).teamASquadId || match.teamAId || (match as any).teamA;
                const teamBId = (match as any).teamBSquadId || match.teamBId || (match as any).teamB;

                // Helper to load players
                const fetchPlayers = async (squadId: string) => {
                    if (!squadId) return [];

                    console.log(`[MatchSetupModal] Fetching players for squad: ${squadId}`);

                    let squad = await squadService.getById(squadId);

                    // Fallback: If not found by ID, maybe it's a name (legacy match)
                    if (!squad) {
                        console.log(`[MatchSetupModal] Squad not found by ID ${squadId}, trying by name...`);
                        const squadByName = await squadService.getByName(squadId);
                        if (squadByName && squadByName.length > 0) {
                            squad = squadByName[0];
                            console.log(`[MatchSetupModal] Resolved squad by name: ${squad.id}`);
                        }
                    }

                    const playerMap = new Map();

                    if (squad) {
                        const realSquadId = squad.id;

                        // 1. Gather embedded players (premium design)
                        if ((squad as any).players && Array.isArray((squad as any).players)) {
                            console.log(`[MatchSetupModal] Processing embedded players for squad ${realSquadId}`);
                            (squad as any).players.forEach((p: any) => {
                                if (p && typeof p === 'object') {
                                    const id = p.id || p.uid;
                                    if (id) playerMap.set(id, { ...p, id });
                                }
                            });
                        }

                        // 2. Fetch by IDs listed in squad (Primary source of truth in v2)
                        if (squad.playerIds && Array.isArray(squad.playerIds) && squad.playerIds.length > 0) {
                            console.log(`[MatchSetupModal] Fetching ${squad.playerIds.length} players by IDs for squad ${realSquadId}`);
                            const playersFromIds = await playerService.getByIds(squad.playerIds);
                            playersFromIds.forEach((p: any) => {
                                if (p.id) playerMap.set(p.id, p);
                            });
                        }

                        // 3. Fetch by real ID query as backup (Secondary/Legacy source of truth)
                        const playersFromQuery = await playerService.getBySquad(realSquadId);
                        playersFromQuery.forEach((p: any) => {
                            if (p.id) playerMap.set(p.id, p);
                        });

                        const finalPlayers = Array.from(playerMap.values());
                        console.log(`[MatchSetupModal] Final player count for squad ${realSquadId}: ${finalPlayers.length}`);
                        return finalPlayers;
                    }

                    // 4. Last resort: Fetch by the original squadId string query
                    const playersFromOriginalQuery = await playerService.getBySquad(squadId);
                    return playersFromOriginalQuery || [];
                };

                const [pA, pB] = await Promise.all([
                    fetchPlayers(teamAId),
                    fetchPlayers(teamBId)
                ]);

                setTeamAPlayers(pA);
                setTeamBPlayers(pB);

                // Auto-init XI if empty (First 11)
                let newAXI = [...teamAPlayingXI];
                let newBXI = [...teamBPlayingXI];

                if (newAXI.length === 0 && pA.length > 0) {
                    newAXI = pA.slice(0, 11).map(p => p.id);
                    setTeamAPlayingXI(newAXI);
                }
                if (newBXI.length === 0 && pB.length > 0) {
                    newBXI = pB.slice(0, 11).map(p => p.id);
                    setTeamBPlayingXI(newBXI);
                }

                // Default Captains/Keepers if not set
                setCaptains(prev => {
                    const next = { ...prev };
                    if (!next.teamACaptainId && newAXI.length > 0) next.teamACaptainId = newAXI[0];
                    if (!next.teamAKeeperId && newAXI.length > 0) next.teamAKeeperId = newAXI[1] || newAXI[0];
                    if (!next.teamBCaptainId && newBXI.length > 0) next.teamBCaptainId = newBXI[0];
                    if (!next.teamBKeeperId && newBXI.length > 0) next.teamBKeeperId = newBXI[1] || newBXI[0];
                    return next;
                });

            } catch (err) {
                console.error("Error loading players", err);
                toast.error("Failed to load players");
            } finally {
                setLoading(false);
            }
        };

        loadPlayers();
    }, [match]);

    // Save Handlers
    const handleSaveToss = async () => {
        // Check if innings has started (balls bowled > 0)
        const hasInningsStarted = (match as any).teamAInnings?.totalBalls > 0 ||
            (match as any).teamBInnings?.totalBalls > 0;

        if (hasInningsStarted) {
            toast.error("Cannot modify toss after innings has started (first ball bowled)");
            return;
        }

        setLoading(true);
        try {
            const winnerKey = tossData.tossWinner; // 'teamA' or 'teamB'
            const decision = tossData.tossDecision; // 'bat' or 'bowl'

            // Logic: 
            // 1. Winner is Team A, Decision Bat -> Team A bats first
            // 2. Winner is Team A, Decision Bowl -> Team B bats first
            // 3. Winner is Team B, Decision Bat -> Team B bats first
            // 4. Winner is Team B, Decision Bowl -> Team A bats first

            let currentBatting: 'teamA' | 'teamB' | undefined;
            if (winnerKey && match.status === 'live') {
                if (decision === 'bat') {
                    currentBatting = winnerKey as 'teamA' | 'teamB';
                } else {
                    currentBatting = (winnerKey === 'teamA') ? 'teamB' : 'teamA';
                }
            }

            const updates: any = {
                tossWinner: winnerKey,
                tossDecision: decision,
                electedTo: decision,
                updatedAt: Timestamp.now()
            };

            if (currentBatting && match.status === 'live') {
                updates.currentBatting = currentBatting;
                updates.matchPhase = 'FirstInnings';

                if (currentBatting !== (match as any).currentBatting) {
                    updates.currentStrikerId = "";
                    updates.currentNonStrikerId = "";
                    updates.currentBowlerId = "";
                }
            }

            if (currentBatting && match.status === 'live') {
                const winnerName = winnerKey === 'teamA' ? match.teamAName : match.teamBName;
                const tossDecisionText = decision === 'bat' ? 'bat' : 'bowl';
                oneSignalService.sendToMatch(
                    match.id,
                    match.adminId || 'admin',
                    "Toss Update 🎲",
                    `${winnerName} won the toss and elected to ${tossDecisionText} first!`
                );
            }

            await matchService.update(match.id, updates);
            toast.success(currentBatting ?
                `Toss updated! ${currentBatting === 'teamA' ? match.teamAName : match.teamBName} will bat first.` :
                "Toss updated successfully"
            );
            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update toss");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveXI = async () => {
        // Validation logic per user request:
        // 1. One team can be set (count > 0) while other is 0. (e.g. 5:0, 11:0 allowed)
        // 2. If BOTH teams have players, counts MUST match. (e.g. 5:5, 11:11 allowed; 5:4 blocked)
        const countA = teamAPlayingXI.length;
        const countB = teamBPlayingXI.length;

        if (countA > 0 && countB > 0 && countA !== countB) {
            toast.error(
                `Team Mismatch: ${countA} vs ${countB}. If both teams are selected, counts must be equal.`,
                { icon: '⚠️', duration: 4000 }
            );
            return;
        }

        // Hard Limit Check (Just in case)
        if (countA > 11 || countB > 11) {
            toast.error("Playing XI cannot exceed 11 players");
            return;
        }

        setLoading(true);
        try {
            await matchService.update(match.id, {
                teamAPlayingXI,
                teamBPlayingXI,
                ...captains,
                isPlayingXILocked: true, // Lock the Playing XI after first save
                updatedAt: Timestamp.now()
            } as any);

            toast.success("Playing XI updated successfully!", {
                icon: '✅',
                duration: 3000
            });

            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update Playing XI");
        } finally {
            setLoading(false);
        }
    };

    const handleSendCommentary = async () => {
        if (!commentaryText.trim()) return;
        setSendingComm(true);
        try {
            const battingTeam = (match as any).currentBatting || 'teamA';
            await addManualCommentary(
                match.id,
                battingTeam,
                commentaryText,
                (match as any).currentOver || "0.0",
                (match as any).currentBall || 0,
                0,
                false,
                false
            );

            setCommentaryText('');
            toast.success("Announcement sent");
        } catch (err) {
            console.error(err);
            toast.error("Failed to send commentary");
        } finally {
            setSendingComm(false);
        }
    };

    const togglePlayer = (team: 'A' | 'B', pid: string) => {
        const isTeamA = team === 'A';
        const currentList = isTeamA ? teamAPlayingXI : teamBPlayingXI;
        const setList = isTeamA ? setTeamAPlayingXI : setTeamBPlayingXI;

        if (currentList.includes(pid)) {
            // Remove
            setList(prev => prev.filter(id => id !== pid));
            // Reset Captain/Keeper if removed
            if (isTeamA) {
                if (captains.teamACaptainId === pid) setCaptains(prev => ({ ...prev, teamACaptainId: '' }));
                if (captains.teamAKeeperId === pid) setCaptains(prev => ({ ...prev, teamAKeeperId: '' }));
            } else {
                if (captains.teamBCaptainId === pid) setCaptains(prev => ({ ...prev, teamBCaptainId: '' }));
                if (captains.teamBKeeperId === pid) setCaptains(prev => ({ ...prev, teamBKeeperId: '' }));
            }
        } else {
            // Add
            if (currentList.length >= 11) {
                toast.error("Maximum 11 players allowed");
                return;
            }
            setList(prev => [...prev, pid]);
        }
    };

    const toggleRole = (team: 'A' | 'B', role: 'C' | 'WK', pid: string) => {
        if (team === 'A') {
            if (role === 'C') setCaptains(prev => ({ ...prev, teamACaptainId: pid }));
            if (role === 'WK') setCaptains(prev => ({ ...prev, teamAKeeperId: pid }));
        } else {
            if (role === 'C') setCaptains(prev => ({ ...prev, teamBCaptainId: pid }));
            if (role === 'WK') setCaptains(prev => ({ ...prev, teamBKeeperId: pid }));
        }
    };

    // Render logic helper
    const renderPlayerList = (team: 'A' | 'B') => {
        const players = team === 'A' ? teamAPlayers : teamBPlayers;
        const selectedIds = team === 'A' ? teamAPlayingXI : teamBPlayingXI;
        const captainId = team === 'A' ? captains.teamACaptainId : captains.teamBCaptainId;
        const keeperId = team === 'A' ? captains.teamAKeeperId : captains.teamBKeeperId;

        // Sort: Selected first, then alphabetical
        const sorted = [...players].sort((a, b) => {
            const aSel = selectedIds.includes(a.id);
            const bSel = selectedIds.includes(b.id);
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;
            return a.name.localeCompare(b.name);
        });

        return (
            <div className="flex-1 overflow-y-auto grid grid-cols-1 xl:grid-cols-2 gap-2 pr-2 custom-scrollbar h-[50vh] content-start">
                {sorted.length === 0 && <div className="col-span-1 xl:col-span-2 text-center text-slate-400 py-10">No players found</div>}
                {sorted.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                        <div
                            key={p.id}
                            className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-slate-200'
                                } ${!isXILocked ? 'hover:border-indigo-200' : 'opacity-60 cursor-not-allowed'}`}
                        >
                            <div
                                className={`flex items-center gap-3 flex-1 ${!isXILocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                onClick={() => !isXILocked && togglePlayer(team, p.id)}
                            >
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                                    {isSelected && <Check size={12} strokeWidth={4} />}
                                </div>
                                <div className="flex flex-col">
                                    <span className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-600'}`}>{p.name}</span>
                                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">
                                        {p.role || 'Player'}
                                    </span>
                                </div>
                            </div>

                            {/* Roles controls - Visible only if selected */}
                            {isSelected && (
                                <div className="flex gap-1 animate-in fade-in zoom-in duration-200">
                                    <button
                                        onClick={() => toggleRole(team, 'C', p.id)}
                                        disabled={isXILocked}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${captainId === p.id ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-300'} ${!isXILocked ? 'hover:border-amber-200 hover:text-amber-400' : 'opacity-50 cursor-not-allowed'}`}
                                        title="Assign Captain"
                                    >
                                        C
                                    </button>
                                    <button
                                        onClick={() => toggleRole(team, 'WK', p.id)}
                                        disabled={isXILocked}
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${keeperId === p.id ? 'bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm' : 'bg-white border-slate-200 text-slate-300'} ${!isXILocked ? 'hover:border-emerald-200 hover:text-emerald-400' : 'opacity-50 cursor-not-allowed'}`}
                                        title="Assign Wicket Keeper"
                                    >
                                        WK
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            Match Setup
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs font-black uppercase tracking-widest">
                                {(match as any).matchNo || 'Match'}
                            </span>
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">{match.teamAName} vs {match.teamBName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-100 flex gap-1 shrink-0 bg-slate-50/50">
                    <button
                        onClick={() => setActiveTab('toss')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'toss' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Toss & Conditions
                    </button>
                    <button
                        onClick={() => setActiveTab('xi')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'xi' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Playing XI
                    </button>
                    <button
                        onClick={() => setActiveTab('commentary')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'commentary' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        Announcements
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
                    {activeTab === 'toss' && (
                        <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                                <h3 className="font-bold flex items-center gap-2 text-slate-900 mb-1">
                                    <Trophy size={18} className="text-amber-500" /> Toss Decision
                                </h3>
                                <p className="text-xs text-slate-400 mb-6">Set who won the toss and what they elected to do.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Toss Winner</label>
                                        <select
                                            value={tossData.tossWinner}
                                            onChange={(e) => setTossData({ ...tossData, tossWinner: e.target.value as any })}
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 p-3 focus:ring-2 focus:ring-indigo-500 transition-all"
                                        >
                                            <option value="">Select Winner...</option>
                                            <option value="teamA">{match.teamAName}</option>
                                            <option value="teamB">{match.teamBName}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Decision</label>
                                        <div className="flex bg-slate-50 rounded-xl p-1 border border-slate-200">
                                            <button
                                                onClick={() => setTossData({ ...tossData, tossDecision: 'bat' })}
                                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tossData.tossDecision === 'bat' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Bat
                                            </button>
                                            <button
                                                onClick={() => setTossData({ ...tossData, tossDecision: 'bowl' })}
                                                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${tossData.tossDecision === 'bowl' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                Bowl
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveToss}
                                disabled={loading}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save Toss Results'}
                            </button>
                        </div>
                    )}

                    {activeTab === 'xi' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between shrink-0 px-1">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Users size={18} className="text-indigo-600" /> Playing XI Selection
                                </h3>
                                <div className="text-xs font-medium text-slate-400">
                                    {isXILocked ? (
                                        <span className="bg-red-50 border border-red-200 px-2 py-1 rounded text-red-600 font-bold flex items-center gap-1">
                                            <Lock size={12} /> Locked
                                        </span>
                                    ) : (
                                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-500 font-bold">Max 11 per team</span>
                                    )}
                                </div>
                            </div>

                            {/* Two-Column Layout */}
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden min-h-0">
                                {/* Team A Panel */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                        <div className="font-bold text-slate-900 truncate pr-2 text-sm">{match.teamAName}</div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${teamAPlayingXI.length === 11 ? 'bg-green-100 text-green-700' :
                                            teamAPlayingXI.length > 11 ? 'bg-red-100 text-red-700' :
                                                'bg-slate-200 text-slate-500'
                                            }`}>
                                            {teamAPlayingXI.length}/11
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-hidden p-1 relative bg-white">
                                        {renderPlayerList('A')}
                                    </div>
                                </div>

                                {/* Team B Panel */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                        <div className="font-bold text-slate-900 truncate pr-2 text-sm">{match.teamBName}</div>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${teamBPlayingXI.length === 11 ? 'bg-green-100 text-green-700' :
                                            teamBPlayingXI.length > 11 ? 'bg-red-100 text-red-700' :
                                                'bg-slate-200 text-slate-500'
                                            }`}>
                                            {teamBPlayingXI.length}/11
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-hidden p-1 relative bg-white">
                                        {renderPlayerList('B')}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Area */}
                            <div className="shrink-0 space-y-3 pt-2">
                                {isXILocked && (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-bold">
                                        <Lock size={16} />
                                        <span>Playing XI is locked and cannot be modified.</span>
                                    </div>
                                )}
                                {!isXILocked && teamAPlayingXI.length > 0 && teamBPlayingXI.length > 0 && teamAPlayingXI.length !== teamBPlayingXI.length && (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
                                        <AlertTriangle size={16} />
                                        <span>Team counts mismatch: {teamAPlayingXI.length} vs {teamBPlayingXI.length}</span>
                                    </div>
                                )}
                                <button
                                    onClick={handleSaveXI}
                                    disabled={loading || isXILocked || (teamAPlayingXI.length > 0 && teamBPlayingXI.length > 0 && teamAPlayingXI.length !== teamBPlayingXI.length)}
                                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${(isXILocked || (teamAPlayingXI.length > 0 && teamBPlayingXI.length > 0 && teamAPlayingXI.length !== teamBPlayingXI.length))
                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                        : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-95'
                                        }`}
                                >
                                    {loading ? 'Saving...' : (
                                        <>
                                            <Save size={18} /> Save Playing XI
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'commentary' && (
                        <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                <h3 className="font-bold flex items-center gap-2 text-slate-900 mb-4">
                                    <Mic size={18} className="text-indigo-600" /> Manual Announcements
                                </h3>

                                <textarea
                                    className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 font-medium text-slate-700 min-h-[150px]"
                                    placeholder="Write an announcement text to appear in the live commentary feed... (e.g. 'Match delayed due to bad light', 'Lunch Break')"
                                    value={commentaryText}
                                    onChange={e => setCommentaryText(e.target.value)}
                                ></textarea>

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleSendCommentary}
                                        disabled={sendingComm || !commentaryText.trim()}
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg hover:bg-slate-800 disabled:opacity-50 active:scale-95 transition-all"
                                    >
                                        {sendingComm ? 'Sending...' : 'Post Announcement'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
