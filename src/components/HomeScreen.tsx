import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  Play, Tv, Film, Clapperboard, Heart, ChevronRight, 
  ChevronLeft, Plus, Sparkles, Trash2,
  TrendingUp, Rocket
} from 'lucide-react';
import { LiveChannel, MovieItem, SeriesItem, HistoryItem, FavoriteItem, Playlist } from '../types';
import { TmdbService } from '../services/tmdbService';
import { StorageService } from '../services/storageService';

interface HomeScreenProps {
  activePlaylist: Playlist | null;
  history: HistoryItem[];
  favorites: FavoriteItem[];
  channels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  onPlayChannel: (channel: LiveChannel) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
  onPlayHistoryItem: (item: HistoryItem) => void;
  onRemoveHistoryItem?: (id: string) => void;
  onNavigateTab: (tab: 'live' | 'movies' | 'series' | 'favorites' | 'playlists') => void;
  onOpenAddPlaylist: () => void;
}

// Module-level in-memory cache to prevent re-fetching TMDb data on tab switches
const tmdbMemoryCache = new Map<string, {
  trending: (MovieItem | SeriesItem)[];
  popularMovies: MovieItem[];
  popularSeries: SeriesItem[];
  newReleases: (MovieItem | SeriesItem)[];
  timestamp: number;
}>();

/**
 * LazySection: Renders children on-demand when the user scrolls near the section.
 * Mounts 350px before entering viewport so the user experiences zero lag or visual flicker.
 */
const LazySection: React.FC<{
  children: React.ReactNode;
  minHeight?: string | number;
  rootMargin?: string;
}> = ({ children, minHeight = '240px', rootMargin = '350px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} style={{ minHeight: isVisible ? 'auto' : minHeight }}>
      {isVisible ? children : null}
    </div>
  );
};

/**
 * FeaturedHeaderBanner: ISOLATED component for the spotlight auto-scroll banner.
 * Keeps the 3-second timer localized so advancing slides NEVER re-renders the rest of HomeScreen!
 */
interface FeaturedHeaderBannerProps {
  featuredList: (MovieItem | SeriesItem)[];
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
}

const FeaturedHeaderBanner: React.FC<FeaturedHeaderBannerProps> = React.memo(({
  featuredList,
  onSelectMovie,
  onSelectSeries
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (featuredList.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredList.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [featuredList.length, isPaused]);

  const currentItem = featuredList[currentIndex] || featuredList[0];
  if (!currentItem) return null;

  return (
    <section 
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden transition-all duration-500 bg-black select-none"
    >
      {/* Background image backdrop */}
      {currentItem.posterUrl || ('backdropUrl' in currentItem && currentItem.backdropUrl) ? (
        <img
          key={currentItem.id}
          src={('backdropUrl' in currentItem && currentItem.backdropUrl) ? currentItem.backdropUrl : currentItem.posterUrl}
          alt={currentItem.name}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover blur-sm opacity-35 scale-105 transition-all duration-700 animate-in fade-in"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-r from-orange-950/30 to-neutral-900" />
      )}

      {/* Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/60 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090a0f] via-transparent to-transparent pointer-events-none" />

      {/* Content Overlay */}
      <div className="absolute bottom-6 left-4 sm:left-8 right-4 max-w-2xl space-y-2.5 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-orange-400 font-bold uppercase tracking-wider">
            {currentItem.category || 'Em Destaque'}
          </span>
          {currentItem.year && (
            <span className="text-xs text-neutral-400 font-medium">
              • {currentItem.year}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight line-clamp-2">
          {currentItem.name}
        </h1>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              if ('seasons' in currentItem) {
                onSelectSeries(currentItem as SeriesItem);
              } else {
                onSelectMovie(currentItem as MovieItem);
              }
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-lg shadow-orange-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white stroke-none" />
            <span>Assistir</span>
          </button>
        </div>
      </div>

      {/* Pager Dots */}
      {featuredList.length > 1 && (
        <div className="absolute bottom-4 right-6 flex items-center gap-1.5 z-10">
          {featuredList.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setIsPaused(true);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex 
                  ? 'w-6 bg-orange-500' 
                  : 'w-1.5 bg-white/30 hover:bg-white/60'
              }`}
              aria-label={`Destaque ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activePlaylist,
  history,
  favorites,
  channels,
  movies,
  series,
  onPlayChannel,
  onSelectMovie,
  onSelectSeries,
  onPlayHistoryItem,
  onRemoveHistoryItem,
  onNavigateTab,
  onOpenAddPlaylist,
}) => {
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Synchronize history state with prop and StorageService (filtering out completed items >= 95%)
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>(() => {
    const raw = history && history.length > 0 ? history : StorageService.getHistory();
    return raw.filter(h => h && h.id && h.title && (h.type === 'live' || !h.progress || h.progress < 95));
  });

  useEffect(() => {
    const raw = history !== undefined ? history : StorageService.getHistory();
    setLocalHistory(raw.filter(h => h && h.id && h.title && (h.type === 'live' || !h.progress || h.progress < 95)));
  }, [history]);

  const validHistory = useMemo(() => {
    return localHistory.filter(item => {
      if (!item || !item.id || !item.title) return false;
      if (item.type !== 'live' && typeof item.progress === 'number' && item.progress >= 95) {
        return false;
      }
      return true;
    });
  }, [localHistory]);

  // Format played timestamp into human-readable relative Portuguese text
  const formatPlayedAt = (isoString?: string): string => {
    if (!isoString) return 'Assistido recentemente';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Agora mesmo';
      if (diffMin < 60) return `Há ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Há ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 7) return `Há ${diffDays} dias`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return 'Assistido recentemente';
    }
  };

  // Carousel scroll helpers
  const scrollRef = (element: HTMLDivElement | null, distance: number) => {
    if (element) {
      element.scrollBy({ left: distance, behavior: 'smooth' });
    }
  };

  const historyRef = useRef<HTMLDivElement>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const moviesRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<HTMLDivElement>(null);
  const popMoviesRef = useRef<HTMLDivElement>(null);
  const popSeriesRef = useRef<HTMLDivElement>(null);
  const newReleasesRef = useRef<HTMLDivElement>(null);

  // Cache key per playlist
  const cacheKey = activePlaylist ? `foxstream_home_cache_${activePlaylist.id}` : null;

  // Initial data from memory cache or localStorage
  const initialCache = useMemo(() => {
    if (!cacheKey) return null;
    if (tmdbMemoryCache.has(cacheKey)) {
      return tmdbMemoryCache.get(cacheKey)!;
    }
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        tmdbMemoryCache.set(cacheKey, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
    return null;
  }, [cacheKey]);

  const [trendingItems, setTrendingItems] = useState<(MovieItem | SeriesItem)[]>(() => {
    if (initialCache?.trending?.length) return initialCache.trending;
    return [...movies.slice(0, 10), ...series.slice(0, 10)];
  });
  const [popularMoviesList, setPopularMoviesList] = useState<MovieItem[]>(() => {
    if (initialCache?.popularMovies?.length) return initialCache.popularMovies;
    return movies.slice(0, 15);
  });
  const [popularSeriesList, setPopularSeriesList] = useState<SeriesItem[]>(() => {
    if (initialCache?.popularSeries?.length) return initialCache.popularSeries;
    return series.slice(0, 15);
  });
  const [newReleasesList, setNewReleasesList] = useState<(MovieItem | SeriesItem)[]>(() => {
    if (initialCache?.newReleases?.length) return initialCache.newReleases;
    const currentYear = new Date().getFullYear().toString();
    const prevYear = (new Date().getFullYear() - 1).toString();
    const localReleases = [
      ...movies.filter(m => m.year === currentYear || m.year === prevYear),
      ...series.filter(s => s.year === currentYear || s.year === prevYear)
    ];
    const lastAdded = [...movies.slice(-15), ...series.slice(-15)];
    const combined: (MovieItem | SeriesItem)[] = [];
    const seen = new Set<string>();
    localReleases.forEach(item => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    });
    lastAdded.forEach(item => {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    });
    return combined.slice(0, 20);
  });

  // O(1) Pre-Indexed Category Maps to avoid repeating expensive 10k item filters in JSX
  const categoryIndex = useMemo(() => {
    const movieCatMap = new Map<string, MovieItem[]>();
    movies.forEach(m => {
      const k = m.category?.toLowerCase() || '';
      if (!movieCatMap.has(k)) movieCatMap.set(k, []);
      movieCatMap.get(k)!.push(m);
    });

    const seriesCatMap = new Map<string, SeriesItem[]>();
    series.forEach(s => {
      const k = s.category?.toLowerCase() || '';
      if (!seriesCatMap.has(k)) seriesCatMap.set(k, []);
      seriesCatMap.get(k)!.push(s);
    });

    const channelCatMap = new Map<string, LiveChannel[]>();
    channels.forEach(ch => {
      const k = ch.category?.toLowerCase() || '';
      if (!channelCatMap.has(k)) channelCatMap.set(k, []);
      channelCatMap.get(k)!.push(ch);
    });

    return { movieCatMap, seriesCatMap, channelCatMap };
  }, [movies, series, channels]);

  // Dynamic top categories extracted directly from playlist items for up to 10 carousels
  const topPlaylistCategories = useMemo(() => {
    const frequency: Record<string, number> = {};
    movies.forEach(m => {
      const c = m.category?.trim();
      if (c && c.toLowerCase() !== 'filmes' && c.toLowerCase() !== 'geral' && c.toLowerCase() !== 'todos') {
        frequency[c] = (frequency[c] || 0) + 1;
      }
    });
    series.forEach(s => {
      const c = s.category?.trim();
      if (c && c.toLowerCase() !== 'séries' && c.toLowerCase() !== 'geral' && c.toLowerCase() !== 'todos') {
        frequency[c] = (frequency[c] || 0) + 1;
      }
    });
    channels.forEach(ch => {
      const c = ch.category?.trim();
      if (c && c.toLowerCase() !== 'canais' && c.toLowerCase() !== 'tv ao vivo' && c.toLowerCase() !== 'geral' && c.toLowerCase() !== 'todos') {
        frequency[c] = (frequency[c] || 0) + 1;
      }
    });
    return Object.keys(frequency).sort((a, b) => frequency[b] - frequency[a]).slice(0, 10);
  }, [movies, series, channels]);

  // Featured List (carrossel de destaques)
  const featuredList = useMemo(() => {
    const list = trendingItems.length > 0 ? trendingItems : [...movies.slice(0, 5), ...series.slice(0, 5)];
    return list.slice(0, 8);
  }, [trendingItems, movies, series]);

  // Asynchronous TMDb Category Loader with Memory & LocalStorage Cache
  useEffect(() => {
    let isCancelled = false;

    // If cache was refreshed in the last 45 minutes, skip re-fetching
    if (initialCache && Date.now() - (initialCache.timestamp || 0) < 45 * 60 * 1000) {
      return;
    }

    const loadTmdbCategories = async () => {
      try {
        const [trendM, trendTv, popM, popTv, nowPlaying, airingTv] = await Promise.all([
          TmdbService.fetchTrendingMovies().catch(() => []),
          TmdbService.fetchTrendingTv().catch(() => []),
          TmdbService.fetchPopularMovies().catch(() => []),
          TmdbService.fetchPopularTv().catch(() => []),
          TmdbService.fetchNowPlayingMovies().catch(() => []),
          TmdbService.fetchCategoryList('tv/on_the_air', true).catch(() => [])
        ]);
        if (isCancelled) return;

        // 1. Destaques
        const matchedTrending: (MovieItem | SeriesItem)[] = [];
        trendM.forEach(tmdb => {
          matchedTrending.push({
            id: `tmdb_trending_m_${tmdb.tmdbId}`,
            playlistId: '',
            name: tmdb.title || '',
            posterUrl: tmdb.poster,
            backdropUrl: tmdb.backdrop,
            category: 'TMDb',
            year: tmdb.year,
            rating: tmdb.rating,
            description: tmdb.plot
          } as any);
        });
        trendTv.forEach(tmdb => {
          matchedTrending.push({
            id: `tmdb_trending_s_${tmdb.tmdbId}`,
            playlistId: '',
            name: tmdb.title || '',
            posterUrl: tmdb.poster,
            backdropUrl: tmdb.backdrop,
            category: 'TMDb',
            year: tmdb.year,
            rating: tmdb.rating,
            description: tmdb.plot,
            seasons: []
          } as any);
        });
        const finalTrending = matchedTrending.slice(0, 15);
        setTrendingItems(finalTrending);

        // 2. Filmes Populares
        const matchedPopM: MovieItem[] = popM.map(tmdb => ({
          id: `tmdb_movie_${tmdb.tmdbId}`,
          playlistId: '',
          name: tmdb.title || '',
          streamUrl: '',
          posterUrl: tmdb.poster,
          backdropUrl: tmdb.backdrop,
          category: 'TMDb',
          year: tmdb.year,
          rating: tmdb.rating,
          description: tmdb.plot
        })).slice(0, 15);
        setPopularMoviesList(matchedPopM);

        // 3. Séries Populares
        const matchedPopTv: SeriesItem[] = popTv.map(tmdb => ({
          id: `tmdb_series_${tmdb.tmdbId}`,
          playlistId: '',
          name: tmdb.title || '',
          posterUrl: tmdb.poster,
          backdropUrl: tmdb.backdrop,
          category: 'TMDb',
          year: tmdb.year,
          rating: tmdb.rating,
          description: tmdb.plot,
          seasons: []
        })).slice(0, 15);
        setPopularSeriesList(matchedPopTv);

        // 4. Lançamentos
        const matchedReleases: (MovieItem | SeriesItem)[] = [
          ...nowPlaying.map(tmdb => ({
            id: `tmdb_release_m_${tmdb.tmdbId}`,
            playlistId: '',
            name: tmdb.title || '',
            streamUrl: '',
            posterUrl: tmdb.poster,
            backdropUrl: tmdb.backdrop,
            category: 'TMDb',
            year: tmdb.year,
            rating: tmdb.rating,
            description: tmdb.plot
          } as any)),
          ...airingTv.map(tmdb => ({
            id: `tmdb_release_s_${tmdb.tmdbId}`,
            playlistId: '',
            name: tmdb.title || '',
            posterUrl: tmdb.poster,
            backdropUrl: tmdb.backdrop,
            category: 'TMDb',
            year: tmdb.year,
            rating: tmdb.rating,
            description: tmdb.plot,
            seasons: []
          } as any))
        ].slice(0, 20);
        setNewReleasesList(matchedReleases);

        // Save into memory cache and write to localStorage in background without blocking UI
        if (cacheKey) {
          const payload = {
            trending: finalTrending,
            popularMovies: matchedPopM,
            popularSeries: matchedPopTv,
            newReleases: matchedReleases,
            timestamp: Date.now()
          };
          tmdbMemoryCache.set(cacheKey, payload);
          setTimeout(() => {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(payload));
            } catch {
              // ignore
            }
          }, 0);
        }
      } catch (err) {
        console.warn('Error loading TMDb categories:', err);
      }
    };

    loadTmdbCategories();

    return () => {
      isCancelled = true;
    };
  }, [cacheKey, initialCache]);

  // If no playlist is loaded, show welcoming setup hero
  if (!activePlaylist) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 pb-24 text-center space-y-6 animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-orange-600 via-amber-500 to-red-500 flex items-center justify-center mx-auto shadow-2xl shadow-orange-950/60 text-white">
          <Tv className="w-10 h-10 stroke-[2.2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black text-white font-['Outfit'] tracking-tight">
            Bem-vindo ao <span className="text-orange-500">FoxStream</span>
          </h1>
          <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
            Seu catálogo IPTV moderno, rápido e seguro. Conecte sua conta Xtream Codes ou adicione sua lista M3U/M3U8 para começar.
          </p>
        </div>

        {/* Feature Highlights Bento */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left py-4">
          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
              <Tv className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">TV ao Vivo</h4>
            <p className="text-[11px] text-neutral-400 mt-1">
              Canais categorizados e organizados sem misturar filmes ou séries.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2">
              <Film className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Filmes & VOD</h4>
            <p className="text-[11px] text-neutral-400 mt-1">
              Posters em alta definição, sinopses e detalhes completos.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-2">
              <Clapperboard className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Séries & Temporadas</h4>
            <p className="text-[11px] text-neutral-400 mt-1">
              Agrupamento automático de temporadas e episódios por série.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-orange-500 via-amber-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-3.5 px-8 rounded-2xl text-sm shadow-xl shadow-orange-950/50 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Adicionar Minha Lista</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 overflow-x-hidden animate-in fade-in duration-200">
      {/* 1. Featured Header Banner Carousel (Isolated to avoid re-rendering HomeScreen on timer ticks) */}
      <FeaturedHeaderBanner
        featuredList={featuredList}
        onSelectMovie={onSelectMovie}
        onSelectSeries={onSelectSeries}
      />

      {/* If a specific category is selected, render its items */}
      {selectedCategory !== 'Todos' && (
        <div className="space-y-6">
          {(() => {
            const k = selectedCategory.toLowerCase();
            const catMovies = categoryIndex.movieCatMap.get(k) || [];
            const catSeries = categoryIndex.seriesCatMap.get(k) || [];
            const catChannels = categoryIndex.channelCatMap.get(k) || [];

            return (
              <>
                {catMovies.length > 0 && (
                  <section className="px-4 max-w-7xl mx-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-amber-400" />
                        <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                          {selectedCategory} (Filmes)
                        </h2>
                        <span className="text-xs text-neutral-500 font-medium">({catMovies.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('movies')}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                      >
                        Ver na aba Filmes <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                      {catMovies.slice(0, 24).map(movie => (
                        <div
                          key={`cat_m_${movie.id}`}
                          onClick={() => onSelectMovie(movie)}
                          className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                        >
                          <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                            {movie.posterUrl ? (
                              <img
                                src={movie.posterUrl}
                                alt={movie.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900"><Film className="w-8 h-8" /></div>
                            )}
                            {movie.year && (
                              <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{movie.year}</span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{movie.name}</h4>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {catSeries.length > 0 && (
                  <section className="px-4 max-w-7xl mx-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clapperboard className="w-4 h-4 text-rose-400" />
                        <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                          {selectedCategory} (Séries)
                        </h2>
                        <span className="text-xs text-neutral-500 font-medium">({catSeries.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('series')}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                      >
                        Ver na aba Séries <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                      {catSeries.slice(0, 24).map(s => (
                        <div
                          key={`cat_s_${s.id}`}
                          onClick={() => onSelectSeries(s)}
                          className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-rose-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                        >
                          <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                            {s.posterUrl ? (
                              <img
                                src={s.posterUrl}
                                alt={s.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900"><Clapperboard className="w-8 h-8" /></div>
                            )}
                            <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                              {s.seasons?.length || 1} Temp
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{s.name}</h4>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {catChannels.length > 0 && (
                  <section className="px-4 max-w-7xl mx-auto space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tv className="w-4 h-4 text-orange-500" />
                        <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                          {selectedCategory} (Canais)
                        </h2>
                        <span className="text-xs text-neutral-500 font-medium">({catChannels.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('live')}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                      >
                        Ver na aba TV ao Vivo <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                      {catChannels.slice(0, 24).map(ch => (
                        <div
                          key={`cat_ch_${ch.id}`}
                          onClick={() => onPlayChannel(ch)}
                          className="group relative flex-shrink-0 w-36 sm:w-44 p-3 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-orange-500/60 cursor-pointer transition-all active:scale-95 shadow-md"
                        >
                          <div className="w-full h-20 rounded-xl bg-neutral-900/90 flex items-center justify-center p-2 mb-2 relative overflow-hidden border border-neutral-800">
                            {ch.logoUrl ? (
                              <img
                                src={ch.logoUrl}
                                alt={ch.name}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                decoding="async"
                                className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-200"
                              />
                            ) : (
                              <Tv className="w-8 h-8 text-neutral-600" />
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{ch.name}</h4>
                          <p className="text-[10px] text-neutral-500 truncate mt-0.5">{ch.category}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* MAIN HOMESCREEN SECTIONS */}
      {selectedCategory === 'Todos' && (
        <>
          {/* SECTION 1: CONTINUE ASSISTINDO (History) - Visible ONLY when there are items */}
          {validHistory.length > 0 && (
            <section className="px-4 max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Play className="w-3.5 h-3.5 fill-orange-400 text-orange-400 ml-0.5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                Continue Assistindo
              </h2>
              <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                {validHistory.length} {validHistory.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scrollRef(historyRef.current, -300)}
                className="p-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer transition-colors"
                aria-label="Rolar para esquerda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollRef(historyRef.current, 300)}
                className="p-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer transition-colors"
                aria-label="Rolar para direita"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={historyRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
          >
            {validHistory.slice(0, 20).map((item) => {
              const seriesMatch = item.type === 'series'
                ? series.find(s => 
                    s.name.toLowerCase() === (item.seriesName || item.title.split(' - ')[0]).trim().toLowerCase() ||
                    item.title.toLowerCase().startsWith(s.name.toLowerCase()) ||
                    s.seasons?.some(se => se.episodes?.some(ep => ep.streamUrl === item.streamUrl))
                  )
                : null;
              const itemPoster = item.type === 'series'
                ? (seriesMatch?.posterUrl || item.posterUrl)
                : (item.posterUrl || (item.type === 'movie' ? movies.find(m => m.streamUrl === item.streamUrl)?.posterUrl : channels.find(ch => ch.streamUrl === item.streamUrl)?.logoUrl));

              return (
                <div
                  key={item.id}
                  onClick={() => onPlayHistoryItem(item)}
                  className="group relative flex-shrink-0 w-64 sm:w-72 p-3 rounded-2xl bg-[#11131b] hover:bg-[#161924] border border-neutral-800/90 hover:border-orange-500/60 transition-all cursor-pointer shadow-md hover:shadow-orange-950/20 active:scale-98 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
                      {itemPoster ? (
                        <img 
                          src={itemPoster} 
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : item.type === 'live' ? (
                        <Tv className="w-6 h-6 text-orange-400" />
                      ) : item.type === 'movie' ? (
                        <Film className="w-6 h-6 text-amber-400" />
                      ) : (
                        <Clapperboard className="w-6 h-6 text-rose-400" />
                      )}

                      {/* Hover play icon badge */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-5 h-5 fill-white text-white drop-shadow ml-0.5" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded tracking-wider ${
                          item.type === 'live' 
                            ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' 
                            : item.type === 'movie' 
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          {item.type === 'live' ? 'TV ao Vivo' : item.type === 'movie' ? 'Filme' : 'Série'}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-neutral-100 group-hover:text-orange-400 truncate mt-1 transition-colors">
                        {item.title}
                      </h4>

                      {item.seriesName && (
                        <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-medium">
                          {item.seriesName} {item.seasonEpisode ? `(${item.seasonEpisode})` : ''}
                        </p>
                      )}

                      {/* Progress bar for movies and series */}
                      {item.type !== 'live' && typeof item.progress === 'number' && item.progress > 0 && (
                        <div className="w-full bg-neutral-800 rounded-full h-1 mt-1.5 overflow-hidden">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(5, item.progress))}%` }}
                          />
                        </div>
                      )}

                      <p className="text-[10px] text-neutral-500 truncate mt-1">
                        {item.type !== 'live' && typeof item.progress === 'number' && item.progress > 0 
                          ? `${item.progress}% concluído • ${formatPlayedAt(item.playedAt)}`
                          : formatPlayedAt(item.playedAt)
                        }
                      </p>
                    </div>
                  </div>

                  {/* Quick remove button */}
                  <button
                    type="button"
                    title="Remover de Continue Assistindo"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHistoryItem?.(item.id);
                      setLocalHistory(prev => prev.filter(h => h.id !== item.id));
                    }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-neutral-900/80 hover:bg-red-500/20 text-neutral-500 hover:text-red-400 border border-neutral-800 hover:border-red-500/40 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: FAVORITOS */}
      {favorites.length > 0 && (
        <section className="px-4 max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                Favoritos
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('favorites')}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
            >
              Ver todos <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            ref={favoritesRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
          >
            {favorites.slice(0, 20).map((fav) => (
              <div
                key={fav.id}
                onClick={() => {
                  if (fav.type === 'live') {
                    onPlayChannel({
                      id: fav.contentId,
                      playlistId: activePlaylist?.id || '',
                      name: fav.title,
                      streamUrl: fav.streamUrl || '',
                      category: fav.category || 'TV ao Vivo'
                    });
                  } else if (fav.type === 'movie') {
                    const match = movies.find(m => m.id === fav.contentId);
                    if (match) onSelectMovie(match);
                  } else {
                    const match = series.find(s => s.id === fav.contentId);
                    if (match) onSelectSeries(match);
                  }
                }}
                className="group relative flex-shrink-0 w-36 sm:w-44 p-2 rounded-2xl bg-neutral-900/60 hover:bg-neutral-800/70 border border-neutral-800 cursor-pointer transition-all active:scale-95"
              >
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                  {fav.posterUrl ? (
                    <img
                      src={fav.posterUrl}
                      alt={fav.title}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      {fav.type === 'live' ? <Tv className="w-8 h-8" /> : fav.type === 'movie' ? <Film className="w-8 h-8" /> : <Clapperboard className="w-8 h-8" />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                    <span className="p-2 rounded-full bg-orange-500 text-white shadow-lg">
                      <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
                    </span>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-neutral-200 truncate group-hover:text-white">
                  {fav.title}
                </h4>
                <p className="text-[10px] text-neutral-500 truncate">{fav.category}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: TV AO VIVO (Carousel) */}
      <section className="px-4 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-orange-500" />
            <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
              TV ao Vivo
            </h2>
            <span className="text-xs text-neutral-500 font-medium">
              ({channels.length} canais)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('live')}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {channels.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-500 text-xs">
            Nenhum canal ao vivo encontrado nesta lista.
          </div>
        ) : (
          <div
            ref={liveRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
          >
            {channels.slice(0, 20).map((channel) => (
              <div
                key={channel.id}
                onClick={() => onPlayChannel(channel)}
                className="group relative flex-shrink-0 w-36 sm:w-44 p-3 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-orange-500/60 cursor-pointer transition-all active:scale-95 shadow-md flex flex-col justify-between"
              >
                <div className="w-full h-20 rounded-xl bg-neutral-900/90 flex items-center justify-center p-2 mb-2 relative overflow-hidden border border-neutral-800">
                  {channel.logoUrl ? (
                    <img
                      src={channel.logoUrl}
                      alt={channel.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Tv className="w-8 h-8 text-neutral-600" />
                  )}
                  <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-red-600/90 text-white text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Ao Vivo
                  </span>
                </div>

                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                    {channel.name}
                  </h4>
                  <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                    {channel.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: FILMES (Carousel) */}
      <section className="px-4 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-amber-400" />
            <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
              Filmes
            </h2>
            <span className="text-xs text-neutral-500 font-medium">
              ({movies.length} títulos)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('movies')}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
          >
            Ver catálogo de filmes <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {movies.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-500 text-xs">
            Nenhum filme catalogado nesta lista.
          </div>
        ) : (
          <div
            ref={moviesRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
          >
            {movies.slice(0, 20).map((movie) => (
              <div
                key={movie.id}
                onClick={() => onSelectMovie(movie)}
                className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
              >
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                      <Film className="w-8 h-8" />
                    </div>
                  )}

                  {movie.year && (
                    <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      {movie.year}
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                  {movie.name}
                </h4>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 5: SÉRIES (Carousel) */}
      <section className="px-4 max-w-7xl mx-auto space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-rose-400" />
            <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
              Séries
            </h2>
            <span className="text-xs text-neutral-500 font-medium">
              ({series.length} séries)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('series')}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
          >
            Ver todas as séries <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {series.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800/80 text-neutral-500 text-xs">
            Nenhuma série catalogada nesta lista.
          </div>
        ) : (
          <div
            ref={seriesRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
          >
            {series.slice(0, 20).map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSeries(s)}
                className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-rose-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
              >
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                  {s.posterUrl ? (
                    <img
                      src={s.posterUrl}
                      alt={s.name}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                      <Clapperboard className="w-8 h-8" />
                    </div>
                  )}

                  <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                    {s.seasons?.length || 1} Temp
                  </span>
                </div>

                <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                  {s.name}
                </h4>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 7: FILMES POPULARES (TMDb Popular Movies) - Lazy loaded on user scroll */}
      {popularMoviesList.length > 0 && (
        <LazySection minHeight="280px" rootMargin="350px">
          <section className="px-4 max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                  Filmes populares
                </h2>
                <span className="text-xs text-neutral-500 font-medium">
                  (TMDb)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('movies')}
                className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
              >
                Ver mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={popMoviesRef}
              className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
            >
              {popularMoviesList.map((movie) => (
                <div
                  key={`pop_movie_${movie.id}`}
                  onClick={() => onSelectMovie(movie)}
                  className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                >
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                    {movie.posterUrl ? (
                      <img
                        src={movie.posterUrl}
                        alt={movie.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                        <Film className="w-8 h-8" />
                      </div>
                    )}

                    {movie.rating ? (
                      <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                        ★ {movie.rating}
                      </span>
                    ) : movie.year ? (
                      <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {movie.year}
                      </span>
                    ) : null}
                  </div>

                  <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                    {movie.name}
                  </h4>
                </div>
              ))}
            </div>
          </section>
        </LazySection>
      )}

      {/* SECTION 8: SÉRIES POPULARES (TMDb Popular TV) - Lazy loaded on user scroll */}
      {popularSeriesList.length > 0 && (
        <LazySection minHeight="280px" rootMargin="350px">
          <section className="px-4 max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-400" />
                <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                  Séries populares
                </h2>
                <span className="text-xs text-neutral-500 font-medium">
                  (TMDb)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('series')}
                className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
              >
                Ver mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={popSeriesRef}
              className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
            >
              {popularSeriesList.map((s) => (
                <div
                  key={`pop_series_${s.id}`}
                  onClick={() => onSelectSeries(s)}
                  className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-rose-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                >
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                    {s.posterUrl ? (
                      <img
                        src={s.posterUrl}
                        alt={s.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                        <Clapperboard className="w-8 h-8" />
                      </div>
                    )}

                    <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      {s.seasons?.length || 1} Temp
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                    {s.name}
                  </h4>
                </div>
              ))}
            </div>
          </section>
        </LazySection>
      )}

      {/* SECTION 9: LANÇAMENTOS (Now Playing & Airing Releases) - Lazy loaded on user scroll */}
      {newReleasesList.length > 0 && (
        <LazySection minHeight="280px" rootMargin="350px">
          <section className="px-4 max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                  Lançamentos
                </h2>
                <span className="text-xs text-neutral-500 font-medium">
                  (Em Cartaz)
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('movies')}
                className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
              >
                Ver mais <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={newReleasesRef}
              className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1"
            >
              {newReleasesList.map((item) => {
                const isMovie = 'streamUrl' in item;
                return (
                  <div
                    key={`release_${item.id}`}
                    onClick={() => isMovie ? onSelectMovie(item as MovieItem) : onSelectSeries(item as SeriesItem)}
                    className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-emerald-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                  >
                    <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                      {item.posterUrl ? (
                        <img
                          src={item.posterUrl}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                          {isMovie ? <Film className="w-8 h-8" /> : <Clapperboard className="w-8 h-8" />}
                        </div>
                      )}

                      {item.year && (
                        <span className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          {item.year}
                        </span>
                      )}

                      {!isMovie && (
                        <span className="absolute bottom-2 left-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          Série
                        </span>
                      )}

                      {item.rating && (
                        <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          ★ {item.rating}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                      {item.name}
                    </h4>
                  </div>
                );
              })}
            </div>
          </section>
        </LazySection>
      )}

      {/* SECTION 10: CARROSSÉIS DE CATEGORIAS DA LISTA IPTV - Renderizados SOB DEMANDA (Lazy on Scroll) */}
      {topPlaylistCategories.map((catName) => {
        const k = catName.toLowerCase();
        const catMovies = categoryIndex.movieCatMap.get(k) || [];
        const catSeries = categoryIndex.seriesCatMap.get(k) || [];
        const catChannels = categoryIndex.channelCatMap.get(k) || [];

        if (catMovies.length > 0) {
          return (
            <LazySection key={`top_cat_${catName}`} minHeight="260px" rootMargin="350px">
              <section className="px-4 max-w-7xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-orange-400" />
                    <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                      {catName}
                    </h2>
                    <span className="text-xs text-neutral-500 font-medium">({catMovies.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('movies')}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                  >
                    Ver todos <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                  {catMovies.slice(0, 20).map(movie => (
                    <div
                      key={`top_cat_m_${movie.id}`}
                      onClick={() => onSelectMovie(movie)}
                      className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-amber-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                    >
                      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900"><Film className="w-8 h-8" /></div>
                        )}
                        {movie.year && (
                          <span className="absolute top-2 left-2 bg-black/70 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{movie.year}</span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{movie.name}</h4>
                    </div>
                  ))}
                </div>
              </section>
            </LazySection>
          );
        }

        if (catSeries.length > 0) {
          return (
            <LazySection key={`top_cat_${catName}`} minHeight="260px" rootMargin="350px">
              <section className="px-4 max-w-7xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-rose-400" />
                    <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                      {catName}
                    </h2>
                    <span className="text-xs text-neutral-500 font-medium">({catSeries.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('series')}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                  >
                    Ver todos <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                  {catSeries.slice(0, 20).map(s => (
                    <div
                      key={`top_cat_s_${s.id}`}
                      onClick={() => onSelectSeries(s)}
                      className="group relative flex-shrink-0 w-32 sm:w-44 p-2 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-rose-500/50 cursor-pointer transition-all active:scale-95 shadow-md"
                    >
                      <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                        {s.posterUrl ? (
                          <img
                            src={s.posterUrl}
                            alt={s.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900"><Clapperboard className="w-8 h-8" /></div>
                        )}
                        <span className="absolute bottom-2 right-2 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                          {s.seasons?.length || 1} Temp
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{s.name}</h4>
                    </div>
                  ))}
                </div>
              </section>
            </LazySection>
          );
        }

        if (catChannels.length > 0) {
          return (
            <LazySection key={`top_cat_${catName}`} minHeight="260px" rootMargin="350px">
              <section className="px-4 max-w-7xl mx-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-orange-500" />
                    <h2 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
                      {catName}
                    </h2>
                    <span className="text-xs text-neutral-500 font-medium">({catChannels.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('live')}
                    className="text-xs font-semibold text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer"
                  >
                    Ver todos <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1">
                  {catChannels.slice(0, 20).map(ch => (
                    <div
                      key={`top_cat_ch_${ch.id}`}
                      onClick={() => onPlayChannel(ch)}
                      className="group relative flex-shrink-0 w-36 sm:w-44 p-3 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-orange-500/60 cursor-pointer transition-all active:scale-95 shadow-md"
                    >
                      <div className="w-full h-20 rounded-xl bg-neutral-900/90 flex items-center justify-center p-2 mb-2 relative overflow-hidden border border-neutral-800">
                        {ch.logoUrl ? (
                          <img
                            src={ch.logoUrl}
                            alt={ch.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-200"
                          />
                        ) : (
                          <Tv className="w-8 h-8 text-neutral-600" />
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">{ch.name}</h4>
                      <p className="text-[10px] text-neutral-500 truncate mt-0.5">{ch.category}</p>
                    </div>
                  ))}
                </div>
              </section>
            </LazySection>
          );
        }

        return null;
      })}
        </>
      )}
    </div>
  );
};
