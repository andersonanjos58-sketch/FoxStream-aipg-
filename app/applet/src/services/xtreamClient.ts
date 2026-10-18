import { LiveChannel, MovieItem, SeriesItem, SeasonItem, EpisodeItem, XtreamAuthResponse, XtreamCategory } from '../types';
import { formatStreamUrl } from '../utils/streamUtils';

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
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

  public normalizeUrl(rawUrl: string): string {
    let clean = (rawUrl || '').trim();
    if (!clean) return '';
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    clean = clean.replace(/\/+$/, '');
    return clean;
  }

  // Force all Xtream API calls through the proxy
  private async apiRequest<T>(url: string): Promise<T> {
    const proxiedUrl = formatStreamUrl(url);
    try {
      const res = await fetch(proxiedUrl, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        throw new Error(`Servidor respondeu com status ${res.status}`);
      }
      return await res.json() as T;
    } catch (err: any) {
      throw new Error(`Falha ao conectar: ${err.message}`);
    }
  }

  public async getLiveContent(playlistId: string): Promise<{ categories: Map<string, string>, channels: LiveChannel[] }> {
    const categoriesMap = new Map<string, string>();
    const channels: LiveChannel[] = [];
    try {
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch { }
    try {
      const streamsUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_live_streams`;
      const streams = await this.apiRequest<any[]>(streamsUrl);
      if (Array.isArray(streams)) {
        for (const s of streams) {
          const streamId = String(s.stream_id || '');
          if (!streamId) continue;
          const name = s.name || s.stream_display_name || 'Canal sem nome';
          const catId = String(s.category_id || '');
          const categoryName = categoriesMap.get(catId) || 'TV Geral';
          // Proxy the actual stream URL
          const streamUrl = formatStreamUrl(`${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`);
          channels.push({
            id: `${playlistId}_live_${streamId}`,
            playlistId,
            name,
            streamUrl,
            logoUrl: s.stream_icon || undefined,
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

  public async getVodContent(playlistId: string): Promise<{ movies: MovieItem[] }> {
    const categoriesMap = new Map<string, string>();
    const movies: MovieItem[] = [];
    try {
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch { }
    try {
      const vodUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_vod_streams`;
      const vodList = await this.apiRequest<any[]>(vodUrl);
      if (Array.isArray(vodList)) {
        for (const v of vodList) {
          const streamId = String(v.stream_id || '');
          if (!streamId) continue;
          const ext = (v.container_extension === 'mkv' || !v.container_extension) ? 'mp4' : v.container_extension;
          // Proxy the actual stream URL
          const streamUrl = formatStreamUrl(`${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${ext}`);
          movies.push({
            id: `${playlistId}_vod_${streamId}`,
            playlistId,
            name: v.name || 'Filme sem título',
            streamUrl,
            posterUrl: v.stream_icon || undefined,
            category: categoriesMap.get(String(v.category_id)) || 'Filmes',
            rating: v.rating_5based ? `${v.rating_5based}/5` : undefined,
            genre: categoriesMap.get(String(v.category_id)) || 'Filmes',
            year: v.year ? String(v.year) : undefined
          });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao carregar VOD streams do Xtream:', err);
    }
    return { movies };
  }

  public async getSeriesContent(playlistId: string): Promise<{ series: SeriesItem[] }> {
    const categoriesMap = new Map<string, string>();
    const seriesList: SeriesItem[] = [];
    try {
      const catUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_categories`;
      const catData = await this.apiRequest<XtreamCategory[]>(catUrl);
      if (Array.isArray(catData)) {
        catData.forEach(c => categoriesMap.set(String(c.category_id), c.category_name));
      }
    } catch { }
    try {
      const seriesUrl = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series`;
      const rawSeries = await this.apiRequest<any[]>(seriesUrl);
      if (Array.isArray(rawSeries)) {
        for (const s of rawSeries) {
          const seriesId = String(s.series_id || '');
          if (!seriesId) continue;
          seriesList.push({
            id: `${playlistId}_series_${seriesId}`,
            playlistId,
            name: s.name || 'Série sem título',
            posterUrl: s.cover || s.stream_icon || undefined,
            category: categoriesMap.get(String(s.category_id)) || 'Séries',
            rating: s.rating_5based ? `${s.rating_5based}/5` : undefined,
            year: s.releaseDate ? s.releaseDate.substring(0, 4) : undefined,
            genre: s.genre || categoriesMap.get(String(s.category_id)) || 'Séries',
            description: s.plot || undefined,
            seasons: []
          });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao carregar Séries do Xtream:', err);
    }
    return { series: seriesList };
  }

  public async getSeriesDetails(seriesId: string, seriesObjId: string): Promise<SeasonItem[]> {
    try {
      const cleanId = seriesId.replace(/.*_series_/, '');
      const url = `${this.baseUrl}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&action=get_series_info&series_id=${cleanId}`;
      const data = await this.apiRequest<any>(url);
      if (data && data.episodes) {
        const seasonsMap = new Map<number, EpisodeItem[]>();
        for (const [seasonKey, epList] of Object.entries(data.episodes)) {
          const seasonNum = parseInt(seasonKey, 10) || 1;
          const episodes: EpisodeItem[] = [];
          if (Array.isArray(epList)) {
            for (const ep of epList) {
              const epId = ep.id;
              const ext = (ep.container_extension === 'mkv' || !ep.container_extension) ? 'mp4' : ep.container_extension;
              // Proxy the actual stream URL
              const epStreamUrl = formatStreamUrl(`${this.baseUrl}/series/${this.username}/${this.password}/${epId}.${ext}`);
              episodes.push({
                id: `${seriesObjId}_ep_${epId}`,
                seriesId: seriesObjId,
                title: ep.title || `Episódio ${ep.episode_num}`,
                seasonNum,
                episodeNum: parseInt(ep.episode_num, 10) || 1,
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
