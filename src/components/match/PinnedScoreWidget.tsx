
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { matchService } from '@/services/firestore/matches';
import { Match, InningsStats } from '@/types';
import { Link } from 'react-router-dom';
import { X, Maximize2, Move } from 'lucide-react';

export const PinnedScoreWidget: React.FC = () => {
    const [match, setMatch] = useState<Match | null>(null);
    const [innings, setInnings] = useState<InningsStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [showCloseZone, setShowCloseZone] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Load pinned match id
    useEffect(() => {
        const handleStorageChange = () => {
            const pinnedId = localStorage.getItem('pinnedMatchId');
            if (!pinnedId) {
                setMatch(null);
                return;
            }
            setLoading(true);
            const unsubscribe = matchService.subscribeToMatch(pinnedId, (data) => {
                setMatch(data);
                if (data?.currentBatting) {
                    const side = data.currentBatting === 'teamB' ? 'teamB' : 'teamA';
                    matchService.getInnings(pinnedId, side).then(setInnings);
                }
                setLoading(false);
            });
            return () => unsubscribe();
        };

        handleStorageChange();
        window.addEventListener('storage', handleStorageChange);
        // Custom event for same-window updates
        window.addEventListener('matchPinned', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('matchPinned', handleStorageChange);
        };
    }, []);

    // Picture-in-Picture logic (for Outside App viewing)
    const enterPiP = async () => {
        if (!canvasRef.current || !videoRef.current) return;

        // Draw score to canvas
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!ctx || !match || !innings) return;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 300, 200);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(`${match.teamAName} vs ${match.teamBName}`, 20, 40);

            ctx.fillStyle = '#3b82f6';
            ctx.font = 'bold 48px Arial';
            ctx.fillText(`${innings.totalRuns}-${innings.totalWickets}`, 20, 100);

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(`Overs: ${innings.overs} | CRR: ${innings.crr}`, 20, 140);

            if (match.result) {
                ctx.fillStyle = '#10b981';
                ctx.font = 'italic 18px Arial';
                ctx.fillText(match.result, 20, 175);
            }
        };

        draw();
        const stream = (canvasRef.current as any).captureStream(10);
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
        window.dispatchEvent(new Event('matchPinned'));
    };

    if (!match) return null;

    return (
        <>
            <AnimatePresence>
                {/* Close Zone at bottom */}
                {showCloseZone && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-red-500/20 to-transparent flex items-center justify-center z-[9998] pointer-events-none"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg border-2 border-white/20 animate-pulse">
                            <X className="text-white" size={32} />
                        </div>
                    </motion.div>
                )}

                {/* The Draggable Bubble */}
                <motion.div
                    drag
                    dragMomentum={false}
                    onDragStart={() => setShowCloseZone(true)}
                    onDragEnd={(event, info) => {
                        setShowCloseZone(false);
                        // If dropped near bottom-center, close it
                        if (info.point.y > window.innerHeight - 100) {
                            closeWidget();
                        }
                    }}
                    className="fixed top-1/2 right-4 z-[9999] cursor-move touch-none"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                >
                    <div className="relative group">
                        {/* Minimal Bubble UI */}
                        <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-full shadow-2xl border-4 border-blue-500 overflow-hidden flex flex-col items-center justify-center text-center p-1">
                            <span className="text-[10px] font-black leading-none text-slate-400 uppercase truncate w-full px-1">{match.teamAName}</span>
                            <div className="flex flex-col items-center my-0.5">
                                <span className="text-sm font-black text-blue-600 leading-none">{innings?.totalRuns || 0}-{innings?.totalWickets || 0}</span>
                                <span className="text-[8px] font-bold text-slate-500">Overs: {innings?.overs || '0.0'}</span>
                            </div>
                            <span className="text-[10px] font-black leading-none text-slate-400 uppercase truncate w-full px-1">{match.teamBName}</span>
                        </div>

                        {/* Hover Actions */}
                        <div className="absolute -top-2 -right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={closeWidget}
                                className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg transform hover:scale-110"
                            >
                                <X size={12} strokeWidth={3} />
                            </button>
                            <button
                                onClick={enterPiP}
                                className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg transform hover:scale-110"
                                title="Floating Window (Outside App)"
                            >
                                <Maximize2 size={12} strokeWidth={3} />
                            </button>
                            <Link
                                to={`/match/${match.id}`}
                                className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg transform hover:scale-110"
                            >
                                <Move size={12} strokeWidth={3} />
                            </Link>
                        </div>

                        {/* Live Indicator */}
                        {match.status?.toLowerCase() === 'live' && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-500 text-white px-1.5 rounded-full ring-2 ring-white">
                                <span className="text-[7px] font-black uppercase tracking-tighter">LIVE</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Hidden elements for PiP hack */}
            <canvas ref={canvasRef} width="300" height="200" className="hidden" />
            <video ref={videoRef} className="hidden" muted playsInline />
        </>
    );
};
