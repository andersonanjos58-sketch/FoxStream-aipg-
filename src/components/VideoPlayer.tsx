import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  RotateCcw, RotateCw, X, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { formatStreamUrl } from '../utils/streamUtils';
import { ActivePlaybackPayload } from '../types';

export interface VideoPlayerProps {
  url?: string;
  payload?: ActivePlaybackPayload | null;
  title?: string;
  poster?: string;
  type?: 'movie' | 'series' | 'live';
  autoPlay?: boolean;
  onClose?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  payload,
  title: initialTitle,
  poster: initialPoster,
  type = 'movie',
  autoPlay = true,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive active stream & metadata
  const streamUrl = payload?.streamUrl || url || '';
  const displayTitle = payload?.title || initialTitle || 'Reprodução de Mídia';
  const displayPoster = payload?.posterPath || payload?.backdropPath || initialPoster;
  const isLive = (payload?.type || type) === 'live' || streamUrl.includes('.m3u8') || streamUrl.includes('/live/');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const handleError = (msg: string) => {
      console.error('[VideoPlayer] Error:', msg);
      setError(`${msg} (Verifique o servidor de streaming ou a conexão)`);
      setLoading(false);
    };

    if (streamUrl.startsWith('magnet:')) {
      handleError('Este link é um Magnet Torrent (P2P). O navegador não reproduz torrents nativamente. Utilize o botão "Abrir Externamente" para abrir em um app compatível ou VLC.');
      return;
    }

    const proxiedUrl = formatStreamUrl(streamUrl);
    setError(null);
    setLoading(true);

    const isHlsStream = streamUrl.includes('.m3u8') || streamUrl.includes('/live/');

    console.log('[VideoPlayer] Initializing playback:');
    console.log(' - Title:', displayTitle);
    console.log(' - URL Original:', streamUrl);
    console.log(' - URL Proxied:', proxiedUrl);
    console.log(' - Is HLS:', isHlsStream);



    let hlsInstance: Hls | null = null;

    if (isHlsStream && Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsInstance.loadSource(proxiedUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (autoPlay) {
          video.play().catch((e) => console.warn('[VideoPlayer] Autoplay prevented:', e));
        }
      });

      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401) {
            handleError('Erro 401: Autenticação IPTV necessária ou expirada.');
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 403) {
            handleError('Erro 403: Acesso ao canal negado pelo servidor.');
          } else {
            handleError('Erro ao carregar sinal de streaming.');
          }
          hlsInstance?.destroy();
        }
      });
    } else {
      // VODs (.mp4, .mkv) or native HTML5 player
      video.src = proxiedUrl;
      video.crossOrigin = 'anonymous';

      video.onloadeddata = () => {
        setLoading(false);
        if (autoPlay) {
          video.play().catch((e) => console.warn('[VideoPlayer] Autoplay prevented:', e));
        }
      };

      video.onerror = () => {
        handleError('Erro ao carregar o arquivo de vídeo.');
      };
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
      video.src = '';
    };
  }, [streamUrl, autoPlay, displayTitle]);

  // Handle Play/Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  };

  // Handle Fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  // Handle Volume / Mute
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Seek +/- 10s
  const handleSeekDelta = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, video.duration || 0));
  };

  // Activity timer for hiding controls
  const handleUserActivity = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      onClick={handleUserActivity}
      className="relative w-full h-full min-h-[300px] aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center select-none group"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onDurationChange={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
      />

      {/* Top Header Overlay with Title & Close button */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-center justify-between z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
              title="Voltar / Fechar Player"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-white text-sm sm:text-base font-bold truncate drop-shadow-md">
              {displayTitle}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded border border-orange-500/30 uppercase tracking-wider">
                {isLive ? 'Ao Vivo' : 'VOD'}
              </span>
              {payload?.format && (
                <span className="text-[10px] text-neutral-400 uppercase font-mono">
                  {payload.format}
                </span>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-transform active:scale-95 cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 space-y-3">
          <div className="w-12 h-12 rounded-full border-4 border-orange-500/20 border-t-orange-500 animate-spin" />
          <span className="text-white text-xs sm:text-sm font-semibold tracking-wide animate-pulse">
            Carregando transmissão...
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/92 p-6 z-20 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h3 className="text-white font-bold text-lg font-['Outfit']">Falha na Reprodução</h3>
          <p className="text-red-400 text-xs sm:text-sm max-w-md font-light leading-relaxed">
            {error}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(streamUrl);
                  alert('URL/Link copiado para a área de transferência!');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Copiar Link do Stream</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.open(streamUrl, '_blank');
              }}
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Abrir Externamente</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition-all cursor-pointer"
              >
                Fechar Player
              </button>
            )}
          </div>
        </div>
      )}

      {/* Center Play/Pause Indicator if paused */}
      {!loading && !error && !isPlaying && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10 bg-black/30 group-hover:bg-black/40 transition-colors"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-500/90 hover:bg-orange-500 text-white flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95">
            <Play className="w-8 h-8 fill-white ml-1" />
          </div>
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent z-30 space-y-2 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Slider (only for VOD or non-live streams with duration) */}
        {!isLive && duration > 0 && (
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] font-mono text-neutral-400 w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const targetTime = parseFloat(e.target.value);
                setCurrentTime(targetTime);
                if (videoRef.current) videoRef.current.currentTime = targetTime;
              }}
              className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <span className="text-[11px] font-mono text-neutral-400 w-10">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Action Controls row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="p-2 text-white hover:text-orange-400 transition-colors cursor-pointer"
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            {/* Skip -10s */}
            {!isLive && (
              <button
                type="button"
                onClick={() => handleSeekDelta(-10)}
                className="p-2 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Voltar 10 segundos"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Skip +10s */}
            {!isLive && (
              <button
                type="button"
                onClick={() => handleSeekDelta(10)}
                className="p-2 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Avançar 10 segundos"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            )}

            {/* Volume Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="p-2 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
