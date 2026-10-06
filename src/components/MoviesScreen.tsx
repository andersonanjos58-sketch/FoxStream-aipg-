import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Film, Search, Star, Heart, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Filter, X } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryForGrid, setSelectedCategoryForGrid] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(60);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Group movies by category preserving list order
  const categoriesMap = useMemo(() => {
    const map = new Map<string, MovieItem[]>();
    (movies || []).forEach((m) => {
      if (!m) return;
      const cat = (m.category || 'Filmes').trim() || 'Filmes';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(m);
    });
    return map;
  }, [movies]);

  const allCategories = useMemo(() => {
    return Array.from(categoriesMap.keys());
  }, [categoriesMap]);

  // Global search across all movies
  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return (movies || []).filter((m) => {
      if (!m) return false;
      const nameMatch = (m.name || '').toLowerCase().includes(q);
      const catMatch = (m.category || '').toLowerCase().includes(q);
      const yearMatch = m.year ? String(m.year).includes(q) : false;
      return nameMatch || catMatch || yearMatch;
    });
  }, [movies, searchQuery]);

  // Movies for active category grid ("Ver tudo")
  const activeCategoryMovies = useMemo(() => {
    if (!selectedCategoryForGrid) return [];
    return categoriesMap.get(selectedCategoryForGrid) || [];
  }, [categoriesMap, selectedCategoryForGrid]);

  const visibleCategoryMovies = useMemo(() => {
    return activeCategoryMovies.slice(0, visibleLimit);
  }, [activeCategoryMovies, visibleLimit]);

  // Reset pagination when category changes
  useEffect(() => {
    setVisibleLimit(60);
  }, [selectedCategoryForGrid]);

  // Infinite scroll for category grid view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < activeCategoryMovies.length) {
          setVisibleLimit((prev) => Math.min(prev + 60, activeCategoryMovies.length));
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
  }, [activeCategoryMovies.length, visibleLimit]);

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
            Catálogo completo organizado por categorias com carrosséis individuais
          </p>
        </div>

        {/* Search Input (Searches across all movies) */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar em todos os filmes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
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
                ? 'bg-amber-500 text-black shadow-amber-950/40'
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
                    ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                }`}
              >
                <span>Todas as Categorias (Carrosséis)</span>
                <span className="text-[10px] bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded-lg border border-neutral-800">
                  {movies.length}
                </span>
              </button>

              <div className="h-px bg-neutral-800/80 my-1" />

              {allCategories.map((cat) => {
                const count = categoriesMap.get(cat)?.length || 0;
                const isSelected = selectedCategoryForGrid === cat;
                return (
                  <button
                    key={`cat_drop_${cat}`}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForGrid(cat);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30'
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
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Ver carrosséis</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
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
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl text-xs"
          >
            Adicionar Lista
          </button>
        </div>
      ) : searchQuery.trim().length > 0 ? (
        /* VIEW 1: GLOBAL SEARCH RESULTS ACROSS ALL MOVIES */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">
              Resultados da busca ({searchResults.length}{' '}
              {searchResults.length === 1 ? 'filme encontrado' : 'filmes encontrados'}):
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-12 text-center text-neutral-400 text-xs border border-neutral-800/60 rounded-2xl bg-neutral-900/40">
              Nenhum filme encontrado para "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
              {searchResults.map((movie) => (
                <MovieCard
                  key={`search_movie_${movie.id}`}
                  movie={movie}
                  isFav={isFavorite(movie.id)}
                  onSelectMovie={onSelectMovie}
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
              {selectedCategoryForGrid} ({activeCategoryMovies.length}{' '}
              {activeCategoryMovies.length === 1 ? 'filme' : 'filmes'})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
            {visibleCategoryMovies.map((movie) => (
              <MovieCard
                key={`cat_grid_${movie.id}`}
                movie={movie}
                isFav={isFavorite(movie.id)}
                onSelectMovie={onSelectMovie}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>

          {activeCategoryMovies.length > visibleLimit && (
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
            </div>
          )}
        </div>
      ) : (
        /* VIEW 3: ONE CAROUSEL PER CATEGORY (MAIN VIEW) */
        <div className="space-y-8">
          {allCategories.map((catName) => {
            const catMovies = categoriesMap.get(catName) || [];
            if (catMovies.length === 0) return null;

            return (
              <MovieCategoryCarousel
                key={`section_cat_${catName}`}
                categoryName={catName}
                movies={catMovies}
                isFavorite={isFavorite}
                onSelectMovie={onSelectMovie}
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

/* Horizontal Carousel Component for a Single Category */
interface MovieCategoryCarouselProps {
  categoryName: string;
  movies: MovieItem[];
  isFavorite: (id: string) => boolean;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
  onVerTudo: () => void;
}

const MovieCategoryCarousel: React.FC<MovieCategoryCarouselProps> = ({
  categoryName,
  movies,
  isFavorite,
  onSelectMovie,
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
            ({movies.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onVerTudo}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-amber-500/10"
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
        {movies.map((movie) => (
          <div key={`carousel_movie_${movie.id}`} className="shrink-0 w-32 sm:w-44">
            <MovieCard
              movie={movie}
              isFav={isFavorite(movie.id)}
              onSelectMovie={onSelectMovie}
              onToggleFavorite={onToggleFavorite}
            />
          </div>
        ))}
      </div>
    </section>
  );
};

/* Individual Movie Card */
interface MovieCardProps {
  movie: MovieItem;
  isFav: boolean;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  isFav,
  onSelectMovie,
  onToggleFavorite
}) => {
  return (
    <div
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
            isFav
              ? 'bg-rose-500/30 text-rose-400'
              : 'bg-black/60 text-neutral-400 hover:text-white'
          }`}
          aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`} />
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
};
