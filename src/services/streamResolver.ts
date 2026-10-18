import { StreamSource } from '../types';
import { cleanTitleForTmdb, computeTextSimilarity, TmdbService } from './tmdbService';

let cachedStreams: StreamSource[] | null = null;
let fetchPromise: Promise<StreamSource[]> | null = null;

/**
 * Normalizes title string for robust fuzzy comparison:
 * lowercases, removes accents/diacritics, and strips punctuation.
 */
export function normalizeTitleForMatching(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flexible JSON manifest parser that supports multiple JSON formats:
 * - Direct Array [ { ... } ]
 * - Standard keys: streams, items, channels, movies, series, vod, playlist, data
 * - Stremio / Add-on manifests with resources or catalogs
 * - Fallback object values where keys are IDs (e.g. { "tmdb:123": { "url": "..." } })
 * - Flexible field normalization (streamUrl / url / file / link, title / name, tmdb_id / id)
 */
export function parseFlexibleJsonManifest(rawData: any): StreamSource[] {
  if (!rawData) return [];

  let rawList: any[] = [];

  if (Array.isArray(rawData)) {
    rawList = rawData;
  } else if (typeof rawData === 'object') {
    if (Array.isArray(rawData.streams)) {
      rawList = rawData.streams;
    } else if (Array.isArray(rawData.items)) {
      rawList = rawData.items;
    } else if (Array.isArray(rawData.channels)) {
      rawList = rawData.channels;
    } else if (Array.isArray(rawData.movies)) {
      rawList = rawList.concat(rawData.movies);
    } else if (Array.isArray(rawData.series)) {
      rawList = rawList.concat(rawData.series);
    } else if (Array.isArray(rawData.vod)) {
      rawList = rawList.concat(rawData.vod);
    } else if (Array.isArray(rawData.playlist)) {
      rawList = rawData.playlist;
    } else if (Array.isArray(rawData.data)) {
      rawList = rawData.data;
    } else if (rawData.manifest) {
      if (Array.isArray(rawData.manifest.streams)) {
        rawList = rawData.manifest.streams;
      } else if (Array.isArray(rawData.manifest.catalogs)) {
        rawList = rawData.manifest.catalogs;
      }
    } else if (Array.isArray(rawData.resources)) {
      rawList = rawData.resources;
    } else if (Array.isArray(rawData.catalogs)) {
      rawList = rawData.catalogs;
    } else {
      // Fallback object values where keys are IDs (e.g. { "tmdb:123": { "url": "..." } })
      const values = Object.values(rawData);
      if (values.length > 0) {
        for (const val of values) {
          if (Array.isArray(val)) {
            rawList = rawList.concat(val);
          } else if (val && typeof val === 'object') {
            rawList.push(val);
          }
        }
      }
    }
  }

  const streams: StreamSource[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') continue;

    const streamUrl = item.streamUrl || item.url || item.file || item.link || item.src || item.stream || item.playbackUrl || '';
    const title = item.title || item.name || item.label || item.caption || item.display_name || `Media ${i + 1}`;
    const tmdbId = item.tmdb_id || item.tmdbId || item.id || item.imdb_id || item.imdbId;
    const type = item.type || (item.seasonNum || item.episodeNum ? 'series' : 'movie');
    const quality = item.quality || item.res || '1080p';
    const year = item.year ? Number(item.year) : undefined;

    streams.push({
      id: String(item.id || `stream_${i}_${Math.random().toString(36).substring(2, 6)}`),
      tmdb_id: tmdbId !== undefined ? tmdbId : undefined,
      title: String(title),
      year: year,
      type: type === 'series' || type === 'tv' ? 'series' : type === 'live' ? 'live' : 'movie',
      streamUrl: String(streamUrl || ''),
      quality: String(quality),
      format: item.format || 'mp4'
    });
  }

  return streams;
}

export class StreamResolverService {
  /**
   * Lazily loads streams.json with in-memory caching.
   * If already loaded, returns instant cached array without network overhead.
   */
  public static async loadStreams(forceRefresh = false): Promise<StreamSource[]> {
    if (cachedStreams && !forceRefresh) {
      return cachedStreams;
    }

    if (fetchPromise && !forceRefresh) {
      return fetchPromise;
    }

    fetchPromise = (async () => {
      // 1. Check if user configured a custom Add-on JSON / Manifest URL in localStorage
      let customAddonUrl: string | null = null;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          customAddonUrl = window.localStorage.getItem('foxstream_active_addon_url');
        }
      } catch {}

      if (customAddonUrl && customAddonUrl.trim()) {
        try {
          // If it's a Stremio manifest URL, it does not return static streams array on load, so we skip static parsing
          if (customAddonUrl.includes('manifest.json')) {
            console.log('[StreamResolver] Stremio Addon manifest active:', customAddonUrl);
            cachedStreams = [];
            return [];
          }

          console.log('[StreamResolver] Loading streams from custom Add-on JSON:', customAddonUrl);
          let res: Response;
          try {
            res = await fetch(customAddonUrl, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          } catch {
            // CORS fallback via proxy
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(customAddonUrl)}`;
            res = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
          }

          if (res.ok) {
            const rawData = await res.json();
            const extracted = parseFlexibleJsonManifest(rawData);

            if (extracted.length > 0) {
              cachedStreams = extracted;
              return cachedStreams;
            }
          }
        } catch (addonErr) {
          console.warn('[StreamResolver] Failed to load custom Add-on JSON, falling back to local streams.json:', addonErr);
        }
      }

      // 2. Default fallback: Load local /streams.json
      try {
        const response = await fetch('/streams.json?t=' + Date.now(), {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Failed to load streams.json (HTTP ${response.status})`);
        }

        const rawData = await response.json();
        cachedStreams = parseFlexibleJsonManifest(rawData);
        return cachedStreams;
      } catch (err) {
        console.warn('[StreamResolver] Could not load /streams.json, using fallback empty list:', err);
        cachedStreams = [];
        return [];
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }

  /**
   * Clear in-memory cached streams to force fresh reload
   */
  public static clearCache(): void {
    cachedStreams = null;
    fetchPromise = null;
  }

  /**
   * In-memory cache injection (for dynamic streams or testing)
   */
  public static setCachedStreams(streams: StreamSource[]) {
    cachedStreams = streams;
  }

  /**
   * Priority Dual-Matching & Stremio Protocol On-Demand Resolution:
   * 1. Stremio Addon Protocol: If Stremio manifest is active, fetches on-demand from `/stream/{type}/{id}.json`.
   * 2. Primary Match (TMDB ID): Exact match against tmdb_id.
   * 3. Fallback Match (Normalized Title & Year): Case-insensitive comparison with release year check.
   */
  public static async resolveStream(params: {
    tmdbId?: number | string;
    title?: string;
    year?: number | string;
    type?: 'movie' | 'series' | 'live';
    seasonNum?: number;
    episodeNum?: number;
  }): Promise<{
    matched: boolean;
    stream: StreamSource | null;
    allStreams?: StreamSource[]; // Add allStreams
    matchType?: 'tmdb_id' | 'title_year' | 'stremio_addon';
    score?: number;
  }> {
    const { tmdbId, title, year, type, seasonNum, episodeNum } = params;

    // 1. STREMIO ADDON PROTOCOL ON-DEMAND FETCH
    let activeAddonUrl: string | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        activeAddonUrl = window.localStorage.getItem('foxstream_active_addon_url');
      }
    } catch {}

    if (activeAddonUrl && (activeAddonUrl.includes('manifest.json') || activeAddonUrl.endsWith('/'))) {
      const addonBase = activeAddonUrl.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
      const mediaType = type === 'series' ? 'series' : 'movie';
      
      let imdbId: string | null = null;
      if (tmdbId) {
        if (String(tmdbId).startsWith('tt')) {
          imdbId = String(tmdbId);
        } else {
          imdbId = await TmdbService.fetchExternalIds(tmdbId, mediaType === 'series' ? 'tv' : 'movie');
        }
      }

      if (imdbId) {
        let streamProtocolUrl = '';
        if (mediaType === 'series') {
          const sNum = seasonNum || 1;
          const eNum = episodeNum || 1;
          streamProtocolUrl = `${addonBase}/stream/series/${imdbId}:${sNum}:${eNum}.json`;
        } else {
          streamProtocolUrl = `${addonBase}/stream/movie/${imdbId}.json`;
        }

        console.log('[StreamResolver] Stremio Protocol Request:', streamProtocolUrl);

        try {
          let res: Response;
          try {
            res = await fetch(streamProtocolUrl, { headers: { Accept: 'application/json' } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          } catch {
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(streamProtocolUrl)}`;
            res = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
          }

          if (res.ok) {
            const data = await res.json();
            const streamsArray = data.streams || [];
            if (streamsArray.length > 0) {
              // Return all streams instead of just the first one.
              // NOTE: This requires updating the return type and handling in the UI.
              // For now, mapping all streams to Source format.
              const resolvedSources: StreamSource[] = streamsArray.map((s: any, idx: number) => ({
                id: `stremio_${imdbId}_${idx}`,
                tmdb_id: tmdbId,
                title: s.title || s.name || title || 'Stream Stremio',
                type: mediaType,
                streamUrl: s.url || (s.infoHash ? `magnet:?xt=urn:btih:${s.infoHash}` : ''),
                quality: s.name || s.quality || '1080p',
                format: 'mp4'
              }));
              
              // To maintain compatibility with current UI, maybe return the first as "best"
              // but we need a way to return all. 
              // Assuming this requires structural changes, for now, follow the requirement to just change the logic.
              return {
                matched: true,
                stream: resolvedSources[0], // Return best (first)
                allStreams: resolvedSources, // New field for all options
                matchType: 'stremio_addon',
                score: 100
              };
            }
          }
        } catch (err) {
          console.warn('[StreamResolver] Stremio protocol fetch failed, falling back to static matching:', err);
        }
      }
    }

    // 2. STATIC FALLBACK MATCHING (streams.json or static JSON lists)
    const streams = await this.loadStreams();

    // Primary Match: TMDB ID
    if (tmdbId !== undefined && tmdbId !== null && String(tmdbId).trim() !== '') {
      const targetIdStr = String(tmdbId).trim();
      const exactMatch = streams.find(
        (s) => s.tmdb_id !== undefined && s.tmdb_id !== null && String(s.tmdb_id).trim() === targetIdStr
      );

      if (exactMatch) {
        console.log(`[StreamResolver] Match Found (Primary TMDB ID: ${targetIdStr}):`, exactMatch.title);
        return {
          matched: true,
          stream: exactMatch,
          matchType: 'tmdb_id',
          score: 100,
        };
      }
    }

    // Fallback Match: Normalized Title & Year
    if (title && title.trim()) {
      const cleanTarget = normalizeTitleForMatching(title);
      const targetYearNum = year ? parseInt(String(year), 10) : undefined;

      let bestCandidate: StreamSource | null = null;
      let highestScore = 0;

      for (const item of streams) {
        if (type && item.type && item.type !== type && item.type !== 'live') {
          continue;
        }

        const cleanSource = normalizeTitleForMatching(item.title);

        if (cleanTarget === cleanSource) {
          const yearDiff = targetYearNum && item.year ? Math.abs(targetYearNum - item.year) : 0;
          if (yearDiff <= 1) {
            console.log(`[StreamResolver] Match Found (Exact Normalized Title):`, item.title);
            return {
              matched: true,
              stream: item,
              matchType: 'title_year',
              score: 95,
            };
          }
        }

        const similarity = computeTextSimilarity(cleanTarget, cleanSource);
        let currentScore = similarity * 80;

        if (targetYearNum && item.year) {
          const diff = Math.abs(targetYearNum - item.year);
          if (diff === 0) currentScore += 20;
          else if (diff === 1) currentScore += 10;
          else currentScore -= 20;
        }

        if (currentScore > highestScore && currentScore >= 75) {
          highestScore = currentScore;
          bestCandidate = item;
        }
      }

      if (bestCandidate) {
        console.log(`[StreamResolver] Match Found (Fuzzy Title & Year, Score: ${highestScore.toFixed(0)}):`, bestCandidate.title);
        return {
          matched: true,
          stream: bestCandidate,
          matchType: 'title_year',
          score: highestScore,
        };
      }
    }

    return {
      matched: false,
      stream: null,
    };
  }
}
