import React, { useState, useEffect } from 'react';
import { X, Play, Heart, Film, Calendar, Star, Clock, Copy, ExternalLink, Check, Sparkles } from 'lucide-react';
import { MovieItem } from '../types';
import { TmdbService, TmdbData } from '../services/tmdbService';

interface MovieDetailsModalProps {
  movie: MovieItem | null;
  isFavorite: boolean;
  onClose: () => void;
  onPlay: (movie: MovieItem) => void;
  onToggleFavorite: (movie: MovieItem) => void;
}

export const MovieDetailsModal: React.FC<MovieDetailsModalProps> = ({
  movie,
  isFavorite,
  onClose,
  onPlay,
  onToggleFavorite
}) => {
  const [copied, setCopied] = useState(false);
  const [tmdbData, setTmdbData] = useState<TmdbData | null>(null);
  const [isLoadingTmdb, setIsLoadingTmdb] = useState(true);

  useEffect(() => {
    if (!movie) {
      setTmdbData(null);
      setIsLoadingTmdb(false);
      return;
    }

    // 1. Instant local display
    setIsLoadingTmdb(true);
    setTmdbData(null);

    // 2. Non-blocking background fetch to TMDb
    let isMounted = true;
    TmdbService.fetchMovieDetails(movie.name, movie.year)
      .then(data => {
        if (isMounted) {
          setTmdbData(data);
          setIsLoadingTmdb(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingTmdb(false);
      });

    return () => {
      isMounted = false;
    };
  }, [movie]);

  if (!movie) return null;

  const backdrop = tmdbData?.backdrop || movie.backdropUrl || movie.posterUrl;
  const rating = tmdbData?.rating || movie.rating;
  const year = tmdbData?.year || movie.year;
  const plot = tmdbData?.plot || movie.description || 'Pressione o botão Assistir para reproduzir este filme no seu player.';

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(movie.streamUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#11131b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm border border-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Backdrop Banner / Poster Top Section */}
        <div className="relative h-48 sm:h-64 w-full bg-gradient-to-t from-[#11131b] via-neutral-900/60 to-black/80 overflow-hidden shrink-0">
          {backdrop ? (
            <img
              src={backdrop}
              alt={movie.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover blur-sm opacity-40 scale-105"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900/80">
              <Film className="w-16 h-16 text-neutral-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#11131b] via-[#11131b]/60 to-transparent" />

          {/* Quick Floating Play Icon */}
          <div className="absolute bottom-4 left-6 sm:left-8 flex items-end gap-4">
            <div className="w-24 sm:w-32 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-neutral-700/80 bg-neutral-900 shrink-0">
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                  <Film className="w-8 h-8 text-neutral-600" />
                </div>
              )}
            </div>

            <div className="mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Filme / VOD
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white font-['Outfit'] mt-1 line-clamp-2">
                {movie.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-neutral-300">
            {year && (
              <span className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 font-medium">
                <Calendar className="w-3.5 h-3.5 text-orange-400" />
                {year}
              </span>
            )}
            {rating && (
              <span className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 font-medium text-amber-300">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {rating}
              </span>
            )}
            {movie.duration && (
              <span className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 font-medium">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                {movie.duration}
              </span>
            )}
            <span className="bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 text-neutral-400 font-medium">
              {movie.category || 'Filmes'}
            </span>
          </div>

          {/* Synopsis */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-300 mb-2 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <span>Sinopse</span>
              {isLoadingTmdb ? (
                <span className="text-[10px] font-normal text-neutral-500 animate-pulse">(Buscando TMDb...)</span>
              ) : tmdbData ? (
                <Sparkles className="w-3 h-3 text-orange-400" />
              ) : null}
            </h3>
            <p className="text-sm text-neutral-300 leading-relaxed font-light">
              {plot}
            </p>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            {/* Assistir Button (Opens externally via Intent/VLC) */}
            <button
              type="button"
              onClick={() => onPlay(movie)}
              className="w-full sm:flex-1 flex items-center justify-center gap-2.5 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-3.5 px-6 rounded-2xl text-base shadow-xl shadow-orange-950/40 active:scale-[0.98] transition-all"
            >
              <Play className="w-5 h-5 fill-white stroke-none" />
              <span>Assistir</span>
            </button>

            {/* Favorite toggle */}
            <button
              type="button"
              onClick={() => onToggleFavorite(movie)}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center gap-2 text-xs font-semibold ${
                isFavorite
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="sm:hidden">{isFavorite ? 'Favoritado' : 'Favoritar'}</span>
            </button>

            {/* Copy stream link */}
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copiar Link do Stream"
              className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          {/* External intent notification note */}
          <div className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-500 flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span>O conteúdo será enviado diretamente para o VLC Media Player ou o reprodutor configurado no Android.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
