import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Film, Search, Heart, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Filter, X, Play } from 'lucide-react';
import { MovieItem } from '../types';

interface MoviesScreenProps {
  movies: MovieItem[];
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
  onOpenSearch: () => void;
}

export const MoviesScreen: React.FC<MoviesScreenProps> = ({
  movies,
  onSelectMovie,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist,
  onOpenSearch
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryForGrid, setSelectedCategoryForGrid] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const [visibleCategoriesCount, setVisibleCategoriesCount] = useState<number>(8);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState<number>(0);
  const [isFeaturedPaused, setIsFeaturedPaused] = useState<boolean>(false);

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

  // Featured movies for spotlight hero carousel (take up to 8 movies with image)
  const featuredMovies = useMemo(() => {
    return (movies || []).filter((m) => m && (m.posterUrl || m.backdropUrl)).slice(0, 8);
  }, [movies]);

  // Auto-Scroll com intervalo de 3 segundos e pausa na interação
  useEffect(() => {
    if (featuredMovies.length <= 1 || isFeaturedPaused) return;

    const timer = setInterval(() => {
      setCurrentFeaturedIndex((prev) => (prev + 1) % featuredMovies.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [featuredMovies.length, isFeaturedPaused]);

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
    setVisibleCategoriesCount(8);
  }, [selectedCategoryForGrid, searchQuery]);

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
    <div className="w-full pb-28">
      {/* 1. BANNER EM DESTAQUE (SPOTLIGHT BANNER):
          - Posicionado diretamente abaixo da barra superior
          - Imagem de largura total (100% da tela, sem margens laterais, efeito de tela infinita)
          - Bordas retas em ângulo reto (0px de raio de borda, sem cantos arredondados)
          - Textos e elementos sobrepostos: Título, tags ("FILME • ★ 0.0/5 • Categoria") e botão branco "Assistir" com ícone e texto pretos
          - Auto-scroll de 3 segundos com pausa ao interagir
      */}
      {featuredMovies.length > 0 && (
        <section
          onMouseEnter={() => setIsFeaturedPaused(true)}
          onMouseLeave={() => setIsFeaturedPaused(false)}
          onTouchStart={() => setIsFeaturedPaused(true)}
          onTouchEnd={() => setIsFeaturedPaused(false)}
          className="relative w-full h-32 sm:h-44 md:h-[215px] rounded-none overflow-hidden bg-black select-none border-b border-neutral-900"
        >
          {(() => {
            const currentMovie = featuredMovies[currentFeaturedIndex] || featuredMovies[0];
            const bgImage = currentMovie.backdropUrl || currentMovie.posterUrl;
            const ratingVal = currentMovie.rating ? `★ ${currentMovie.rating}/5` : '★ 0.0/5';
            const catLabel = currentMovie.category ? currentMovie.category : 'Filmes';
            const tagString = `FILME • ${ratingVal} • ${catLabel}`;

            return (
              <div className="relative w-full h-full">
                {/* Imagem de largura total */}
                {bgImage ? (
                  <img
                    key={`spotlight_m_${currentMovie.id}`}
                    src={bgImage}
                    alt={currentMovie.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-none transition-all duration-700 animate-in fade-in"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-950 to-black rounded-none" />
                )}

                {/* Gradientes cinematográficos para legibilidade */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-[#080a10]/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080a10] via-[#080a10]/50 to-transparent pointer-events-none" />

                {/* Textos e elementos sobrepostos na imagem do banner */}
                <div className="absolute bottom-3 sm:bottom-6 left-4 sm:left-10 right-4 sm:right-10 max-w-3xl space-y-1 sm:space-y-1.5 z-10">
                  {/* Tags sobrepostas: "FILME • ★ 0.0/5 • Categoria" */}
                  <div className="text-[10px] sm:text-xs font-bold text-amber-400 tracking-wide">
                    {tagString}
                  </div>

                  {/* Título */}
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white font-['Outfit'] tracking-tight line-clamp-1 drop-shadow-md">
                    {currentMovie.name}
                  </h1>

                  {/* Sinopse resumida se disponível */}
                  {currentMovie.description && (
                    <p className="hidden sm:block text-[11px] sm:text-xs text-neutral-300 line-clamp-1 max-w-2xl drop-shadow">
                      {currentMovie.description}
                    </p>
                  )}

                  {/* Botão branco "Assistir" com ícone e texto pretos */}
                  <div className="pt-0.5 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onSelectMovie(currentMovie)}
                      className="bg-white hover:bg-neutral-200 active:scale-95 text-black font-bold px-4 py-1.5 sm:py-2 rounded-full flex items-center gap-1.5 text-[10px] sm:text-xs shadow-xl transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-black text-black" />
                      <span>Assistir</span>
                    </button>
                  </div>
                </div>

                {/* Pager Dots no canto inferior direito */}
                {featuredMovies.length > 1 && (
                  <div className="absolute bottom-3 sm:bottom-6 right-4 sm:right-10 flex items-center gap-1.5 z-20">
                    {featuredMovies.map((_, idx) => (
                      <button
                        key={`spotlight_dot_${idx}`}
                        type="button"
                        onClick={() => {
                          setCurrentFeaturedIndex(idx);
                          setIsFeaturedPaused(true);
                        }}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          idx === currentFeaturedIndex
                            ? 'w-6 bg-white'
                            : 'w-1.5 bg-white/40 hover:bg-white/70'
                        }`}
                        aria-label={`Ir para destaque ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* 2. BUSCA E CATEGORIAS:
          - Colocados diretamente ABAIXO do banner em destaque, alinhados na mesma linha
          - Categorias na esquerda e Busca na direita
      */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 z-30 relative">
        <div className="flex flex-row items-center gap-3 relative z-30 w-full">
          {/* Elemento 1: Botão no formato pílula "Categorias" com menu cascata */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer h-10 ${
                selectedCategoryForGrid
                  ? 'bg-amber-500 text-black shadow-amber-950/40'
                  : 'bg-[#121520] border border-neutral-800 text-white hover:border-neutral-700'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {selectedCategoryForGrid
                  ? `Cat: ${selectedCategoryForGrid}`
                  : 'Categorias ⬇️'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Menu em cascata com todas as categorias disponíveis na lista IPTV */}
            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 sm:w-80 max-h-96 overflow-y-auto bg-[#121520] border border-neutral-800 rounded-2xl shadow-2xl p-2 space-y-1 no-scrollbar animate-in fade-in zoom-in-95 duration-150 z-40">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryForGrid(null);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
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

          {/* Botão de retorno quando visualizando a grade de uma categoria */}
          {selectedCategoryForGrid && (
            <button
              type="button"
              onClick={() => setSelectedCategoryForGrid(null)}
              className="flex items-center gap-1.5 text-[10px] text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 h-10 rounded-full transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ver carrosséis</span>
            </button>
          )}

          {/* Elemento 2: Barra de busca como botão que abre o ambiente de busca e ativa o teclado */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex-1 flex items-center gap-2 bg-[#121520] border border-neutral-800 hover:border-neutral-700 rounded-full pl-4 pr-10 h-10 text-xs text-neutral-400 cursor-pointer text-left transition-colors shadow-inner"
          >
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <span>Buscar em todos os filmes...</span>
          </button>
        </div>

        {/* 3. CONTEÚDO PRINCIPAL */}
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
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Adicionar Lista
            </button>
          </div>
        ) : searchQuery.trim().length > 0 ? (
          /* VIEW 1: RESULTADOS DA BUSCA GLOBAL EM TODOS OS FILMES */
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
          /* VIEW 2: GRADE COMPLETA DA CATEGORIA SELECIONADA ("VER TUDO") */
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
          /* VIEW 3: UM CARROSSEL POR CATEGORIA (Ex: Ficção [Ver tudo], Ação [Ver tudo]...) */
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
                  onViewAll={() => setSelectedCategoryForGrid(catName)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* Componente de carrossel horizontal por categoria */
interface MovieCategoryCarouselProps {
  categoryName: string;
  movies: MovieItem[];
  isFavorite: (id: string) => boolean;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
  onViewAll: () => void;
}

const MovieCategoryCarousel: React.FC<MovieCategoryCarouselProps> = ({
  categoryName,
  movies,
  isFavorite,
  onSelectMovie,
  onToggleFavorite,
  onViewAll
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="space-y-3">
      {/* Cabeçalho da categoria com botão "Ver tudo" */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-white font-['Outfit']">
            {categoryName}
          </h3>
          <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
            {movies.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <span>Ver tudo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="hidden sm:flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
              aria-label="Rolar para esquerda"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors active:scale-90 cursor-pointer"
              aria-label="Rolar para direita"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Carrossel horizontal de filmes */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-2 pt-1"
      >
        {movies.slice(0, 24).map((movie) => (
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

/* Individual Movie Card
   - Clean: Sem letrinhas pequenas na parte inferior da capa, apenas o nome do filme abaixo do pôster
*/
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
            loading="lazy"
            decoding="async"
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
      </div>

      {/* Nome limpo do filme (sem letrinhas pequenas de tags na parte inferior da capa) */}
      <div className="min-w-0 px-1 py-0.5">
        <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
          {movie.name}
        </h4>
      </div>
    </div>
  );
};
