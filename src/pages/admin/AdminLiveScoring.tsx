import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { matchService } from '@/services/firestore/matches';
import { playerService } from '@/services/firestore/players';
import { addBall, BallUpdateResult } from '@/services/matchEngine/ballUpdateService';
import { recalculateInnings } from '@/services/matchEngine/recalculateInnings';
import { Match, InningsStats, Player } from '@/types';
import { Loader2, CheckCircle, RotateCcw, ArrowRightLeft, UserPlus, ShieldAlert, Trophy, Target, Activity, Award, Megaphone, Send, SwitchCamera } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getMatchResultString } from '@/utils/matchWinner';
import * as commentaryService from '@/services/commentary/commentaryService';

const AdminLiveScoring = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();

    // --- State ---
    const [match, setMatch] = useState<Match | null>(null);
    const [inningsA, setInningsA] = useState<InningsStats | null>(null);
    const [inningsB, setInningsB] = useState<InningsStats | null>(null);

    // Players State
    const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
    const [playersLoaded, setPlayersLoaded] = useState(false);

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Selection Inputs
    const [selectedStriker, setSelectedStriker] = useState<string>('');
    const [selectedNonStriker, setSelectedNonStriker] = useState<string>('');
    const [selectedBowler, setSelectedBowler] = useState<string>('');

    // Scoring Inputs
    const [runInput, setRunInput] = useState<number | null>(null);
    const [extras, setExtras] = useState({ wide: false, noBall: false, bye: false, legBye: false, penalty: false });
    const [wicketModalOpen, setWicketModalOpen] = useState(false);
    const [nextBatterModalOpen, setNextBatterModalOpen] = useState(false);

    // Wicket Modal State
    const [wicketType, setWicketType] = useState('caught');
    const [whoIsOut, setWhoIsOut] = useState<'striker' | 'nonStriker'>('striker');
    const [nextBatterId, setNextBatterId] = useState('');
    const [fielderId, setFielderId] = useState('');
    const [manualCommentary, setManualCommentary] = useState('');

    // --- Data Subscription ---
    useEffect(() => {
        if (!matchId) return;

        // Subscribe to Match
        const unsubMatch = onSnapshot(doc(db, 'matches', matchId), (doc) => {
            if (doc.exists()) {
                const mData = { id: doc.id, ...doc.data() } as Match;
                setMatch(mData);

                // Sync local selection state logic (only if empty to allow local switching?)
                // Actually, standard is to follow DB. If multiple scorers, last write wins.
                if (mData.currentStrikerId !== undefined) setSelectedStriker(mData.currentStrikerId);
                if (mData.currentNonStrikerId !== undefined) setSelectedNonStriker(mData.currentNonStrikerId);
                if (mData.currentBowlerId !== undefined) setSelectedBowler(mData.currentBowlerId);
            }
            setLoading(false);
        });

        const unsubInn = matchService.subscribeToInnings(matchId, 'teamA', (data) => setInningsA(data));
        const unsubInnB = matchService.subscribeToInnings(matchId, 'teamB', (data) => setInningsB(data));

        return () => {
            unsubMatch();
            unsubInn && unsubInn();
            unsubInnB && unsubInnB();
        };
    }, [matchId]);

    // --- Fetch Players Logic ---
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!match) return;
            try {
                // Determine team IDs using robust resolution
                const teamAId = (match as any).teamASquadId || (match as any).teamAId || (match as any).teamA || '';
                const teamBId = (match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB || '';

                if (!teamAId || !teamBId) {
                    console.warn("[AdminLiveScoring] Missing team IDs for player fetch");
                    return;
                }

                const [pA, pB] = await Promise.all([
                    playerService.getBySquad(String(teamAId)),
                    playerService.getBySquad(String(teamBId))
                ]);
                setTeamAPlayers(pA);
                setTeamBPlayers(pB);
                setPlayersLoaded(true);
            } catch (error) {
                console.error("Error fetching players:", error);
                toast.error("Failed to load player lists");
            }
        };

        if (match && !playersLoaded) {
            fetchPlayers();
        }
    }, [match, playersLoaded]);

    // Sync player names with match document (so recalculateInnings can access names)
    useEffect(() => {
        const syncPlayerNames = async () => {
            if (!matchId || !playersLoaded || !teamAPlayers.length || !teamBPlayers.length) return;

            try {
                // Create player objects with id and name for easy lookup
                const teamAPlayingXIWithNames = (match?.teamAPlayingXI || []).map(id => {
                    const player = teamAPlayers.find(p => p.id === id);
                    return player ? { id: player.id, name: player.name } : { id, name: 'Unknown' };
                });

                const teamBPlayingXIWithNames = (match?.teamBPlayingXI || []).map(id => {
                    const player = teamBPlayers.find(p => p.id === id);
                    return player ? { id: player.id, name: player.name } : { id, name: 'Unknown' };
                });

                // Update match with player names (only if not already done OR if data is missing)
                const alreadySynced = match?.playersDataSynced &&
                    match?.teamAPlayingXIWithNames?.length &&
                    match?.teamBPlayingXIWithNames?.length;

                if (!alreadySynced) {
                    console.log("[AdminLiveScoring] Syncing player names to match document...");
                    await matchService.update(matchId, {
                        teamAPlayingXIWithNames,
                        teamBPlayingXIWithNames,
                        playersDataSynced: true
                    });
                }
            } catch (err) {
                console.error("Failed to sync player names:", err);
            }
        };

        syncPlayerNames();
    }, [matchId, playersLoaded, teamAPlayers, teamBPlayers, match]);

    // --- Derived Data ---
    const currentInnings = match?.currentBatting === 'teamB' ? inningsB : inningsA;

    // Resolve Real Player Objects based on Playing XI IDs
    const resolvePlayers = (playerIds: string[], sourceList: Player[]) => {
        return (playerIds || []).map(id => sourceList.find(p => p.id === id)).filter(Boolean) as Player[];
    };

    const isTeamB = match?.currentBatting === 'teamB';
    const battingTeamPlayersAll = isTeamB ? teamBPlayers : teamAPlayers;
    const bowlingTeamPlayersAll = isTeamB ? teamAPlayers : teamBPlayers;

    const battingPlayingXI = resolvePlayers(
        isTeamB ? match?.teamBPlayingXI || [] : match?.teamAPlayingXI || [],
        battingTeamPlayersAll
    );
    const bowlingPlayingXI = resolvePlayers(
        isTeamB ? match?.teamAPlayingXI || [] : match?.teamBPlayingXI || [],
        bowlingTeamPlayersAll
    );

    const availableBatters = useMemo(() => {
        if (!currentInnings || !battingPlayingXI) return [];
        const atCrease = [match?.currentStrikerId, match?.currentNonStrikerId];
        const dismissedIds = currentInnings.fallOfWickets?.map(w => w.batsmanId) || [];
        return battingPlayingXI.filter(p => !atCrease.includes(p.id) && !dismissedIds.includes(p.id));
    }, [currentInnings, battingPlayingXI, match]);

    const getPlayerName = (id: string) => {
        const p = [...teamAPlayers, ...teamBPlayers].find(x => x.id === id);
        return p?.name || 'Unknown';
    };

    // --- Handlers ---
    const handlePlayerAssign = async (field: 'currentStrikerId' | 'currentNonStrikerId' | 'currentBowlerId', value: string) => {
        if (!matchId) return;

        // ICC Rule: Same bowler cannot bowl consecutive overs
        if (field === 'currentBowlerId' && value && match?.lastOverBowlerId === value) {
            toast.error('Same bowler cannot bowl consecutive overs!');
            return;
        }

        try {
            await matchService.update(matchId, { [field]: value });
        } catch (err) {
            console.error("Failed to update player", err);
            toast.error("Failed to assign player");
        }
    };

    const handleScoreClick = (r: number) => {
        setRunInput(r);
    };

    const toggleExtra = (type: 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty') => {
        setExtras(prev => {
            const neo = { ...prev, [type]: !prev[type] };
            if (type === 'wide' && neo.wide) neo.noBall = false;
            if (type === 'noBall' && neo.noBall) neo.wide = false;
            if (type === 'bye' && neo.bye) neo.legBye = false;
            if (type === 'legBye' && neo.legBye) neo.bye = false;
            return neo;
        });
    };

    const handleUndo = async () => {
        if (!matchId || !match?.currentBatting) return;
        if (!confirm("Are you sure you want to undo the last ball?")) return;

        setProcessing(true);
        try {
            const inningKv = match.currentBatting;
            const balls = await matchService.getBalls(matchId, inningKv);
            if (balls.length === 0) {
                toast.error("No balls to undo");
                return;
            }

            const ballToUndo = balls[balls.length - 1];

            // --- Revert State Logic ---
            let nextStriker = selectedStriker;
            let nextNonStriker = selectedNonStriker;
            let nextBowler = selectedBowler;

            // 1. Check if the ball being undone completed an over
            // (We check count of legal balls BEFORE deleting)
            const legalBalls = balls.filter(b => b.isLegal !== false);
            const isLastBallOfOver = legalBalls.length % 6 === 0 && ballToUndo.isLegal !== false;

            if (isLastBallOfOver) {
                // Was an end of over => ends were swapped. Swap them back.
                [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
                // Restore the bowler (it was cleared on over end)
                nextBowler = ballToUndo.bowlerId;
            }

            // 2. Was it an odd run rotation? (1, 3, 5 runs and NOT a boundary)
            // For Extras like Wide+1, Byes, Leg Byes, the batsmen still run.
            let rotationRuns = ballToUndo.runsOffBat || 0;
            const bExtras = ballToUndo.extras || {};

            if (ballToUndo.isWide || ballToUndo.extraType === 'wide') {
                // For Wide+1, total wides is 2. Rotation runs = 2 - 1 = 1.
                rotationRuns = (bExtras.wides || 0) - 1;
            } else if (bExtras.byes || bExtras.legByes) {
                rotationRuns = (bExtras.byes || 0) + (bExtras.legByes || 0);
            }

            const isBoundary = (ballToUndo.runsOffBat === 4 || ballToUndo.runsOffBat === 6);
            if (!isBoundary && Math.abs(rotationRuns) % 2 !== 0) {
                [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
            }

            // 3. Was it a wicket? Restore the out batter to the crease
            if (ballToUndo.wicket) {
                const outId = ballToUndo.wicket.dismissedPlayerId;
                // Check if they were the striker or non-striker
                if (outId === ballToUndo.batsmanId) nextStriker = outId;
                else nextNonStriker = outId;
            }

            // --- Database Sync ---
            // 1. Delete actual ball
            await matchService.deleteBall(matchId, inningKv, ballToUndo.id);

            // 2. Recalculate stats (SINGLE SOURCE OF TRUTH)
            await recalculateInnings(matchId, inningKv, { useTransaction: false });

            // 3. Revert match state IDs
            const updates: any = {
                currentStrikerId: nextStriker,
                currentNonStrikerId: nextNonStriker,
                currentBowlerId: nextBowler
            };

            // IF match was finished, bring it back to LIVE
            if (match.status === 'finished') {
                updates.status = 'live';
                updates.matchPhase = match.currentBatting === 'teamA' ? 'FirstInnings' : 'SecondInnings';
            }

            // Clear lastOverBowlerId if we are returning to the same over
            if (isLastBallOfOver) {
                updates.lastOverBowlerId = '';
            }

            await matchService.update(matchId, updates);

            toast.success("Last ball undone and match reverted to Live");
        } catch (err) {
            console.error("Undo failed:", err);
            toast.error("Failed to undo");
        } finally {
            setProcessing(false);
        }
    };

    const validateSubmission = () => {
        if (!selectedStriker || !selectedNonStriker || !selectedBowler) {
            toast.error("Select Striker, Non-Striker & Bowler!");
            return false;
        }

        // ICC Rule: Same bowler cannot bowl consecutive overs
        if (match?.lastOverBowlerId === selectedBowler) {
            toast.error("Same bowler cannot bowl consecutive overs! Change bowler first.");
            return false;
        }

        if (selectedStriker === selectedNonStriker) {
            toast.error("Striker & Non-Striker must be different!");
            return false;
        }
        if (runInput === null && !wicketModalOpen) {
            toast.error("Select Runs (0-6)");
            return false;
        }
        return true;
    };

    const submitBall = async (wicketData?: any) => {
        if (!match || !matchId) return;
        setProcessing(true);

        const inningKv = match.currentBatting || 'teamA';
        const runs = runInput || 0;

        let batRuns = runs;
        let wideVal = 0;
        let nbVal = 0;
        let byeVal = 0;
        let lbVal = 0;
        let penaltyVal = 0;

        if (extras.wide) {
            batRuns = 0;
            wideVal = 1 + runs;
        } else if (extras.noBall) {
            nbVal = 1;
        } else if (extras.bye) {
            batRuns = 0;
            byeVal = runs;
        } else if (extras.legBye) {
            batRuns = 0;
            lbVal = runs;
        } else if (extras.penalty) {
            batRuns = 0;
            penaltyVal = runs;
        }

        const payload = {
            runsOffBat: batRuns,
            extras: { wides: wideVal, noBalls: nbVal, byes: byeVal, legByes: lbVal, penalty: penaltyVal },
            isLegal: !extras.wide && !extras.noBall,
            isWide: !!extras.wide,
            isNoBall: !!extras.noBall,
            batsmanId: selectedStriker,
            nonStrikerId: selectedNonStriker,
            bowlerId: selectedBowler,
            freeHit: !!match.freeHit,
            wicket: wicketData || null
        };

        try {
            const result: BallUpdateResult = await addBall(matchId, inningKv, payload);
            if (!result.success) throw new Error(result.error);

            // Generate AI Commentary
            try {
                const strikerObj = battingTeamPlayersAll.find(p => p.id === selectedStriker);
                const bowlerObj = bowlingTeamPlayersAll.find(p => p.id === selectedBowler);

                await commentaryService.generateAutoCommentary(matchId, inningKv, {
                    runs: batRuns,
                    ballType: extras.wide ? 'wide' : extras.noBall ? 'no-ball' : extras.bye ? 'bye' : extras.legBye ? 'leg-bye' : 'normal',
                    wicketType: wicketData?.type || null,
                    batsman: strikerObj?.name || 'Batter',
                    bowler: bowlerObj?.name || 'Bowler',
                    isBoundary: batRuns === 4 || batRuns === 6,
                    isFour: batRuns === 4,
                    isSix: batRuns === 6,
                    over: result.inningsData?.overs || '0.0',
                    ball: result.inningsData?.ballsInCurrentOver || 0,
                    ballDocId: result.ballId,
                    matchContext: {
                        currentScore: result.inningsData?.totalRuns,
                        wickets: result.inningsData?.totalWickets,
                    }
                });
            } catch (commErr) {
                console.error("[AdminLiveScoring] Commentary generation failed:", commErr);
            }

            // Strike Rotation & State Logic
            let nextStriker = selectedStriker;
            let nextNonStriker = selectedNonStriker;
            let nextBowler = selectedBowler;
            const updates: any = {};

            if (wicketData) {
                // If it's a wicket, we clear the out player and trigger the next batter modal
                const outId = wicketData.dismissedPlayerId;
                if (outId === selectedStriker) nextStriker = '';
                else nextNonStriker = '';

                // Trigger the next batter modal after a short delay
                setTimeout(() => setNextBatterModalOpen(true), 500);
            } else {
                const physicalRuns = runs;
                const isBoundary = (physicalRuns === 4 || physicalRuns === 6);

                if (!isBoundary && physicalRuns % 2 !== 0) {
                    [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
                }
            }

            if (result.overComplete) {
                // Swap Ends at over end
                [nextStriker, nextNonStriker] = [nextNonStriker, nextStriker];
                // Track last bowler to prevent consecutive overs
                updates.lastOverBowlerId = selectedBowler;
                nextBowler = '';
                toast('Over Completed! Select new bowler', { icon: '🏏', style: { borderRadius: '10px', background: '#333', color: '#fff' } });
            }

            // Update Match State if changed
            if (nextStriker !== match.currentStrikerId) updates.currentStrikerId = nextStriker;
            if (nextNonStriker !== match.currentNonStrikerId) updates.currentNonStrikerId = nextNonStriker;
            if (nextBowler !== match.currentBowlerId) updates.currentBowlerId = nextBowler;

            if (Object.keys(updates).length > 0) {
                await matchService.update(matchId, updates);
            }

            setRunInput(null);
            setExtras({ wide: false, noBall: false, bye: false, legBye: false, penalty: false });
            toast.success("Ball added");

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to update score');
        } finally {
            setProcessing(false);
            setWicketModalOpen(false);
        }
    };

    const handleWicketConfirm = () => {
        if (!wicketType || !whoIsOut) {
            toast.error("Please select the dismissal method.");
            return;
        }
        const dismissedId = whoIsOut === 'striker' ? selectedStriker : selectedNonStriker;
        const wicketPayload = {
            type: wicketType,
            dismissedPlayerId: dismissedId,
            creditedToBowler: !['runout', 'timedOut', 'hitBallTwice', 'obstructing'].includes(wicketType),
            fielderId: fielderId || null
        };
        submitBall(wicketPayload);
    };

    const handleNextBatterConfirm = async () => {
        if (!nextBatterId || !matchId) {
            toast.error("Please select the next batter.");
            return;
        }

        try {
            const field = !selectedStriker ? 'currentStrikerId' : 'currentNonStrikerId';
            await matchService.update(matchId, { [field]: nextBatterId });
            setNextBatterModalOpen(false);
            setNextBatterId('');
            toast.success("New batter arrived at crease");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update next batter");
        }
    };

    const handleManualCommentarySubmit = async () => {
        if (!manualCommentary.trim() || !matchId || !match) return;
        setProcessing(true);
        try {
            const currentInn = match.currentBatting === 'teamB' ? inningsB : inningsA;
            await commentaryService.addManualCommentary(
                matchId,
                match.currentBatting || 'teamA',
                manualCommentary,
                currentInn?.overs || '0.0',
                0, 0, false, false
            );
            setManualCommentary('');
            toast.success("Commentary added!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to add commentary");
        } finally {
            setProcessing(false);
        }
    };

    const resultSummary = useMemo(() => {
        if (!match) return '';
        return getMatchResultString(
            match.teamAName,
            match.teamBName,
            inningsA || null,
            inningsB || null,
            match
        );
    }, [match, inningsA, inningsB]);

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
    if (!match) return <div className="p-10 text-red-500 font-bold text-center">Match not found</div>;

    return (
        <div className="max-w-5xl mx-auto p-4 lg:p-6 pb-32 bg-slate-50 min-h-screen text-slate-800 font-inter">
            {/* --- TOP BAR: Match Status --- */}
            <div className="bg-[#1e293b] text-white rounded-2xl shadow-xl p-5 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy size={120} />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-blue-300 font-bold text-xs uppercase tracking-widest mb-1">
                            {(match as any).matchType || 'T20 Match'} • <span className="text-emerald-400">{match.status.toUpperCase()}</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black leading-tight tracking-tight flex items-center flex-wrap gap-2">
                            <span className={match.currentBatting === 'teamA' ? 'text-white' : 'text-slate-500'}>{match.teamAName}</span>
                            <span className="text-slate-500 text-lg mx-2">vs</span>
                            <span className={match.currentBatting === 'teamB' ? 'text-white' : 'text-slate-500'}>{match.teamBName}</span>

                            <span className="ml-3 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-md border border-emerald-500/30">
                                {match.currentBatting === 'teamB' ? match.teamBName : match.teamAName} BATTING
                            </span>

                            {/* Manual Swap Button - Visible only before ball 1 */}
                            {(!currentInnings || (currentInnings.legalBalls || 0) === 0) && (
                                <button
                                    onClick={async () => {
                                        if (window.confirm(`Switch batting team to ${match.currentBatting === 'teamA' ? match.teamBName : match.teamAName}?`)) {
                                            const newBatting = match.currentBatting === 'teamA' ? 'teamB' : 'teamA';
                                            await matchService.update(matchId as string, {
                                                currentBatting: newBatting,
                                                currentStrikerId: "",
                                                currentNonStrikerId: "",
                                                currentBowlerId: ""
                                            });
                                            toast.success(`Switched batting team to ${newBatting === 'teamA' ? match.teamAName : match.teamBName}`);
                                        }
                                    }}
                                    className="ml-2 p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors text-white/60 hover:text-white"
                                    title="Swap Batting Team"
                                >
                                    <SwitchCamera size={14} />
                                </button>
                            )}
                        </h1>
                        <div className="flex items-baseline gap-3 mt-3">
                            <div className="text-4xl font-black text-white tabular-nums tracking-tighter">
                                {currentInnings?.totalRuns || 0}/{currentInnings?.totalWickets || 0}
                            </div>
                            <div className="text-slate-400 font-medium text-lg">
                                ({currentInnings?.overs || '0.0'} ov)
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">CRR</div>
                            <div className="text-xl font-mono font-bold text-emerald-400">{currentInnings?.currentRunRate || '0.00'}</div>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Target</div>
                            <div className="text-xl font-mono font-bold text-amber-400">{currentInnings?.target || '-'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* --- LEFT COL: PLAYERS --- */}
                <div className="lg:col-span-4 space-y-4">
                    {/* Batsmen Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                                <Activity size={16} className="text-blue-600" /> On Crease
                            </h3>
                            <button
                                onClick={() => {
                                    const temp = selectedStriker;
                                    handlePlayerAssign('currentStrikerId', selectedNonStriker);
                                    handlePlayerAssign('currentNonStrikerId', temp);
                                }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 active:scale-95 transition-transform"
                            >
                                <ArrowRightLeft size={14} /> Swap
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Striker */}
                            <div className="relative">
                                <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block pl-1">Striker (On Strike)</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs">S</div>
                                    <select
                                        className="flex-1 form-select bg-slate-50 border-slate-200 rounded-lg text-sm font-semibold focus:ring-blue-500 focus:border-blue-500"
                                        value={selectedStriker}
                                        onChange={(e) => handlePlayerAssign('currentStrikerId', e.target.value)}
                                    >
                                        <option value="">Select Striker...</option>
                                        {battingPlayingXI.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Non-Striker */}
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block pl-1">Non-Striker</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-xs">NS</div>
                                    <select
                                        className="flex-1 form-select bg-slate-50 border-slate-200 rounded-lg text-sm font-semibold text-slate-600 focus:ring-blue-500 focus:border-blue-500"
                                        value={selectedNonStriker}
                                        onChange={(e) => handlePlayerAssign('currentNonStrikerId', e.target.value)}
                                    >
                                        <option value="">Select Non-Striker...</option>
                                        {battingPlayingXI.filter(p => p.id !== selectedStriker).map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bowler Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide flex items-center gap-2">
                                <Target size={16} className="text-red-600" /> Current Bowler
                            </h3>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-black text-xs">B</div>
                                <select
                                    className={`flex-1 form-select rounded-lg text-sm font-semibold focus:ring-red-500 focus:border-red-500 ${!selectedBowler ? 'border-red-300 bg-red-50 text-red-900 animate-pulse' : 'bg-slate-50 border-slate-200'}`}
                                    value={selectedBowler}
                                    onChange={(e) => handlePlayerAssign('currentBowlerId', e.target.value)}
                                >
                                    <option value="">{selectedBowler ? 'Change Bowler...' : '⚠ Select Bowler Required'}</option>
                                    {bowlingPlayingXI.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- CENTER COL: SCORING PAD --- */}
                <div className="lg:col-span-8">
                    {match.status === 'finished' ? (
                        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden text-center p-12">
                            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Trophy size={48} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight mb-2">Match Finished</h2>
                            <p className="text-xl font-bold text-slate-600 mb-8">{resultSummary}</p>

                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 inline-block min-w-[300px]">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Summary</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center gap-8">
                                        <span className="font-bold text-slate-700">{match.teamAName}</span>
                                        <span className="font-black text-slate-900">{inningsA?.totalRuns}-{inningsA?.totalWickets} <span className="text-slate-400 text-sm">({inningsA?.overs} ov)</span></span>
                                    </div>
                                    <div className="flex justify-between items-center gap-8">
                                        <span className="font-bold text-slate-700">{match.teamBName}</span>
                                        <span className="font-black text-slate-900">{inningsB?.totalRuns}-{inningsB?.totalWickets} <span className="text-slate-400 text-sm">({inningsB?.overs} ov)</span></span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 flex items-center justify-center gap-4">
                                <button
                                    onClick={handleUndo}
                                    className="px-8 py-4 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-100 transition-all flex items-center gap-3 border border-red-100"
                                >
                                    <RotateCcw size={20} /> Undo Last Ball (Restore Match)
                                </button>
                                <button
                                    onClick={() => navigate('/admin/matches')}
                                    className="px-8 py-4 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-lg"
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden relative">
                            {processing && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
                                    <div className="bg-white p-4 rounded-xl shadow-2xl flex items-center gap-3">
                                        <Loader2 className="animate-spin text-blue-600" />
                                        <span className="font-bold text-slate-700">Updating...</span>
                                    </div>
                                </div>
                            )}

                            {/* Extras Toolbar */}
                            <div className="flex border-b divide-x divide-slate-100">
                                {['wide', 'noBall', 'bye', 'legBye', 'penalty'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => toggleExtra(type as any)}
                                        className={`flex-1 py-4 font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all
                                        ${extras[type as keyof typeof extras]
                                                ? 'bg-slate-800 text-white shadow-inner'
                                                : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        {type.replace(/([A-Z])/g, ' $1').trim()}
                                    </button>
                                ))}
                            </div>

                            {/* Runs Grid - Modern & Large */}
                            <div className="p-4 bg-slate-50 relative">
                                {match.freeHit && (
                                    <div className="absolute top-2 right-4 z-10 flex items-center gap-1.5 bg-yellow-400 text-yellow-950 px-3 py-1 rounded-full text-xs font-black animate-bounce shadow-lg border border-yellow-500 uppercase tracking-tighter">
                                        <Activity size={14} /> FREE HIT
                                    </div>
                                )}
                                <div className="grid grid-cols-4 gap-3 mb-4">
                                    {[0, 1, 2, 3].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => handleScoreClick(r)}
                                            className={`h-20 sm:h-24 rounded-2xl font-black text-3xl sm:text-4xl shadow-sm border border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1
                                            ${runInput === r
                                                    ? 'bg-blue-600 border-blue-800 text-white ring-2 ring-offset-2 ring-blue-400 theme-transition'
                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[4, 6].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => handleScoreClick(r)}
                                            className={`h-20 sm:h-24 rounded-2xl font-black text-3xl sm:text-4xl shadow-sm border border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1
                                            ${runInput === r
                                                    ? 'bg-indigo-600 border-indigo-800 text-white ring-2 ring-offset-2 ring-indigo-400'
                                                    : 'bg-white border-slate-200 text-indigo-900 hover:border-indigo-200'}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            if (match.freeHit) setWicketType('runout');
                                            setWicketModalOpen(true);
                                        }}
                                        className="h-20 sm:h-24 rounded-2xl font-black text-2xl sm:text-3xl shadow-sm border border-b-4 bg-red-500 border-red-700 text-white hover:bg-red-600 active:scale-95 active:border-b-0 active:translate-y-1 flex flex-col items-center justify-center gap-1"
                                    >
                                        <span>OUT</span>
                                        <ShieldAlert size={16} className="opacity-80" />
                                    </button>
                                </div>
                            </div>

                            {/* Submit Actions */}
                            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Selection</span>
                                    <div className="flex items-baseline gap-1 animate-in fade-in slide-in-from-bottom-2">
                                        <span className="text-2xl font-black text-slate-800">{runInput ?? '-'}</span>
                                        <span className="text-sm font-bold text-slate-500">Run(s)</span>
                                        {Object.entries(extras).filter(([_, v]) => v).length > 0 && (
                                            <span className="ml-2 px-2 py-0.5 rounded bg-slate-800 text-white text-xs font-bold">
                                                {Object.entries(extras).filter(([_, v]) => v).map(([k]) => k).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => { if (validateSubmission()) submitBall(); }}
                                    disabled={processing || !selectedBowler}
                                    className="pl-6 pr-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all active:scale-95"
                                >
                                    <CheckCircle size={20} />
                                    {processing ? 'Processing...' : 'Submit Ball'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MATCH CONTROLS --- */}
            <div className="mt-8 border-t border-slate-200 pt-8">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Game Management</h4>
                <div className="flex flex-wrap gap-4">
                    <button
                        onClick={() => {
                            if (confirm("End Innings?")) matchService.update(matchId!, { status: 'INNINGS BREAK', matchPhase: 'InningsBreak' });
                        }}
                        className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                    >
                        End Innings
                    </button>
                    <button
                        onClick={() => {
                            if (confirm("Start 2nd Innings?")) {
                                const newBatting = match.currentBatting === 'teamA' ? 'teamB' : 'teamA';
                                matchService.update(matchId!, {
                                    status: 'LIVE',
                                    matchPhase: 'SecondInnings',
                                    currentBatting: newBatting,
                                    currentStrikerId: '', currentNonStrikerId: '', currentBowlerId: ''
                                });
                            }
                        }}
                        className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                    >
                        Start 2nd Innings
                    </button>
                    <button
                        onClick={handleUndo}
                        className="px-6 py-3 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                    >
                        <RotateCcw size={16} /> Undo Ball
                    </button>
                    <button
                        onClick={() => {
                            if (confirm("Finalize Match?")) matchService.update(matchId!, { status: 'finished', matchPhase: 'finished' });
                        }}
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors ml-auto shadow-lg"
                    >
                        Finalize Match
                    </button>
                </div>

                {/* --- MANUAL COMMENTARY --- */}
                <div className="mt-8 border-t border-slate-200 pt-8">
                    <h4 className="text-xs font-bold text-slate-400 border-b border-slate-100 pb-2 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Megaphone size={14} /> Live Announcement
                    </h4>
                    <div className="flex gap-2">
                        <textarea
                            value={manualCommentary}
                            onChange={(e) => setManualCommentary(e.target.value)}
                            placeholder="Add a custom highlight or announcement... (e.g. Magnificent shot from Mehedi Hasan!)"
                            className="flex-1 rounded-xl border-slate-200 text-sm font-medium focus:ring-blue-500 focus:border-blue-500 resize-none h-12 py-2.5 px-3"
                        />
                        <button
                            onClick={handleManualCommentarySubmit}
                            disabled={processing || !manualCommentary.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white w-12 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* WICKET MODAL */}
            {wicketModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-red-600 p-4 text-center">
                            <h2 className="text-white font-black text-xl uppercase tracking-widest flex items-center justify-center gap-2">
                                <ShieldAlert /> Wicket Fall
                            </h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Who is Out?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setWhoIsOut('striker')}
                                        className={`p-4 border rounded-xl font-bold text-sm transition-all ${whoIsOut === 'striker' ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        {getPlayerName(selectedStriker) || 'Striker'}
                                    </button>
                                    <button
                                        onClick={() => setWhoIsOut('nonStriker')}
                                        className={`p-4 border rounded-xl font-bold text-sm transition-all ${whoIsOut === 'nonStriker' ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                                    >
                                        {getPlayerName(selectedNonStriker) || 'Non-Striker'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Method</label>
                                <select
                                    className="w-full form-select rounded-xl border-slate-200 font-semibold disabled:bg-slate-50"
                                    value={wicketType}
                                    onChange={(e) => setWicketType(e.target.value)}
                                    disabled={match.freeHit}
                                >
                                    {match.freeHit ? (
                                        <option value="runout">Run Out (Free Hit)</option>
                                    ) : (
                                        <>
                                            <option value="caught">Caught</option>
                                            <option value="bowled">Bowled</option>
                                            <option value="lbw">LBW</option>
                                            <option value="runout">Run Out</option>
                                            <option value="stumped">Stumped</option>
                                            <option value="hitWicket">Hit Wicket</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {['caught', 'runout', 'stumped'].includes(wicketType) && (
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Fielder</label>
                                    <select
                                        className="w-full form-select rounded-xl border-slate-200 font-semibold"
                                        value={fielderId}
                                        onChange={(e) => setFielderId(e.target.value)}
                                    >
                                        <option value="">Select Fielder...</option>
                                        {bowlingPlayingXI.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Incoming Batter</label>
                                <select
                                    className="w-full form-select rounded-xl border-blue-200 bg-blue-50 text-blue-900 font-bold"
                                    value={nextBatterId}
                                    onChange={(e) => setNextBatterId(e.target.value)}
                                >
                                    <option value="">Select Batter...</option>
                                    {availableBatters.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setWicketModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleWicketConfirm}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/30"
                                >
                                    Confirm Wicket
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEXT BATTER MODAL */}
            {nextBatterModalOpen && (
                <div className="fixed inset-0 z-[110] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border-t-4 border-blue-600">
                        <div className="p-6 space-y-5">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <UserPlus size={32} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">New Batter</h2>
                                <p className="text-slate-500 text-sm font-medium">Select the next player to come to the crease</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block text-center">Incoming Batter</label>
                                <select
                                    className="w-full form-select h-14 rounded-xl border-blue-200 bg-blue-50 text-blue-900 font-bold text-lg text-center"
                                    value={nextBatterId}
                                    onChange={(e) => setNextBatterId(e.target.value)}
                                >
                                    <option value="">Choose Batter...</option>
                                    {availableBatters.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleNextBatterConfirm}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95"
                            >
                                Send to Crease
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveScoring;
