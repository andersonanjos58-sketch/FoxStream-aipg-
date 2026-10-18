import React, { useState, useEffect } from 'react';
import { 
  Play, Tv, Film, Clapperboard, Heart, ChevronRight, 
  Sparkles, TrendingUp, Star, Flame, Trophy, Compass,
  Calendar, Award
} from 'lucide-react';
import { LiveChannel, MovieItem, SeriesItem, HistoryItem, FavoriteItem, Playlist } from '../types';
import { TmdbService, TmdbData } from '../services/tmdbService';
import { TmdbSpotlightBanner } from './TmdbSpotlightBanner';
import { TmdbCategoryRow } from './TmdbCategoryRow';
import { HeroBannerSkeleton, RowSkeleton } from './SkeletonLoaders';

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
  onSelectTmdbMedia,
}) => {
  // TMDB Showcase States
  const [trendingAll, setTrendingAll] = useState<TmdbData[]>([]);
  const [popularMovies, setPopularMovies] = useState<TmdbData[]>([]);
  const [popularTv, setPopularTv] = useState<TmdbData[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TmdbData[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TmdbData[]>([]);
  const [actionMovies, setActionMovies] = useState<TmdbData[]>([]);
  const [scifiMovies, setScifiMovies] = useState<TmdbData[]>([]);
  const [animationMovies, setAnimationMovies] = useState<TmdbData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load TMDB Showcase Content
  useEffect(() => {
    let isMounted = true;

    const loadShowcase = async () => {
      setIsLoading(true);
      try {
        const [
          trendingRes,
          popMoviesRes,
          popTvRes,
          topMoviesRes,
          nowPlayingRes,
          actionRes,
          scifiRes,
          animRes,
        ] = await Promise.all([
          TmdbService.fetchTrending('all', 'week').catch(() => []),
          TmdbService.fetchPopularMovies(1).catch(() => []),
          TmdbService.fetchPopularTv(1).catch(() => []),
          TmdbService.fetchTopRatedMovies(1).catch(() => []),
          TmdbService.fetchNowPlayingMovies(1).catch(() => []),
          TmdbService.fetchMoviesByGenre(28, 1).catch(() => []), // Action
          TmdbService.fetchMoviesByGenre(878, 1).catch(() => []), // Sci-Fi
          TmdbService.fetchMoviesByGenre(16, 1).catch(() => []), // Animation
        ]);

        if (isMounted) {
          setTrendingAll(trendingRes);
          setPopularMovies(popMoviesRes);
          setPopularTv(popTvRes);
          setTopRatedMovies(topMoviesRes);
          setNowPlayingMovies(nowPlayingRes);
          setActionMovies(actionRes);
          setScifiMovies(scifiRes);
          setAnimationMovies(animRes);
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('[HomeScreen] TMDB Showcase load error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    loadShowcase();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectTmdbItem = (item: TmdbData, defaultType: 'movie' | 'tv' = 'movie') => {
    const isTv = defaultType === 'tv' || trendingAll.some(t => t.tmdbId === item.tmdbId && popularTv.some(pt => pt.tmdbId === item.tmdbId));
    
    if (onSelectTmdbMedia) {
      onSelectTmdbMedia({
        id: item.tmdbId || item.title || '',
        mediaType: isTv ? 'tv' : 'movie',
        title: item.title || '',
        poster: item.poster,
        backdrop: item.backdrop,
        year: item.year,
        rating: item.rating,
        overview: item.plot,
      });
      return;
    }

    // Fallback if onSelectTmdbMedia not attached
    if (isTv) {
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
    } else {
      onSelectMovie({
        id: `tmdb_m_${item.tmdbId}`,
        playlistId: '',
        name: item.title || '',
        streamUrl: '',
        posterUrl: item.poster,
        backdropUrl: item.backdrop,
        category: 'TMDb',
        year: item.year,
        rating: item.rating,
        description: item.plot,
      });
    }
  };

  return (
    <div className="w-full min-h-screen text-white pb-24 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto pt-4">
      {/* 1. Hero Spotlight Carousel */}
      {isLoading ? (
        <HeroBannerSkeleton />
      ) : (
        <TmdbSpotlightBanner
          items={trendingAll.length > 0 ? trendingAll : popularMovies}
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />
      )}

      {/* 2. Quick Navigation Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 pt-1 mb-4 custom-scrollbar">
        <button
          type="button"
          onClick={() => onNavigateTab('movies')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-neutral-200 transition-all active:scale-95 shrink-0"
        >
          <Film className="w-4 h-4 text-orange-400" />
          <span>Filmes TMDB</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('series')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-neutral-200 transition-all active:scale-95 shrink-0"
        >
          <Tv className="w-4 h-4 text-amber-400" />
          <span>Séries TMDB</span>
        </button>

        {channels.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigateTab('live')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs sm:text-sm font-semibold text-neutral-200 transition-all active:scale-95 shrink-0"
          >
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>TV ao Vivo ({channels.length})</span>
          </button>
        )}

        {favorites.length > 0 && (
          <button
            type="button"
            onClick={() => onNavigateTab('favorites')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs sm:text-sm font-semibold text-rose-300 transition-all active:scale-95 shrink-0"
          >
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
            <span>Favoritos ({favorites.length})</span>
          </button>
        )}
      </div>

      {/* 3. Continue Watching (History) if available */}
      {history.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Play className="w-4 h-4 text-orange-500 fill-orange-500" />
              <span>Continuar Assistindo</span>
            </h2>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto pb-3 custom-scrollbar">
            {history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                onClick={() => onPlayHistoryItem(item)}
                className="group relative shrink-0 w-44 sm:w-52 aspect-video rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-orange-500/50 shadow-md cursor-pointer transition-all hover:scale-105"
              >
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover filter brightness-75"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-950 p-2 text-center text-xs text-neutral-400">
                    {item.title}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-2.5">
                  <span className="text-xs font-bold text-white truncate drop-shadow">
                    {item.title}
                  </span>
                  {item.seasonEpisode && (
                    <span className="text-[10px] text-orange-400 font-mono">
                      {item.seasonEpisode}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. TMDB Showcase Category Carousels */}
      <div className="space-y-6 sm:space-y-8">
        {/* Em Alta Esta Semana */}
        <TmdbCategoryRow
          title="Em Alta Esta Semana"
          icon={<TrendingUp className="w-5 h-5" />}
          items={trendingAll}
          isLoading={isLoading}
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />

        {/* Filmes Populares */}
        <TmdbCategoryRow
          title="Filmes Populares"
          icon={<Flame className="w-5 h-5" />}
          items={popularMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
          onSeeAll={() => onNavigateTab('movies')}
        />

        {/* Séries Populares */}
        <TmdbCategoryRow
          title="Séries Mais Assistidas"
          icon={<Tv className="w-5 h-5" />}
          items={popularTv}
          isLoading={isLoading}
          mediaType="tv"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'tv')}
          onSeeAll={() => onNavigateTab('series')}
        />

        {/* Lançamentos no Cinema */}
        <TmdbCategoryRow
          title="Lançamentos nos Cinemas"
          icon={<Calendar className="w-5 h-5" />}
          items={nowPlayingMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />

        {/* Mais Bem Avaliados */}
        <TmdbCategoryRow
          title="Mais Votados de Todos os Tempos"
          icon={<Trophy className="w-5 h-5" />}
          items={topRatedMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />

        {/* Ação e Aventura */}
        <TmdbCategoryRow
          title="Ação & Aventura"
          icon={<Award className="w-5 h-5" />}
          items={actionMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />

        {/* Ficção Científica */}
        <TmdbCategoryRow
          title="Ficção Científica & Futuro"
          icon={<Sparkles className="w-5 h-5" />}
          items={scifiMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />

        {/* Animação */}
        <TmdbCategoryRow
          title="Animação para Todas as Idades"
          icon={<Film className="w-5 h-5" />}
          items={animationMovies}
          isLoading={isLoading}
          mediaType="movie"
          onSelectItem={(item) => handleSelectTmdbItem(item, 'movie')}
        />
      </div>
    </div>
  );
};
