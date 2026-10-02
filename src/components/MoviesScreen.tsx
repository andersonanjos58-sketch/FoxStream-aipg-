import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Film, Search, Star, Calendar, Heart, Play } from 'lucide-react';
import { MovieItem } from '../types';

interface MoviesScreenProps {
  movies: MovieItem[];
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
}

export const MoviesScreen: React.FC<MoviesScreenProps> = ({
  movies,
  onSelectMovie,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  const observerTarget = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (movies || []).forEach(m => {
      if (m && m.category) set.add(String(m.category).trim());
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [movies]);

  const filteredMovies = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return (movies || []).filter(m => {
      if (!m) return false;
      const movieCat = m.category || 'Filmes';
      const matchCat = selectedCategory === 'Todos' || movieCat === selectedCategory;
      const matchQuery = !q ||
        (m.name || '').toLowerCase().includes(q) ||
        (m.year && String(m.year).includes(q)) ||
        movieCat.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [movies, selectedCategory, searchQuery]);

  const visibleMovies = useMemo(() => {
    return (filteredMovies || []).slice(0, visibleLimit);
  }, [filteredMovies, visibleLimit]);

  // Reset limit when query or category changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [selectedCategory, searchQuery]);

  // Setup intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < filteredMovies.length) {
          setVisibleLimit((prev) => Math.min(prev + 100, filteredMovies.length));
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
  }, [filteredMovies.length, visibleLimit]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              Filmes
            </h1>
            <span className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold uppercase px-2 py-0.5 rounded-full">
              VOD
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Catálogo completo de filmes sob demanda em grade de posters
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar filme, ano ou gênero..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
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
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-950/40'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grid or Empty */}
      {movies.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 space-y-3">
          <Film className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">Nenhum filme catalogado</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Adicione uma lista M3U com filmes (VOD) ou sincronize sua conta Xtream Codes.
          </p>
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-xs"
          >
            Adicionar Lista
          </button>
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-xs">
          Nenhum filme encontrado para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {visibleMovies.map((movie) => {
              const starred = isFavorite(movie.id);
              return (
                <div
                  key={movie.id}
                  onClick={() => onSelectMovie(movie)}
                  className="group relative rounded-2xl bg-[#11131b] hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-amber-500/50 p-2 cursor-pointer transition-all active:scale-[0.98] shadow-md flex flex-col justify-between"
                >
                  {/* Poster 2:3 */}
                  <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                    {movie.posterUrl ? (
                      <img
                        src={movie.posterUrl}
                        alt={movie.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900">
                        <Film className="w-8 h-8" />
                      </div>
                    )}

                    {/* Favorite Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(movie);
                      }}
                      className={`absolute top-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                        starred
                          ? 'bg-rose-500/30 text-rose-400'
                          : 'bg-black/60 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${starred ? 'fill-rose-500' : ''}`} />
                    </button>

                    {/* Year Tag */}
                    {movie.year && (
                      <span className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        {movie.year}
                      </span>
                    )}

                    {/* Rating Tag */}
                    {movie.rating && (
                      <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        {movie.rating}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 px-1">
                    <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                      {movie.name}
                    </h4>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                      {movie.category}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMovies.length > visibleLimit && (
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
