import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tv, Play, Heart, Search, Filter, Radio, Sparkles } from 'lucide-react';
import { LiveChannel } from '../types';

interface LiveTvScreenProps {
  channels: LiveChannel[];
  onPlayChannel: (channel: LiveChannel) => void;
  onToggleFavorite: (channel: LiveChannel) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
}

export const LiveTvScreen: React.FC<LiveTvScreenProps> = ({
  channels,
  onPlayChannel,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Extract all categories sorted alphabetically
  const categories = useMemo(() => {
    const set = new Set<string>();
    (channels || []).forEach(c => {
      if (c && c.category) set.add(String(c.category).trim());
    });
    return ['Todas', ...Array.from(set).sort()];
  }, [channels]);

  // Filter channels based on selected category and query
  const filteredChannels = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return (channels || []).filter(c => {
      if (!c) return false;
      const channelCat = c.category || 'Geral';
      const matchCat = selectedCategory === 'Todas' || channelCat === selectedCategory;
      const matchQuery = !q || 
        (c.name || '').toLowerCase().includes(q) ||
        channelCat.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [channels, selectedCategory, searchQuery]);

  const visibleChannels = useMemo(() => {
    return (filteredChannels || []).slice(0, visibleLimit);
  }, [filteredChannels, visibleLimit]);

  // Reset limit when query, category, or view mode changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [selectedCategory, searchQuery, viewMode]);

  // Setup intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < filteredChannels.length) {
          setVisibleLimit((prev) => Math.min(prev + 100, filteredChannels.length));
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
  }, [filteredChannels.length, visibleLimit]);

  // Grouped by categories (for hierarchical tree view)
  const groupedChannels = useMemo(() => {
    const map = new Map<string, LiveChannel[]>();
    filteredChannels.forEach(c => {
      if (!c) return;
      const cat = c.category || 'Geral';
      const list = map.get(cat) || [];
      list.push(c);
      map.set(cat, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredChannels]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center">
              <Tv className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              TV ao Vivo
            </h1>
            <span className="text-xs bg-red-600/90 text-white font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            SOMENTE transmissões em tempo real organizadas estritamente por categoria
          </p>
        </div>

        {/* Search Input & View Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar canal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'grid' ? 'grouped' : 'grid')}
            className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-300 hover:text-white text-xs flex items-center gap-1.5 shrink-0"
            title={viewMode === 'grid' ? 'Ver agrupado por categoria' : 'Ver em grade'}
          >
            <Filter className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">{viewMode === 'grid' ? 'Por Categoria' : 'Grade'}</span>
          </button>
        </div>
      </div>

      {/* Categories Horizontal Pills */}
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
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Content View */}
      {channels.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 space-y-3">
          <Tv className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">Nenhum canal ao vivo disponível</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Adicione uma lista M3U ou conta Xtream Codes com canais de transmissão.
          </p>
          <button
            type="button"
            onClick={onOpenAddPlaylist}
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-xl text-xs"
          >
            Adicionar Lista
          </button>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="p-8 text-center text-neutral-400 text-xs">
          Nenhum canal encontrado para os filtros selecionados.
        </div>
      ) : viewMode === 'grid' ? (
        /* Regular Responsive Grid with Lazy Load */
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {visibleChannels.map((channel) => {
              const starred = isFavorite(channel.id);
              return (
                <div
                  key={channel.id}
                  onClick={() => onPlayChannel(channel)}
                  className="group relative p-3 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800/90 hover:border-orange-500/60 cursor-pointer transition-all active:scale-[0.98] shadow-md flex flex-col justify-between"
                >
                  {/* Logo & Favorite Button */}
                  <div className="relative w-full h-24 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center p-3 mb-2.5 overflow-hidden">
                    {channel.logoUrl ? (
                      <img
                        src={channel.logoUrl}
                        alt={channel.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Tv className="w-8 h-8 text-neutral-600" />
                    )}

                    {/* Favorite Toggle Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(channel);
                      }}
                      className={`absolute top-1.5 right-1.5 p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                        starred
                          ? 'bg-rose-500/20 text-rose-500'
                          : 'bg-black/50 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${starred ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>

                  {/* Info & Play */}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                      {channel.name}
                    </h4>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-neutral-500">
                      <span className="truncate">{channel.category}</span>
                      <span className="p-1 rounded-md bg-orange-500/10 text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <Play className="w-3 h-3 fill-current stroke-none ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredChannels.length > visibleLimit && (
            <div ref={observerTarget} className="w-full py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
            </div>
          )}
        </div>
      ) : (
        /* Hierarchical Categorized Group Tree View */
        <div className="space-y-6">
          {groupedChannels.map(([catName, items]) => (
            <div key={catName} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
                <Radio className="w-4 h-4 text-orange-400" />
                <h3 className="text-sm font-bold text-white font-['Outfit']">{catName}</h3>
                <span className="text-[11px] text-neutral-500 font-medium">({items.length} canais)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map((channel) => (
                  <div
                    key={channel.id}
                    onClick={() => onPlayChannel(channel)}
                    className="p-3 rounded-2xl bg-[#11131b] hover:bg-neutral-800/90 border border-neutral-800 hover:border-orange-500/60 cursor-pointer transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                      {channel.logoUrl ? (
                        <img
                          src={channel.logoUrl}
                          alt={channel.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Tv className="w-4 h-4 text-neutral-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-neutral-200 truncate">{channel.name}</h5>
                      <span className="text-[10px] text-neutral-500">Ao Vivo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
