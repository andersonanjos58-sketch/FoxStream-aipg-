import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Tv, Film, Play, Sparkles, Star } from 'lucide-react';
import { LiveChannel, MovieItem, SeriesItem, TmdbMediaItem } from '../types';
import { TmdbService } from '../services/tmdbService';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  onPlayChannel: (channel: LiveChannel) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
  searchScope?: 'ALL' | 'MOVIE' | 'SERIES';
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

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  channels,
  movies,
  series,
  onPlayChannel,
  onSelectMovie,
  onSelectSeries,
  searchScope = 'ALL',
  onSelectTmdbMedia,
}) => {
  const [query, setQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TmdbMediaItem[]>([]);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);

  const trimmed = query.trim().toLowerCase();

  // Search TMDB live with 300ms debounce
  useEffect(() => {
    if (!trimmed || trimmed.length < 2) {
      setTmdbResults([]);
      setIsSearchingTmdb(false);
      return;
    }

    let isMounted = true;
    setIsSearchingTmdb(true);

    const timer = setTimeout(async () => {
      try {
        const results = await TmdbService.searchMulti(trimmed);
        if (isMounted) {
          // Filter by scope if needed
          let filtered = results;
          if (searchScope === 'MOVIE') filtered = results.filter((r) => r.mediaType === 'movie');
          if (searchScope === 'SERIES') filtered = results.filter((r) => r.mediaType === 'tv');
          setTmdbResults(filtered.slice(0, 16));
          setIsSearchingTmdb(false);
        }
      } catch (err) {
        if (isMounted) setIsSearchingTmdb(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [trimmed, searchScope]);

  // Local live channels search
  const matchedChannels = useMemo(() => {
    if (!trimmed || searchScope !== 'ALL') return [];
    return (channels || [])
      .filter(
        (c) =>
          c &&
          ((c.name || '').toLowerCase().includes(trimmed) ||
            (c.category || '').toLowerCase().includes(trimmed))
      )
      .slice(0, 8);
  }, [channels, trimmed, searchScope]);

  if (!isOpen) return null;

  const handleSelectTmdb = (item: TmdbMediaItem) => {
    if (onSelectTmdbMedia) {
      onSelectTmdbMedia({
        id: item.id,
        mediaType: item.mediaType,
        title: item.title,
        poster: item.posterPath,
        backdrop: item.backdropPath,
        year: item.year,
        rating: item.voteAverage ? `${item.voteAverage.toFixed(1)}/10` : undefined,
        overview: item.overview,
      });
      onClose();
      return;
    }

    if (item.mediaType === 'tv') {
      onSelectSeries({
        id: `tmdb_tv_${item.id}`,
        playlistId: '',
        name: item.title,
        posterUrl: item.posterPath,
        backdropUrl: item.backdropPath,
        category: 'TMDb',
        year: item.year,
        rating: item.voteAverage ? `${item.voteAverage.toFixed(1)}/10` : undefined,
        description: item.overview,
        seasons: [],
      });
    } else {
      onSelectMovie({
        id: `tmdb_m_${item.id}`,
        playlistId: '',
        name: item.title,
        streamUrl: '',
        posterUrl: item.posterPath,
        backdropUrl: item.backdropPath,
        category: 'TMDb',
        year: item.year,
        rating: item.voteAverage ? `${item.voteAverage.toFixed(1)}/10` : undefined,
        description: item.overview,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl max-h-[88vh] bg-[#11131b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col mt-4 sm:mt-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800 bg-[#0d0f17]">
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar filmes, séries e canais..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-neutral-500 focus:outline-none"
          />
          {isSearchingTmdb && (
            <div className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin shrink-0" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-full text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Results */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {!trimmed ? (
            <div className="py-16 text-center text-neutral-500 text-sm space-y-2">
              <Sparkles className="w-8 h-8 text-neutral-600 mx-auto" />
              <p>Digite o nome de qualquer filme ou série para buscar em todo o catálogo TMDB.</p>
            </div>
          ) : tmdbResults.length === 0 && matchedChannels.length === 0 && !isSearchingTmdb ? (
            <div className="py-16 text-center text-neutral-400 text-sm">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <div className="space-y-6">
              {/* TMDB Results */}
              {tmdbResults.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" />
                    <span>Catálogo TMDB ({tmdbResults.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {tmdbResults.map((item) => (
                      <div
                        key={`${item.mediaType}_${item.id}`}
                        onClick={() => handleSelectTmdb(item)}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-white/5 hover:border-orange-500/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-14 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                            {item.posterPath ? (
                              <img
                                src={item.posterPath}
                                alt={item.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Film className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-orange-400 truncate">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-1">
                              <span className="uppercase text-orange-400 font-semibold">
                                {item.mediaType === 'tv' ? 'Série' : 'Filme'}
                              </span>
                              {item.year && <span>• {item.year}</span>}
                              {item.voteAverage > 0 && (
                                <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                  <Star className="w-3 h-3 fill-amber-400" />
                                  {item.voteAverage.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Play className="w-4 h-4 fill-orange-500 text-orange-500 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels Results */}
              {matchedChannels.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    <Tv className="w-4 h-4" />
                    <span>Canais ao Vivo ({matchedChannels.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {matchedChannels.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          onPlayChannel(ch);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-neutral-900/80 hover:bg-neutral-800/90 border border-white/5 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                            {ch.logoUrl ? (
                              <img
                                src={ch.logoUrl}
                                alt={ch.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <Tv className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 truncate">
                              {ch.name}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{ch.category}</p>
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
