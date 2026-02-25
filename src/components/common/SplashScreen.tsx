import React, { useEffect, useState } from 'react';
import tazkirImage from '@/assets/tazkir.png';
import { StatusBar } from '@capacitor/status-bar';
import { motion, AnimatePresence } from 'framer-motion';

const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Hide status bar during splash for full-screen feel
    StatusBar.hide().catch(() => { });

    // Progress bar animation - Completed in ~2.8s
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 0.6; // Slower progress for longer duration
      });
    }, 20);

    // Multi-stage animation timing - Cinematic feel
    setTimeout(() => setStage(1), 500);  // Show Logo/Branding
    setTimeout(() => setStage(2), 1200); // Show Image/Memorial
    setTimeout(() => setStage(3), 3200); // Start fading out

    const timer2 = setTimeout(() => {
      onFinish();
      StatusBar.show().catch(() => { });
    }, 3500); // Increased from 2000ms to 3500ms

    return () => {
      clearInterval(interval);
      clearTimeout(timer2);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#050B18] overflow-hidden">
      {/* Background Cinematic Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.08)_0%,transparent_60%)]" />
        <motion.div
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[20%] -left-[10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.04)_0%,transparent_70%)]"
        />

        {/* Particle Grid Overlay */}
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <AnimatePresence mode="wait">
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-6">

          {/* Section 1: Top Branding */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8 flex flex-col items-center"
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-2 px-4 justify-center">
              <span className="text-[#10B981] text-2xl sm:text-3xl">🏏</span>
              <h1 className="text-white text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase italic text-center leading-tight">
                BatchCrick<span className="text-[#10B981] not-italic">BD</span>
              </h1>
            </div>
            <div className="w-12 sm:w-16 h-1 bg-gradient-to-r from-transparent via-[#10B981] to-transparent rounded-full mb-3" />
            <p className="text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] opacity-80 text-center">
              SHALNAGOR MODERN ACADEMY
            </p>

          </motion.div>

          {/* Section 2: Memorial Image with Glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: 15 }}
            animate={{
              opacity: stage >= 1 ? 1 : 0,
              scale: stage >= 1 ? 1 : 0.9,
              rotateY: 0
            }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[70vw] max-w-[260px] sm:max-w-xs md:max-w-72 aspect-[3/4] group"

          >
            {/* Ambient Glow behind image */}
            <div className="absolute inset-0 bg-[#10B981]/20 blur-[60px] rounded-full scale-75 opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />

            {/* The Frame */}
            <div className="relative w-full h-full rounded-[2.5rem] bg-slate-900 border border-white/10 p-1.5 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 z-10" />
              <img
                src={tazkirImage}
                alt="FOREVER"
                className="w-full h-full object-cover transition-transform duration-[10s] ease-linear scale-110 group-hover:scale-125"
              />

              {/* Overlay Badge */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: stage >= 2 ? 1 : 0, x: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="absolute top-6 right-6 z-20 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-slate-950 shadow-xl"
              >
                <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </motion.div>

              {/* Text on Image */}
              <div className="absolute bottom-6 left-0 right-0 z-20 text-center px-4">
                <p className="text-white/40 text-[9px] font-bold uppercase tracking-[0.3em] mb-1">In Loving Memory of</p>
                <p className="text-white text-xl font-black uppercase tracking-widest italic">Tazkir</p>
              </div>
            </div>
          </motion.div>

          {/* Section 3: Professional Footer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: stage >= 2 ? 1 : 0, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mt-10 flex flex-col items-center text-center"
          >
            <div className="flex flex-col items-center gap-2 mb-6">
              <h2 className="text-white text-xl sm:text-3xl font-black tracking-[0.3em] sm:tracking-[0.4em] uppercase opacity-90">
                FOREVER
              </h2>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-slate-600 font-bold text-base sm:text-lg">2002</span>
                <div className="w-8 sm:w-10 h-[1px] bg-slate-800" />
                <span className="text-[#10B981] text-2xl sm:text-3xl font-light">∞</span>
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <span className="text-slate-500 text-[9px] sm:text-[11px] font-black uppercase tracking-[0.4em] opacity-60">CRICKET PLATFORM</span>
              <span className="text-white text-xl sm:text-3xl font-black italic tracking-tighter">
                NON-STOP <span className="text-[#10B981]">ACTION</span>
              </span>
            </div>

          </motion.div>

        </div>
      </AnimatePresence>

      {/* Modern Loader - Precision Bar */}
      <div className="absolute bottom-12 left-10 right-10 h-[2px] bg-slate-800/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 via-[#10B981] to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute top-0 right-0 text-[8px] font-bold text-[#10B981] opacity-60 translate-y-2 uppercase tracking-widest">
          {Math.round(progress)}% Loading system
        </div>
      </div>

      {/* Fade out mask */}
      <AnimatePresence>
        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#050B18] z-[10001] pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SplashScreen;
