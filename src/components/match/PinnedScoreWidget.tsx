
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { matchService } from '@/services/firestore/matches';
import { Match, InningsStats } from '@/types';
import { Link } from 'react-router-dom';
import { X, Maximize2, ExternalLink } from 'lucide-react';

export const PinnedScoreWidget: React.FC = () => {
    const [match, setMatch] = useState<Match | null>(null);
    const [innings, setInnings] = useState<InningsStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [showCloseZone, setShowCloseZone] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Load pinned match id and subscribe to updates
    useEffect(() => {
        let unsubMatch: (() => void) | null = null;
        let unsubInnings: (() => void) | null = null;

        const handleStorageChange = () => {
            const pinnedId = localStorage.getItem('pinnedMatchId');
            if (!pinnedId) {
                setMatch(null);
                setInnings(null);
                if (unsubMatch) unsubMatch();
                if (unsubInnings) unsubInnings();
                return;
            }

            setLoading(true);
            unsubMatch = matchService.subscribeToMatch(pinnedId, (data) => {
                setMatch(data);
                if (data?.currentBatting) {
                    const side = data.currentBatting.includes('teamB') ? 'teamB' : 'teamA';

                    // Cleanup previous innings subscription if side changed
                    if (unsubInnings) unsubInnings();

                    unsubInnings = matchService.subscribeToInnings(pinnedId, side as any, (innData) => {
                        setInnings(innData);
                        setLoading(false);
                    });
                } else {
                    setLoading(false);
                }
            });
        };

        handleStorageChange();
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('matchPinned', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('matchPinned', handleStorageChange);
            if (unsubMatch) unsubMatch();
            if (unsubInnings) unsubInnings();
        };
    }, []);

    // Draw high-fidelity PiP frame
    useEffect(() => {
        if (!match || !innings || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const drawFrame = () => {
            if (!match || !innings) return;
            const w = 400;
            const h = 250;

            // 1. Background (Rounded corners feel)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);

            // 2. Dark Header (ANDR vs BEN style)
            ctx.fillStyle = '#334155'; // slate-700
            ctx.fillRect(0, 0, w, 60);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px Inter, Arial';
            const teamText = `${match.teamAName} vs ${match.teamBName}`;
            ctx.fillText(teamText.toUpperCase(), 20, 38);

            // Match Type Badge
            ctx.fillStyle = '#4ade80'; // emerald-400
            ctx.fillRect(w - 70, 15, 50, 25);
            ctx.fillStyle = '#064e3b';
            ctx.font = 'black 14px Inter, Arial';
            ctx.fillText('LIVE', w - 62, 33);

            // 3. Body Content
            // Team Logo Placeholder (Circle)
            ctx.beginPath();
            ctx.arc(50, 130, 30, 0, Math.PI * 2);
            ctx.fillStyle = '#f1f5f9';
            ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 24px Inter, Arial';
            ctx.fillText((match as any).currentBatting === 'teamB' ? match.teamBName[0] : match.teamAName[0], 40, 140);

            // Score
            ctx.fillStyle = '#2563eb'; // blue-600
            ctx.font = 'black 54px Inter, Arial';
            const scoreText = `${innings.totalRuns}-${innings.totalWickets}`;
            ctx.fillText(scoreText, 100, 145);

            // Overs
            ctx.fillStyle = '#64748b'; // slate-500
            ctx.font = 'bold 24px Inter, Arial';
            ctx.fillText(`${innings.overs} ov`, 110 + ctx.measureText(scoreText).width, 143);

            // Footer - CRR & Info
            ctx.fillStyle = '#475569';
            ctx.font = 'bold 20px Inter, Arial';
            const crr = innings.crr || (innings.totalRuns / (parseFloat(innings.overs.split('.')[0] || '1') + (parseFloat(innings.overs.split('.')[1] || '0') / 6))).toFixed(2);
            ctx.fillText(`CRR: ${crr}`, 100, 185);

            // Toss/Status Info (Bottom line)
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'italic 18px Inter, Arial';
            const status = (match as any).resultSummary || (match as any).tossWinner ? `${(match as any).tossWinner} opted to ${(match as any).electedTo}` : 'Match in progress';
            ctx.fillText(status, 25, 225);
        };

        drawFrame();
    }, [match, innings]);

    const enterPiP = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const stream = (canvasRef.current as any).captureStream(1); // 1 FPS is enough for scores
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        try {
            if ((document as any).pictureInPictureEnabled && videoRef.current !== (document as any).pictureInPictureElement) {
                await (videoRef.current as any).requestPictureInPicture();
            }
        } catch (error) {
            console.error('PiP failed:', error);
        }
    };

    const closeWidget = () => {
        localStorage.removeItem('pinnedMatchId');
        setMatch(null);
        setInnings(null);
        window.dispatchEvent(new Event('matchPinned'));
    };

    if (!match) return null;

    return (
        <>
            <AnimatePresence>
                {showCloseZone && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-red-500/30 to-transparent flex items-center justify-center z-[9998] pointer-events-none"
                    >
                        <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl border-4 border-white/20">
                            <X className="text-white" size={40} />
                        </div>
                    </motion.div>
                )}

                <motion.div
                    drag
                    dragMomentum={false}
                    onDragStart={() => setShowCloseZone(true)}
                    onDragEnd={(event, info) => {
                        setShowCloseZone(false);
                        if (info.point.y > window.innerHeight - 120) {
                            closeWidget();
                        }
                    }}
                    className="fixed top-1/2 right-4 z-[9999] cursor-move touch-none"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                >
                    <div className="relative group">
                        {/* Premium Floating Widget UI */}
                        <div className="w-28 h-28 bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-[3px] border-blue-500 overflow-hidden flex flex-col p-1.5 transition-transform hover:scale-105">
                            {/* Header */}
                            <div className="bg-slate-100 dark:bg-slate-800 rounded-t-2xl py-1 px-2 text-center border-b border-slate-200 dark:border-white/5">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter truncate block">
                                    {match.teamAName} vs {match.teamBName}
                                </span>
                            </div>

                            {/* Main Body */}
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="text-lg font-medium text-blue-600 leading-none mb-0.5">
                                    {innings?.totalRuns || 0}-{innings?.totalWickets || 0}
                                </div>
                                <div className="text-[9px] font-bold text-slate-500 tabular-nums">
                                    {innings?.overs || '0.0'} ov
                                </div>
                                {innings?.crr && (
                                    <div className="text-[8px] font-medium text-slate-400 mt-0.5">
                                        CRR: {innings.crr}
                                    </div>
                                )}
                            </div>

                            {/* Floating "Live" Dot */}
                            {match.status?.toLowerCase() === 'live' && (
                                <div className="absolute top-8 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            )}
                        </div>

                        {/* Hover Overlay Actions */}
                        <div className="absolute -top-4 -right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
                            <button
                                onClick={closeWidget}
                                className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl hover:bg-red-600 transition-colors"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                            <button
                                onClick={enterPiP}
                                className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl hover:bg-blue-700 transition-colors"
                                title="Floating Window (Outside App)"
                            >
                                <Maximize2 size={16} strokeWidth={3} />
                            </button>
                            <Link
                                to={`/match/${match.id}`}
                                className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl hover:bg-emerald-600 transition-colors"
                            >
                                <ExternalLink size={16} strokeWidth={3} />
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Hidden elements for PiP hack */}
            <canvas ref={canvasRef} width="400" height="250" className="hidden" />
            <video ref={videoRef} className="hidden" muted playsInline />
        </>
    );
};
