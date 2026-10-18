import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { formatStreamUrl } from '../utils/streamUtils';

interface VideoPlayerProps {
  url: string;
  autoPlay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, autoPlay = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    const proxiedUrl = formatStreamUrl(url);
    setError(null);
    setLoading(true);

    const isHlsStream = url.includes('.m3u8') || url.includes('/live/');
    
    console.log("FoxStream Player - URL Original:", url);
    console.log("FoxStream Player - URL Proxied:", proxiedUrl);
    console.log("FoxStream Player - É HLS/Live?:", isHlsStream);

    let hlsInstance: Hls | null = null;

    // Helper for error messages
    const handleError = (msg: string) => {
        console.error("FoxStream Player Error:", msg);
        setError(`${msg} (Verifique autenticação ou link)`);
        setLoading(false);
    };

    if (isHlsStream && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsInstance.loadSource(proxiedUrl);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (autoPlay) video.play().catch(e => console.error("AutoPlay failed:", e));
      });

      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401) {
            handleError('Erro 401: Autenticação necessária ou falha.');
          } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 403) {
            handleError('Erro 403: Acesso negado pelo servidor.');
          } else {
            handleError('Erro ao carregar o fluxo HLS.');
          }
          hlsInstance?.destroy();
        }
      });
    } else {
      // VODs: Use native player
      video.src = proxiedUrl;
      video.crossOrigin = 'anonymous'; // Critical for CORS
      video.onloadeddata = () => {
        setLoading(false);
        if (autoPlay) video.play().catch(e => console.error("AutoPlay failed:", e));
      };
      video.onerror = () => {
        // Can't reliably check 401/403 status codes on video element error
        handleError('Erro ao carregar a mídia VOD.');
      };
    }

    return () => {
      if (hlsInstance) hlsInstance.destroy();
      video.src = '';
    };
  }, [url, autoPlay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/70 z-10 text-sm">
          A carregar...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-black/80 z-10 text-center p-4 text-sm">
          {error}
        </div>
      )}
      <video
        ref={videoRef}
        controls
        className="w-full h-full"
        playsInline
      />
    </div>
  );
};

export default VideoPlayer;
