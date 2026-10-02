import React from 'react';
import { Tv2, Search, Plus, ListVideo, Smartphone, RefreshCw } from 'lucide-react';
import { Playlist } from '../types';
import { NavTab } from './BottomNav';
import logoImage from '../assets/images/foxstream_logo_new_1790894733124.jpg';

export interface NavbarProps {
  currentTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  activePlaylist?: Playlist | null;
  activePlaylistId?: string;
  playlists: Playlist[];
  onSelectPlaylist: (id: string) => void;
  onOpenSearch: () => void;
  onOpenAddPlaylist: () => void;
  onOpenPlaylists?: () => void;
  onOpenAndroidSource?: () => void;
  onRefreshActivePlaylist?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  activePlaylist,
  activePlaylistId,
  playlists = [],
  onSelectPlaylist,
  onOpenSearch,
  onOpenAddPlaylist,
  onOpenPlaylists,
  onOpenAndroidSource,
  onRefreshActivePlaylist,
  isRefreshing = false
}) => {
  const currentActiveId = activePlaylist?.id || activePlaylistId || (playlists.length > 0 ? playlists[0].id : '');

  const handleLogoClick = () => {
    if (onOpenPlaylists) {
      onOpenPlaylists();
    } else if (onSelectTab) {
      onSelectTab('home');
    }
  };

  const handlePlaylistsClick = () => {
    if (onOpenPlaylists) {
      onOpenPlaylists();
    } else if (onSelectTab) {
      onSelectTab('playlists');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur-md border-b border-neutral-800/80 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <div 
          id="navbar-brand-logo"
          className="flex items-center gap-3 cursor-pointer select-none" 
          onClick={handleLogoClick}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-orange-950/40 border border-orange-500/30">
            <img src={logoImage} alt="FoxStream Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-tight text-white font-['Outfit']">
                Fox<span className="text-orange-500">Stream</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
                IPTV
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-none">
              Gerenciador de Catálogo
            </p>
          </div>
        </div>

        {/* Active Playlist Selector or Add button */}
        <div className="flex items-center gap-2">
          {playlists.length > 0 ? (
            <div className="flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 rounded-full px-3 py-1.5 text-xs text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <select
                id="navbar-playlist-select"
                aria-label="Selecionar Lista Ativa"
                value={currentActiveId}
                onChange={(e) => onSelectPlaylist?.(e.target.value)}
                className="bg-transparent text-neutral-200 font-medium text-xs focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[180px] truncate"
              >
                {playlists.map((p) => (
                  <option key={p.id} value={p.id} className="bg-neutral-900 text-white">
                    {p.name} ({p.type === 'xtream' ? 'Xtream' : 'M3U'})
                  </option>
                ))}
              </select>

              {onRefreshActivePlaylist && (
                <button
                  id="navbar-refresh-playlist-btn"
                  type="button"
                  aria-label="Atualizar lista atual"
                  onClick={onRefreshActivePlaylist}
                  disabled={isRefreshing}
                  title="Atualizar lista"
                  className="p-1 text-neutral-400 hover:text-white rounded-full transition-colors ml-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-orange-400' : ''}`} />
                </button>
              )}
            </div>
          ) : (
            <button
              id="navbar-add-playlist-btn"
              type="button"
              onClick={onOpenAddPlaylist}
              className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Lista</span>
            </button>
          )}

          {/* Search Button */}
          <button
            id="navbar-search-btn"
            type="button"
            aria-label="Buscar canais, filmes e séries"
            onClick={onOpenSearch}
            className="p-2.5 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors"
            title="Buscar conteúdo"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Manage Playlists */}
          <button
            id="navbar-manage-playlists-btn"
            type="button"
            aria-label="Minhas Listas"
            onClick={handlePlaylistsClick}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-xs font-medium transition-colors"
            title="Gerenciar listas"
          >
            <ListVideo className="w-3.5 h-3.5 text-orange-400" />
            <span>Minhas Listas</span>
          </button>

          {/* Android Kotlin Source Code Inspector */}
          {onOpenAndroidSource && (
            <button
              id="navbar-android-source-btn"
              type="button"
              aria-label="Código Fonte Android Nativo"
              onClick={onOpenAndroidSource}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-neutral-900/80 border border-neutral-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-medium transition-colors"
              title="Ver código fonte nativo Kotlin & Jetpack Compose"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Android Nativo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
