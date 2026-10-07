import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Clapperboard, Search, Heart, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Filter, X, Play } from 'lucide-react';
import { SeriesItem } from '../types';

interface SeriesScreenProps {
  series?: SeriesItem[];
  seriesList?: SeriesItem[];
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
}

export const SeriesScreen: React.FC<SeriesScreenProps> = ({
  series,
  seriesList: propSeriesList,
  onSelectSeries,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist
}) => {
  const seriesList = series || propSeriesList || [];
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryForGrid, setSelectedCategoryForGrid] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const [currentFeaturedIndex, setCurrentFeaturedIndex] = useState<number>(0);
  const [isFeaturedPaused, setIsFeaturedPaused] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Group series by category preserving list order
  const categoriesMap = useMemo(() => {
    const map = new Map<string, SeriesItem[]>();
    (seriesList || []).forEach((s) => {
      if (!s) return;
      const cat = (s.category || 'Séries').trim() || 'Séries';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(s);
    });
    return map;
  }, [seriesList]);

  const allCategories = useMemo(() => {
    return Array.from(categoriesMap.keys());
  }, [categoriesMap]);

  // Featured series for spotlight hero banner (take up to 8 series with poster/backdrop)
  const featuredSeries = useMemo(() => {
    return (seriesList || []).filter((s) => s && (s.posterUrl || s.backdropUrl)).slice(0, 8);
  }, [seriesList]);

  // Auto-Scroll com intervalo de 3 segundos e pausa na interação
  useEffect(() => {
    if (featuredSeries.length <= 1 || isFeaturedPaused) return;

    const timer = setInterval(() => {
      setCurrentFeaturedIndex((prev) => (prev + 1) % featuredSeries.length);
    }, 3000);

    return () => clearInterval(timer);
  }, [featuredSeries.length, isFeaturedPaused]);

  // Global search across all series
  const searchResults = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return [];
    return (seriesList || []).filter((s) => {
      if (!s) return false;
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const catMatch = (s.category || '').toLowerCase().includes(q);
      const yearMatch = s.year ? String(s.year).includes(q) : false;
      return nameMatch || catMatch || yearMatch;
    });
  }, [seriesList, searchQuery]);

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
    <div className="w-full pb-28">
      {/* 1. BANNER EM DESTAQUE (SPOTLIGHT BANNER):
          - Posicionado diretamente abaixo da barra superior
          - Imagem de largura total (100% da tela, sem margens laterais, tela infinita)
          - Bordas retas em ângulo reto (0px de raio de borda, sem cantos arredondados)
          - Textos e elementos sobrepostos: Título, tags ("SÉRIE • ★ 0.0/5 • Categoria") e botão branco "Assistir" com ícone e texto pretos
          - Auto-scroll com intervalo de 3 segundos e pausa na interação
      */}
      {featuredSeries.length > 0 && (
        <section
          onMouseEnter={() => setIsFeaturedPaused(true)}
          onMouseLeave={() => setIsFeaturedPaused(false)}
          onTouchStart={() => setIsFeaturedPaused(true)}
          onTouchEnd={() => setIsFeaturedPaused(false)}
          className="relative w-full h-72 sm:h-96 md:h-[430px] rounded-none overflow-hidden bg-black select-none border-b border-neutral-900"
        >
          {(() => {
            const currentItem = featuredSeries[currentFeaturedIndex] || featuredSeries[0];
            const bgImage = currentItem.backdropUrl || currentItem.posterUrl;
            const ratingVal = currentItem.rating ? `★ ${currentItem.rating}/5` : '★ 0.0/5';
            const catLabel = currentItem.category ? currentItem.category : 'Séries';
            const tagString = `SÉRIE • ${ratingVal} • ${catLabel}`;

            return (
              <div className="relative w-full h-full">
                {/* Imagem de largura total */}
                {bgImage ? (
                  <img
                    key={`spotlight_s_${currentItem.id}`}
                    src={bgImage}
                    alt={currentItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-none transition-all duration-700 animate-in fade-in"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-950 to-black rounded-none" />
                )}

                {/* Gradientes cinematográficos */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-[#080a10]/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080a10] via-[#080a10]/50 to-transparent pointer-events-none" />

                {/* Textos e elementos sobrepostos */}
                <div className="absolute bottom-6 sm:bottom-10 left-4 sm:left-10 right-4 sm:right-10 max-w-3xl space-y-2 sm:space-y-3 z-10">
                  {/* Tags */}
                  <div className="text-xs sm:text-sm font-bold text-rose-400 tracking-wide">
                    {tagString}
                  </div>

                  {/* Título */}
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white font-['Outfit'] tracking-tight line-clamp-2 drop-shadow-md">
                    {currentItem.name}
                  </h1>

                  {/* Sinopse resumida se disponível */}
                  {currentItem.description && (
                    <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 max-w-2xl drop-shadow">
                      {currentItem.description}
                    </p>
                  )}

                  {/* Botão branco "Assistir" com ícone e texto pretos */}
                  <div className="pt-2 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => onSelectSeries(currentItem)}
                      className="bg-white hover:bg-neutral-200 active:scale-95 text-black font-bold px-7 py-2.5 sm:py-3 rounded-full flex items-center gap-2 text-xs sm:text-sm shadow-xl transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-black text-black" />
                      <span>Assistir</span>
                    </button>
                  </div>
                </div>

                {/* Pager Dots no canto inferior direito */}
                {featuredSeries.length > 1 && (
                  <div className="absolute bottom-5 sm:bottom-8 right-4 sm:right-10 flex items-center gap-1.5 z-20">
                    {featuredSeries.map((_, idx) => (
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
          - Colocados diretamente ABAIXO do banner em destaque
          - Primeiro elemento: Uma barra de busca escura arredondada
          - Segundo elemento: Um botão no formato pílula "Categorias"
      */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="space-y-3">
          {/* Primeiro elemento: Barra de busca escura arredondada */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar em todas as séries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121520] border border-neutral-800 rounded-2xl pl-11 pr-10 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Segundo elemento: Botão no formato pílula "Categorias" com menu cascata */}
          <div className="flex items-center justify-between gap-3 relative z-30">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                  selectedCategoryForGrid
                    ? 'bg-rose-500 text-white shadow-rose-950/40'
                    : 'bg-[#161a26] border border-neutral-800 text-white hover:border-neutral-700'
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
                        ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30'
                        : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    <span>Todas as Categorias (Carrosséis)</span>
                    <span className="text-[10px] bg-neutral-900 text-neutral-400 px-2 py-0.5 rounded-lg border border-neutral-800">
                      {seriesList.length}
                    </span>
                  </button>

                  <div className="h-px bg-neutral-800/80 my-1" />

                  {allCategories.map((cat) => {
                    const count = categoriesMap.get(cat)?.length || 0;
                    const isSelected = selectedCategoryForGrid === cat;
                    return (
                      <button
                        key={`cat_drop_s_${cat}`}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryForGrid(cat);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
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

            {/* Botão de retorno quando visualizando a grade de uma categoria */}
            {selectedCategoryForGrid && !searchQuery && (
              <button
                type="button"
                onClick={() => setSelectedCategoryForGrid(null)}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-3.5 py-2 rounded-full transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Ver carrosséis</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. CONTEÚDO PRINCIPAL */}
        {seriesList.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 space-y-3">
            <Clapperboard className="w-12 h-12 text-neutral-600 mx-auto" />
            <h3 className="text-base font-bold text-neutral-300">Nenhuma série catalogada</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Adicione uma lista M3U com séries ou sincronize sua conta Xtream Codes.
            </p>
            <button
              type="button"
              onClick={onOpenAddPlaylist}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Adicionar Lista
            </button>
          </div>
        ) : searchQuery.trim().length > 0 ? (
          /* VIEW 1: RESULTADOS DA BUSCA GLOBAL EM TODAS AS SÉRIES */
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
                {searchResults.map((series) => (
                  <SeriesCard
                    key={`search_series_${series.id}`}
                    series={series}
                    isFav={isFavorite(series.id)}
                    onSelectSeries={onSelectSeries}
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
                {selectedCategoryForGrid} ({activeCategorySeries.length}{' '}
                {activeCategorySeries.length === 1 ? 'série' : 'séries'})
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
              {visibleCategorySeries.map((series) => (
                <SeriesCard
                  key={`cat_grid_s_${series.id}`}
                  series={series}
                  isFav={isFavorite(series.id)}
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
          /* VIEW 3: UM CARROSSEL POR CATEGORIA */
          <div className="space-y-8">
            {allCategories.map((catName) => {
              const catSeries = categoriesMap.get(catName) || [];
              if (catSeries.length === 0) return null;

              return (
                <SeriesCategoryCarousel
                  key={`section_cat_s_${catName}`}
                  categoryName={catName}
                  seriesList={catSeries}
                  isFavorite={isFavorite}
                  onSelectSeries={onSelectSeries}
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
interface SeriesCategoryCarouselProps {
  categoryName: string;
  seriesList: SeriesItem[];
  isFavorite: (id: string) => boolean;
  onSelectSeries: (series: SeriesItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  onViewAll: () => void;
}

const SeriesCategoryCarousel: React.FC<SeriesCategoryCarouselProps> = ({
  categoryName,
  seriesList,
  isFavorite,
  onSelectSeries,
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
            {seriesList.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
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

      {/* Carrossel horizontal de séries */}
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

/* Individual Series Card
   - Clean: Sem letrinhas pequenas na parte inferior da capa, apenas o nome da série abaixo do pôster
*/
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
            loading="lazy"
            decoding="async"
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
      </div>

      {/* Nome limpo da série (sem letrinhas pequenas de tags na parte inferior da capa) */}
      <div className="min-w-0 px-1 py-0.5">
        <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
          {series.name}
        </h4>
      </div>
    </div>
  );
};
