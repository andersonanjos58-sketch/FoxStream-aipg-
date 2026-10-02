import React, { useState } from 'react';
import { Heart, Tv, Film, Clapperboard, Play, Trash2 } from 'lucide-react';
import { FavoriteItem, ContentType, LiveChannel, MovieItem, SeriesItem } from '../types';

interface FavoritesScreenProps {
  favorites: FavoriteItem[];
  channels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  onPlayChannel: (channel: LiveChannel) => void;
  onSelectMovie: (movie: MovieItem) => void;
  onSelectSeries: (series: SeriesItem) => void;
  onRemoveFavorite: (fav: FavoriteItem) => void;
  onNavigateHome: () => void;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({
  favorites,
  channels,
  movies,
  series,
  onPlayChannel,
  onSelectMovie,
  onSelectSeries,
  onRemoveFavorite,
  onNavigateHome
}) => {
  const [filterType, setFilterType] = useState<ContentType | 'all'>('all');

  const filteredFavs = favorites.filter(f => filterType === 'all' || f.type === filterType);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-24 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
              <Heart className="w-4 h-4 fill-rose-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Outfit']">
              Meus Favoritos
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Canais, filmes e séries marcados com estrela salvos localmente no seu dispositivo
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-xl bg-neutral-900 p-1 border border-neutral-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'all' ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos ({favorites.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('live')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'live' ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Canais
          </button>
          <button
            type="button"
            onClick={() => setFilterType('movie')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'movie' ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Filmes
          </button>
          <button
            type="button"
            onClick={() => setFilterType('series')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'series' ? 'bg-orange-500 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Séries
          </button>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-800 rounded-3xl bg-neutral-900/20 space-y-3">
          <Heart className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">Você ainda não possui favoritos</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Toque no ícone de coração em qualquer canal, filme ou série para salvar nesta lista de acesso rápido.
          </p>
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold px-4 py-2 rounded-xl text-xs transition-colors"
          >
            Explorar Conteúdos
          </button>
        </div>
      ) : filteredFavs.length === 0 ? (
        <div className="p-8 text-center text-neutral-500 text-xs">
          Nenhum favorito encontrado para esta categoria.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {filteredFavs.map((fav) => {
            return (
              <div
                key={fav.id}
                onClick={() => {
                  if (fav.type === 'live') {
                    const match = channels.find(c => c.id === fav.contentId);
                    if (match) {
                      onPlayChannel(match);
                    } else {
                      onPlayChannel({
                        id: fav.contentId,
                        playlistId: '',
                        name: fav.title,
                        streamUrl: fav.streamUrl || '',
                        category: fav.category || 'Geral'
                      });
                    }
                  } else if (fav.type === 'movie') {
                    const match = movies.find(m => m.id === fav.contentId);
                    if (match) onSelectMovie(match);
                  } else {
                    const match = series.find(s => s.id === fav.contentId);
                    if (match) onSelectSeries(match);
                  }
                }}
                className="group relative rounded-2xl bg-[#11131b] hover:bg-neutral-800/80 border border-neutral-800/80 hover:border-rose-500/50 p-2.5 cursor-pointer transition-all active:scale-[0.98] shadow-md flex flex-col justify-between"
              >
                {/* Poster / Logo */}
                <div className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-neutral-950 mb-2 relative">
                  {fav.posterUrl ? (
                    <img
                      src={fav.posterUrl}
                      alt={fav.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900">
                      {fav.type === 'live' ? <Tv className="w-8 h-8" /> : fav.type === 'movie' ? <Film className="w-8 h-8" /> : <Clapperboard className="w-8 h-8" />}
                    </div>
                  )}

                  {/* Type Badge */}
                  <span className="absolute top-2 left-2 bg-black/75 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {fav.type === 'live' ? 'TV ao Vivo' : fav.type === 'movie' ? 'Filme' : 'Série'}
                  </span>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFavorite(fav);
                    }}
                    title="Remover dos favoritos"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/75 hover:bg-rose-950 text-rose-400 hover:text-rose-200 backdrop-blur-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                    <span className="p-2 rounded-full bg-orange-500 text-white shadow-lg">
                      <Play className="w-4 h-4 fill-white stroke-none ml-0.5" />
                    </span>
                  </div>
                </div>

                <div className="min-w-0 px-1">
                  <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white truncate">
                    {fav.title}
                  </h4>
                  <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                    {fav.category}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
