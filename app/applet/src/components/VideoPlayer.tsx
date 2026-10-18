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
    if (!video) return;

    const proxiedUrl = formatStreamUrl(url);
    setError(null);
    setLoading(true);

    if (Hls.isSupported() && (url.includes('.m3u8') || url.includes('.ts'))) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        if (autoPlay) video.play().catch(console.error);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError('Erro ao carregar o sinal do canal.');
          setLoading(false);
          hls.destroy();
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || url.match(/\.(mp4|mkv)$/)) {
      // Fallback for native support or standard video files
      video.src = proxiedUrl;
      video.onloadeddata = () => setLoading(false);
      video.onerror = () => {
        setError('Erro ao reproduzir a mídia.');
        setLoading(false);
      };
    } else {
      setError('Formato de mídia não suportado.');
      setLoading(false);
    }
  }, [url, autoPlay]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/70 z-10">
          Carregando sinal...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-black/70 z-10">
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
