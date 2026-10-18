import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TmdbData } from '../services/tmdbService';
import { TmdbMediaCard } from './TmdbMediaCard';
import { CardSkeleton } from './SkeletonLoaders';

interface TmdbCategoryRowProps {
  title: string;
  icon?: React.ReactNode;
  items: TmdbData[];
  isLoading?: boolean;
  mediaType?: 'movie' | 'tv';
  onSelectItem: (item: TmdbData) => void;
  onSeeAll?: () => void;
}

export const TmdbCategoryRow: React.FC<TmdbCategoryRowProps> = ({
  title,
  icon,
  items,
  isLoading = false,
  mediaType = 'movie',
  onSelectItem,
  onSeeAll,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!rowRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items, isLoading]);

  const scroll = (direction: 'left' | 'right') => {
    if (!rowRef.current) return;
    const { clientWidth } = rowRef.current;
    const amount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
    rowRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  if (!isLoading && (!items || items.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-3 py-2 relative group/row">
      {/* Row Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-orange-500">{icon}</span>}
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {title}
          </h2>
          {items.length > 0 && !isLoading && (
            <span className="text-xs text-neutral-500 font-mono">
              ({items.length})
            </span>
          )}
        </div>

        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 group-hover/row:translate-x-0.5 transition-transform"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row Scroll Container */}
      <div className="relative">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 items-center justify-center shadow-xl backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all hover:scale-110 active:scale-95"
            title="Rolar para esquerda"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 items-center justify-center shadow-xl backdrop-blur-md opacity-0 group-hover/row:opacity-100 transition-all hover:scale-110 active:scale-95"
            title="Rolar para direita"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div
          ref={rowRef}
          onScroll={checkScroll}
          className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 px-1 custom-scrollbar scroll-smooth"
        >
          {isLoading ? (
            <CardSkeleton count={7} />
          ) : (
            items.map((item, idx) => (
              <TmdbMediaCard
                key={`${item.tmdbId || item.title}-${idx}`}
                item={item}
                mediaType={mediaType}
                onClick={() => onSelectItem(item)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
