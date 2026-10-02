import React, { useState, useEffect } from 'react';
import { X, Play, Heart, Clapperboard, Calendar, Star, Layers, Tv, Clock, Copy, Check, RefreshCw } from 'lucide-react';
import { SeriesItem, EpisodeItem, SeasonItem, Playlist } from '../types';
import { XtreamClient } from '../services/xtreamClient';

interface SeriesDetailsModalProps {
  series: SeriesItem | null;
  isFavorite: boolean;
  onClose: () => void;
  onPlayEpisode: (series: SeriesItem, episode: EpisodeItem) => void;
  onToggleFavorite: (series: SeriesItem) => void;
  playlists: Playlist[];
  onUpdateSeries?: (updatedSeries: SeriesItem) => void;
}

export const SeriesDetailsModal: React.FC<SeriesDetailsModalProps> = ({
  series,
  isFavorite,
  onClose,
  onPlayEpisode,
  onToggleFavorite,
  playlists,
  onUpdateSeries
}) => {
  const [seasons, setSeasons] = useState<SeasonItem[]>(series?.seasons || []);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [copiedEpId, setCopiedEpId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!series) return;

    // Check if we already have loaded seasons with episodes to avoid duplicate fetches
    const hasEpisodes = series.seasons && series.seasons.length > 0 && series.seasons.some(s => s.episodes && s.episodes.length > 0);
    if (hasEpisodes) {
      setSeasons(series.seasons);
      const loadedSeasonNums = series.seasons.map(s => s.seasonNum);
      if (loadedSeasonNums.length > 0 && !loadedSeasonNums.includes(selectedSeasonNum)) {
        setSelectedSeasonNum(loadedSeasonNums[0]);
      }
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const playlist = playlists?.find(p => p.id === series.playlistId);
        if (playlist && playlist.type === 'xtream' && playlist.serverUrl && playlist.username && playlist.password) {
          const client = new XtreamClient({
            serverUrl: playlist.serverUrl,
            username: playlist.username,
            password: playlist.password
          });
          const seasonsData = await client.getSeriesDetails(series.id, series.id);
          
          if (seasonsData && seasonsData.length > 0) {
            setSeasons(seasonsData);
            // Auto-select first season
            if (seasonsData[0]) {
              setSelectedSeasonNum(seasonsData[0].seasonNum);
            }
            
            if (onUpdateSeries) {
              onUpdateSeries({
                ...series,
                seasons: seasonsData,
                totalEpisodes: seasonsData.reduce((acc, s) => acc + (s.episodes?.length || 0), 0)
              });
            }
          } else {
            setSeasons([]);
          }
        } else {
          setSeasons([]);
        }
      } catch (err: any) {
        console.error('Error fetching series details:', err);
        setError(err.message || 'Falha ao carregar os episódios da série.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [series, playlists, onUpdateSeries]);

  if (!series) return null;

  // Use state-based seasons if available
  const displaySeasons = seasons && seasons.length > 0
    ? seasons
    : [{ seasonNum: 1, name: 'Temporada 1', episodes: [] }];

  // Ensure selected season is valid
  const currentSeason = displaySeasons.find(s => s.seasonNum === selectedSeasonNum) || displaySeasons[0];
  const episodes = currentSeason?.episodes || [];

  const handleCopyEp = (ep: EpisodeItem) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ep.streamUrl)
        .then(() => {
          setCopiedEpId(ep.id);
          setTimeout(() => setCopiedEpId(null), 2000);
        })
        .catch(() => {
          setCopiedEpId(ep.id);
          setTimeout(() => setCopiedEpId(null), 2000);
        });
    } else {
      setCopiedEpId(ep.id);
      setTimeout(() => setCopiedEpId(null), 2000);
    }
  };

  const handleRetry = () => {
    if (!series) return;
    setLoading(true);
    setError(null);
    const playlist = playlists?.find(p => p.id === series.playlistId);
    if (playlist && playlist.type === 'xtream' && playlist.serverUrl && playlist.username && playlist.password) {
      const client = new XtreamClient({
        serverUrl: playlist.serverUrl,
        username: playlist.username,
        password: playlist.password
      });
      client.getSeriesDetails(series.id, series.id)
        .then((seasonsData) => {
          if (seasonsData && seasonsData.length > 0) {
            setSeasons(seasonsData);
            if (seasonsData[0]) {
              setSelectedSeasonNum(seasonsData[0].seasonNum);
            }
            if (onUpdateSeries) {
              onUpdateSeries({
                ...series,
                seasons: seasonsData,
                totalEpisodes: seasonsData.reduce((acc, s) => acc + (s.episodes?.length || 0), 0)
              });
            }
          } else {
            setSeasons([]);
          }
        })
        .catch((err: any) => {
          setError(err.message || 'Falha ao carregar os episódios da série.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
      setSeasons([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-[#11131b] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm border border-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Backdrop Banner / Poster Top Section */}
        <div className="relative h-44 sm:h-56 w-full bg-gradient-to-t from-[#11131b] via-neutral-900/60 to-black/80 overflow-hidden shrink-0">
          {series.posterUrl ? (
            <img
              src={series.posterUrl}
              alt={series.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover blur-md opacity-30 scale-110"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-neutral-900/80">
              <Clapperboard className="w-16 h-16 text-neutral-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#11131b] via-[#11131b]/70 to-transparent" />

          {/* Floating Details Header */}
          <div className="absolute bottom-4 left-6 sm:left-8 flex items-end gap-4">
            <div className="w-20 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-neutral-700/80 bg-neutral-900 shrink-0">
              {series.posterUrl ? (
                <img
                  src={series.posterUrl}
                  alt={series.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                  <Tv className="w-8 h-8 text-neutral-600" />
                </div>
              )}
            </div>

            <div className="mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Série
                </span>
                <span className="text-[10px] text-neutral-400 font-medium">
                  {displaySeasons.length} {displaySeasons.length === 1 ? 'temporada' : 'temporadas'}
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-white font-['Outfit'] mt-1 line-clamp-2">
                {series.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
          {/* Metadata & Favorite Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
              {series.year && (
                <span className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-orange-400" />
                  {series.year}
                </span>
              )}
              {series.rating && (
                <span className="flex items-center gap-1 bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 font-medium text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {series.rating}
                </span>
              )}
              <span className="bg-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-800 text-neutral-400 font-medium">
                {series.category || 'Séries'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onToggleFavorite(series)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0 ${
                isFavorite
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="hidden sm:inline">{isFavorite ? 'Favoritada' : 'Favoritar Série'}</span>
            </button>
          </div>

          {/* Synopsis if present */}
          {series.description && (
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light">
              {series.description}
            </p>
          )}

          {/* Episode Section with states */}
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 border border-neutral-800/85 rounded-2xl bg-neutral-900/20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
              <p className="text-xs text-neutral-400 font-medium">Carregando episódios...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center border border-dashed border-rose-950 bg-rose-950/10 rounded-2xl text-rose-300 text-xs space-y-3">
              <p className="font-medium">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </button>
            </div>
          ) : seasons.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-xs">
              Nenhum episódio encontrado para esta série.
            </div>
          ) : (
            <>
              {/* Season Selector Tabs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                    Selecione a Temporada
                  </h3>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {displaySeasons.map((season) => {
                    const isSelected = season.seasonNum === currentSeason.seasonNum;
                    return (
                      <button
                        key={season.seasonNum}
                        type="button"
                        onClick={() => setSelectedSeasonNum(season.seasonNum)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-950/40'
                            : 'bg-neutral-900/90 text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        Temporada {season.seasonNum}
                        <span className="ml-1.5 opacity-70 text-[10px]">
                          ({season.episodes?.length || 0} eps)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Episodes List in Current Season */}
              <div key={currentSeason.seasonNum} className="space-y-2 pt-1 transition-opacity duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-300 pb-1">
                  <span>
                    Temporada {currentSeason.seasonNum} • {episodes.length} {episodes.length === 1 ? 'episódio' : 'episódios'}
                  </span>
                </div>

                {episodes.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-neutral-800 rounded-2xl text-neutral-500 text-xs">
                    Nenhum episódio encontrado para esta temporada.
                  </div>
                ) : (
                  episodes.map((ep, idx) => (
                    <div
                      key={ep.id}
                      style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
                      className="flex items-center justify-between gap-3 p-3 sm:p-3.5 bg-neutral-900/60 hover:bg-neutral-800/60 border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl transition-all group animate-in fade-in slide-in-from-bottom-2 duration-200 fill-mode-backwards"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-neutral-800/90 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                          {ep.episodeNum}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-sm font-semibold text-neutral-200 group-hover:text-white truncate">
                            {ep.title}
                          </h5>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                            <span>T{ep.seasonNum}:E{ep.episodeNum}</span>
                            {ep.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {ep.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Play & Action Buttons for Episode */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyEp(ep)}
                          title="Copiar URL do episódio"
                          className="p-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors"
                        >
                          {copiedEpId === ep.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onPlayEpisode(series, ep)}
                          className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-md transition-all active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-white stroke-none" />
                          <span>Assistir</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
