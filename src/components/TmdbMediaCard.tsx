import React from 'react';
import { Star, Play, Info } from 'lucide-react';
import { TmdbData } from '../services/tmdbService';
import { TmdbMediaItem } from '../types';

interface TmdbMediaCardProps {
  item: TmdbData | TmdbMediaItem;
  mediaType?: 'movie' | 'tv';
  onClick: () => void;
  onQuickPlay?: () => void;
}

export const TmdbMediaCard: React.FC<TmdbMediaCardProps> = ({
  item,
  mediaType = 'movie',
  onClick,
  onQuickPlay,
}) => {
  const title = (item as any).title || (item as any).name || 'Sem título';
  const poster = (item as any).poster || (item as any).posterPath;
  const rating = (item as any).rating || ((item as any).voteAverage ? `${(item as any).voteAverage.toFixed(1)}/10` : undefined);
  const year = (item as any).year;
  const isTv = mediaType === 'tv' || (item as any).mediaType === 'tv';

  return (
    <div
      onClick={onClick}
      className="group relative shrink-0 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-lg hover:shadow-2xl hover:shadow-orange-950/40 hover:border-orange-500/50 transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer select-none"
    >
      {/* Poster Image */}
      {poster ? (
        <img
          src={poster}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-black">
          <span className="text-neutral-500 text-xs font-semibold">{title}</span>
        </div>
      )}

      {/* Top Badges */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/75 backdrop-blur-md text-orange-400 border border-white/10">
          {isTv ? 'Série' : 'Filme'}
        </span>

        {rating && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/75 backdrop-blur-md text-amber-400 border border-white/10">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {rating.replace('/10', '')}
          </span>
        )}
      </div>

      {/* Hover Quick Actions Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 z-10">
        <h4 className="text-white text-xs sm:text-sm font-bold line-clamp-2 drop-shadow-md">
          {title}
        </h4>
        {year && <span className="text-[11px] text-neutral-400 font-light mt-0.5">{year}</span>}

        <div className="flex items-center gap-2 mt-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="flex-1 py-1.5 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-white stroke-none" />
            <span>Assistir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
