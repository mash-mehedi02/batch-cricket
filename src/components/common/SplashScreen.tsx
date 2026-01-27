import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import tazkirImage from '@/assets/tazkir.png';
import ripImage from '@/assets/rip.png';

const SplashScreen: React.FC<{ onLoadingComplete: () => void }> = ({ onLoadingComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topTextRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const foreverRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          // Delay a bit before finishing to let the user see the final state
          gsap.to(containerRef.current, {
            opacity: 0,
            duration: 0.8,
            delay: 1.5,
            ease: "power2.inOut",
            onComplete: onLoadingComplete
          });
        }
      });

      // Initial states
      gsap.set([topTextRef.current, foreverRef.current, footerRef.current], {
        opacity: 0,
        y: 20
      });
      gsap.set(imageRef.current, {
        opacity: 0,
        scale: 0.8,
        filter: "blur(10px)"
      });

      // Animation Sequence
      tl.to(containerRef.current, {
        backgroundColor: "rgba(15, 23, 42, 1)", // Deep slate
        duration: 1
      })
        .to(topTextRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "back.out(1.7)"
        }, "-=0.4")
        .to(imageRef.current, {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 1.2,
          ease: "power4.out"
        }, "-=0.6")
        .to(foreverRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: "back.out(1.7)"
        }, "-=0.8")
        .to(footerRef.current, {
          opacity: 0.6,
          y: 0,
          duration: 0.8,
          ease: "power2.out"
        }, "-=0.4");

      // Continuous pulse for the image glow
      gsap.to(".glow-effect", {
        opacity: 0.6,
        scale: 1.1,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    }, containerRef);

    return () => ctx.revert();
  }, [onLoadingComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-[#0f172a] flex flex-col items-center justify-center z-[9999] overflow-hidden select-none"
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500 rounded-full blur-[120px]" />
      </div>

      {/* Top Text Section */}
      <div ref={topTextRef} className="relative z-10 flex flex-col items-center mb-10 text-center px-4">
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-2">
          BatchCrick <span className="text-emerald-400">BD</span>
        </h1>
        <div className="h-[2px] w-12 bg-emerald-500 mb-2" />
        <p className="text-gray-400 text-xs md:text-sm tracking-[0.3em] uppercase font-medium">
          Shalnagor Modern Academy
        </p>
      </div>

      {/* Main Image Content */}
      <div ref={imageRef} className="relative z-10 group">
        <div className="glow-effect absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl -z-10" />

        <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-2xl overflow-hidden border-2 border-white/10 backdrop-blur-sm bg-white/5 shadow-2xl">
          <img
            src={tazkirImage}
            alt="Memorial"
            className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-700"
          />

          {/* RIP Badge */}
          <div className="absolute top-4 right-4 w-16 h-16 md:w-20 md:h-20 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center p-2 shadow-xl border border-white/20">
            <img
              src={ripImage}
              alt="RIP"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>
      </div>

      {/* Forever Text Section */}
      <div ref={foreverRef} className="relative z-10 mt-8 text-center px-4">
        <p className="text-white text-2xl md:text-3xl font-bold tracking-[0.2em] mb-1">
          FOREVER
        </p>
        <div className="flex items-center justify-center gap-3 text-emerald-400">
          <span className="text-lg md:text-xl font-medium tracking-widest text-gray-300">2002</span>
          <span className="w-8 h-[1px] bg-gray-600" />
          <span className="text-2xl md:text-3xl">∞</span>
        </div>

        <div className="mt-6 space-y-1">
          <div className="text-lg md:text-xl font-bold text-white tracking-[0.1em]">CRICKET</div>
          <div className="text-2xl md:text-3xl font-black text-emerald-500 tracking-wider">NON-STOP</div>
        </div>
      </div>

      {/* Signature Footer */}
      <div ref={footerRef} className="absolute bottom-10 z-10">
        <p className="text-gray-500 text-xs md:text-sm italic tracking-widest font-light">
          Developed by <span className="text-gray-400 font-normal">Mehedi Hasan</span>
        </p>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/30 w-full overflow-hidden">
        <div className="h-full bg-emerald-500 animate-loading-bar" style={{ width: '0%' }} id="splash-progress" />
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .animate-loading-bar {
          animation: loading-bar 2.5s linear forwards;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;