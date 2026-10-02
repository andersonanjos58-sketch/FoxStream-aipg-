export interface PlaybackIntentOptions {
  title: string;
  streamUrl: string;
  category?: string;
  posterUrl?: string;
  type: 'live' | 'movie' | 'series';
  seriesName?: string;
  seasonEpisode?: string;
}

export interface PlaybackResult {
  methodUsed: 'vlc_intent' | 'generic_intent' | 'vlc_scheme' | 'direct_url' | 'fallback_dialog';
  message: string;
}

export class PlaybackService {
  /**
   * Builds an Android Intent URI prioritizing VLC (org.videolan.vlc)
   */
  public static buildVlcAndroidIntent(url: string, title?: string): string {
    const scheme = url.startsWith('https://') ? 'https' : 'http';
    const cleanUrl = url.replace(/^https?:\/\//i, '');
    const encodedTitle = title ? encodeURIComponent(title) : '';
    const fallbackUrl = encodeURIComponent('https://play.google.com/store/apps/details?id=org.videolan.vlc');
    
    // Android Intent format:
    // intent://example.com/stream.m3u8#Intent;action=android.intent.action.VIEW;package=org.videolan.vlc;type=video/*;scheme=http;S.title=Canal;end
    let intent = `intent://${cleanUrl}#Intent;action=android.intent.action.VIEW;package=org.videolan.vlc;type=video/*;scheme=${scheme};`;
    if (encodedTitle) {
      intent += `S.title=${encodedTitle};`;
    }
    intent += `S.browser_fallback_url=${fallbackUrl};`;
    intent += 'end;';
    return intent;
  }

  /**
   * Builds a generic Android Intent URI without locking to VLC package
   */
  public static buildGenericAndroidIntent(url: string, title?: string): string {
    const scheme = url.startsWith('https://') ? 'https' : 'http';
    const cleanUrl = url.replace(/^https?:\/\//i, '');
    const encodedTitle = title ? encodeURIComponent(title) : '';
    
    let intent = `intent://${cleanUrl}#Intent;action=android.intent.action.VIEW;type=video/*;scheme=${scheme};`;
    if (encodedTitle) {
      intent += `S.title=${encodedTitle};`;
    }
    intent += 'end;';
    return intent;
  }

  /**
   * Builds a direct VLC custom scheme URL (vlc://...)
   */
  public static buildVlcScheme(url: string): string {
    return `vlc://${url}`;
  }

  /**
   * Checks if current browser environment is Android
   */
  public static isAndroidDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /android/i.test(navigator.userAgent || '');
  }

  /**
   * Checks if running inside an iframe sandbox
   */
  public static isInsideIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  /**
   * Helper to safely trigger external protocol scheme URLs (like vlc:// or intent://)
   * using a dynamic click event that is allowed in iframe sandboxes.
   */
  public static triggerSchemeUrl(url: string) {
    if (typeof document === 'undefined') return;
    try {
      const a = document.createElement('a');
      a.href = url;
      // Using target="_self" is crucial for deep links (intent://, vlc://, etc.)
      // inside iframe sandboxes. If we use _blank, modern browsers classify it as a popup and block it.
      // _self instructs the browser to parse the scheme in the current window context, passing it to the OS.
      a.target = '_self';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Failed to trigger scheme via link:', err);
      try {
        if (typeof window !== 'undefined') {
          window.location.href = url;
        }
      } catch {
        // Silently catch
      }
    }
  }

  /**
   * Triggers playback externally.
   * Priority:
   * 1. VLC Android Intent (with native fallback to Play Store built-in)
   * 2. VLC Scheme (vlc://)
   */
  public static launchExternalPlayback(options: PlaybackIntentOptions): PlaybackResult {
    const { streamUrl, title } = options;
    const isAndroid = this.isAndroidDevice();

    if (isAndroid) {
      const vlcIntent = this.buildVlcAndroidIntent(streamUrl, title);

      try {
        this.triggerSchemeUrl(vlcIntent);

        return {
          methodUsed: 'vlc_intent',
          message: 'Enviando comando para abrir no VLC Player via Android Intent...'
        };
      } catch {
        // Fallback to standard stream link
        const fallbackUrl = streamUrl;
        this.triggerSchemeUrl(fallbackUrl);
        return {
          methodUsed: 'generic_intent',
          message: 'Link de mídia aberto no navegador.'
        };
      }
    }

    // On Desktop or other environments, try vlc:// protocol
    try {
      const vlcScheme = this.buildVlcScheme(streamUrl);
      this.triggerSchemeUrl(vlcScheme);
      return {
        methodUsed: 'vlc_scheme',
        message: 'Tentando abrir aplicativo VLC Media Player (vlc://)...'
      };
    } catch {
      // Fallback
    }

    return {
      methodUsed: 'fallback_dialog',
      message: 'Link de reprodução pronto para reprodutor externo.'
    };
  }

  /**
   * Quick open helper that launches external player or Intent
   */
  public static openStream(streamUrl: string, title: string = 'Transmissão', type: 'live' | 'movie' | 'series' = 'live'): PlaybackResult {
    return this.launchExternalPlayback({
      streamUrl,
      title,
      type
    });
  }

  /**
   * Generates a temporary .m3u file for desktop/mobile players (VLC, MPV, PotPlayer)
   */
  public static downloadLauncherM3U(title: string, streamUrl: string) {
    const m3uContent = `#EXTM3U\n#EXTINF:-1,${title}\n${streamUrl}\n`;
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
