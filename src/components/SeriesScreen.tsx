import React, { useState, useEffect, useMemo } from 'react';
import { 
  Tv, Search, Filter, Star, Sparkles, TrendingUp, 
  Flame, Trophy, Calendar, RefreshCw, X, Play
} from 'lucide-react';
import { SeriesItem } from '../types';
import { TmdbService, TmdbData } from '../services/tmdbService';
import { TmdbMediaCard } from './TmdbMediaCard';
import { GridCardSkeleton } from './SkeletonLoaders';

interface SeriesScreenProps {
  series?: SeriesItem[];
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
  onOpenSearch: () => void;
  onSelectTmdbMedia?: (item: {
    id: number | string;
    mediaType: 'movie' | 'tv';
    title: string;
    poster?: string;
    backdrop?: string;
    year?: string;
    rating?: string;
    overview?: string;
  }) => void;
}

const SERIES_FILTERS = [
  { id: 'popular', name: 'Mais Assistidas', icon: Flame },
  { id: 'trending', name: 'Em Alta', icon: TrendingUp },
  { id: 'top_rated', name: 'Mais Votadas', icon: Trophy },
  { id: 'airing_today', name: 'No Ar Hoje', icon: Calendar },
  { id: '10765', name: 'Ficção & Fantasia', genreId: 10765 },
  { id: '16', name: 'Animação', genreId: 16 },
  { id: '18', name: 'Drama', genreId: 18 },
  { id: '80', name: 'Crime & Investigação', genreId: 80 },
  { id: '9648', name: 'Mistério', genreId: 9648 },
  { id: '35', name: 'Comédia', genreId: 35 },
  { id: '10759', name: 'Ação & Aventura', genreId: 10759 },
];

export const SeriesScreen: React.FC<SeriesScreenProps> = ({
  series = [],
  onSelectSeries,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist,
  onOpenSearch,
  onSelectTmdbMedia,
}) => {
  const [selectedFilter, setSelectedFilter] = useState('popular');
  const [items, setItems] = useState<TmdbData[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Load series from TMDB according to selected category filter
  const loadCategorySeries = async (filterId: string, pageNum: number, append = false) => {
    if (pageNum === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      let results: TmdbData[] = [];

      if (filterId === 'popular') {
        results = await TmdbService.fetchPopularTv(pageNum);
      } else if (filterId === 'trending') {
        results = await TmdbService.fetchTrendingTv();
      } else if (filterId === 'top_rated') {
        results = await TmdbService.fetchTopRatedTv(pageNum);
      } else if (filterId === 'airing_today') {
        results = await TmdbService.fetchAiringTodayTv(pageNum);
      } else {
        const genreId = parseInt(filterId, 10);
        if (!isNaN(genreId)) {
          results = await TmdbService.fetchTvByGenre(genreId, pageNum);
        }
      }

      if (append) {
        setItems((prev) => [...prev, ...results]);
      } else {
        setItems(results);
      }

      setHasMore(results.length > 0);
    } catch (err) {
      console.warn('[SeriesScreen] TMDB fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadCategorySeries(selectedFilter, 1, false);
  }, [selectedFilter]);

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadCategorySeries(selectedFilter, nextPage, true);
  };

  const handleSelectItem = (item: TmdbData) => {
    if (onSelectTmdbMedia) {
      onSelectTmdbMedia({
        id: item.tmdbId || item.title || '',
        mediaType: 'tv',
        title: item.title || '',
        poster: item.poster,
        backdrop: item.backdrop,
        year: item.year,
        rating: item.rating,
        overview: item.plot,
      });
      return;
    }

    onSelectSeries({
      id: `tmdb_tv_${item.tmdbId}`,
      playlistId: '',
      name: item.title || '',
      posterUrl: item.poster,
      backdropUrl: item.backdrop,
      category: 'TMDb',
      year: item.year,
      rating: item.rating,
      description: item.plot,
      seasons: [],
    });
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.year && String(s.year).includes(q))
    );
  }, [items, searchQuery]);

  const featuredSeries = items[0];

  return (
    <div className="w-full min-h-screen text-white pb-24 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto pt-4">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Tv className="w-7 h-7 text-amber-500" />
            <span>Séries & Produções TMDB</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 font-light mt-0.5">
            Temporadas e episódios das séries mais aclamadas mundialmente
          </p>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar séries por nome..."
            className="w-full bg-neutral-900 border border-white/10 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-1 mb-6 custom-scrollbar">
        {SERIES_FILTERS.map((f) => {
          const Icon = f.icon;
          const isSelected = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-950/40 border border-amber-400/40 scale-105'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{f.name}</span>
            </button>
          );
        })}
      </div>

      {/* Spotlight Feature Card */}
      {!searchQuery && featuredSeries && !isLoading && (
        <div
          onClick={() => handleSelectItem(featuredSeries)}
          className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl mb-8 group cursor-pointer"
        >
          {featuredSeries.backdrop ? (
            <img
              src={featuredSeries.backdrop}
              alt={featuredSeries.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transform scale-100 group-hover:scale-105 transition-transform duration-700 filter brightness-75"
            />
          ) : (
            <div className="w-full h-full bg-neutral-950" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-6 sm:p-10 space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Série em Destaque
              </span>
              {featuredSeries.rating && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-black/60 text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {featuredSeries.rating}
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              {featuredSeries.title}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 font-light">
              {featuredSeries.plot}
            </p>
            <div className="pt-2">
              <button
                type="button"
                className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
              >
                <Play className="w-4 h-4 fill-white stroke-none" />
                <span>Ver Temporadas & Assistir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      {isLoading ? (
        <GridCardSkeleton count={18} />
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-900/50 border border-white/5 space-y-3">
          <Tv className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">Nenhuma série encontrada</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto font-light">
            Não encontramos resultados para sua busca nesta categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {filteredItems.map((item, idx) => (
            <TmdbMediaCard
              key={`${item.tmdbId || item.title}-${idx}`}
              item={item}
              mediaType="tv"
              onClick={() => handleSelectItem(item)}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll / Load More */}
      {!isLoading && hasMore && !searchQuery && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={handleLoadMore}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <span>Carregando mais séries...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <span>Carregar Mais Séries</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
