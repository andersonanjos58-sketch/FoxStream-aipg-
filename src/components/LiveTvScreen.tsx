import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tv, Play, Heart, Search, Filter, Radio, Sparkles, Layers } from 'lucide-react';
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
  const [visibleLimit, setVisibleLimit] = useState<number>(100);

  const observerTarget = useRef<HTMLDivElement>(null);

  // Extract all categories sorted alphabetically with counts
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    const total = (channels || []).length;
    map.set('Todas', total);
    (channels || []).forEach(c => {
      if (c && c.category) {
        const cat = String(c.category).trim();
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return map;
  }, [channels]);

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
      const channelCat = (c.category || 'Geral').trim();
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

  // Reset limit when query or category changes
  useEffect(() => {
    setVisibleLimit(100);
  }, [selectedCategory, searchQuery]);

  // Setup intersection observer for infinite scroll
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
            Transmissões em tempo real organizadas por categorias em painel dedicado
          </p>
        </div>

        {/* Global Search Input */}
        <div className="flex items-center gap-2 w-full sm:w-80">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar canal em todas as categorias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Mobile Horizontal Categories (Visible only on small screens) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:hidden">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = categoryCounts.get(cat) || 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Split-Screen Layout (Sidebar Categories + Right Channel Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Sidebar: Categories Panel (Desktop) */}
        <div className="hidden md:block md:col-span-4 lg:col-span-3 bg-[#11131b]/90 border border-neutral-800/80 rounded-2xl p-4 sticky top-6 shadow-xl max-h-[calc(100vh-140px)] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-['Outfit']">
                Categorias
              </h2>
            </div>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-medium">
              {categories.length}
            </span>
          </div>

          <div className="space-y-1 overflow-y-auto no-scrollbar pr-1 flex-1">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts.get(cat) || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-950/40'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                  }`}
                >
                  <span className="truncate pr-2 flex items-center gap-2">
                    <Radio className={`w-3 h-3 shrink-0 ${isSelected ? 'text-white' : 'text-neutral-500 group-hover:text-orange-400'}`} />
                    {cat}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                    isSelected ? 'bg-orange-600 text-white font-bold' : 'bg-neutral-900 text-neutral-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Panel: Channels Grid */}
        <div className="md:col-span-8 lg:col-span-9 space-y-4">
          
          {/* Category Banner / Active Filter Header */}
          <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800/80 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-bold text-white font-['Outfit']">
                {selectedCategory}
              </h3>
              <span className="text-xs text-neutral-400 font-medium">
                ({filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canais'})
              </span>
            </div>
            {selectedCategory !== 'Todas' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Todas')}
                className="text-xs text-orange-400 hover:text-orange-300 font-semibold underline"
              >
                Ver Todas
              </button>
            )}
          </div>

          {/* Content Check */}
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
            <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 text-neutral-400 text-xs space-y-2">
              <p>Nenhum canal encontrado para "{searchQuery}" na categoria "{selectedCategory}".</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory('Todas'); }}
                className="text-orange-400 hover:underline font-semibold"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
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
          )}

        </div>

      </div>
    </div>
  );
};
