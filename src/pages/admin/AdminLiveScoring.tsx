import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { matchService } from '@/services/firestore/matches';
import { playerService } from '@/services/firestore/players';
import { addBall, BallUpdateResult } from '@/services/matchEngine/ballUpdateService';
import * as emailService from '@/services/emailService';
import { recalculateInnings } from '@/services/matchEngine/recalculateInnings';
import { Match, InningsStats, Player } from '@/types';
import {
    Loader2,
    CheckCircle,
    RotateCcw,
    ArrowRightLeft,
    UserPlus,
    Trophy,
    Activity,
    Megaphone,
    Send,
    SwitchCamera,
    X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getMatchResultString, calculateMatchWinner } from '@/utils/matchWinner';
import { calculatePotM } from '@/utils/potmCalculator';
import * as commentaryService from '@/services/commentary/commentaryService';
import { oneSignalService } from '@/services/oneSignalService';
import { useAuthStore } from '@/store/authStore';

const AdminLiveScoring = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuthStore();

    // --- State ---
    const [match, setMatch] = useState<Match | null>(null);
    const [inningsA, setInningsA] = useState<InningsStats | null>(null);
    const [inningsB, setInningsB] = useState<InningsStats | null>(null);
    const [inningsASO, setInningsASO] = useState<InningsStats | null>(null);
    const [inningsBSO, setInningsBSO] = useState<InningsStats | null>(null);

    // Players State
    const [teamAPlayers, setTeamAPlayers] = useState<Player[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<Player[]>([]);
    const [inningsBalls, setInningsBalls] = useState<any[]>([]);
    const [playersLoaded, setPlayersLoaded] = useState(false);

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const processingRef = useRef(false);

    // Selection Inputs
    const [selectedStriker, setSelectedStriker] = useState<string>('');
    const [selectedNonStriker, setSelectedNonStriker] = useState<string>('');
    const [selectedBowler, setSelectedBowler] = useState<string>('');

    // Scoring Inputs
    const [runInput, setRunInput] = useState<number | null>(null);
    const [extras, setExtras] = useState({ wide: false, noBall: false, bye: false, legBye: false, penalty: false });
    const [wicketModalOpen, setWicketModalOpen] = useState(false);
    const [nextBatterModalOpen, setNextBatterModalOpen] = useState(false);
    const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
    const [undoModalOpen, setUndoModalOpen] = useState(false);
    const [sendMailChecked, setSendMailChecked] = useState(false);

    // Wicket Modal State
    const [wicketType, setWicketType] = useState('caught');
    const [whoIsOut, setWhoIsOut] = useState<'striker' | 'nonStriker'>('striker');
    const [nextBatterId, setNextBatterId] = useState('');
    const [fielderId, setFielderId] = useState('');
    const [manualCommentary, setManualCommentary] = useState('');
    const [potmId, setPotmId] = useState<string>('');
    const [suggestedPotm, setSuggestedPotm] = useState<Player | null>(null);
    const [lastCommentary, setLastCommentary] = useState<string>('');
    const [nextBowlerModalOpen, setNextBowlerModalOpen] = useState(false);
    const [nextBowlerId, setNextBowlerId] = useState('');
    const [batterTargetEnd, setBatterTargetEnd] = useState<'striker' | 'nonStriker' | null>(null);

    // Permissions check
    useEffect(() => {
        if (!authLoading && match && user) {
            const isSuperAdmin = user.role === 'super_admin';
            const isOwner = match.adminId === user.uid || (match as any).createdBy === user.uid;

            if (!isSuperAdmin && !isOwner) {
                toast.error("Access Denied: You don't have permission to score this match.");
                navigate('/admin/live');
            }
        }
    }, [match, authLoading, user, navigate]);

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
        const unsubInnASO = matchService.subscribeToInnings(matchId, 'teamA_super', (data) => setInningsASO(data));
        const unsubInnBSO = matchService.subscribeToInnings(matchId, 'teamB_super', (data) => setInningsBSO(data));

        const unsubComm = commentaryService.subscribeToCommentary(matchId, (items) => {
            if (items.length > 0) {
                setLastCommentary(items[items.length - 1].text);
            }
        });

        // Subscribe to current innings balls for fast local recalculation
        const currentInningId = match?.currentBatting || 'teamA';
        const unsubBalls = matchService.subscribeToBalls(matchId, currentInningId as any, (balls) => {
            setInningsBalls(balls);
        });

        return () => {
            unsubMatch();
            unsubInn && unsubInn();
            unsubInnB && unsubInnB();
            unsubInnASO && unsubInnASO();
            unsubInnBSO && unsubInnBSO();
            unsubComm();
            unsubBalls();
        };
    }, [matchId, match?.currentBatting]);

    // --- Player of the Match Logic ---
    useEffect(() => {
        const shouldCalculate = (finalizeModalOpen || match?.status === 'finished') && match && inningsA && inningsB && teamAPlayers.length > 0 && teamBPlayers.length > 0;
        if (shouldCalculate) {
            const suggested = calculatePotM(match, inningsA, inningsB, teamAPlayers, teamBPlayers);
            if (suggested) {
                setSuggestedPotm(suggested);
                // IF no manual choice yet, default to auto-suggestion
                if (!potmId && !match.playerOfTheMatch) {
                    setPotmId(suggested.id);
                    // Auto-save if match is finished and no PotM set yet
                    if (match.status === 'finished' && !match.playerOfTheMatch && matchId) {
                        matchService.update(matchId, { playerOfTheMatch: suggested.id }).catch(() => { });
                    }
                }
            }
        }
    }, [finalizeModalOpen, match?.status, match, inningsA, inningsB, teamAPlayers, teamBPlayers, potmId]);

    // --- Auto-trigger select if missing ---
    // DISABLED: User requested no auto-popup on entry. 
    // Manual selection enabled via clicking on names.
    /*
    useEffect(() => {
        if (match?.status === 'live' && !match.matchPhase?.toLowerCase().includes('break')) {
            if (!selectedStriker && !nextBatterModalOpen) {
                setBatterTargetEnd('striker');
                setNextBatterModalOpen(true);
            } else if (!selectedNonStriker && !nextBatterModalOpen) {
                setBatterTargetEnd('nonStriker');
                setNextBatterModalOpen(true);
            } else if (!selectedBowler && !nextBowlerModalOpen) {
                setNextBowlerModalOpen(true);
            }
        }
    }, [match?.status, match?.matchPhase, selectedStriker, selectedNonStriker, selectedBowler, nextBatterModalOpen, nextBowlerModalOpen]);
    */

    // --- Fetch Players Logic ---
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!match) return;
            try {
                // 1. Determine team IDs
                const teamAId = (match as any).teamASquadId || (match as any).teamAId || (match as any).teamA || '';
                const teamBId = (match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB || '';

                if (!teamAId || !teamBId) {
                    console.warn("[AdminLiveScoring] Missing team IDs");
                    return;
                }

                // 2. Initial Squad Fetch
                let [pA, pB] = await Promise.all([
                    playerService.getBySquad(String(teamAId)),
                    playerService.getBySquad(String(teamBId))
                ]);

                // 3. ROBUSTNESS: Ensure players in Playing XI are included
                // Sometimes players are in the XI but not correctly linked to the squadId in Firestore
                const xiA = match.teamAPlayingXI || [];
                const xiB = match.teamBPlayingXI || [];

                const missingA = xiA.filter(id => !pA.some(p => p.id === id));
                const missingB = xiB.filter(id => !pB.some(p => p.id === id));

                if (missingA.length > 0) {
                    console.log(`[AdminLiveScoring] Fetching ${missingA.length} missing players for Team A`);
                    const extraA = await playerService.getByIds(missingA);
                    pA = [...pA, ...extraA];
                }
                if (missingB.length > 0) {
                    console.log(`[AdminLiveScoring] Fetching ${missingB.length} missing players for Team B`);
                    const extraB = await playerService.getByIds(missingB);
                    pB = [...pB, ...extraB];
                }

                setTeamAPlayers(sortPlayersByRole(pA));
                setTeamBPlayers(sortPlayersByRole(pB));
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
    const isTeamB = match?.currentBatting === 'teamB' || match?.currentBatting === 'teamB_super';
    const isSuper = match?.isSuperOver || String(match?.currentBatting || '').includes('super');

    const currentInnings = useMemo(() => {
        if (!match) return null;
        const cb = match.currentBatting;
        if (cb === 'teamA') return inningsA;
        if (cb === 'teamB') return inningsB;
        if (cb === 'teamA_super') return inningsASO;
        if (cb === 'teamB_super') return inningsBSO;
        return null;
    }, [match, inningsA, inningsB, inningsASO, inningsBSO]);

    const battingTeamPlayersAll = isTeamB ? teamBPlayers : teamAPlayers;
    const bowlingTeamPlayersAll = isTeamB ? teamAPlayers : teamBPlayers;

    // Resolve Real Player Objects based on Playing XI IDs


    const sortPlayersByRole = (players: Player[]) => {
        return [...players].sort((a, b) => {
            const roleA = (a.role || '').toLowerCase();
            const roleB = (b.role || '').toLowerCase();

            const getPriority = (r: string) => {
                if (r.includes('batsman') || r.includes('batter')) return 1;
                if (r.includes('keeper') || r === 'wk') return 2;
                if (r.includes('all-rounder') || r.includes('all rounder') || r.includes('allrounder')) return 3;
                if (r.includes('bowler')) return 4;
                return 99;
            };

            const priorityA = getPriority(roleA);
            const priorityB = getPriority(roleB);

            if (priorityA !== priorityB) return priorityA - priorityB;
            return (a.name || '').localeCompare(b.name || '');
        });
    };

    const resolvePlayers = (playerIds: string[], sourceList: Player[]) => {
        const list = (playerIds || []).map(id => sourceList.find(p => p.id === id)).filter(Boolean) as Player[];
        return sortPlayersByRole(list);
    };

    const battingPlayingXI = useMemo(() => {
        const xiIds = isTeamB ? match?.teamBPlayingXI : match?.teamAPlayingXI;
        // FALLBACK: If no specific Playing XI is set, show all players from the squad
        if (!xiIds || xiIds.length === 0) return battingTeamPlayersAll;
        const resolved = resolvePlayers(xiIds, battingTeamPlayersAll);
        // If resolved list is empty (IDs didn't match), also fall back to all players
        return resolved.length > 0 ? resolved : battingTeamPlayersAll;
    }, [match, isTeamB, battingTeamPlayersAll]);

    const bowlingPlayingXI = useMemo(() => {
        const xiIds = isTeamB ? match?.teamAPlayingXI : match?.teamBPlayingXI;
        // FALLBACK: If no specific Playing XI is set, show all players from the squad
        if (!xiIds || xiIds.length === 0) return bowlingTeamPlayersAll;
        const resolved = resolvePlayers(xiIds, bowlingTeamPlayersAll);
        // If resolved list is empty (IDs didn't match), also fall back to all players
        return resolved.length > 0 ? resolved : bowlingTeamPlayersAll;
    }, [match, isTeamB, bowlingTeamPlayersAll]);

    const dismissedIds = useMemo(() => {
        return currentInnings?.fallOfWickets?.map(w => w.batsmanId) || [];
    }, [currentInnings]);

    const availableBatters = useMemo(() => {
        if (!battingPlayingXI) return [];
        const atCrease = [match?.currentStrikerId, match?.currentNonStrikerId].filter(Boolean);
        return battingPlayingXI.filter(p => !atCrease.includes(p.id!) && !dismissedIds.includes(p.id));
    }, [battingPlayingXI, match, dismissedIds]);

    const isAllOut = useMemo(() => {
        if (!currentInnings || !battingPlayingXI.length) return false;
        return (currentInnings.totalWickets || 0) >= (battingPlayingXI.length - 1);
    }, [currentInnings, battingPlayingXI]);

    const isFinished = match?.status?.toLowerCase() === 'finished';

    const isInningsComplete = useMemo(() => {
        if (!match || !currentInnings) return false;
        if (isFinished) return true;
        if (isAllOut) return true;
        const maxOvers = match.oversLimit || 5; // Use 5 as a sensible default if oversLimit is missing
        return (currentInnings.legalBalls || 0) >= (maxOvers * 6);
    }, [match, currentInnings, isFinished, isAllOut]);

    const getPlayerName = (id: string) => {
        const p = [...teamAPlayers, ...teamBPlayers].find(x => x.id === id);
        return p?.name || 'Unknown';
    };

    // --- Handlers ---


    const handleScoreClick = (r: number) => {
        setRunInput(r);
    };

    const handleSwapStrike = async () => {
        if (!matchId || !selectedStriker || !selectedNonStriker) return;
        setProcessing(true);
        try {
            await matchService.update(matchId, {
                currentStrikerId: selectedNonStriker,
                currentNonStrikerId: selectedStriker
            });
            toast.success('Strike Swapped!');
        } catch (err: any) {
            toast.error('Failed to swap strike');
        } finally {
            setProcessing(false);
        }
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

    const executeUndo = async () => {
        if (processing) return;
        if (!matchId || !match) {
            console.warn("[AdminLiveScoring] Undo blocked: match data not loaded.", { matchId, hasMatch: !!match });
            toast.error("Match data loading, please wait...");
            return;
        }

        // Determine which innings to undo. 
        // Fallback to teamA if currentBatting is missing or empty.
        let inningKv = match.currentBatting || 'teamA';
        console.log(`[AdminLiveScoring] executeUndo triggered. matchId: ${matchId}, currentBatting: ${match.currentBatting || 'N/A'}`);

        if (!match.currentBatting) {
            console.log("[AdminLiveScoring] currentBatting missing in match doc, defaulting to teamA for undo check.");
        }

        setProcessing(true);
        try {
            console.log(`[AdminLiveScoring] Starting undo for ${inningKv}...`);

            let balls = await matchService.getBalls(matchId, inningKv as any);

            // If current innings has no balls, try to undo from the previous innings
            if (balls.length === 0) {
                if (inningKv === 'teamB' && (!inningsB || (inningsB.legalBalls || 0) === 0)) {
                    console.log("[AdminLiveScoring] No balls in Team B. Switching to Team A for undo.");
                    inningKv = 'teamA';
                    balls = await matchService.getBalls(matchId, inningKv as any);
                }
            }

            if (balls.length === 0) {
                toast.error("No balls to undo");
                setProcessing(false);
                return;
            }

            const ballToUndo = balls[balls.length - 1];
            console.log("[AdminLiveScoring] Ball to undo:", ballToUndo.id, "at", ballToUndo.timestamp);

            // --- Revert State Logic ---
            const legalBalls = balls.filter(b => b.isLegal !== false);
            const isLastBallOfOver = legalBalls.length % 6 === 0 && ballToUndo.isLegal !== false;

            // Directly use the players from the ball being undone. This is much safer than manual swapping.
            let nextStriker = ballToUndo.batsmanId;
            let nextNonStriker = ballToUndo.nonStrikerId;
            let nextBowler = ballToUndo.bowlerId;

            // 1. Was it a wicket? If so, the out player is already captured in ballToUndo.batsmanId/nonStrikerId
            // No extra logic needed for wicket restoration if we use the ball's original data.

            // 2. Special case: If striker and non-striker are somehow the same in the database (bug safety)
            if (nextStriker === nextNonStriker) {
                // Try to find if one of them should be a new player or just leave it for manual fix
                console.warn("[AdminLiveScoring] Undo detected identical player IDs in ball record.");
            }

            // --- Database Sync ---
            // 1. Delete actual ball
            await matchService.deleteBall(matchId, inningKv as any, ballToUndo.id);

            // 2. Delete linked commentary
            await commentaryService.deleteCommentaryForBall(matchId, ballToUndo.id);

            // 3. Recalculate stats - This updates the innings document and some match fields
            await recalculateInnings(matchId, inningKv as any, { useTransaction: false });

            // 4. Determine Match Document Reversion
            const updates: any = {
                currentBatting: inningKv,
                currentStrikerId: nextStriker,
                currentNonStrikerId: nextNonStriker,
                currentBowlerId: nextBowler,
                updatedAt: Timestamp.now()
            };

            const statusLower = String(match.status || '').toLowerCase();
            const phaseLower = String(match.matchPhase || '').toLowerCase();

            // IF match was finished or in break, or if we are back in Team A, bring it back to LIVE
            const isTeamA = inningKv === 'teamA';
            const wasFinished = statusLower === 'finished' || statusLower === 'inningsbreak' || phaseLower === 'finished' || phaseLower === 'inningsbreak' || statusLower === 'innings break';

            if (wasFinished || isTeamA) {
                updates.status = 'live';
                updates.matchPhase = isTeamA ? 'FirstInnings' : 'SecondInnings';

                // Clear results
                updates.winnerId = null;
                updates.resultSummary = null;
                updates.winner = null;
                updates.matchResult = null;
                updates.matchResultText = null;

                // Sync Player stats - remove from history if it was finished
                if (statusLower === 'finished' || phaseLower === 'finished') {
                    await matchService.removeMatchStatsFromPlayers(matchId).catch(err => {
                        console.error("Failed to remove match stats from players:", err);
                    });
                }

                // IF undoing from/back to Team A, clear the "finalized" first innings fields
                if (isTeamA) {
                    updates.innings1Score = 0;
                    updates.innings1Wickets = 0;
                    updates.innings1Overs = "0.0";
                    updates.target = 0;
                }
            }

            if (isLastBallOfOver) {
                updates.lastOverBowlerId = '';
            }

            await matchService.update(matchId, updates);
            toast.success("Last ball undone successfully");
        } catch (err) {
            console.error("Undo failed:", err);
            toast.error("Failed to undo last ball");
        } finally {
            setProcessing(false);
        }
    };

    const triggerLiveNotification = async (message: string, eventIcon?: string) => {
        if (!match || !matchId) return;

        try {
            const tournament = (match as any).tournamentName || (match as any).matchType || 'Match';

            // Professional Title: Team1 vs Team2, MatchNo (Tournament)
            const title = `${match.teamAName} vs ${match.teamBName}${match.matchNo ? `, ${match.matchNo}` : ''} (${tournament})`;

            // Resolve Batting Team Logo
            const battingTeamLogo = match.currentBatting === 'teamA' ? (match as any).teamALogoUrl : (match as any).teamBLogoUrl;

            await oneSignalService.sendToMatch(
                matchId,
                (match as any)?.adminId || (match as any)?.createdBy || 'admin',
                title,
                message,
                undefined, // Default URL
                eventIcon || battingTeamLogo,
                [
                    { id: 'open_match', text: 'Open Match', icon: 'ic_menu_view' },
                    { id: 'turn_off', text: `Turn off for ${match.teamAName} vs ${match.teamBName}`, icon: 'ic_menu_close_clear_cancel' }
                ],
                `match_score_${matchId}` // Persistent collapse ID for score updates
            );
        } catch (err) {
            console.error("[AdminLiveScoring] Notification helper failed:", err);
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
        if (processingRef.current) return;

        if (isInningsComplete) {
            toast.error("Innings or match is complete");
            return;
        }

        processingRef.current = true;
        setProcessing(true);

        const inningKv = match.currentBatting || 'teamA';
        const runs = runInput || 0;

        let batRuns = runs;

        // Force 0 runs for standard dismissal types to prevent generic 'W+Runs' errors
        // (e.g. User selects 6 then clicks OUT -> Caught). 
        // Only Run Out, Obstructing, etc. can have runs attached.
        if (wicketData) {
            const allowRuns = ['runout', 'obstructing', 'hitBallTwice'].includes(wicketData.type);
            if (!allowRuns) {
                batRuns = 0;
            }
        }

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
            // Speed optimization: Pass local balls count to avoid getDocs(balls) in service
            const result: BallUpdateResult = await addBall(matchId, inningKv as any, payload, {
                sequence: inningsBalls.length + 1,
                previousBalls: inningsBalls
            });
            if (!result.success) throw new Error(result.error);

            // Execute commentary and notifications in BACKGROUND (don't await) 
            // to make UI instant
            (async () => {
                try {
                    const strikerObj = battingTeamPlayersAll.find(p => p.id === selectedStriker);
                    const nonStrikerObj = battingTeamPlayersAll.find(p => p.id === selectedNonStriker);
                    const bowlerObj = bowlingTeamPlayersAll.find(p => p.id === selectedBowler);

                    const ballInnings = result.inningsData;
                    const totalBallRuns = batRuns + wideVal + nbVal + byeVal + lbVal + penaltyVal;
                    const isLegalBall = !extras.wide && !extras.noBall;

                    const currentLegalBalls = ballInnings?.legalBalls || 0;
                    const currentOverNumber = isLegalBall
                        ? Math.floor((currentLegalBalls - 1) / 6) + 1
                        : Math.floor(currentLegalBalls / 6) + 1;

                    // For commentary, even if a ball is wide, we want to show it as the X.Y ball of the over
                    // If legalBalls = 24 (4.0 overs), and next ball is wide, it's the 1st ball of the 5th over (4.1)
                    const overLabel = isLegalBall
                        ? ballInnings?.overs
                        : `${Math.floor(currentLegalBalls / 6)}.${(currentLegalBalls % 6) + 1}`;

                    await commentaryService.generateAutoCommentary(matchId, inningKv as any, {
                        runs: batRuns,
                        totalRuns: totalBallRuns,
                        ballType: extras.wide ? 'wide' : extras.noBall ? 'no-ball' : extras.bye ? 'bye' : extras.legBye ? 'leg-bye' : 'normal',
                        wicketType: wicketData?.type || null,
                        batsman: strikerObj?.name || 'Batter',
                        nonStriker: nonStrikerObj?.name || 'Non-Striker',
                        bowler: bowlerObj?.name || 'Bowler',
                        isBoundary: batRuns === 4 || batRuns === 6,
                        isFour: batRuns === 4,
                        isSix: batRuns === 6,
                        over: overLabel || '0.0',
                        overNumber: currentOverNumber,
                        ball: (currentLegalBalls % 6) + (isLegalBall ? 0 : 1),
                        ballDocId: result.ballId,
                        style: 'tv',
                        matchContext: {
                            currentScore: ballInnings?.totalRuns,
                            wickets: ballInnings?.totalWickets,
                        }
                    });

                    // 1. Wicket Notification
                    if (wicketData) {
                        const scoreMsg = `${ballInnings?.totalRuns || 0}/${ballInnings?.totalWickets || 0} (${ballInnings?.overs || '0.0'} ov)`;
                        const wktMsg = `Wicket: ${strikerObj?.name || 'Batter'} is OUT! 🔴\n${scoreMsg}`;
                        triggerLiveNotification(wktMsg);
                    }

                    // 2. Milestones (50/100)
                    const batsmanStats = ballInnings?.batsmanStats?.find((s: any) => s.batsmanId === selectedStriker);
                    if (batsmanStats) {
                        const currentRuns = batsmanStats.runs || 0;
                        const preRuns = currentRuns - batRuns;
                        if (currentRuns >= 100 && preRuns < 100) {
                            triggerLiveNotification(`CENTURY! 💯🏏\n${batsmanStats.batsmanName} scored a MASSIVE 100! 🌟`);
                        } else if (currentRuns >= 50 && preRuns < 50) {
                            triggerLiveNotification(`Milestone! 🏏✨\n${batsmanStats.batsmanName} reached 50 runs! 🔥`);
                        }
                    }
                } catch (commErr) {
                    console.error("[AdminLiveScoring] Notification/Commentary failed:", commErr);
                }
            })();

            // Innings Completion Notification
            const overLimit = ((match as any)?.oversLimit || 5) * 6;
            const legalBallsAfter = result.inningsData?.legalBalls || 0;
            const wicketsAfter = result.inningsData?.totalWickets || 0;
            const isFinalBall = legalBallsAfter >= overLimit;
            const isFinalWicket = wicketsAfter >= (battingPlayingXI.length - 1);

            if (isFinalBall || isFinalWicket) {
                const teamName = match?.currentBatting === 'teamA' ? match?.teamAName : match?.teamBName;
                const finishMsg = `Innings Finished! ☕\n${teamName} finished at ${result.inningsData?.totalRuns}/${result.inningsData?.totalWickets} (${result.inningsData?.overs} ov)`;
                triggerLiveNotification(finishMsg);
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

                // Only show next batter modal if not all out and not end of innings
                if (!isFinalBall && !isFinalWicket) {
                    setTimeout(() => setNextBatterModalOpen(true), 500);
                }
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

                if (!isFinalBall && !isFinalWicket) {
                    setTimeout(() => setNextBowlerModalOpen(true), 500);
                }
            }

            // Update Match State if changed
            if (nextStriker !== match.currentStrikerId) updates.currentStrikerId = nextStriker;
            if (nextNonStriker !== match.currentNonStrikerId) updates.currentNonStrikerId = nextNonStriker;
            if (nextBowler !== match.currentBowlerId) updates.currentBowlerId = nextBowler;

            if (Object.keys(updates).length > 0) {
                await matchService.update(matchId, updates);
            }

            // INSTANT UI UPDATE: Manually update local innings state to avoid 1-ball delay from subscription
            if (inningKv === 'teamA') setInningsA(result.inningsData);
            else if (inningKv === 'teamB') setInningsB(result.inningsData);
            else if (inningKv === 'teamA_super') setInningsASO(result.inningsData);
            else if (inningKv === 'teamB_super') setInningsBSO(result.inningsData);

            setRunInput(null);
            setExtras({ wide: false, noBall: false, bye: false, legBye: false, penalty: false });
            toast.success("Ball added");

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Failed to update score');
        } finally {
            processingRef.current = false;
            setProcessing(false);
            setWicketModalOpen(false);
        }
    };

    const handleWicketConfirm = () => {
        if (processingRef.current) return;
        if (isInningsComplete) {
            toast.error("Innings or match is already complete");
            setWicketModalOpen(false);
            return;
        }
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

        const otherBatterId = batterTargetEnd === 'striker' ? selectedNonStriker : selectedStriker;
        if (nextBatterId === otherBatterId) {
            toast.error("Player already at crease!");
            return;
        }

        try {
            const field = batterTargetEnd === 'striker' ? 'currentStrikerId' :
                (batterTargetEnd === 'nonStriker' ? 'currentNonStrikerId' :
                    (!selectedStriker ? 'currentStrikerId' : 'currentNonStrikerId'));

            await matchService.update(matchId, { [field]: nextBatterId });
            setNextBatterModalOpen(false);
            setNextBatterId('');
            setBatterTargetEnd(null);
            toast.success("New batter arrived at crease");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update next batter");
        }
    };

    const handleNextBowlerConfirm = async () => {
        if (!nextBowlerId || !matchId) {
            toast.error("Please select the next bowler.");
            return;
        }
        if (match?.lastOverBowlerId === nextBowlerId) {
            toast.error("Same bowler cannot bowl consecutive overs!");
            return;
        }
        try {
            setProcessing(true);
            await matchService.update(matchId, { currentBowlerId: nextBowlerId });
            setNextBowlerModalOpen(false);
            setNextBowlerId('');
            toast.success("New bowler ready!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update bowler");
        } finally {
            setProcessing(false);
        }
    };

    const handleManualCommentarySubmit = async () => {
        if (!manualCommentary.trim() || !matchId || !match) return;
        setProcessing(true);
        try {
            const currentInn = match.currentBatting === 'teamB' ? inningsB : inningsA;
            await commentaryService.addManualCommentary(
                matchId,
                (match.currentBatting as any) || 'teamA',
                manualCommentary,
                currentInn?.overs || '0.0',
                0, 0, false, false
            );

            // Send Push Notification for manual highlight
            if (manualCommentary) {
                triggerLiveNotification(`Live Update 📢\n${manualCommentary}`);
            }
            setManualCommentary('');
            toast.success("Commentary added!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to add commentary");
        } finally {
            setProcessing(false);
        }
    };

    const handleFinalizeConfirm = async () => {
        if (!matchId || !match) return;
        setProcessing(true);
        try {
            // 1. Calculate Winner ID for the points table
            const finalResult = resultSummary; // Use memoized result which includes SO
            let winnerSquadId: string | null = null;

            // Check Super Over result first
            const soAR = Number(inningsASO?.totalRuns || 0);
            const soBR = Number(inningsBSO?.totalRuns || 0);
            const mainAR = Number(inningsA?.totalRuns || 0);
            const mainBR = Number(inningsB?.totalRuns || 0);
            const hasSO = match.isSuperOver && (soAR > 0 || soBR > 0);

            if (hasSO && match) {
                if (soAR > soBR) winnerSquadId = (match as any).teamASquadId || (match as any).teamAId || (match as any).teamA || undefined;
                else if (soBR > soAR) winnerSquadId = (match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB || undefined;
            } else if (match) {
                if (mainAR > mainBR) winnerSquadId = (match as any).teamASquadId || (match as any).teamAId || (match as any).teamA || undefined;
                else if (mainBR > mainAR) winnerSquadId = (match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB || undefined;
            }

            // 2. Update Match Status (Triggers stats sync in service)
            const chosenPotmId = potmId || suggestedPotm?.id || undefined;

            await matchService.update(matchId, {
                status: 'finished',
                matchPhase: 'finished',
                playerOfTheMatch: chosenPotmId,
                resultSummary: finalResult,
                winnerId: winnerSquadId ? (winnerSquadId as string) : undefined
            });

            // 3. Send Push Notification for Match Result
            if (finalResult) {
                triggerLiveNotification(`Match Ended! 🏆\n${finalResult}`);
            }
            // 4. Send Emails if requested
            if (sendMailChecked && match) {
                const emailToastId = toast.loading("Sending personalized scores to Playing XI...");
                const emailResult = await emailService.sendMatchEndEmails(matchId, resultSummary);

                if (emailResult && emailResult.success) {
                    toast.success("Scores sent successfully!", { id: emailToastId });
                } else {
                    toast.error("Match finished, but score emails failed.", { id: emailToastId });
                }
            }

            toast.success("Match Finalized!");
            setFinalizeModalOpen(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to finalize: " + error.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleStartSuperOver = async () => {
        if (!matchId || !match) return;
        if (!window.confirm("ARE YOU SURE? This will start a 1-over Super Over without deleting main match scores!")) return;

        setProcessing(true);
        try {
            // 1. Determine Batting Order for Super Over
            // ICC Rule: Team batting second in the match will bat first in the Super Over.
            // If matchPhase is 'Tied', currentBatting is the team that just finished 2nd innings.
            const battedSecond = match.currentBatting || 'teamB';
            const firstBatInSO = battedSecond; // teamA or teamB
            const firstBatSOInningId = firstBatInSO === 'teamA' ? 'teamA_super' : 'teamB_super';

            // 2. Store stats if not already stored
            const mainScore = match.isSuperOver ? match.mainMatchScore : {
                teamA: { runs: inningsA?.totalRuns || 0, wickets: inningsA?.totalWickets || 0, overs: inningsA?.overs || "0.0" },
                teamB: { runs: inningsB?.totalRuns || 0, wickets: inningsB?.totalWickets || 0, overs: inningsB?.overs || "0.0" }
            };

            // 3. Setup New Innings for Super Over
            await matchService.setupSuperOver(matchId, 'teamA_super');
            await matchService.setupSuperOver(matchId, 'teamB_super');

            // 4. Update Match Document
            await matchService.update(matchId, {
                status: 'live',
                matchPhase: 'FirstInnings', // Re-use phase for SO 1st inn
                oversLimit: 1,
                isSuperOver: true,
                superOverCount: (match.superOverCount || 0) + 1,
                mainMatchScore: mainScore,
                currentBatting: firstBatSOInningId,
                currentStrikerId: '',
                currentNonStrikerId: '',
                currentBowlerId: '',
                // DO NOT reset innings1Score/Wickets/Overs or target here,
                // as they relate to the main match and are used for display/scorecard.
                // The Super Over will manage its own score in the 'score' map and innings docs.
                winnerId: undefined,
                resultSummary: undefined
            });

            if (matchId) {
                triggerLiveNotification("SUPER OVER! ⚡\nA Super Over has been initiated! Get ready for the drama!");
            }
            toast.success("Super Over Started!");
            setFinalizeModalOpen(false);
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to start Super Over: " + err.message);
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
            match,
            inningsASO || null,
            inningsBSO || null
        );
    }, [match, inningsA, inningsB, inningsASO, inningsBSO]);


    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}><Loader2 className="w-10 h-10 animate-spin text-teal-600" /></div>;
    if (!match) return <div style={{ padding: '40px', color: 'red', fontWeight: 700, textAlign: 'center' }}>Match not found</div>;

    const battingTeamName = isTeamB ? match.teamBName : match.teamAName;
    const strikerStats = currentInnings?.batsmanStats?.find(b => b.batsmanId === selectedStriker);
    const nonStrikerStats = currentInnings?.batsmanStats?.find(b => b.batsmanId === selectedNonStriker);
    const bowlerStatsData = currentInnings?.bowlerStats?.find(b => b.bowlerId === selectedBowler);
    const thisOverBalls = currentInnings?.currentOverBalls || [];
    const totalExtras = currentInnings?.extras ? (currentInnings.extras.wides || 0) + (currentInnings.extras.noBalls || 0) + (currentInnings.extras.byes || 0) + (currentInnings.extras.legByes || 0) + (currentInnings.extras.penalty || 0) : 0;
    const isBreakOrTied = match.matchPhase?.toLowerCase() === 'inningsbreak' || match.status?.toLowerCase() === 'inningsbreak' || match.matchPhase?.toLowerCase() === 'tied';
    const kbtn = (bg: string, clr: string) => ({ display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: '8px', fontWeight: 800 as const, fontSize: '20px', border: 'none' as const, cursor: 'pointer' as const, background: bg, color: clr, transition: 'transform 0.1s', minHeight: '56px', width: '100%' });

    return (
        <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#e8ecf1', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
            {/* HEADER */}
            <div style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)', color: '#fff', padding: '10px 14px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.8 }}> </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {match.status === 'live' && <span style={{ fontSize: '9px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', letterSpacing: '1px' }}>LIVE</span>}
                        {(!currentInnings || (currentInnings.legalBalls || 0) === 0) && (
                            <button onClick={() => { if (window.confirm(`Switch to ${match.currentBatting === 'teamA' ? match.teamBName : match.teamAName}?`)) { const nb = match.currentBatting === 'teamA' ? 'teamB' : 'teamA'; matchService.update(matchId as string, { currentBatting: nb, currentStrikerId: '', currentNonStrikerId: '', currentBowlerId: '' }); toast.success('Switched!'); } }} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px', cursor: 'pointer' }}><SwitchCamera size={13} /></button>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ width: '100%', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', opacity: 0.9 }}>
                        {match.teamAName} <span style={{ opacity: 0.6, fontSize: '10px' }}>vs</span> {match.teamBName}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '4px', marginRight: '2px' }}>{battingTeamName}</span>
                    <span style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-1px', lineHeight: 1 }}>{currentInnings?.totalRuns || 0}/{currentInnings?.totalWickets || 0}</span>
                    <span style={{ fontSize: '15px', fontWeight: 500, opacity: 0.85 }}>({currentInnings?.overs || '0.0'}/{match.oversLimit || 20})</span>
                    {isSuper && <span style={{ fontSize: '9px', fontWeight: 800, background: '#f59e0b', padding: '2px 6px', borderRadius: '6px' }}>SUPER OVER</span>}
                </div>
                {isSuper && <div style={{ fontSize: '10px', opacity: 0.65, marginTop: '2px' }}>Main: {match.teamAName} {match.mainMatchScore?.teamA?.runs || inningsA?.totalRuns || 0}/{match.mainMatchScore?.teamA?.wickets || inningsA?.totalWickets || 0} • {match.teamBName} {match.mainMatchScore?.teamB?.runs || inningsB?.totalRuns || 0}/{match.mainMatchScore?.teamB?.wickets || inningsB?.totalWickets || 0}</div>}
            </div>

            {isBreakOrTied ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', background: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                        {match.matchPhase?.toLowerCase() === 'tied' ? <Activity size={32} className="text-amber-500" /> : <Megaphone size={32} className="text-blue-600" />}
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', margin: '0 0 4px' }}>{match.matchPhase?.toLowerCase() === 'tied' ? 'Match Tied!' : 'Innings Break'}</h2>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px' }}>{match.matchPhase?.toLowerCase() === 'tied' ? 'Both teams scored equally!' : `${match.currentBatting === 'teamA' ? match.teamAName : match.teamBName} finished.`}</p>
                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 20px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '6px' }}><span style={{ fontWeight: 600, color: '#475569' }}>{match.teamAName}</span><span style={{ fontWeight: 800 }}>{inningsA?.totalRuns || 0}-{inningsA?.totalWickets || 0} <span style={{ fontSize: '12px', color: '#94a3b8' }}>({inningsA?.overs || '0.0'})</span></span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontWeight: 600, color: '#475569' }}>{match.teamBName}</span><span style={{ fontWeight: 800 }}>{inningsB?.totalRuns || 0}-{inningsB?.totalWickets || 0} <span style={{ fontSize: '12px', color: '#94a3b8' }}>({inningsB?.overs || '0.0'})</span></span></div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {match.matchPhase?.toLowerCase() === 'tied' && <button onClick={handleStartSuperOver} disabled={processing} style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>⚡ Super Over</button>}
                        {match.matchPhase?.toLowerCase() === 'tied' && <button onClick={async () => { if (!matchId) return; if (!window.confirm('Finish as TIE?')) return; setProcessing(true); try { await matchService.update(matchId, { status: 'finished', matchPhase: 'finished', winnerId: undefined, resultSummary: 'Match Tied' }); toast.success('Tied!'); } catch (e: any) { toast.error(e.message); } finally { setProcessing(false); } }} disabled={processing} style={{ padding: '10px 20px', background: '#475569', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>🏆 Finish (Tied)</button>}
                        {match.matchPhase?.toLowerCase() === 'inningsbreak' && !isSuper && <button onClick={() => { if (confirm('Start 2nd Innings?')) { const nb = match.currentBatting === 'teamA' ? 'teamB' : 'teamA'; const t = Number((match.currentBatting === 'teamA' ? inningsA : inningsB)?.totalRuns || 0) + 1; matchService.update(matchId!, { status: 'live', matchPhase: 'SecondInnings', currentBatting: nb, target: t, currentStrikerId: '', currentNonStrikerId: '', currentBowlerId: '' }); toast.success('2nd Innings Started!'); } }} style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>▶ Start 2nd Innings</button>}
                        {isSuper && match.matchPhase?.toLowerCase() === 'inningsbreak' && <button onClick={() => { if (confirm('Start SO 2nd Inn?')) { const cb = String(match.currentBatting || ''); const nb = cb.includes('teamA') ? 'teamB_super' : 'teamA_super'; const t = Number(currentInnings?.totalRuns || 0) + 1; matchService.update(matchId!, { status: 'live', matchPhase: 'SecondInnings', currentBatting: nb, target: t, currentStrikerId: '', currentNonStrikerId: '', currentBowlerId: '' }); toast.success('SO 2nd Inn!'); } }} style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>⚡ SO 2nd Inn</button>}
                        {match.matchPhase?.toLowerCase() !== 'tied' && <button onClick={() => setFinalizeModalOpen(true)} style={{ padding: '10px 20px', background: '#1e293b', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Finalize</button>}
                        <button onClick={() => setUndoModalOpen(true)} disabled={processing} style={{ padding: '10px 20px', background: '#fef2f2', color: '#dc2626', fontWeight: 800, borderRadius: '12px', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '13px' }}><RotateCcw size={14} /> Undo</button>
                    </div>
                </div>
            ) : match.status?.toLowerCase() === 'finished' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
                    <div style={{ width: '64px', height: '64px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><Trophy size={32} className="text-green-600" /></div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', margin: '0 0 4px' }}>Match Finished</h2>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px' }}>{resultSummary}</p>

                    {/* Player of the Match Section */}
                    <div style={{ width: '100%', maxWidth: '320px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '16px', padding: '16px', border: '1px solid #fde68a', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', justifyContent: 'center' }}>
                            <Trophy size={16} style={{ color: '#d97706' }} />
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Player of the Match</span>
                        </div>
                        {(() => {
                            const currentPotmId = match.playerOfTheMatch || (match as any).playerOfMatchId || potmId || '';
                            const currentPotmName = currentPotmId ? getPlayerName(currentPotmId) : 'Not Selected';
                            const isAuto = currentPotmId && suggestedPotm && currentPotmId === suggestedPotm.id;
                            return (
                                <>
                                    {currentPotmId && (
                                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#92400e', marginBottom: '10px' }}>
                                            🏆 {currentPotmName}
                                            {isAuto && <span style={{ fontSize: '10px', fontWeight: 700, background: '#d97706', color: '#fff', padding: '2px 6px', borderRadius: '6px', marginLeft: '8px', verticalAlign: 'middle' }}>Auto</span>}
                                        </div>
                                    )}
                                    <select
                                        value={currentPotmId}
                                        onChange={async (e) => {
                                            const newId = e.target.value;
                                            setPotmId(newId);
                                            if (matchId) {
                                                try {
                                                    await matchService.update(matchId, { playerOfTheMatch: newId || undefined });
                                                    toast.success(newId ? `PotM: ${getPlayerName(newId)}` : 'PotM cleared');
                                                } catch (err: any) {
                                                    toast.error('Failed to update PotM');
                                                }
                                            }
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #fde68a', fontWeight: 700, background: '#fff', color: '#1e293b', outline: 'none', fontSize: '13px', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2392400e\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
                                    >
                                        <option value="">Select Player...</option>
                                        {suggestedPotm && <option value={suggestedPotm.id}>⭐ {suggestedPotm.name} (Best Performer)</option>}
                                        <optgroup label={match.teamAName}>{teamAPlayers.map(p => <option key={p.id} value={p.id}>{p.name}{suggestedPotm && p.id === suggestedPotm.id ? ' 🏆' : ''}</option>)}</optgroup>
                                        <optgroup label={match.teamBName}>{teamBPlayers.map(p => <option key={p.id} value={p.id}>{p.name}{suggestedPotm && p.id === suggestedPotm.id ? ' 🏆' : ''}</option>)}</optgroup>
                                    </select>
                                </>
                            );
                        })()}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                        {calculateMatchWinner(match.teamAName, match.teamBName, inningsA, inningsB, match).isTied && <button onClick={handleStartSuperOver} disabled={processing} style={{ padding: '10px 20px', background: '#f59e0b', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>⚡ Super Over</button>}
                        <button onClick={() => setUndoModalOpen(true)} disabled={processing} style={{ padding: '10px 20px', background: '#fef2f2', color: '#dc2626', fontWeight: 800, borderRadius: '12px', border: '1px solid #fecaca', cursor: 'pointer', fontSize: '13px' }}><RotateCcw size={14} /> Undo</button>
                        <button onClick={() => navigate('/admin/matches')} style={{ padding: '10px 20px', background: '#1e293b', color: '#fff', fontWeight: 800, borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Back</button>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* BATSMAN + BOWLER */}
                    <div style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', padding: '6px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>🏏 BATTING STATUS</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.5px' }}>⚡ BOWLING</span>
                        </div>
                        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ flex: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #0d9488', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 900, color: '#0d9488', flexShrink: 0 }}>●</span>
                                    <div style={{ flex: 1 }}>
                                        {selectedStriker ? (
                                            <div
                                                onClick={() => { setBatterTargetEnd('striker'); setNextBatterModalOpen(true); }}
                                                style={{ fontWeight: 800, fontSize: '15px', color: '#1e293b', cursor: 'pointer', padding: '2px 0' }}
                                            >
                                                {getPlayerName(selectedStriker)}
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedStriker}
                                                onChange={(e) => { if (e.target.value) matchService.update(matchId!, { currentStrikerId: e.target.value }); }}
                                                style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #0d9488', background: '#f0fdfa', fontWeight: 700, fontSize: '13px', color: '#0d9488', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230d9488\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                                            >
                                                <option value="">Select Striker...</option>
                                                {(battingPlayingXI || []).filter(p => p.id !== selectedNonStriker && !dismissedIds.includes(p.id!)).map(p => <option key={p.id} value={p.id}>{p.name} ({p.role || 'P'})</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                {strikerStats && <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', marginLeft: '22px' }}>{strikerStats.runs}<sub style={{ fontSize: '11px', fontWeight: 500, color: '#94a3b8' }}>({strikerStats.balls})</sub> <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', marginLeft: '4px' }}>SR {strikerStats.strikeRate?.toFixed(1) || '0.0'}</span></div>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                    <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', color: '#94a3b8', flexShrink: 0 }}>○</span>
                                    <div style={{ flex: 1 }}>
                                        {selectedNonStriker ? (
                                            <div
                                                onClick={() => { setBatterTargetEnd('nonStriker'); setNextBatterModalOpen(true); }}
                                                style={{ fontWeight: 700, fontSize: '14px', color: '#64748b', cursor: 'pointer', padding: '2px 0' }}
                                            >
                                                {getPlayerName(selectedNonStriker)}
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedNonStriker}
                                                onChange={(e) => { if (e.target.value) matchService.update(matchId!, { currentNonStrikerId: e.target.value }); }}
                                                style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid #94a3b8', background: '#f8fafc', fontWeight: 700, fontSize: '13px', color: '#64748b', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                                            >
                                                <option value="">Select Non-Striker...</option>
                                                {(battingPlayingXI || []).filter(p => p.id !== selectedStriker && !dismissedIds.includes(p.id!)).map(p => <option key={p.id} value={p.id}>{p.name} ({p.role || 'P'})</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                {nonStrikerStats && <div style={{ fontSize: '16px', fontWeight: 800, color: '#475569', marginLeft: '22px' }}>{nonStrikerStats.runs}<sub style={{ fontSize: '10px', color: '#94a3b8' }}>({nonStrikerStats.balls})</sub></div>}

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleSwapStrike(); }}
                                    disabled={processing}
                                    style={{
                                        marginLeft: '22px',
                                        marginTop: '10px',
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        color: '#0d9488',
                                        background: '#f0fdfa',
                                        border: '1.5px solid #ccfbf1',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 4px rgba(13, 148, 136, 0.05)'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.background = '#ccfbf1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.background = '#f0fdfa'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <ArrowRightLeft size={13} strokeWidth={2.5} />
                                    SWAP STRIKE
                                </button>
                            </div>
                            <div
                                style={{ flex: 1, textAlign: 'right', borderLeft: '1px solid #f1f5f9', paddingLeft: '8px' }}
                            >
                                {selectedBowler ? (
                                    <div
                                        onClick={() => setNextBowlerModalOpen(true)}
                                        style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b', textAlign: 'right', padding: '2px 0', cursor: 'pointer' }}
                                    >
                                        {getPlayerName(selectedBowler)}
                                    </div>
                                ) : (
                                    <select
                                        value={selectedBowler}
                                        onChange={(e) => { if (e.target.value) matchService.update(matchId!, { currentBowlerId: e.target.value }); }}
                                        style={{ width: '100%', padding: '6px 8px', borderRadius: '8px', border: '1px solid #ef4444', background: '#fff', fontWeight: 700, fontSize: '12px', color: '#dc2626', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23dc2626\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', backgroundSize: '10px' }}
                                    >
                                        <option value="">Bowler...</option>
                                        {bowlingPlayingXI.map(p => { const isLast = p.id === match.lastOverBowlerId; return <option key={p.id} value={p.id} disabled={isLast}>{p.name}{isLast ? ' (Last)' : ''}</option>; })}
                                    </select>
                                )}
                                {bowlerStatsData && <div style={{ marginTop: '4px' }}><div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{bowlerStatsData.wickets}/{bowlerStatsData.runsConceded}</div><div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>({bowlerStatsData.overs})</div></div>}
                            </div>
                        </div>
                    </div>
                    {/* THIS OVER */}
                    <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: '#fff', background: '#0d9488', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>THIS OVER</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {thisOverBalls.map((b: any, i: number) => (
                                <div key={i} style={{
                                    minWidth: '24px',
                                    width: 'auto',
                                    height: '24px',
                                    borderRadius: '12px',
                                    padding: b.value.length > 1 ? '0 5px' : '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: b.value.length > 2 ? '9px' : '10px',
                                    fontWeight: 900,
                                    background: b.type === 'wicket' ? '#dc2626' : b.type === 'boundary' ? '#16a34a' : '#f1f5f9',
                                    color: (b.type === 'wicket' || b.type === 'boundary') ? '#fff' : '#334155',
                                    border: b.type === 'normal' ? '1px solid #e2e8f0' : 'none',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    whiteSpace: 'nowrap'
                                }}>{b.value}</div>
                            ))}
                            {thisOverBalls.length === 0 && <span style={{ fontSize: '12px', color: '#94a3b8' }}>Waiting for ball...</span>}
                        </div>
                    </div>

                    {/* LAST BALL COMMENTARY */}
                    {lastCommentary && (
                        <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <Megaphone size={12} className="text-teal-600" />
                                <span style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', uppercase: 'true', letterSpacing: '0.5px' } as any}>LAST BALL COMMENTARY</span>
                            </div>
                            <p style={{ fontSize: '12px', fontWeight: 600, color: '#334155', margin: 0, lineHeight: 1.4, fontStyle: 'italic' }}>
                                "{lastCommentary}"
                            </p>
                        </div>
                    )}
                    {/* STATS BAR */}
                    <div style={{ background: '#0d9488', padding: '3px 12px', textAlign: 'center' }}><span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{match.matchPhase === 'FirstInnings' ? '1st Innings' : '2nd Innings'}{isSuper ? ' (Super Over)' : ''}</span></div>
                    <div style={{ background: '#fff', padding: '5px 12px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', fontSize: '12px' }}>
                        <div><span style={{ fontWeight: 800, color: '#0d9488' }}>Extras</span> <span style={{ fontWeight: 700, marginLeft: '4px' }}>{totalExtras}</span></div>
                        {match.target ? <div><span style={{ fontWeight: 800, color: '#0d9488' }}>Target</span> <span style={{ fontWeight: 700, marginLeft: '4px' }}>{match.target}</span></div> : null}
                        <div><span style={{ fontWeight: 800, color: '#0d9488' }}>CRR</span> <span style={{ fontWeight: 700, marginLeft: '4px' }}>{currentInnings?.currentRunRate || '0.00'}</span></div>
                        <div><span style={{ fontWeight: 800, color: '#0d9488' }}>RRR</span> <span style={{ fontWeight: 700, marginLeft: '4px' }}>{currentInnings?.requiredRunRate?.toFixed(2) || '—'}</span></div>
                    </div>
                    {match.freeHit && <div style={{ background: '#fbbf24', padding: '5px', textAlign: 'center', fontWeight: 900, fontSize: '12px', color: '#78350f', letterSpacing: '1px', textTransform: 'uppercase' }}>⚡ FREE HIT ⚡</div>}
                    {processing && <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: '#fff', padding: '16px 24px', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}><Loader2 className="animate-spin text-teal-600" size={20} /><span style={{ fontWeight: 700, color: '#334155' }}>Updating...</span></div></div>}

                    {/* KEYPAD */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '6px', gap: '5px', background: '#e8ecf1' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '5px' }}>
                            {[7, 5, 6, 4, 1].map(r => <button key={r} onClick={() => handleScoreClick(r)} disabled={processing || isInningsComplete} style={{ ...kbtn(runInput === r ? '#065f46' : r === 6 ? '#1e40af' : r === 4 ? '#16a34a' : '#94a3b8', '#fff'), fontSize: r === 6 || r === 4 ? '18px' : '16px', padding: '0', minHeight: '52px', opacity: (processing || isInningsComplete) ? 0.5 : 1, boxShadow: runInput === r ? 'inset 0 0 0 3px #10b981' : 'none' }}>{r}</button>)}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '5px' }}>
                            <button onClick={() => { if (isInningsComplete) return; if (match.freeHit) setWicketType('runout'); setWicketModalOpen(true); }} disabled={processing || isInningsComplete} style={{ ...kbtn('#dc2626', '#fff'), fontSize: '18px', padding: '0', minHeight: '52px', opacity: (processing || isInningsComplete) ? 0.5 : 1 }}>W</button>
                            {[3, 2, 0].map(r => <button key={r} onClick={() => handleScoreClick(r)} disabled={processing || isInningsComplete} style={{ ...kbtn(runInput === r ? '#065f46' : '#94a3b8', '#fff'), padding: '0', minHeight: '52px', opacity: (processing || isInningsComplete) ? 0.5 : 1, boxShadow: runInput === r ? 'inset 0 0 0 3px #10b981' : 'none' }}>{r}</button>)}
                            <button onClick={() => setFinalizeModalOpen(true)} style={{ ...kbtn('#0f766e', '#fff'), fontSize: '14px', padding: '0', minHeight: '52px' }}>•••</button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '5px' }}>
                            <button onClick={() => setUndoModalOpen(true)} disabled={processing} style={{ ...kbtn('#475569', '#fff'), fontSize: '10px', padding: '0', minHeight: '52px', letterSpacing: '0.5px' }}>UNDO</button>
                            <button onClick={() => toggleExtra('legBye')} style={{ ...kbtn(extras.legBye ? '#0f766e' : '#64748b', '#fff'), fontSize: '12px', padding: '0', minHeight: '52px', fontWeight: 700 }}>LB</button>
                            <button onClick={() => toggleExtra('bye')} style={{ ...kbtn(extras.bye ? '#0f766e' : '#64748b', '#fff'), fontSize: '12px', padding: '0', minHeight: '52px', fontWeight: 700 }}>BYE</button>
                            <button onClick={() => toggleExtra('noBall')} style={{ ...kbtn(extras.noBall ? '#dc2626' : '#ef4444', '#fff'), fontSize: '12px', padding: '0', minHeight: '52px', fontWeight: 700 }}>NB</button>
                            <button onClick={() => toggleExtra('wide')} style={{ ...kbtn(extras.wide ? '#0f766e' : '#64748b', '#fff'), fontSize: '12px', padding: '0', minHeight: '52px', fontWeight: 700 }}>WD</button>
                        </div>
                        {/* SUBMIT BAR */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: '10px', padding: '8px 12px', marginTop: '2px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selection</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b' }}>{runInput ?? '-'}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Run(s)</span>
                                    {Object.values(extras).some(v => v) && <span style={{ marginLeft: '6px', padding: '2px 8px', borderRadius: '6px', background: '#1e293b', color: '#fff', fontSize: '10px', fontWeight: 700 }}>{Object.entries(extras).filter(([_, v]) => v).map(([k]) => k).join(', ')}</span>}
                                </div>
                            </div>
                            <button onClick={() => { if (validateSubmission()) submitBall(); }} disabled={processing || !selectedBowler || runInput === null} style={{ padding: '10px 24px', background: processing || !selectedBowler || runInput === null ? '#cbd5e1' : '#0d9488', color: '#fff', fontWeight: 800, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: processing || !selectedBowler || runInput === null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: processing || !selectedBowler || runInput === null ? 'none' : '0 4px 12px rgba(13,148,136,0.3)' }}>
                                <CheckCircle size={18} />{processing ? 'Wait...' : 'Submit'}
                            </button>
                        </div>
                        {/* Sync + Commentary */}
                        <div style={{ marginTop: '4px', display: 'flex', gap: '6px' }}>
                            <button onClick={async () => { setProcessing(true); try { await Promise.all([recalculateInnings(matchId!, 'teamA'), recalculateInnings(matchId!, 'teamB'), recalculateInnings(matchId!, 'teamA_super'), recalculateInnings(matchId!, 'teamB_super')]); toast.success('Synced!'); } catch (e) { console.error(e); toast.error('Sync failed'); } finally { setProcessing(false); } }} disabled={processing} style={{ padding: '8px 12px', background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: 700, fontSize: '11px', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><RotateCcw size={12} /> Sync</button>
                            <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                                <input value={manualCommentary} onChange={(e) => setManualCommentary(e.target.value)} placeholder="Announcement..." style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none' }} />
                                <button onClick={handleManualCommentarySubmit} disabled={processing || !manualCommentary.trim()} style={{ padding: '8px 12px', background: '#0d9488', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer' }}><Send size={14} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* WICKET MODAL */}
            {wicketModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', position: 'relative' }}>
                        <button
                            onClick={() => setWicketModalOpen(false)}
                            style={{ position: 'absolute', top: '10px', right: '12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
                        >
                            <X size={16} />
                        </button>
                        <div style={{ background: '#dc2626', padding: '14px', textAlign: 'center' }}><h2 style={{ color: '#fff', fontWeight: 900, fontSize: '18px', margin: 0, letterSpacing: '1px' }}>🏏 WICKET</h2></div>
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Who is Out?</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <button onClick={() => setWhoIsOut('striker')} style={{ padding: '12px', border: whoIsOut === 'striker' ? '2px solid #dc2626' : '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, fontSize: '13px', background: whoIsOut === 'striker' ? '#fef2f2' : '#fff', color: whoIsOut === 'striker' ? '#dc2626' : '#475569', cursor: 'pointer' }}>{getPlayerName(selectedStriker) || 'Striker'}</button>
                                    <button onClick={() => setWhoIsOut('nonStriker')} style={{ padding: '12px', border: whoIsOut === 'nonStriker' ? '2px solid #dc2626' : '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, fontSize: '13px', background: whoIsOut === 'nonStriker' ? '#fef2f2' : '#fff', color: whoIsOut === 'nonStriker' ? '#dc2626' : '#475569', cursor: 'pointer' }}>{getPlayerName(selectedNonStriker) || 'Non-Striker'}</button>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Method</label>
                                <select value={wicketType} onChange={(e) => setWicketType(e.target.value)} disabled={match.freeHit} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '14px' }}>
                                    {match.freeHit ? <option value="runout">Run Out (Free Hit)</option> : <>{['caught', 'bowled', 'lbw', 'runout', 'stumped', 'hitWicket'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/([A-Z])/g, ' $1')}</option>)}</>}
                                </select>
                            </div>
                            {['caught', 'runout', 'stumped'].includes(wicketType) && (
                                <div>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>Fielder</label>
                                    <select value={fielderId} onChange={(e) => setFielderId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: 600 }}>
                                        <option value="">Select Fielder...</option>
                                        {bowlingPlayingXI.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button onClick={() => setWicketModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#475569' }}>Cancel</button>
                                <button onClick={handleWicketConfirm} style={{ flex: 1, padding: '12px', background: '#dc2626', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#fff' }}>Confirm OUT</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* NEXT BATTER MODAL */}
            {nextBatterModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', borderTop: '4px solid #0d9488', position: 'relative' }}>
                        <button
                            onClick={() => { setNextBatterModalOpen(false); setBatterTargetEnd(null); }}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={16} />
                        </button>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '48px', height: '48px', background: '#f0fdfa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserPlus size={24} className="text-teal-600" /></div>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Next Batter</h2>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '-8px 0 4px', fontWeight: 600 }}>{batterTargetEnd ? `Assigning ${batterTargetEnd.charAt(0).toUpperCase() + batterTargetEnd.slice(1)}` : 'Select next player'}</p>
                            <select value={nextBatterId} onChange={(e) => setNextBatterId(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #99f6e4', background: '#f0fdfa', fontWeight: 700, fontSize: '15px', textAlign: 'center' }}>
                                <option value="">Choose Batter...</option>
                                {availableBatters.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                <button onClick={() => { setNextBatterModalOpen(false); setBatterTargetEnd(null); }} style={{ flex: 1, padding: '14px', background: '#f1f5f9', borderRadius: '10px', fontWeight: 700, border: 'none', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={handleNextBatterConfirm} style={{ flex: 1, padding: '14px', background: '#0d9488', borderRadius: '10px', fontWeight: 700, border: 'none', color: '#fff', cursor: 'pointer' }}>Assign</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* NEXT BOWLER MODAL */}
            {nextBowlerModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '400px', overflow: 'hidden', borderTop: '4px solid #0d9488', position: 'relative' }}>
                        <button
                            onClick={() => setNextBowlerModalOpen(false)}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={16} />
                        </button>
                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '48px', height: '48px', background: '#f0fdfa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Activity size={24} className="text-teal-600" /></div>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Next Bowler</h2>
                            <select value={nextBowlerId} onChange={(e) => setNextBowlerId(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #99f6e4', background: '#f0fdfa', fontWeight: 700, fontSize: '15px', textAlign: 'center' }}>
                                <option value="">Choose Bowler...</option>
                                {bowlingPlayingXI.map(p => { const isLast = p.id === match.lastOverBowlerId; return <option key={p.id} value={p.id} disabled={isLast}>{p.name}{isLast ? ' (Last Over)' : ''}</option>; })}
                            </select>
                            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                <button onClick={() => setNextBowlerModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', borderRadius: '10px', fontWeight: 700, border: 'none', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={handleNextBowlerConfirm} disabled={processing} style={{ flex: 1, padding: '14px', background: '#0d9488', borderRadius: '10px', fontWeight: 700, border: 'none', color: '#fff', cursor: 'pointer' }}>{processing ? '...' : 'Assign'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* FINALIZE MODAL */}
            {finalizeModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} className="animate-in fade-in duration-300">
                    <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '380px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }} className="animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setFinalizeModalOpen(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', zIndex: 10 }}
                        >
                            <X size={18} />
                        </button>
                        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px', marginBottom: '8px' }}>
                                <div style={{ width: '56px', height: '56px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle size={32} className="text-emerald-500" />
                                </div>
                                <div style={{ gap: '4px', display: 'flex', flexDirection: 'column' }}>
                                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Finalize Match?</h2>
                                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0, fontWeight: 500 }}>Confirm ending the match and calculating final data.</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <input type="checkbox" checked={sendMailChecked} onChange={(e) => setSendMailChecked(e.target.checked)} style={{ width: '20px', height: '20px', borderRadius: '6px', cursor: 'pointer', accentColor: '#10b981' }} />
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px', display: 'block' }}>Email Scorecards</span>
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Notify all players of results</span>
                                    </div>
                                </label>

                                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <Trophy size={14} className="text-amber-500" />
                                        <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Player of the Match</label>
                                    </div>
                                    <select
                                        value={potmId}
                                        onChange={(e) => setPotmId(e.target.value)}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: 700, background: '#fff', color: '#0f172a', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                                    >
                                        <option value="">Auto Select Winner...</option>
                                        {suggestedPotm && <option value={suggestedPotm.id}>{suggestedPotm.name.toUpperCase()} (Top Perf)</option>}
                                        <optgroup label={match.teamAName}>{teamAPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                                        <optgroup label={match.teamBName}>{teamBPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                                <button onClick={() => setFinalizeModalOpen(false)} style={{ flex: 1, padding: '14px', background: '#f1f5f9', borderRadius: '14px', fontWeight: 800, border: 'none', cursor: 'pointer', color: '#475569', fontSize: '14px' }}>Cancel</button>
                                <button onClick={handleFinalizeConfirm} disabled={processing} style={{ flex: 1, padding: '14px', background: '#0f172a', borderRadius: '14px', fontWeight: 800, border: 'none', cursor: 'pointer', color: '#fff', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.4)' }}>{processing ? 'Calculating...' : 'Confirm'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* UNDO MODAL */}
            {undoModalOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '360px', overflow: 'hidden', position: 'relative' }}>
                        <button
                            onClick={() => setUndoModalOpen(false)}
                            style={{ position: 'absolute', top: '12px', right: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={16} />
                        </button>
                        <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '48px', height: '48px', background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={24} className="text-red-600" /></div>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', margin: 0 }}>Undo Last Ball?</h2>
                            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>This will revert score, stats, and commentary.</p>
                            <div style={{ display: 'flex', gap: '8px', width: '100%', marginTop: '8px' }}>
                                <button onClick={() => setUndoModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#475569' }}>Cancel</button>
                                <button onClick={() => { setUndoModalOpen(false); executeUndo(); }} style={{ flex: 1, padding: '12px', background: '#dc2626', borderRadius: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', color: '#fff' }}>Yes, Undo</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveScoring;
