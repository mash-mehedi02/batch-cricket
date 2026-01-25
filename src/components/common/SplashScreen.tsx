import React, { useEffect } from 'react';
import tazkirImage from '@/assets/tazkir.png';
import ripImage from '@/assets/rip.png';

const SplashScreen: React.FC<{ onLoadingComplete: () => void }> = ({ onLoadingComplete }) => {

  useEffect(() => {
    // Simulate loading process - in a real app, this would be replaced with actual initialization logic
    // such as checking auth status, initializing services, loading initial data, etc.
    const timer = setTimeout(() => {
      onLoadingComplete();
    }, 2000); // Splash screen duration - 2 seconds (optimized for faster load)

    // Cleanup timeout if component unmounts
    return () => clearTimeout(timer);
  }, [onLoadingComplete]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#0f172a] via-[#020817] to-[#000000] flex flex-col items-center justify-center z-50 overflow-hidden">
      {/* Subtle noise/vignette effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/40"></div>

      {/* Top Section - App Logo and Subtext */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        {/* App Name */}
        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 text-center">
          <span className="block">BatchCrick BD</span>
        </h1>

        {/* Subtext */}
        <p className="text-gray-300 text-sm sm:text-base tracking-widest uppercase">
          Shalnagor Modern Academy
        </p>
      </div>

      {/* Center Section - Image */}
      <div className="relative z-10 flex flex-col items-center mb-4 sm:mb-8">
        <div className="relative flex items-center justify-center">
          {/* Main image with fade-in animation */}
          <img
            src={tazkirImage}
            alt="BatchCrick BD"
            className="w-80 h-80 sm:w-96 sm:h-96 md:w-[30rem] md:h-[30rem] lg:w-[36rem] lg:h-[36rem] object-contain opacity-0 animate-fade-in-scale"
          />

          {/* RIP image in top-right corner of main image with white circular background */}
          <div className="absolute top-4 right-4 sm:top-0 sm:right-0 w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-white rounded-full flex items-center justify-center z-20 p-2 shadow-lg hover:scale-105 transition-transform">
            <img
              src={ripImage}
              alt="RIP"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Pulse/shimmer effect on logo while loading */}
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[#16a34a]/20 to-transparent animate-shimmer"></div>
        </div>

        {/* Forever text with subtext */}
        <div className="mt-2 sm:mt-4 text-center">
          <p className="text-white text-lg sm:text-xl md:text-2xl font-bold mb-1">
            FOREVER
          </p>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base italic">
            2002 - ∞
          </p>
        </div>

        {/* Two-line headline */}
        <div className="mt-4 sm:mt-6 text-center">
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">CRICKET</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-black text-[#16a34a]">NON-STOP</div>
        </div>
      </div>

      {/* Bottom Section - Signature */}
      <div className="relative z-10 mt-auto">
        <p className="text-gray-500 text-sm italic tracking-wide font-cursive">
          Mehedi Hasan
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;