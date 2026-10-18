import React, { useState, useEffect } from 'react';
import { 
  X, Play, Heart, Star, Clock, Calendar, Film, Tv, 
  ExternalLink, Copy, Check, Sparkles, AlertCircle, CheckCircle2,
  Share2, PlayCircle, Info, Loader2
} from 'lucide-react';
import { TmdbMediaItem, ActivePlaybackPayload, StreamSource } from '../types';
import { TmdbService } from '../services/tmdbService';
import { useStreamResolver } from '../hooks/useStreamResolver';

interface EnrichedDetailsModalProps {
  mediaId: number | string;
  mediaType: 'movie' | 'tv';
  initialTitle?: string;
  initialPoster?: string;
  initialBackdrop?: string;
  initialYear?: string;
  initialRating?: string;
  initialOverview?: string;
  isFavorite?: boolean;
  onClose: () => void;
  onPlay: (payload: ActivePlaybackPayload) => void;
  onToggleFavorite?: (media: TmdbMediaItem | { id: number; title: string; posterPath?: string; mediaType: 'movie' | 'tv' }) => void;
}

export const EnrichedDetailsModal: React.FC<EnrichedDetailsModalProps> = ({
  mediaId,
  mediaType,
  initialTitle,
  initialPoster,
  initialBackdrop,
  initialYear,
  initialRating,
  initialOverview,
  isFavorite = false,
  onClose,
  onPlay,
  onToggleFavorite,
}) => {
  const [details, setDetails] = useState<TmdbMediaItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [episodeStreams, setEpisodeStreams] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [isEpisodeStreamLoading, setIsLoadingStreams] = useState(false);

  const handleSelectEpisode = async (episodeNumber: number) => {
    setSelectedEpisode(episodeNumber);
    setIsLoadingStreams(true);
    setEpisodeStreams([]);

    try {
      const imdbId = await TmdbService.fetchExternalIds(mediaId, 'tv');
      if (!imdbId) throw new Error("Could not find IMDb ID");
      
      const addonBaseUrl = localStorage.getItem('foxstream_active_addon_url')?.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '') || '';
      
      const endpoint = `${addonBaseUrl}/stream/series/${imdbId}:${selectedSeason}:${episodeNumber}.json`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setEpisodeStreams(data.streams || []);
    } catch (err) {
      console.error("Failed to load episode streams", err);
      setEpisodeStreams([]);
    } finally {
      setIsLoadingStreams(false);
    }
  };

  // Hook for On-Demand Stream Resolution
  const { resolve, state: streamVerificationState, stream, allStreams, isAvailable, isLoading: isStreamLoading, matchType } = useStreamResolver({
    tmdbId: mediaId,
    title: details?.title || initialTitle,
    year: details?.year || initialYear,
    type: mediaType === 'tv' ? 'series' : 'movie',
    autoResolve: mediaType === 'movie', // Only auto-resolve for movies
  });

  // Fetch full details from TMDB
  useEffect(() => {
    let isMounted = true;
    setLoadingEpisodes(true);

    const fetchFullDetails = async () => {
      try {
        const data =
          mediaType === 'tv'
            ? await TmdbService.fetchFullTvDetails(mediaId)
            : await TmdbService.fetchFullMovieDetails(mediaId);

        if (isMounted) {
          setDetails(data);
          setLoadingDetails(false);
        }
      } catch (err) {
        console.warn('[EnrichedDetailsModal] Failed to fetch full details:', err);
        if (isMounted) setLoadingDetails(false);
      }
    };

    fetchFullDetails();

    return () => {
      isMounted = false;
    };
  }, [mediaId, mediaType]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (mediaType === 'tv') {
      setLoadingEpisodes(true);
      TmdbService.fetchSeasonEpisodes(mediaId, selectedSeason).then(eps => {
        setEpisodes(eps);
        setLoadingEpisodes(false);
      });
    }
  }, [selectedSeason, mediaType, mediaId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const title = details?.title || initialTitle || 'Título Desconhecido';
  const backdrop = details?.backdropPath || initialBackdrop || details?.posterPath || initialPoster;
  const poster = details?.posterPath || initialPoster;
  const rating = details?.voteAverage ? details.voteAverage.toFixed(1) : initialRating || '—';
  const year = details?.year || initialYear || '—';
  const overview = details?.overview || initialOverview || 'Sinopse não disponível no momento.';

  // Format runtime
  const formatRuntime = (mins?: number) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handlePlayClick = () => {
    if (!stream || !isAvailable) return;

    const payload: ActivePlaybackPayload = {
      tmdbId: typeof mediaId === 'number' ? mediaId : parseInt(String(mediaId), 10) || 0,
      title,
      posterPath: poster || '',
      backdropPath: backdrop || '',
      streamUrl: stream.streamUrl,
      format: stream.format,
      type: stream.type || (mediaType === 'tv' ? 'series' : 'movie'),
      seriesName: mediaType === 'tv' ? title : undefined,
    };

    onPlay(payload);
  };

  const handleCopyLink = () => {
    if (stream?.streamUrl && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(stream.streamUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] bg-[#0d0f18] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
          {/* Hero Backdrop Top Section */}
          <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden shrink-0">
            {backdrop ? (
              <img
                src={backdrop}
                alt={title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center transform scale-105 filter brightness-75"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-950 to-black" />
            )}

            {/* Gradient Overlays for Cinematic Blending */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f18] via-[#0d0f18]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0d0f18]/90 via-transparent to-transparent" />

            {/* Floating Poster & Badges overlay */}
            <div className="absolute bottom-4 left-4 sm:left-8 right-4 flex items-end gap-5">
              {/* Poster thumbnail */}
              {poster && (
                <div className="hidden sm:block w-28 md:w-36 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/15 shrink-0 bg-neutral-900">
                  <img
                    src={poster}
                    alt={title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title & Quick Info on Banner */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    {mediaType === 'tv' ? 'Série' : 'Filme'}
                  </span>
                  {stream?.quality && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {stream.quality}
                    </span>
                  )}
                  {stream?.format && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {stream.format}
                    </span>
                  )}
                  {details?.voteCount && (
                    <span className="text-[11px] text-neutral-400">
                      ({details.voteCount} votos)
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight drop-shadow-md truncate">
                  {title}
                </h1>

                {details?.tagline && (
                  <p className="text-xs sm:text-sm text-neutral-300 italic mt-1 line-clamp-1 font-light">
                    "{details.tagline}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Details Body Content */}
          <div className="p-4 sm:p-8 space-y-6">
            {/* Meta tags bar */}
            <div className="flex items-center flex-wrap gap-4 text-xs sm:text-sm text-neutral-300 pb-4 border-b border-white/10">
              {/* Rating */}
              <div className="flex items-center gap-1.5 text-amber-400 font-bold bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/20">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>{rating}</span>
                <span className="text-neutral-500 font-normal">/ 10</span>
              </div>

              {/* Year */}
              <div className="flex items-center gap-1.5 text-neutral-300 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                <Calendar className="w-4 h-4 text-neutral-400" />
                <span>{year}</span>
              </div>

              {/* Runtime / Seasons */}
              {mediaType === 'movie' && details?.runtime ? (
                <div className="flex items-center gap-1.5 text-neutral-300 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                  <Clock className="w-4 h-4 text-neutral-400" />
                  <span>{formatRuntime(details.runtime)}</span>
                </div>
              ) : null}

              {mediaType === 'tv' && details?.numberOfSeasons ? (
                <div className="flex items-center gap-1.5 text-neutral-300 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-white/5">
                  <Tv className="w-4 h-4 text-neutral-400" />
                  <span>
                    {details.numberOfSeasons} {details.numberOfSeasons === 1 ? 'Temporada' : 'Temporadas'}
                    {details.numberOfEpisodes ? ` • ${details.numberOfEpisodes} eps` : ''}
                  </span>
                </div>
              ) : null}


              {/* TV Series Season/Episode Selector */}
              {mediaType === 'tv' && (
                <div className="bg-neutral-900/40 p-4 rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold">Temporadas</h3>
                    <select
                      value={selectedSeason}
                      onChange={(e) => setSelectedSeason(Number(e.target.value))}
                      className="bg-neutral-800 text-white text-sm rounded-xl px-3 py-1.5 border border-white/10"
                    >
                      {Array.from({ length: details?.numberOfSeasons || 1 }).map((_, i) => (
                        <option key={i} value={i + 1}>Temporada {i + 1}</option>
                      ))}
                    </select>
                  </div>
                  
                  {loadingEpisodes ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-orange-500" /></div>
                  ) : (
                    <div className="grid gap-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                      {episodes.map(ep => (
                        <div key={ep.id} className="bg-neutral-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-4">
                          <div className="w-16 h-9 bg-neutral-700 rounded flex-shrink-0">
                             {ep.still_path && <img src={`https://image.tmdb.org/t/p/w185${ep.still_path}`} className="w-full h-full object-cover rounded" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{ep.episode_number}. {ep.name}</p>
                            <p className="text-xs text-neutral-400 line-clamp-1">{ep.overview}</p>
                          </div>
                          <button
                            onClick={() => handleSelectEpisode(ep.episode_number)}
                            className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                          >
                            Assistir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Episode Streams Options */}
                  {selectedEpisode !== null && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <h4 className="text-white font-semibold mb-3">Opções de Transmissão - Ep {selectedEpisode}</h4>
                      {isEpisodeStreamLoading ? (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-orange-500" /></div>
                      ) : episodeStreams.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {episodeStreams.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const payload: ActivePlaybackPayload = {
                                  tmdbId: typeof mediaId === 'number' ? mediaId : parseInt(String(mediaId), 10) || 0,
                                  title: `${details?.title || initialTitle} - T${selectedSeason} E${selectedEpisode}`,
                                  posterPath: poster || '',
                                  backdropPath: backdrop || '',
                                  streamUrl: s.url || (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : ''),
                                  format: 'mp4',
                                  type: 'series',
                                  seriesName: details?.title || initialTitle,
                                };
                                onPlay(payload);
                              }}
                              className="flex items-center justify-between gap-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 px-5 rounded-xl text-sm transition-all"
                            >
                              <span className="truncate" style={{ whiteSpace: 'pre-line' }}>{s.title || s.name || 'Stream'}</span>
                              <Play className="w-4 h-4 fill-white stroke-none" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-neutral-400">Nenhum stream disponível para este episódio.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Genres */}
              {details?.genres && details.genres.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {details.genres.slice(0, 4).map((g) => (
                    <span
                      key={g.id}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-neutral-300 border border-white/10"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ACTION ROW: Assistir Agora / Status */}
            <div className="bg-neutral-900/60 p-4 sm:p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Watch Now Button / Stream List */}
                {mediaType === 'movie' ? (
                  isAvailable ? (
                  <div className="w-full flex flex-col gap-2">
                    {/* If allStreams exists, show all. If not, fallback to single stream */}
                    {allStreams && allStreams.length > 1 ? (
                      allStreams.map((s: any, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (!s.streamUrl) {
                              alert('Este stream não possui um link de reprodução válido.');
                              return;
                            }
                            const payload: ActivePlaybackPayload = {
                              tmdbId: typeof mediaId === 'number' ? mediaId : parseInt(String(mediaId), 10) || 0,
                              title,
                              posterPath: poster || '',
                              backdropPath: backdrop || '',
                              streamUrl: s.streamUrl,
                              format: s.format,
                              type: 'movie',
                              seriesName: undefined,
                            };
                            onPlay(payload);
                          }}
                          className="flex items-center justify-between gap-3 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 px-5 rounded-xl text-sm transition-all"
                        >
                          <span className="truncate" style={{ whiteSpace: 'pre-line' }}>{s.title || s.quality}</span>
                          <Play className="w-4 h-4 fill-white stroke-none" />
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={handlePlayClick}
                        className="w-full sm:w-auto flex items-center justify-center gap-3 bg-gradient-to-r from-orange-500 via-orange-600 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold py-3.5 px-8 rounded-2xl text-base shadow-xl shadow-orange-950/50 hover:shadow-orange-600/30 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-white stroke-none" />
                        <span>Assistir Agora</span>
                        {stream?.quality && (
                          <span className="text-xs bg-black/30 px-2 py-0.5 rounded font-mono">
                            {stream.quality}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                ) : isStreamLoading ? (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto flex items-center justify-center gap-3 bg-neutral-800/80 text-neutral-400 font-semibold py-3.5 px-8 rounded-2xl text-sm border border-white/10 cursor-wait"
                  >
                    <div className="w-4 h-4 rounded-full border-2 border-orange-500/40 border-t-orange-500 animate-spin" />
                    <span>Verificando sinal de transmissão...</span>
                  </button>
                ) : (
                  <div className="w-full sm:w-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    <button
                      type="button"
                      disabled
                      title="Este título não possui link mapeado no arquivo streams.json no momento."
                      className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-neutral-800/50 text-neutral-500 font-semibold py-3.5 px-6 rounded-2xl text-sm border border-neutral-700/50 cursor-not-allowed"
                    >
                      <AlertCircle className="w-4 h-4 text-neutral-500" />
                      <span>Conteúdo indisponível no momento</span>
                    </button>
                  </div>
                )
                ) : null}

                {/* Trailer Button */}
                {details?.trailerUrl && (
                  <a
                    href={details.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-neutral-200 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-semibold"
                    title="Assistir Trailer Oficial no YouTube"
                  >
                    <PlayCircle className="w-4 h-4 text-red-400" />
                    <span className="hidden sm:inline">Trailer</span>
                  </a>
                )}

                {/* Favorite toggle */}
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={() => {
                      if (details) onToggleFavorite(details);
                      else onToggleFavorite({ id: Number(mediaId), title, posterPath: poster, mediaType });
                    }}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-center gap-2 ${
                      isFavorite
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                )}

                {/* Copy stream link */}
                {isAvailable && stream?.streamUrl && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    title="Copiar URL do Stream"
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                )}
              </div>

              {/* Match Verification Diagnostics Badge */}
              <div className="text-right text-[11px] text-neutral-400 flex items-center gap-1.5">
                {isAvailable ? (
                  <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Sinal pronto ({matchType === 'tmdb_id' ? 'TMDB ID' : 'Título'})
                  </span>
                ) : isStreamLoading ? (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    Consultando streams.json
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-neutral-500">
                    <Info className="w-3.5 h-3.5" />
                    Sem link em streams.json
                  </span>
                )}
              </div>
            </div>

            {/* Synopsis / Overview */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                <span>Sinopse</span>
                {loadingDetails && (
                  <span className="text-[10px] font-normal text-neutral-500 animate-pulse">
                    (Atualizando TMDb...)
                  </span>
                )}
              </h3>
              <p className="text-sm sm:text-base text-neutral-300 font-light leading-relaxed">
                {overview}
              </p>
            </div>

            {/* Cast Carousel / Avatars */}
            {details?.cast && details.cast.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Elenco Principal
                </h3>
                <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-1 custom-scrollbar">
                  {details.cast.map((actor) => (
                    <div
                      key={actor.id}
                      className="flex flex-col items-center text-center shrink-0 w-20 sm:w-24 group"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-neutral-800 border-2 border-white/10 group-hover:border-orange-500/50 transition-colors shadow-md">
                        {actor.profilePath ? (
                          <img
                            src={actor.profilePath}
                            alt={actor.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-500 text-xs font-bold">
                            {actor.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-medium text-neutral-200 mt-2 truncate w-full group-hover:text-orange-400 transition-colors">
                        {actor.name}
                      </span>
                      <span className="text-[10px] text-neutral-400 truncate w-full font-light">
                        {actor.character}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
