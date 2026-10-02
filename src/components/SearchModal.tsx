import React, { useState, useMemo } from 'react';
import { Search, X, Tv, Film, Clapperboard, Play, ArrowRight } from 'lucide-react';
import { LiveChannel, MovieItem, SeriesItem } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  onPlayChannel: (channel: LiveChannel) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  channels,
  movies,
  series,
  onPlayChannel,
  onSelectMovie,
  onSelectSeries
}) => {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) {
      return {
        channels: [],
        movies: [],
        series: [],
        total: 0
      };
    }

    const matchedChannels = (channels || []).filter(c =>
      c && (
        (c.name || '').toLowerCase().includes(trimmed) ||
        (c.category || '').toLowerCase().includes(trimmed)
      )
    ).slice(0, 10);

    const matchedMovies = (movies || []).filter(m =>
      m && (
        (m.name || '').toLowerCase().includes(trimmed) ||
        (m.category || '').toLowerCase().includes(trimmed) ||
        (m.year && String(m.year).includes(trimmed))
      )
    ).slice(0, 10);

    const matchedSeries = (series || []).filter(s =>
      s && (
        (s.name || '').toLowerCase().includes(trimmed) ||
        (s.category || '').toLowerCase().includes(trimmed)
      )
    ).slice(0, 10);

    return {
      channels: matchedChannels,
      movies: matchedMovies,
      series: matchedSeries,
      total: matchedChannels.length + matchedMovies.length + matchedSeries.length
    };
  }, [channels, movies, series, trimmed]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[88vh] bg-[#11131b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col mt-4 sm:mt-10">
        {/* Search Bar Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-800 bg-[#0d0f17]">
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar canais, filmes, séries e episódios..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-neutral-500 focus:outline-none"
          />
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
        <div className="p-5 overflow-y-auto space-y-6">
          {!trimmed ? (
            <div className="py-12 text-center text-neutral-500 text-xs">
              Digite o nome de um canal ao vivo, filme ou série para pesquisar globalmente no catálogo.
            </div>
          ) : results.total === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category 1: CANAIS AO VIVO */}
              {results.channels.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase tracking-wider">
                    <Tv className="w-4 h-4" />
                    <span>TV ao Vivo ({results.channels.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.channels.map((ch) => (
                      <div
                        key={ch.id}
                        onClick={() => {
                          onPlayChannel(ch);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                            {ch.logoUrl ? (
                              <img src={ch.logoUrl} alt={ch.name} className="max-h-full max-w-full object-contain" />
                            ) : (
                              <Tv className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white group-hover:text-orange-400 truncate">
                              {ch.name}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">{ch.category}</p>
                          </div>
                        </div>
                        <Play className="w-3.5 h-3.5 fill-orange-500 text-orange-500 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 2: FILMES */}
              {results.movies.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <Film className="w-4 h-4" />
                    <span>Filmes ({results.movies.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.movies.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          onSelectMovie(m);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-12 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {m.posterUrl ? (
                              <img src={m.posterUrl} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white group-hover:text-amber-400 truncate">
                              {m.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                              <span>{m.category}</span>
                              {m.year && <span>• {m.year}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category 3: SÉRIES */}
              {results.series.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                    <Clapperboard className="w-4 h-4" />
                    <span>Séries ({results.series.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {results.series.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          onSelectSeries(s);
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/70 hover:bg-neutral-800/80 border border-neutral-800 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-12 rounded-lg bg-neutral-800 flex items-center justify-center shrink-0 overflow-hidden">
                            {s.posterUrl ? (
                              <img src={s.posterUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              <Clapperboard className="w-4 h-4 text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white group-hover:text-rose-400 truncate">
                              {s.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                              <span>{s.category}</span>
                              <span>• {s.seasons?.length || 1} Temp</span>
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0 ml-2" />
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
