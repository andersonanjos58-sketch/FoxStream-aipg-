import { LiveChannel, MovieItem, SeriesItem, SeasonItem, EpisodeItem, XtreamAuthResponse, XtreamCategory } from '../types';

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface XtreamConnectionResult {
  success: boolean;
  message: string;
  authData?: XtreamAuthResponse;
}

export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(creds: XtreamCredentials) {
    this.baseUrl = this.normalizeUrl(creds.serverUrl);
    this.username = creds.username.trim();
    this.password = creds.password.trim();
  }

  /**
   * Normalizes server URL ensuring protocol and removing trailing slash
   */
  public normalizeUrl(rawUrl: string): string {
    let clean = (rawUrl || '').trim();
    if (!clean) return '';
    // If no protocol specified, default to http://
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    // Remove trailing slashes
    clean = clean.replace(/\/+$/, '');
    return clean;
  }

  /**
   * Helper to execute API requests with proxy fallback to avoid browser CORS blocks
   */
  private async apiRequest<T>(url: string): Promise<T> {
    // Attempt 1: Via backend proxy endpoint if available
    try {
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      const proxyRes = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' }
      });
      if (proxyRes.ok) {
        const text = await proxyRes.text();
        return JSON.parse(text) as T;
      }
    } catch {
      // Fallback to direct fetch
    }

    // Attempt 2: Direct fetch (works on same-origin or CORS enabled servers)
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      return data as T;
    } catch (err: any) {
      throw new Error(`Falha ao conectar: ${err.message || 'Erro de rede ou bloqueio de CORS'}`);
    }
  }

  /**
   * Tests connection to the Xtream server
   */
  public async testConnection(): Promise<XtreamConnectionResult> {
    if (!this.baseUrl) {
      return { success: false, message: 'Informe a URL do servidor Xtream / XC API.' };
    }
    if (!this.username) {
      return { success: false, message: 'Informe o nome de usuário.' };
    }
    if (!this.password) {
      return { success: false, message: 'Informe a senha.' };
    }

    try {
      const authUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
      const data = await this.apiRequest<XtreamAuthResponse>(authUrl);

      if (data && data.user_info) {
        if (data.user_info.auth === 1 || data.user_info.status === 'Active') {
          return {
            success: true,
            message: 'Conexão realizada com sucesso',
            authData: data
          };
        } else {
          return {
            success: false,
            message: `Conta recusada pelo servidor. Status: ${data.user_info.status || 'Inativo'}`
          };
        }
      }

      return {
        success: false,
        message: 'Servidor respondeu, mas os dados de autenticação são inválidos.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Não foi possível conectar ao servidor Xtream: ${err.message || 'Verifique o endereço e suas credenciais.'}`
      };
    }
  }

  /**
   * Fetches all live categories and streams
   */
  public async getLiveContent(playlistId: string): Promise<{ categories: Map<string, string>; channels: LiveChannel[] }> {
    const categoriesMap = new Map<string, string>();
    const channels: LiveChannel[] = [];

    try {
      // 1. Get Categories
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch {
      // Continue without explicit categories
    }

    try {
      // 2. Get Live Streams
      const streamsUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_streams`;
      const streams = await this.apiRequest<any[]>(streamsUrl);

      if (Array.isArray(streams)) {
        const seenIds = new Set<string>();
        for (const s of streams) {
          const streamId = String(s.stream_id || '');
          if (!streamId || seenIds.has(streamId)) continue;
          seenIds.add(streamId);

          const name = s.name || s.stream_display_name || 'Canal sem nome';
          const catId = String(s.category_id || '');
          const categoryName = categoriesMap.get(catId) || 'TV Geral';
          const logo = s.stream_icon;
          const streamUrl = `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`;

          channels.push({
            id: `${playlistId}_live_${streamId}`,
            playlistId,
            name,
            streamUrl,
            logoUrl: logo || undefined,
            category: categoryName,
            tvgId: s.epg_channel_id || undefined,
            tvgName: name
          });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao carregar Live streams do Xtream:', err);
    }

    return { categories: categoriesMap, channels };
  }

  /**
   * Fetches all VOD categories and movie streams
   */
  public async getVodContent(playlistId: string): Promise<{ movies: MovieItem[] }> {
    const categoriesMap = new Map<string, string>();
    const movies: MovieItem[] = [];

    try {
      // 1. Get VOD Categories
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch {
      // Continue
    }

    try {
      // 2. Get VOD Streams
      const vodUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_streams`;
      const vodList = await this.apiRequest<any[]>(vodUrl);

      if (Array.isArray(vodList)) {
        const seenIds = new Set<string>();
        for (const v of vodList) {
          const streamId = String(v.stream_id || '');
          if (!streamId || seenIds.has(streamId)) continue;
          seenIds.add(streamId);

          const name = v.name || 'Filme sem título';
          const ext = v.container_extension || 'mp4';
          const catId = String(v.category_id || '');
          const categoryName = categoriesMap.get(catId) || 'Filmes';
          const poster = v.stream_icon;
          const streamUrl = `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${ext}`;

          movies.push({
            id: `${playlistId}_vod_${streamId}`,
            playlistId,
            name,
            streamUrl,
            posterUrl: poster || undefined,
            category: categoryName,
            rating: v.rating_5based ? `${v.rating_5based}/5` : v.rating ? `${v.rating}/10` : undefined,
            genre: categoryName,
            year: v.year ? String(v.year) : undefined
          });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao carregar VOD streams do Xtream:', err);
    }

    return { movies };
  }

  /**
   * Fetches all Series categories and series list
   */
  public async getSeriesContent(playlistId: string): Promise<{ series: SeriesItem[] }> {
    const categoriesMap = new Map<string, string>();
    const seriesList: SeriesItem[] = [];

    try {
      // 1. Get Series Categories
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch {
      // Continue
    }

    try {
      // 2. Get Series
      const seriesUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series`;
      const rawSeries = await this.apiRequest<any[]>(seriesUrl);

      if (Array.isArray(rawSeries)) {
        const seenIds = new Set<string>();
        for (const s of rawSeries) {
          const seriesId = String(s.series_id || '');
          if (!seriesId || seenIds.has(seriesId)) continue;
          seenIds.add(seriesId);

          const name = s.name || 'Série sem título';
          const catId = String(s.category_id || '');
          const categoryName = categoriesMap.get(catId) || 'Séries';
          const poster = s.cover || s.stream_icon;

          seriesList.push({
            id: `${playlistId}_series_${seriesId}`,
            playlistId,
            name,
            posterUrl: poster || undefined,
            category: categoryName,
            rating: s.rating_5based ? `${s.rating_5based}/5` : s.rating ? `${s.rating}/10` : undefined,
            year: s.releaseDate ? s.releaseDate.substring(0, 4) : undefined,
            genre: s.genre || categoryName,
            description: s.plot || undefined,
            seasons: [] // loaded on demand or with getSeriesInfo
          });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao carregar Séries do Xtream:', err);
    }

    return { series: seriesList };
  }

  /**
   * Fetches specific series information (seasons and episodes)
   */
  public async getSeriesDetails(seriesId: string, seriesObjId: string): Promise<SeasonItem[]> {
    try {
      const cleanId = seriesId.replace(/.*_series_/, '');
      const url = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_info&series_id=${cleanId}`;
      const data = await this.apiRequest<any>(url);

      if (data && data.episodes) {
        const seasonsMap = new Map<number, EpisodeItem[]>();

        // data.episodes is keyed by season number e.g. "1": [...], "2": [...]
        for (const [seasonKey, epList] of Object.entries(data.episodes)) {
          const seasonNum = parseInt(seasonKey, 10) || 1;
          const episodes: EpisodeItem[] = [];

          if (Array.isArray(epList)) {
            for (const ep of epList) {
              const epId = ep.id;
              const epNum = parseInt(ep.episode_num, 10) || 1;
              const ext = ep.container_extension || 'mp4';
              const epStreamUrl = `${this.baseUrl}/series/${this.username}/${this.password}/${epId}.${ext}`;

              episodes.push({
                id: `${seriesObjId}_ep_${epId}`,
                seriesId: seriesObjId,
                title: ep.title || `Episódio ${epNum}`,
                seasonNum,
                episodeNum: epNum,
                streamUrl: epStreamUrl,
                duration: ep.info?.duration_secs ? `${Math.round(ep.info.duration_secs / 60)} min` : undefined,
                overview: ep.info?.plot || undefined
              });
            }
          }

          seasonsMap.set(seasonNum, episodes);
        }

        return Array.from(seasonsMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([seasonNum, episodes]) => ({
            seasonNum,
            name: `Temporada ${seasonNum}`,
            episodes: episodes.sort((a, b) => a.episodeNum - b.episodeNum)
          }));
      }
    } catch (err) {
      console.warn('Erro ao carregar detalhes da série Xtream:', err);
    }

    return [];
  }
}
