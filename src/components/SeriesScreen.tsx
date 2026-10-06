import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Clapperboard, Search, Star, Heart, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Filter, X } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryForGrid, setSelectedCategoryForGrid] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(60);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Group series by category preserving list order
  const categoriesMap = useMemo(() => {
    const map = new Map<string, SeriesItem[]>();
    (series || []).forEach((s) => {
      if (!s) return;
      const cat = (s.category || 'Séries').trim() || 'Séries';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(s);
    });
    return map;
  }, [series]);

  const allCategories = useMemo(() => {
    return Array.from(categoriesMap.keys());
  }, [categoriesMap]);

  // Global search across all series
  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return (series || []).filter((s) => {
      if (!s) return false;
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const catMatch = (s.category || '').toLowerCase().includes(q);
      return nameMatch || catMatch;
    });
  }, [series, searchQuery]);

  // Series for active category grid ("Ver tudo")
  const activeCategorySeries = useMemo(() => {
    if (!selectedCategoryForGrid) return [];
    return categoriesMap.get(selectedCategoryForGrid) || [];
  }, [categoriesMap, selectedCategoryForGrid]);

  const visibleCategorySeries = useMemo(() => {
    return activeCategorySeries.slice(0, visibleLimit);
  }, [activeCategorySeries, visibleLimit]);

  // Reset pagination when category changes
  useEffect(() => {
    setVisibleLimit(60);
  }, [selectedCategoryForGrid]);

  // Infinite scroll for category grid view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < activeCategorySeries.length) {
          setVisibleLimit((prev) => Math.min(prev + 60, activeCategorySeries.length));
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
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
  }, [activeCategorySeries.length, visibleLimit]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 space-y-6">
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
            Catálogo completo organizado por categorias com carrosséis individuais
          </p>
        </div>

        {/* Search Input (Searches across all series) */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar em todas as séries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-rose-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Cascading Dropdown Bar */}
      <div className="flex items-center justify-between gap-3 relative z-30">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              selectedCategoryForGrid
                ? 'bg-rose-600 text-white shadow-rose-950/40'
                : 'bg-neutral-900 border border-neutral-800 text-white hover:border-neutral-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>
              {selectedCategoryForGrid
                ? `Categoria: ${selectedCategoryForGrid}`
                : 'Categorias ⬇️'}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Cascading Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-[#121520] border border-neutral-800/90 rounded-2xl shadow-2xl p-2 space-y-1 no-scrollbar animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryForGrid(null);
                  setIsDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  selectedCategoryForGrid === null
                    ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30'
                    : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                }`}
              >
                <span>Todas as Categorias (Carrosséis)</span>
                <span className="text-[10px] bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded-lg border border-neutral-800">
                  {series.length}
                </span>
              </button>

              <div className="h-px bg-neutral-800/80 my-1" />

              {allCategories.map((cat) => {
                const count = categoriesMap.get(cat)?.length || 0;
                const isSelected = selectedCategoryForGrid === cat;
                return (
                  <button
                    key={`cat_drop_series_${cat}`}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForGrid(cat);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <span className="truncate pr-2 text-left">{cat}</span>
                    <span className="text-[10px] bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded-lg border border-neutral-800 shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Back to Carousels button when inside Category Grid */}
        {selectedCategoryForGrid && !searchQuery && (
          <button
            type="button"
            onClick={() => setSelectedCategoryForGrid(null)}
            className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver carrosséis</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
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
      ) : searchQuery.trim().length > 0 ? (
        /* VIEW 1: GLOBAL SEARCH RESULTS ACROSS ALL SERIES */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              Resultados da busca ({searchResults.length}{' '}
              {searchResults.length === 1 ? 'série encontrada' : 'séries encontradas'}):
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 text-xs border border-neutral-800/60 rounded-2xl bg-neutral-900/40">
              Nenhuma série encontrada para "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
              {searchResults.map((s) => (
                <SeriesCard
                  key={`search_series_${s.id}`}
                  series={s}
                  isFav={isFavorite(s.id)}
                  onSelectSeries={onSelectSeries}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      ) : selectedCategoryForGrid ? (
        /* VIEW 2: CATEGORY DETAIL ("VER TUDO" GRID) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
              {selectedCategoryForGrid} ({activeCategorySeries.length}{' '}
              {activeCategorySeries.length === 1 ? 'série' : 'séries'})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {visibleCategorySeries.map((s) => (
              <SeriesCard
                key={`cat_series_grid_${s.id}`}
                series={s}
                isFav={isFavorite(s.id)}
                onSelectSeries={onSelectSeries}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>

          {activeCategorySeries.length > visibleLimit && (
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-500" />
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: ONE CAROUSEL PER CATEGORY (MAIN VIEW) */
        <div className="space-y-8">
          {allCategories.map((catName) => {
            const catSeries = categoriesMap.get(catName) || [];
            if (catSeries.length === 0) return null;

            return (
              <SeriesCategoryCarousel
                key={`section_series_cat_${catName}`}
                categoryName={catName}
                seriesList={catSeries}
                isFavorite={isFavorite}
                onSelectSeries={onSelectSeries}
                onToggleFavorite={onToggleFavorite}
                onVerTudo={() => setSelectedCategoryForGrid(catName)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

/* Horizontal Carousel Component for a Single Series Category */
interface SeriesCategoryCarouselProps {
  categoryName: string;
  seriesList: SeriesItem[];
  isFavorite: (id: string) => boolean;
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  onVerTudo: () => void;
}

const SeriesCategoryCarousel: React.FC<SeriesCategoryCarouselProps> = ({
  categoryName,
  seriesList,
  isFavorite,
  onSelectSeries,
  onToggleFavorite,
  onVerTudo
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -480 : 480;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-3">
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
            {categoryName}
          </h2>
          <span className="text-xs text-neutral-500 font-medium">
            ({seriesList.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVerTudo}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
          >
            Ver tudo <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="hidden sm:flex items-center gap-1 ml-2">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-90"
              aria-label="Rolar para esquerda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-90"
              aria-label="Rolar para direita"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 pt-1"
      >
        {seriesList.map((s) => (
          <div key={`carousel_series_${s.id}`} className="shrink-0 w-32 sm:w-44">
            <SeriesCard
              series={s}
              isFav={isFavorite(s.id)}
              onSelectSeries={onSelectSeries}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

/* Individual Series Card */
interface SeriesCardProps {
  series: SeriesItem;
  isFav: boolean;
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
}

const SeriesCard: React.FC<SeriesCardProps> = ({
  series,
  isFav,
  onSelectSeries,
  onToggleFavorite
}) => {
  const seasonCount = series.seasons?.length || 1;
  const episodeCount =
    series.totalEpisodes ||
    series.seasons?.reduce((acc, season) => acc + season.episodes.length, 0) ||
    0;

  return (
    <div
      onClick={() => onSelectSeries(series)}
      className="group relative rounded-2xl bg-[#11131b] hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-rose-500/50 p-2 cursor-pointer transition-all active:scale-[0.98] shadow-md flex flex-col justify-between"
    >
      {/* Poster 2:3 */}
      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
        {series.posterUrl ? (
          <img
            src={series.posterUrl}
            alt={series.name}
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
            onToggleFavorite(series);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-colors ${
            isFav
              ? 'bg-rose-500/30 text-rose-400'
              : 'bg-black/60 text-neutral-400 hover:text-white'
          }`}
          aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
        </button>

        {/* Seasons Count Badge */}
        <span className="absolute bottom-2 left-2 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
          {seasonCount} {seasonCount === 1 ? 'Temp' : 'Temps'}
        </span>

        {/* Rating Tag */}
        {series.rating && (
          <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
            {series.rating}
          </span>
        )}
      </div>

      <div className="min-w-0 px-1">
        <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
          {series.name}
        </h4>
        <div className="flex items-center justify-between text-[10px] text-neutral-500 mt-0.5">
          <span className="truncate">{series.category}</span>
          {episodeCount > 0 && <span>{episodeCount} eps</span>}
        </div>
      </div>
    </div>
  );
};
