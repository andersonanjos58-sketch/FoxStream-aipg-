import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Clapperboard, Search, Star, Heart, Layers, Play } from 'lucide-react';
import { SeriesItem } from '../types';

interface SeriesScreenProps {
  series: SeriesItem[];
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
}

export const SeriesScreen: React.FC<SeriesScreenProps> = ({
  series,
  onSelectSeries,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  const observerTarget = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (series || []).forEach(s => {
      if (s && s.category) set.add(String(s.category).trim());
    });
    return ['Todas', ...Array.from(set).sort()];
  }, [series]);

  const filteredSeries = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return (series || []).filter(s => {
      if (!s) return false;
      const seriesCat = s.category || 'Séries';
      const matchCat = selectedCategory === 'Todas' || seriesCat === selectedCategory;
      const matchQuery = !q ||
        (s.name || '').toLowerCase().includes(q) ||
        seriesCat.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [series, selectedCategory, searchQuery]);

  const visibleSeries = useMemo(() => {
    return (filteredSeries || []).slice(0, visibleLimit);
  }, [filteredSeries, visibleLimit]);

  // Reset limit when query or category changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [selectedCategory, searchQuery]);

  // Setup intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < filteredSeries.length) {
          setVisibleLimit((prev) => Math.min(prev + 100, filteredSeries.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [filteredSeries.length, visibleLimit]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Clapperboard className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              Séries
            </h1>
            <span className="text-xs bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold uppercase px-2 py-0.5 rounded-full">
              Episódios Agrupados
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Episódios organizados exclusivamente sob cada série e temporada
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar título de série..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isSelected
                  ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-950/40'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid or Empty */}
      {series.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 space-y-3">
          <Clapperboard className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">Nenhuma série catalogada</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Adicione uma playlist com episódios identificados por temporada (S01E01) ou sincronize séries Xtream Codes.
          </p>
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-xs"
          >
            Adicionar Lista
          </button>
        </div>
      ) : filteredSeries.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-xs">
          Nenhuma série encontrada para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {visibleSeries.map((s) => {
              const starred = isFavorite(s.id);
              const seasonCount = s.seasons?.length || 1;
              const episodeCount = s.totalEpisodes || s.seasons?.reduce((acc, season) => acc + season.episodes.length, 0) || 0;

              return (
                <div
                  key={s.id}
                  onClick={() => onSelectSeries(s)}
                  className="group relative rounded-2xl bg-[#11131b] hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-rose-500/50 p-2 cursor-pointer transition-all active:scale-[0.98] shadow-md flex flex-col justify-between"
                >
                  {/* Poster 2:3 */}
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                    {s.posterUrl ? (
                      <img
                        src={s.posterUrl}
                        alt={s.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900">
                        <Clapperboard className="w-8 h-8" />
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(s);
                      }}
                      className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                        starred
                          ? 'bg-rose-500/30 text-rose-400'
                          : 'bg-black/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${starred ? 'fill-rose-500' : ''}`} />
                    </button>

                    {/* Seasons Count Badge */}
                    <span className="absolute bottom-2 left-2 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      {seasonCount} {seasonCount === 1 ? 'Temp' : 'Temps'}
                    </span>

                    {/* Rating Tag */}
                    {s.rating && (
                      <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {s.rating}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 px-1">
                    <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                      {s.name}
                    </h4>
                    <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-0.5">
                      <span className="truncate">{s.category}</span>
                      {episodeCount > 0 && <span>{episodeCount} eps</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSeries.length > visibleLimit && (
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-500"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
