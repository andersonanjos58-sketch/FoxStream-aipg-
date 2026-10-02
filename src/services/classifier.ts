import { ContentType } from '../types';

export interface SeriesMatch {
  isSeries: boolean;
  seriesName: string;
  seasonNum: number;
  episodeNum: number;
  cleanEpisodeTitle: string;
}

// Regex patterns to detect series seasons and episodes
// S01E01, S1E1, 1x01, Season 1 Episode 2, Temporada 1 Episodio 2, etc.
const SERIES_PATTERNS = [
  // S01E02, S1E2, S01 E02, S1 EP 02, S01 - EP02, S01-E02
  /(?:^|[\s._\-[\]])(?:s|season|temp|temporada)\s*0*([0-9]{1,3})\s*[\s._\-]*(?:e|ep|episode|episodio|cap|capitulo)\s*0*([0-9]{1,4})(?:[\s._\-[\]]|$)/i,
  // 1x02 or 01x02 or 01X02
  /(?:^|[\s._\-[\]])0*([0-9]{1,3})\s*x\s*0*([0-9]{1,4})(?:[\s._\-[\]]|$)/i,
  // [S1] [E02] or [S01E02]
  /\[s0*([0-9]{1,3})\]\s*\[e0*([0-9]{1,4})\]/i,
  /\[s0*([0-9]{1,3})e0*([0-9]{1,4})\]/i,
  // Season 1 - 02 or Temporada 1 - 02
  /(?:season|temporada)\s*0*([0-9]{1,3})\s*[\s._\-]+\s*0*([0-9]{1,4})\b/i,
  // T01E02 or T1E2 or T01 EP 02
  /(?:^|[\s._\-[\]])t0*([0-9]{1,3})\s*(?:e|ep)?\s*0*([0-9]{1,4})(?:[\s._\-[\]]|$)/i,
  // S01 - 02 or S1 - 02
  /(?:^|[\s._\-[\]])s0*([0-9]{1,3})\s*-\s*0*([0-9]{1,4})(?:[\s._\-[\]]|$)/i
];

const MOVIE_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.iso', '.flv'];

// Category name keywords
const SERIES_CATEGORY_KEYWORDS = [
  'serie', 'série', 'series', 'séries', 'novela', 'novelas', 'season', 'temporada',
  'anime', 'animes', 'dorama', 'doramas', 'kdrama', 'minisserie', 'minissérie'
];

const MOVIE_CATEGORY_KEYWORDS = [
  'filme', 'filmes', 'movie', 'movies', 'vod', 'cinema', 'cine', 'lancamento', 'lançamento',
  'lancamentos', 'lançamentos', '4k filme', '4k movie', 'documentario', 'documentário',
  'filmes 4k', 'filme 4k', 'vod filmes', 'vod filme'
];

const LIVE_CATEGORY_KEYWORDS = [
  'ao vivo', 'live', 'canais', 'canal', 'tv ao vivo', 'tv aberta', 'tv fechada',
  'esporte', 'esportes', 'noticia', 'notícias', 'abertos', 'aberto', 'locais',
  'variedades', 'infantil', 'desenhos 24h', '24 horas', '24h', 'globo', 'premiere',
  'telecine', 'combate', 'espn', 'sportv', 'hbo live', 'discovery live', 'religiosos',
  'pay per view', 'ppv', 'broadcasting'
];

const OTHER_CATEGORY_KEYWORDS = [
  'radio', 'rádio', 'radios', 'rádios', 'webcam', 'camera', 'câmera', 'podcast',
  'podcasts', 'audio', 'áudio', 'outros', 'other', 'teste', 'test', 'desconhecido', 'diversos'
];

/**
 * Checks if a title or string matches a TV series episode pattern
 */
export function matchSeriesPattern(title: string, groupTitle: string = ''): SeriesMatch {
  if (!title || typeof title !== 'string') {
    return {
      isSeries: false,
      seriesName: '',
      seasonNum: 1,
      episodeNum: 1,
      cleanEpisodeTitle: 'Episódio 1'
    };
  }

  for (const pattern of SERIES_PATTERNS) {
    const match = title.match(pattern);
    if (match && match[1] && match[2]) {
      const seasonNum = parseInt(match[1], 10);
      const episodeNum = parseInt(match[2], 10);

      // Extract clean series name by removing the matched season/episode part
      const matchedIndex = match.index || 0;
      let rawSeriesName = title.slice(0, matchedIndex).trim();

      if (!rawSeriesName && match.index === 0) {
        // Pattern was at the start, e.g. "S01E01 Game of Thrones"
        rawSeriesName = title.slice(match[0].length).trim();
      }

      // Cleanup trailing characters like '-', ':', '[', '(', '|'
      rawSeriesName = cleanItemName(rawSeriesName);

      if (rawSeriesName.length >= 2) {
        return {
          isSeries: true,
          seriesName: rawSeriesName,
          seasonNum: isNaN(seasonNum) ? 1 : seasonNum,
          episodeNum: isNaN(episodeNum) ? 1 : episodeNum,
          cleanEpisodeTitle: `Episódio ${episodeNum}`
        };
      }
    }
  }

  // Fallback check: if groupTitle is explicitly a series/novela/anime and title contains "Capitulo X" or "Episodio X"
  const groupLower = (groupTitle || '').toLowerCase();
  const isSeriesGroup = SERIES_CATEGORY_KEYWORDS.some(kw => groupLower.includes(kw));
  if (isSeriesGroup) {
    const epMatch = title.match(/(?:^|[\s._\-[\]])(?:e|ep|episode|episodio|cap|capitulo)\s*0*([0-9]{1,4})(?:[\s._\-[\]]|$)/i);
    if (epMatch && epMatch[1]) {
      const episodeNum = parseInt(epMatch[1], 10);
      const matchedIndex = epMatch.index || 0;
      let rawSeriesName = title.slice(0, matchedIndex).trim();
      if (!rawSeriesName && epMatch.index === 0) {
        rawSeriesName = title.slice(epMatch[0].length).trim();
      }
      rawSeriesName = cleanItemName(rawSeriesName) || cleanItemName(groupTitle);
      return {
        isSeries: true,
        seriesName: rawSeriesName || 'Série',
        seasonNum: 1,
        episodeNum: isNaN(episodeNum) ? 1 : episodeNum,
        cleanEpisodeTitle: `Episódio ${episodeNum}`
      };
    }
  }

  return {
    isSeries: false,
    seriesName: '',
    seasonNum: 1,
    episodeNum: 1,
    cleanEpisodeTitle: title
  };
}

/**
 * Classifies an item into 'live' | 'movie' | 'series' | 'other' following strict priority rules:
 * 1. Explicit type parameter
 * 2. Series/episode naming patterns (S01E01, 1x01, Season 1, etc.)
 * 3. URL path indicators (/series/, /movie/, /live/)
 * 4. Group-title metadata
 * 5. Media file extensions
 * 6. Explicit exclusion/safe fallback to 'other' without contaminating Live TV
 */
export function classifyContent(
  name: string,
  groupTitle: string = '',
  streamUrl: string = '',
  explicitType?: ContentType
): ContentType {
  if (explicitType) {
    return explicitType;
  }

  const groupLower = (groupTitle || '').toLowerCase().trim();
  const nameLower = (name || '').toLowerCase().trim();
  const urlLower = (streamUrl || '').toLowerCase().trim();

  // 1. Series detection by Episode/Season pattern in title
  const seriesCheck = matchSeriesPattern(name, groupTitle);
  if (seriesCheck.isSeries) {
    return 'series';
  }

  // 2. URL path indicators
  if (urlLower.includes('/series/') || urlLower.includes('/serie/')) {
    return 'series';
  }
  if (urlLower.includes('/movie/') || urlLower.includes('/movies/') || urlLower.includes('/vod/')) {
    return 'movie';
  }
  if (urlLower.includes('/live/') || urlLower.includes(':8080/live') || urlLower.startsWith('rtmp://') || urlLower.startsWith('rtsp://')) {
    return 'live';
  }

  // 3. Category / Group-Title metadata
  const isSeriesGroup = SERIES_CATEGORY_KEYWORDS.some(kw => groupLower.includes(kw));
  const isMovieGroup = MOVIE_CATEGORY_KEYWORDS.some(kw => groupLower.includes(kw));
  const isLiveGroup = LIVE_CATEGORY_KEYWORDS.some(kw => groupLower.includes(kw));
  const isOtherGroup = OTHER_CATEGORY_KEYWORDS.some(kw => groupLower.includes(kw));

  if (isOtherGroup && !isLiveGroup && !isMovieGroup) {
    return 'other';
  }

  if (isSeriesGroup && !isLiveGroup) {
    return 'series';
  }

  if (isMovieGroup && !isLiveGroup && !isSeriesGroup) {
    return 'movie';
  }

  if (isLiveGroup && !isMovieGroup && !isSeriesGroup) {
    return 'live';
  }

  // 4. File extension indicators
  const hasMovieExt = MOVIE_EXTENSIONS.some(ext => urlLower.includes(ext));
  if (hasMovieExt && !urlLower.includes('.m3u8')) {
    // Check if title has a movie year e.g. "Matrix (1999)"
    return 'movie';
  }

  // 5. Check if title contains release year e.g. "Avatar (2022)" and group is not live
  const hasMovieYear = /\((?:19|20)\d{2}\)|\b(?:19|20)\d{2}\b/.test(name);
  if (hasMovieYear && !isLiveGroup && !groupLower.includes('canal') && !groupLower.includes('ao vivo')) {
    return 'movie';
  }

  // 6. Live streaming indicators:
  // If group mentions TV or Live, or stream has .m3u8/.ts and clearly indicates live broadcast
  if (
    groupLower.includes('canal') ||
    groupLower.includes('canais') ||
    groupLower.includes('ao vivo') ||
    groupLower.includes('live') ||
    groupLower.includes('tv')
  ) {
    return 'live';
  }

  // 7. If stream ends in .m3u8 or .ts but has no category indicating live TV,
  // do NOT blindly assume live TV. If it cannot be safely classified, put in 'other'.
  if (urlLower.includes('.m3u8') || urlLower.includes('.ts')) {
    // Only classify as live if name doesn't suggest an unclassified video or test
    if (groupTitle && groupTitle !== 'Geral' && groupTitle !== 'Undefined') {
      return 'live';
    }
  }

  // 8. Safe fallback: Put unclassified items in 'other', never contaminating Live TV
  return 'other';
}

/**
 * Cleans up messy names from M3U lists (removes quality tags, dual audio, etc.)
 */
export function cleanItemName(rawName: string): string {
  if (!rawName) return 'Sem Nome';
  const str = String(rawName);

  return str
    .replace(/^[-_:|\s]+|[-_:|\s]+$/g, '')
    .replace(/\b(4K|UHD|FHD|HD|SD|1080p|720p|480p|DUAL|LEG|LEGENDADO|DUBLADO|NACIONAL|5\.1|7\.1|H265|HEVC|H\.264)\b/gi, '')
    .replace(/[\[\(\{].*?(?:4K|FHD|HD|DUBLADO|LEGENDADO).*?[\]\)\}]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || str.trim() || 'Sem Nome';
}
