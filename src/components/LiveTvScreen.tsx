import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Tv, Play, Pause, Heart, Search, X, Volume2, VolumeX, 
  Maximize2, RotateCcw, ExternalLink, Radio, Layers, 
  Sparkles, AlertTriangle, Loader2 
} from 'lucide-react';
import Hls from 'hls.js';
import { LiveChannel } from '../types';
import { getChannelEpg, ChannelEpgInfo } from '../services/epgService';
import { PlaybackService } from '../services/playbackService';
import { StorageService } from '../services/storageService';

interface LiveTvScreenProps {
  channels: LiveChannel[];
  onPlayChannel?: (channel: LiveChannel) => void;
  onToggleFavorite: (channel: LiveChannel) => void;
  isFavorite: (id: string) => boolean;
  onOpenAddPlaylist: () => void;
  fixXtreamStreamUrl?: (url: string) => string;
  onRecordHistory?: (channel: LiveChannel) => void;
  isActiveTab?: boolean;
}

export const LiveTvScreen: React.FC<LiveTvScreenProps> = ({
  channels,
  onPlayChannel,
  onToggleFavorite,
  isFavorite,
  onOpenAddPlaylist,
  fixXtreamStreamUrl,
  onRecordHistory,
  isActiveTab = true
}) => {
  // Navigation & Filtering
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(80);

  // Top Embedded Player State
  const [activeChannel, setActiveChannel] = useState<LiveChannel | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showControls, setShowControls] = useState<boolean>(true);

  // Refs for video playback
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  // EPG Cache for channels (keyed by channel id)
  const [epgMap, setEpgMap] = useState<Map<string, ChannelEpgInfo>>(new Map());

  // 1. Auto-play last watched channel upon entering Live TV page if none selected
  useEffect(() => {
    if (isActiveTab && channels && channels.length > 0) {
      if (!activeChannel) {
        const savedId = StorageService.getLastLiveChannelId();
        const foundChannel = savedId ? channels.find(c => c.id === savedId) : null;
        setActiveChannel(foundChannel || channels[0]);
      }
    }
  }, [isActiveTab, channels, activeChannel]);

  // Keep last watched channel persisted whenever active channel changes
  useEffect(() => {
    if (activeChannel?.id) {
      StorageService.setLastLiveChannelId(activeChannel.id);
    }
  }, [activeChannel?.id]);

  // Update EPG periodically (every 60 seconds)
  useEffect(() => {
    const updateEpg = () => {
      const now = new Date();
      const newMap = new Map<string, ChannelEpgInfo>();
      channels.forEach(ch => {
        newMap.set(ch.id, getChannelEpg(ch, now));
      });
      setEpgMap(newMap);
    };

    updateEpg();
    const interval = setInterval(updateEpg, 60000);
    return () => clearInterval(interval);
  }, [channels]);

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

  // Filter channels based on selected category and search query
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
    setVisibleLimit(80);
  }, [selectedCategory, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleLimit < filteredChannels.length) {
          setVisibleLimit((prev) => Math.min(prev + 80, filteredChannels.length));
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [filteredChannels.length, visibleLimit]);

  // Helper for playable stream URL (exact link from list with healed credentials)
  const getPlayableUrl = useCallback((rawUrl: string): string => {
    if (!rawUrl) return '';
    const healed = fixXtreamStreamUrl ? fixXtreamStreamUrl(rawUrl) : rawUrl;
    return healed;
  }, [fixXtreamStreamUrl]);

  // Auto-hide controls timer
  const triggerControlsActivity = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4500);
  }, [isPlaying]);

  // Stream Player Setup whenever activeChannel or retryKey changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeChannel || !activeChannel.streamUrl) return;

    setIsLoadingStream(true);
    setPlayerError(null);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const rawUrl = activeChannel.streamUrl;
    const finalStream = fixXtreamStreamUrl ? fixXtreamStreamUrl(rawUrl) : rawUrl;
    const playableUrl = getPlayableUrl(finalStream);

    const isM3u8 = playableUrl.includes('.m3u8') || playableUrl.includes('/m3u8') || 
                   playableUrl.toLowerCase().includes('type=m3u8') ||
                   finalStream.includes('.m3u8') || finalStream.includes('/m3u8');

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 20,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
      });
      hlsRef.current = hls;

      hls.loadSource(playableUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play()
          .then(() => {
            setIsPlaying(true);
            setIsLoadingStream(false);
          })
          .catch(() => {
            // Browsers often require muted autoplay
            video.muted = true;
            setIsMuted(true);
            video.play()
              .then(() => {
                setIsPlaying(true);
                setIsLoadingStream(false);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsLoadingStream(false);
              });
          });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setPlayerError('Não foi possível conectar ao fluxo ao vivo. O canal pode estar instável ou requer reprodutor externo.');
              setIsLoadingStream(false);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playableUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play()
          .then(() => {
            setIsPlaying(true);
            setIsLoadingStream(false);
          })
          .catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
      });
    } else {
      video.src = playableUrl;
      video.load();
      video.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoadingStream(false);
        })
        .catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeChannel, retryKey, fixXtreamStreamUrl, getPlayableUrl]);

  // 3-second minimum watch rule: only add to Continue Watching if watched for >= 3 seconds
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChannelIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isPlaying || !activeChannel) {
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current);
        watchTimerRef.current = null;
      }
      return;
    }

    // Don't re-record if already recorded for this specific channel in this continuous playback
    if (recordedChannelIdRef.current === activeChannel.id) {
      return;
    }

    if (watchTimerRef.current) {
      clearTimeout(watchTimerRef.current);
    }

    watchTimerRef.current = setTimeout(() => {
      if (onRecordHistory && activeChannel) {
        onRecordHistory(activeChannel);
        recordedChannelIdRef.current = activeChannel.id;
      }
    }, 3000);

    return () => {
      if (watchTimerRef.current) {
        clearTimeout(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };
  }, [isPlaying, activeChannel, onRecordHistory]);

  // Playback Control Handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
    triggerControlsActivity();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    video.muted = nextMute;
    triggerControlsActivity();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    triggerControlsActivity();
  };

  const handleToggleFullscreen = () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.warn('Erro ao entrar em tela cheia:', err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSelectChannel = (channel: LiveChannel) => {
    if (activeChannel?.id === channel.id) return;
    setActiveChannel(channel);
    StorageService.setLastLiveChannelId(channel.id);
    // Keeps user on the same page while the top player updates and plays!
  };

  // Current channel EPG info
  const activeEpg = activeChannel ? epgMap.get(activeChannel.id) || getChannelEpg(activeChannel) : null;
  const vlcIntentUrl = activeChannel 
    ? PlaybackService.buildVlcAndroidIntent(
        fixXtreamStreamUrl ? fixXtreamStreamUrl(activeChannel.streamUrl) : activeChannel.streamUrl, 
        activeChannel.name
      ) 
    : '';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 pb-24 space-y-4">

      {/* TOP EMBEDDED PLAYER SECTION - FIXED STICKY AT TOP */}
      {activeChannel && (
        <div className="sticky top-[57px] z-30 pt-1 pb-2.5 bg-[#090a0f]/95 backdrop-blur-md -mx-3 px-3 sm:-mx-4 sm:px-4 border-b border-neutral-800/80 shadow-2xl transition-all">
          <div 
            ref={playerContainerRef}
            onMouseMove={triggerControlsActivity}
            className="relative w-full rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl transition-all group mx-auto max-w-5xl"
          >
            {/* Main Video Element */}
            <div className="relative aspect-video max-h-[220px] sm:max-h-[280px] md:max-h-[340px] w-full flex items-center justify-center bg-neutral-950">
            <video
              ref={videoRef}
              playsInline
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
              onWaiting={() => setIsLoadingStream(true)}
              onPlaying={() => { setIsLoadingStream(false); setIsPlaying(true); setPlayerError(null); }}
              onError={() => {
                setIsLoadingStream(false);
                setPlayerError('Transmissão ao vivo instável ou bloqueada pelo navegador. Você pode tentar recarregar ou abrir no VLC.');
              }}
            />

            {/* Spinner Overlay */}
            {isLoadingStream && !playerError && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center pointer-events-none gap-2 z-10">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                <span className="text-xs text-neutral-300 font-medium tracking-wide">
                  Conectando a {activeChannel.name}...
                </span>
              </div>
            )}

            {/* Error Overlay with VLC fallback */}
            {playerError && (
              <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1">
                  <p className="text-sm font-bold text-white">Falha na Reprodução Web</p>
                  <p className="text-xs text-neutral-400">{playerError}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRetryKey(k => k + 1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Tentar Novamente
                  </button>
                  {vlcIntentUrl && (
                    <a
                      href={vlcIntentUrl}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-orange-950/50"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir no VLC
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Top Video Header Overlay (Channel Title & EPG Now Playing) */}
            <div 
              className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-10 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {activeChannel.logoUrl ? (
                  <img
                    src={activeChannel.logoUrl}
                    alt={activeChannel.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-contain bg-black/60 rounded-lg p-1 border border-neutral-800 shrink-0"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30 shrink-0">
                    <Tv className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      AO VIVO
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium truncate">
                      {activeChannel.category}
                    </span>
                  </div>
                  <h2 className="text-sm sm:text-base font-black text-white truncate font-['Outfit']">
                    {activeChannel.name}
                  </h2>
                </div>
              </div>

              {/* Quick Actions in top overlay */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleFavorite(activeChannel)}
                  className={`p-2 rounded-xl backdrop-blur-md transition-colors ${
                    isFavorite(activeChannel.id)
                      ? 'bg-rose-500/20 text-rose-500'
                      : 'bg-black/50 text-neutral-400 hover:text-white'
                  }`}
                  title="Favoritar canal"
                >
                  <Heart className={`w-4 h-4 ${isFavorite(activeChannel.id) ? 'fill-rose-500' : ''}`} />
                </button>
                {vlcIntentUrl && (
                  <a
                    href={vlcIntentUrl}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 rounded-xl text-xs font-medium backdrop-blur-md transition-colors"
                    title="Abrir transmissão externa no VLC"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                    <span>VLC</span>
                  </a>
                )}
              </div>
            </div>

            {/* Bottom Controls Bar Overlay */}
            <div 
              className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between gap-3 transition-opacity duration-300 z-10 ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Left playback buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="p-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-transform active:scale-95 shadow-md shadow-orange-950/40"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setRetryKey(k => k + 1)}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 text-neutral-300 hover:text-white transition-colors"
                  title="Recarregar sinal do canal"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1.5 pl-1">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="p-2 rounded-xl bg-black/40 hover:bg-black/60 text-neutral-300 hover:text-white transition-colors"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-neutral-300" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 sm:w-24 accent-orange-500 h-1 bg-neutral-700 rounded-lg cursor-pointer hidden sm:block"
                  />
                </div>
              </div>

              {/* Current Program on Player Bar */}
              {activeEpg && (
                <div className="hidden md:flex flex-col items-center max-w-sm truncate text-center px-2">
                  <span className="text-[11px] font-bold text-white truncate">
                    🔴 {activeEpg.currentProgram.title}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                    <span>{activeEpg.currentProgram.startTime} - {activeEpg.currentProgram.endTime}</span>
                    <span className="w-1 h-1 rounded-full bg-neutral-600" />
                    <span className="text-orange-400">{activeEpg.currentProgram.progressPercent}% decorrido</span>
                  </div>
                </div>
              )}

              {/* Right Fullscreen & External actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="p-2 rounded-xl bg-black/40 hover:bg-black/60 text-neutral-300 hover:text-white transition-colors"
                  title="Tela Cheia"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Under-player EPG Mini Bar */}
          {activeEpg && (
            <div className="px-4 py-2.5 bg-neutral-900/90 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping shrink-0" />
                <span className="text-neutral-400 shrink-0 font-medium">Programa Atual:</span>
                <span className="text-white font-bold truncate">
                  {activeEpg.currentProgram.title}
                </span>
                <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full shrink-0">
                  {activeEpg.currentProgram.startTime} - {activeEpg.currentProgram.endTime}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 truncate shrink-0">
                <span className="text-neutral-500">A seguir:</span>
                <span className="text-neutral-300 font-medium truncate max-w-[220px]">
                  {activeEpg.nextProgram.title} ({activeEpg.nextProgram.startTime})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* TOP HEADER WITH SLIM SEARCH (No "ordem" button, slim search bar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-500 flex items-center justify-center">
            <Tv className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white font-['Outfit']">
            Grade de Canais
          </h1>
          <span className="text-[10px] bg-neutral-800 text-neutral-400 font-semibold px-2 py-0.5 rounded-full">
            {filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canais'}
          </span>
        </div>

        {/* Slim Sleek Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar canal ou categoria..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#11131b] border border-neutral-800/90 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:hidden">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const count = categoryCounts.get(cat) || 0;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-950/40'
                  : 'bg-neutral-900/90 text-neutral-400 hover:text-white border border-neutral-800/80'
              }`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] px-1.5 py-0.1 rounded-full ${isSelected ? 'bg-orange-600 text-white' : 'bg-neutral-800 text-neutral-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* MAIN CONTENT: SPLIT SCREEN (Categories Left + Compact Channels with EPG Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        
        {/* Left Sidebar: Categories Panel (Desktop) */}
        <div className="hidden md:block md:col-span-4 lg:col-span-3 bg-[#11131b]/95 border border-neutral-800/80 rounded-2xl p-3.5 sticky top-4 shadow-xl max-h-[calc(100vh-120px)] flex flex-col">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800/90">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 font-['Outfit']">
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
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-between group ${
                    isSelected
                      ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-950/40'
                      : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                  }`}
                >
                  <span className="truncate pr-2 flex items-center gap-2">
                    <Radio className={`w-3 h-3 shrink-0 ${isSelected ? 'text-white' : 'text-neutral-500 group-hover:text-orange-400'}`} />
                    {cat}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${
                    isSelected ? 'bg-orange-600 text-white font-bold' : 'bg-neutral-900 text-neutral-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Main Panel: Compact Channel Cards with EPG */}
        <div className="md:col-span-8 lg:col-span-9 space-y-3">
          
          {/* Active Category Filter Header */}
          <div className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800/80 rounded-xl px-3 py-2">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-orange-400" />
              <h3 className="text-xs font-bold text-white font-['Outfit']">
                {selectedCategory}
              </h3>
              <span className="text-[11px] text-neutral-400 font-medium">
                ({filteredChannels.length} {filteredChannels.length === 1 ? 'canal' : 'canais'})
              </span>
            </div>
            {selectedCategory !== 'Todas' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('Todas')}
                className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold underline"
              >
                Ver Todas
              </button>
            )}
          </div>

          {/* Empty States */}
          {channels.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 space-y-3">
              <Tv className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-300">Nenhum canal ao vivo disponível</h3>
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
            <div className="p-10 text-center border border-dashed border-neutral-800 rounded-2xl bg-neutral-900/20 text-neutral-400 text-xs space-y-2">
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
            <div className="space-y-4">
              {/* COMPACT CHANNEL CARDS GRID WITH EPG */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {visibleChannels.map((channel) => {
                  const starred = isFavorite(channel.id);
                  const isCurrentActive = activeChannel?.id === channel.id;
                  const epg = epgMap.get(channel.id) || getChannelEpg(channel);

                  return (
                    <div
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      className={`group relative p-2.5 rounded-xl border cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between shadow-sm ${
                        isCurrentActive
                          ? 'bg-orange-950/20 border-orange-500/80 ring-1 ring-orange-500/50 shadow-orange-950/40'
                          : 'bg-[#11131b] hover:bg-[#161922] border-neutral-800/80 hover:border-neutral-700'
                      }`}
                    >
                      {/* Top Row: Channel Logo + Channel Name & Badges */}
                      <div className="flex items-center gap-2.5 mb-2">
                        {/* Channel Logo */}
                        <div className="relative w-14 h-12 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                          {channel.logoUrl ? (
                            <img
                              src={channel.logoUrl}
                              alt={channel.name}
                              referrerPolicy="no-referrer"
                              className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Tv className="w-5 h-5 text-neutral-600" />
                          )}
                          
                          {/* Playing Status Badge on Logo */}
                          {isCurrentActive && (
                            <div className="absolute inset-0 bg-orange-600/20 flex items-center justify-center">
                              <span className="flex items-center gap-0.5">
                                <span className="w-1 h-3 bg-orange-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1 h-4 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1 h-2.5 bg-orange-500 rounded-full animate-bounce" />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Name and Channel Status */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`text-xs font-bold truncate ${
                              isCurrentActive ? 'text-orange-400' : 'text-neutral-200 group-hover:text-white'
                            }`}>
                              {channel.name}
                            </h4>

                            {/* Favorite Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(channel);
                              }}
                              className={`p-1 rounded-md transition-colors shrink-0 ${
                                starred
                                  ? 'text-rose-500 hover:text-rose-400'
                                  : 'text-neutral-500 hover:text-neutral-300'
                              }`}
                              title="Favoritar"
                            >
                              <Heart className={`w-3.5 h-3.5 ${starred ? 'fill-rose-500' : ''}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-neutral-500 truncate max-w-[130px]">
                              {channel.category}
                            </span>
                            {isCurrentActive ? (
                              <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.2 rounded">
                                NO AR
                              </span>
                            ) : (
                              <span className="text-[9px] text-neutral-500 group-hover:text-orange-400 flex items-center gap-0.5">
                                <Play className="w-2.5 h-2.5 fill-current" />
                                Assistir
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* EPG SECTION ON CARD */}
                      <div className="pt-2 border-t border-neutral-800/60 space-y-1">
                        {/* Current program title & time */}
                        <div className="flex items-center justify-between text-[11px] gap-1">
                          <span className="font-semibold text-neutral-300 group-hover:text-white truncate flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCurrentActive ? 'bg-orange-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="truncate">{epg.currentProgram.title}</span>
                          </span>
                          <span className="text-[10px] text-neutral-500 shrink-0 font-medium">
                            {epg.currentProgram.startTime}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-neutral-800/90 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isCurrentActive ? 'bg-orange-500' : 'bg-neutral-500 group-hover:bg-orange-400'
                            }`}
                            style={{ width: `${epg.currentProgram.progressPercent}%` }}
                          />
                        </div>

                        {/* Upcoming Next program */}
                        <div className="flex items-center justify-between text-[10px] text-neutral-400 truncate pt-0.5">
                          <span className="truncate">
                            <span className="text-neutral-500 mr-1">A seguir:</span>
                            {epg.nextProgram.title}
                          </span>
                          <span className="text-neutral-500 shrink-0 ml-1">
                            {epg.nextProgram.startTime}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Lazy Load Spinner */}
              {filteredChannels.length > visibleLimit && (
                <div ref={observerTarget} className="w-full py-6 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500"></div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
