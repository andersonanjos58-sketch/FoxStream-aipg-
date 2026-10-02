import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2, ExternalLink, RefreshCw, X, AlertTriangle, Tv } from 'lucide-react';
import Hls from 'hls.js';
import { PlaybackIntentOptions, PlaybackService } from '../services/playbackService';

interface InternalPlayerProps {
  options: PlaybackIntentOptions | null;
  onClose: () => void;
}

export const InternalPlayer: React.FC<InternalPlayerProps> = ({ options, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      const supported = 'pictureInPictureEnabled' in document && typeof video.requestPictureInPicture === 'function';
      setIsPipSupported(!!supported);

      const handleEnterPip = () => setIsPipActive(true);
      const handleLeavePip = () => setIsPipActive(false);

      video.addEventListener('enterpictureinpicture', handleEnterPip);
      video.addEventListener('leavepictureinpicture', handleLeavePip);

      return () => {
        video.removeEventListener('enterpictureinpicture', handleEnterPip);
        video.removeEventListener('leavepictureinpicture', handleLeavePip);
      };
    }
  }, []);

  const togglePip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Guard: Prevent requesting Picture-in-Picture before video metadata has loaded
    if (!isMetadataLoaded || video.readyState < 1) {
      console.warn('Metadata not loaded yet. Ignoring Picture-in-Picture request.');
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('Error with Picture-in-Picture:', err);
    }
    triggerControlsActivity();
  };

  const finalStreamUrl = options?.streamUrl || '';
  const finalTitle = options?.title || 'Transmissão FoxStream';
  const finalType = options?.type || 'live';
  const finalPoster = options?.posterUrl || '';
  const finalCategory = options?.category || '';
  const finalSeriesName = options?.seriesName || '';
  const finalSeasonEp = options?.seasonEpisode || '';

  const getPlayableUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    if (url.startsWith('/api/proxy') || url.includes('/api/proxy?url=')) return url;
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  };

  const sanitizeUrlForError = (url: string): string => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      if (pathParts.length >= 4 && ['live', 'movie', 'series'].includes(pathParts[1])) {
        pathParts[2] = '***';
        pathParts[3] = '***';
        parsed.pathname = pathParts.join('/');
      }
      if (parsed.searchParams.has('username')) parsed.searchParams.set('username', '***');
      if (parsed.searchParams.has('password')) parsed.searchParams.set('password', '***');
      if (parsed.searchParams.has('user')) parsed.searchParams.set('user', '***');
      if (parsed.searchParams.has('pass')) parsed.searchParams.set('pass', '***');
      return parsed.toString();
    } catch {
      return url.replace(/(\/live\/|\/movie\/|\/series\/)[^/]+\/[^/]+/, '$1***/***');
    }
  };

  const playableUrl = getPlayableUrl(finalStreamUrl);

  // Controls auto-hide timer
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerControlsActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 4000);
  };

  useEffect(() => {
    triggerControlsActivity();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying]);

  // Load and setup HLS stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !finalStreamUrl) return;

    setIsLoading(true);
    setError(null);
    setIsMetadataLoaded(false);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isM3u8 = playableUrl.includes('.m3u8') || playableUrl.includes('/m3u8') || playableUrl.toLowerCase().includes('type=m3u8') ||
                   finalStreamUrl.includes('.m3u8') || finalStreamUrl.includes('/m3u8') || finalStreamUrl.toLowerCase().includes('type=m3u8');

    if (isM3u8 && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 30,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
      });
      hlsRef.current = hls;

      hls.loadSource(playableUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS.js loading error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('HLS Network error, attempting recovery...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('HLS Media error, attempting recovery...', data);
              hls.recoverMediaError();
              break;
            default:
              const cleanedUrl = sanitizeUrlForError(finalStreamUrl);
              setError(
                `Não foi possível decodificar ou carregar esta transmissão (Erro HLS.js). O servidor remoto de mídia pode estar temporariamente offline ou requer autenticação externa. Transmissão limpa: ${cleanedUrl}. Recomendação: Clique no botão "Abrir no VLC" para reproduzir no aplicativo externo nativo.`
              );
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (iOS / Safari)
      video.src = playableUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      });
    } else {
      // Standard video format (mp4/mkv/TS)
      video.src = playableUrl;
      video.load();
      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playableUrl, retryCount]);

  // Video Event Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleDurationChange = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleWaiting = () => setIsLoading(true);
  const handlePlaying = () => {
    setIsLoading(false);
    setError(null);
  };
  const handleLoadStart = () => setIsLoading(true);
  const handleCanPlay = () => {
    setIsLoading(false);
    setIsMetadataLoaded(true);
  };
  const handleLoadedMetadata = () => {
    setIsMetadataLoaded(true);
  };
  const handleVideoError = () => {
    // If HLS failed natively or basic mp4 stream errored
    if (!hlsRef.current) {
      const sanitizedUrl = sanitizeUrlForError(finalStreamUrl);
      setError(
        `Erro de mídia ou codec do reprodutor interno. O navegador não conseguiu decodificar esta transmissão de vídeo diretamente (CORS/Codec). Link limpo: ${sanitizedUrl}. Sugestão: Clique no botão "Abrir no VLC" para reproduzir instantaneamente sem bloqueios do navegador.`
      );
      setIsLoading(false);
    }
  };

  // User Playback Interactions
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Playback blocked', e));
    }
    triggerControlsActivity();
  };

  const handleRewind = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
    }
    triggerControlsActivity();
  };

  const handleForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
    }
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

  const toggleMute = () => {
    const currentMute = !isMuted;
    setIsMuted(currentMute);
    if (videoRef.current) {
      videoRef.current.muted = currentMute;
    }
    triggerControlsActivity();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
    triggerControlsActivity();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    }
    triggerControlsActivity();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleOpenInVlc = () => {
    if (options) {
      PlaybackService.launchExternalPlayback(options);
    }
  };

  // Helper to format time (hh:mm:ss / mm:ss)
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return '00:00';
    const hrs = Math.floor(timeInSeconds / 3600);
    const mins = Math.floor((timeInSeconds % 3600) / 60);
    const secs = Math.floor(timeInSeconds % 60);

    const pad = (num: number) => String(num).padStart(2, '0');

    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  };

  // Detect whether to show timeline or Live status
  const isLive = finalType === 'live' || duration === Infinity || duration === 0 || isNaN(duration);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200 p-0 sm:p-4">
      <div
        ref={containerRef}
        onMouseMove={triggerControlsActivity}
        onClick={triggerControlsActivity}
        className="relative w-full max-w-5xl aspect-video bg-neutral-950 border border-neutral-800/60 sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col group select-none"
      >
        {/* Actual HTML Video */}
        <video
          ref={videoRef}
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleVideoError}
          playsInline
          className="w-full h-full object-contain cursor-pointer bg-black"
        />

        {/* LOADING SPINNER OVERLAY */}
        {/* LOADING SPINNER OVERLAY */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-sm pointer-events-none z-15">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-orange-500 border-neutral-800"></div>
            <span className="text-xs font-semibold text-neutral-300 mt-3 tracking-wider uppercase">Carregando Stream...</span>
          </div>
        )}

        {/* ERROR OVERLAY */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 p-6 text-center z-20">
            {/* Top Close Button for Error Overlay */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors z-30"
              title="Fechar player"
            >
              <X className="w-4 h-4" />
            </button>

            <AlertTriangle className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">Erro de Reprodução</h3>
            <p className="text-xs text-neutral-400 max-w-sm mb-6 leading-relaxed">{error}</p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </button>
              <button
                type="button"
                onClick={handleOpenInVlc}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-orange-950/40"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir no VLC
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-xl text-xs font-bold transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                Fechar player
              </button>
            </div>
          </div>
        )}

        {/* CONTROLS OVERLAY */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/80 flex flex-col justify-between p-4 transition-opacity duration-300 pointer-events-none z-10 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* TOP CONTROLS BAR (Header / Info) */}
          <div className="flex items-center justify-between w-full pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded bg-orange-500 text-white shadow-sm shadow-orange-950">
                {isLive ? 'AO VIVO' : finalType === 'movie' ? 'Filme' : 'Série'}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-white truncate max-w-[280px] sm:max-w-md">
                  {finalTitle}
                </h3>
                {(finalSeriesName || finalCategory) && (
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    {finalSeriesName ? `${finalSeriesName} • ${finalSeasonEp}` : finalCategory}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* VlC Intent Trigger Button */}
              <button
                type="button"
                onClick={handleOpenInVlc}
                title="Abrir no aplicativo VLC Media Player"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-[11px] font-semibold transition-all active:scale-95"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="hidden sm:inline">Abrir no VLC</span>
                <span className="sm:hidden">VLC</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full bg-neutral-900/60 hover:bg-neutral-800/90 text-neutral-400 hover:text-white border border-neutral-800/30 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* MIDDLE PLAY/PAUSE BIG OVERLAY */}
          <div className="flex items-center justify-center w-full pointer-events-auto">
            <div className="flex items-center gap-5">
              {!isLive && (
                <button
                  type="button"
                  onClick={handleRewind}
                  className="p-2 rounded-full bg-black/40 hover:bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/20 transition-all"
                  title="Voltar 10 segundos"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={togglePlay}
                className="p-3.5 rounded-full bg-orange-500/80 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/20 transition-all hover:scale-105 active:scale-95"
                title={isPlaying ? 'Pausar' : 'Reproduzir'}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 fill-white stroke-none" /> : <Play className="w-4.5 h-4.5 fill-white stroke-none ml-0.5" />}
              </button>

              {!isLive && (
                <button
                  type="button"
                  onClick={handleForward}
                  className="p-2 rounded-full bg-black/40 hover:bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/20 transition-all"
                  title="Avançar 10 segundos"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* BOTTOM CONTROLS BAR */}
          <div className="w-full flex flex-col gap-2.5 pointer-events-auto">
            {/* Timeline Slider (Only for VOD/Series, hidden or styled for Live) */}
            {!isLive ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-neutral-300 shrink-0 select-none">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-orange-500 bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer hover:h-2 transition-all"
                />
                <span className="text-[11px] font-mono text-neutral-300 shrink-0 select-none">
                  {formatTime(duration)}
                </span>
              </div>
            ) : (
              <div className="h-2" />
            )}

            {/* Volume & Fullscreen controls */}
            <div className="flex items-center justify-between">
              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 sm:w-28 accent-white bg-neutral-850 h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Resolution / Fullscreen */}
              <div className="flex items-center gap-2">
                {isPipSupported && (
                  <button
                    type="button"
                    onClick={togglePip}
                    disabled={!isMetadataLoaded}
                    className={`p-2 rounded-lg bg-neutral-900/60 transition-colors ${
                      isMetadataLoaded
                        ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer'
                        : 'opacity-40 text-neutral-500 cursor-not-allowed'
                    }`}
                    title={
                      !isMetadataLoaded
                        ? 'Carregando stream...'
                        : isPipActive
                        ? 'Sair do Picture-in-Picture'
                        : 'Picture-in-Picture'
                    }
                  >
                    <Tv className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
                  title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
