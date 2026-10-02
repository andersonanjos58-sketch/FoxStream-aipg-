import React from 'react';
import { Home, Tv, Film, Clapperboard, Heart, ListPlus } from 'lucide-react';

export type NavTab = 'home' | 'live' | 'movies' | 'series' | 'favorites' | 'playlists' | 'settings';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  favoriteCount?: number;
  favoritesCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  favoriteCount,
  favoritesCount
}) => {
  const count = favoriteCount ?? favoritesCount ?? 0;
  const navItems = [
    { id: 'home' as NavTab, label: 'Início', icon: Home },
    { id: 'live' as NavTab, label: 'TV ao Vivo', icon: Tv },
    { id: 'movies' as NavTab, label: 'Filmes', icon: Film },
    { id: 'series' as NavTab, label: 'Séries', icon: Clapperboard },
    { id: 'favorites' as NavTab, label: 'Favoritos', icon: Heart, badge: count > 0 ? count : null },
    { id: 'playlists' as NavTab, label: 'Listas', icon: ListPlus },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090a0f]/95 backdrop-blur-lg border-t border-neutral-800/80 px-2 py-1.5 safe-area-bottom">
      <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all ${
                isActive
                  ? 'text-orange-500 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {/* Active pill indicator */}
              {isActive && (
                <span className="absolute -top-1.5 w-6 h-1 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
              )}
              
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'scale-100'}`} />
                {item.badge !== null && item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
