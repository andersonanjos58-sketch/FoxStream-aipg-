import React, { useState, useEffect } from 'react';
import { Play, Info, Star, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { TmdbData } from '../services/tmdbService';

interface TmdbSpotlightBannerProps {
  items: TmdbData[];
  onSelectItem: (item: TmdbData) => void;
  onPlayDirect?: (item: TmdbData) => void;
}

export const TmdbSpotlightBanner: React.FC<TmdbSpotlightBannerProps> = ({
  items,
  onSelectItem,
  onPlayDirect,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const featuredList = items.filter((item) => item.backdrop || item.poster).slice(0, 7);

  // Auto-scroll every 5 seconds, pausing on hover/focus
  useEffect(() => {
    if (featuredList.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredList.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [featuredList.length, isPaused]);

  if (featuredList.length === 0) return null;

  const current = featuredList[currentIndex];
  if (!current) return null;

  const title = current.title || 'Destaque';
  const backdrop = current.backdrop || current.poster;
  const rating = current.rating;
  const year = current.year;
  const plot = current.plot || 'Acompanhe as produções mais populares e aclamadas diretamente no FoxStream.';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative w-full h-[360px] sm:h-[440px] md:h-[500px] rounded-3xl overflow-hidden bg-neutral-950 border border-white/10 shadow-2xl mb-8 group"
    >
      {/* Background Backdrop Image */}
      {backdrop && (
        <img
          key={backdrop}
          src={backdrop}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center transform scale-100 filter brightness-75 transition-all duration-1000 animate-in fade-in zoom-in-95"
        />
      )}

      {/* Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d14] via-[#0b0d14]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d14] via-[#0b0d14]/40 to-transparent" />

      {/* Content Info */}
      <div className="absolute inset-0 p-6 sm:p-10 md:p-14 flex flex-col justify-end max-w-2xl z-10 space-y-3 sm:space-y-4">
        {/* Badges row */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            Destaque em Alta
          </span>

          {rating && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-black/60 text-amber-400 border border-white/10 backdrop-blur-md">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {rating}
            </span>
          )}

          {year && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/60 text-neutral-300 border border-white/10 backdrop-blur-md">
              {year}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-lg line-clamp-2">
          {title}
        </h1>

        {/* Synopsis snippet */}
        <p className="text-xs sm:text-sm md:text-base text-neutral-300 line-clamp-2 sm:line-clamp-3 font-light leading-relaxed max-w-xl">
          {plot}
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectItem(current)}
            className="flex items-center justify-center gap-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-3 px-6 sm:px-7 rounded-2xl text-sm sm:text-base shadow-xl shadow-orange-950/50 active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-white stroke-none" />
            <span>Assistir Agora</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectItem(current)}
            className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-5 sm:px-6 rounded-2xl text-sm sm:text-base backdrop-blur-md border border-white/15 transition-all active:scale-95"
          >
            <Info className="w-4 h-4 text-neutral-300" />
            <span>Mais Informações</span>
          </button>
        </div>
      </div>

      {/* Slide Navigation Controls */}
      {featuredList.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev - 1 + featuredList.length) % featuredList.length)}
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
            title="Destaque anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % featuredList.length)}
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/10 items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all"
            title="Próximo destaque"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 right-6 sm:bottom-8 sm:right-10 z-20 flex items-center gap-1.5">
            {featuredList.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all rounded-full ${
                  currentIndex === idx
                    ? 'w-6 h-2 bg-orange-500'
                    : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                }`}
                title={`Ir para destaque ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
