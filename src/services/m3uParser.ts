import { LiveChannel, MovieItem, SeriesItem, SeasonItem, EpisodeItem, OtherItem } from '../types';
import { classifyContent, matchSeriesPattern, cleanItemName } from './classifier';

export interface ParseResult {
  channels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  others: OtherItem[];
  totalParsed: number;
  stats: {
    liveCount: number;
    movieCount: number;
    seriesCount: number;
    otherCount: number;
  };
  diagnostics: string[];
}

export interface ParseProgress {
  processedLines: number;
  totalEstimatedLines: number;
  channelsCount: number;
  moviesCount: number;
  seriesCount: number;
  othersCount: number;
}

/**
 * Validates if the content returned from a URL is HTML or an error document
 * rather than a valid playlist.
 */
export function isHtmlContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  const sample = content.trim().substring(0, 1500).toLowerCase();
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.includes('<head') ||
    sample.includes('<body') ||
    sample.includes('<title>') ||
    sample.startsWith('<!--if ie') ||
    sample.includes('cloudflare') ||
    sample.includes('<script') ||
    (sample.startsWith('<') && sample.includes('</'))
  );
}

/**
 * Pre-validates M3U content before parsing.
 * Returns valid: false and a descriptive error message if the content is not an M3U playlist.
 */
export function validateM3UContent(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'A resposta da URL está vazia.' };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'A resposta da URL está vazia.' };
  }

  if (isHtmlContent(trimmed)) {
    return {
      valid: false,
      error: 'A URL não retornou uma playlist M3U válida. O servidor retornou uma página HTML (possível erro no servidor, proteção contra bots ou parâmetros incorretos).'
    };
  }

  const hasM3UTag = trimmed.includes('#EXTM3U') || trimmed.includes('#EXTINF:');
  const hasStreamUrl = /(https?|rtmp|rtsp|mms):\/\/[^\s]+/i.test(trimmed);

  if (!hasM3UTag && !hasStreamUrl) {
    return {
      valid: false,
      error: 'A URL não retornou uma playlist M3U válida. O arquivo não contém cabeçalhos #EXTM3U, #EXTINF ou URLs de transmissão de mídia.'
    };
  }

  return { valid: true };
}

/**
 * Robust M3U / M3U8 Playlist Parser
 * Fully compliant with #EXTM3U, #EXTINF, tvg-name, tvg-logo, group-title, tvg-id.
 * Resilient against malformed playlists, missing metadata, duplicate items, and HTML error pages.
 */
export function parseM3U(
  content: string,
  playlistId: string,
  onProgress?: (progress: ParseProgress) => void
): ParseResult {
  const validation = validateM3UContent(content);
  if (!validation.valid) {
    throw new Error(validation.error || 'A URL não retornou uma playlist M3U válida.');
  }

  const diagnostics: string[] = [];
  const lines = content.split(/\r?\n/);
  const totalEstimatedLines = lines.length;
  diagnostics.push(`Total de linhas brutas: ${totalEstimatedLines}`);

  const hasExtM3U = lines.some(l => l.trim().startsWith('#EXTM3U'));
  if (hasExtM3U) {
    diagnostics.push('Cabeçalho #EXTM3U detectado.');
  } else {
    diagnostics.push('Aviso: cabeçalho #EXTM3U não encontrado, analisando diretivas #EXTINF e fluxos.');
  }

  const channels: LiveChannel[] = [];
  const movies: MovieItem[] = [];
  const others: OtherItem[] = [];

  // Map of seriesName -> SeriesItem with seasons
  const seriesMap = new Map<string, {
    id: string;
    name: string;
    posterUrl?: string;
    category: string;
    seasonsMap: Map<number, EpisodeItem[]>;
  }>();

  const seenUrls = new Set<string>();
  let ignoredHtmlLines = 0;

  let currentExtInf: {
    name: string;
    tvgId?: string;
    tvgName?: string;
    tvgLogo?: string;
    groupTitle?: string;
    duration?: string;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      continue; // Skip empty lines
    }

    // Reject HTML tags and directives inside M3U
    if (line.startsWith('<') || line.startsWith('<!--') || line.startsWith('<!DOCTYPE') || line.endsWith('>')) {
      ignoredHtmlLines++;
      continue;
    }

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      currentExtInf = parseExtInfLine(line);
      continue;
    }

    // Handle #EXTGRP directive
    if (line.startsWith('#EXTGRP:') && currentExtInf && !currentExtInf.groupTitle) {
      currentExtInf.groupTitle = line.replace('#EXTGRP:', '').trim();
      continue;
    }

    if (line.startsWith('#')) {
      // Other directives like #EXTVLCOPT, #KODIPROP, comments
      continue;
    }

    // Validate that this line is actually a stream URL
    const isLikelyUrl =
      /^(https?|rtmp|rtsp|mms):\/\/[^\s]+/i.test(line) ||
      (!line.includes(' ') && line.includes('/') && (line.includes('.m3u8') || line.includes('.ts') || line.includes('.mp4') || line.includes('.')));

    if (!isLikelyUrl) {
      // Not a media stream URL; skip to avoid creating corrupt channels
      continue;
    }

    const streamUrl = line;

    // Deduplicate by URL
    if (seenUrls.has(streamUrl)) {
      currentExtInf = null;
      continue;
    }
    seenUrls.add(streamUrl);

    // Extract metadata
    const name = currentExtInf?.name || extractNameFromUrl(streamUrl);
    const category = currentExtInf?.groupTitle?.trim() || 'Geral';
    const logoUrl = currentExtInf?.tvgLogo;
    const tvgId = currentExtInf?.tvgId;
    const tvgName = currentExtInf?.tvgName;

    // Determine content type strictly
    const contentType = classifyContent(name, category, streamUrl);
    const uniqueItemId = `${playlistId}_${i}_${Math.random().toString(36).substring(2, 7)}`;

    if (contentType === 'live') {
      channels.push({
        id: uniqueItemId,
        playlistId,
        name: cleanItemName(name),
        streamUrl,
        logoUrl: logoUrl && isValidUrl(logoUrl) ? logoUrl : undefined,
        category: category || 'Canais',
        tvgId,
        tvgName
      });
    } else if (contentType === 'movie') {
      const yearMatch = name.match(/\((?:19|20)\d{2}\)|\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch ? yearMatch[0].replace(/[()]/g, '') : undefined;

      movies.push({
        id: uniqueItemId,
        playlistId,
        name: cleanItemName(name),
        streamUrl,
        posterUrl: logoUrl && isValidUrl(logoUrl) ? logoUrl : undefined,
        category: category || 'Filmes',
        year,
        genre: category
      });
    } else if (contentType === 'series') {
      const seriesMatch = matchSeriesPattern(name, category);
      const seriesName = seriesMatch.isSeries && seriesMatch.seriesName ? seriesMatch.seriesName : cleanItemName(name);
      const seasonNum = seriesMatch.seasonNum || 1;
      const episodeNum = seriesMatch.episodeNum || 1;

      const seriesKey = (seriesName || 'Série').toLowerCase().trim();
      let seriesEntry = seriesMap.get(seriesKey);
      if (!seriesEntry) {
        seriesEntry = {
          id: `${playlistId}_series_${seriesMap.size}_${Math.random().toString(36).substring(2, 6)}`,
          name: seriesName || 'Série',
          posterUrl: logoUrl && isValidUrl(logoUrl) ? logoUrl : undefined,
          category: category || 'Séries',
          seasonsMap: new Map<number, EpisodeItem[]>()
        };
        seriesMap.set(seriesKey, seriesEntry);
      }

      if (!seriesEntry.posterUrl && logoUrl && isValidUrl(logoUrl)) {
        seriesEntry.posterUrl = logoUrl;
      }

      let seasonEpisodes = seriesEntry.seasonsMap.get(seasonNum);
      if (!seasonEpisodes) {
        seasonEpisodes = [];
        seriesEntry.seasonsMap.set(seasonNum, seasonEpisodes);
      }

      seasonEpisodes.push({
        id: uniqueItemId,
        seriesId: seriesEntry.id,
        title: seriesMatch.cleanEpisodeTitle || `Episódio ${episodeNum}`,
        seasonNum,
        episodeNum,
        streamUrl
      });
    } else {
      // Content classified as 'other' - placed safely in Outros, never polluting Live TV!
      others.push({
        id: uniqueItemId,
        playlistId,
        name: cleanItemName(name),
        streamUrl,
        logoUrl: logoUrl && isValidUrl(logoUrl) ? logoUrl : undefined,
        category: category || 'Outros',
        tvgId,
        tvgName
      });
    }

    currentExtInf = null;

    if (onProgress && i % 500 === 0) {
      onProgress({
        processedLines: i,
        totalEstimatedLines,
        channelsCount: channels.length,
        moviesCount: movies.length,
        seriesCount: seriesMap.size,
        othersCount: others.length
      });
    }
  }

  // Convert seriesMap to final SeriesItem array with structured seasons and sorted episodes
  const series: SeriesItem[] = Array.from(seriesMap.values()).map(entry => {
    const seasons: SeasonItem[] = Array.from(entry.seasonsMap.entries())
      .sort(([sA], [sB]) => sA - sB)
      .map(([seasonNum, episodes]) => {
        episodes.sort((a, b) => a.episodeNum - b.episodeNum);
        return {
          seasonNum,
          name: `Temporada ${seasonNum}`,
          episodes
        };
      });

    const totalEpisodes = seasons.reduce((acc, s) => acc + s.episodes.length, 0);

    return {
      id: entry.id,
      playlistId,
      name: entry.name,
      posterUrl: entry.posterUrl,
      category: entry.category,
      seasons,
      totalEpisodes
    };
  });

  const totalParsed = channels.length + movies.length + series.length + others.length;

  diagnostics.push(`Itens classificados:`);
  diagnostics.push(`- TV ao Vivo: ${channels.length} canais`);
  diagnostics.push(`- Filmes (VOD): ${movies.length} títulos`);
  diagnostics.push(`- Séries: ${series.length} séries (${series.reduce((a, s) => a + (s.totalEpisodes || 0), 0)} episódios)`);
  diagnostics.push(`- Outros: ${others.length} itens`);
  if (ignoredHtmlLines > 0) {
    diagnostics.push(`Aviso: ${ignoredHtmlLines} linhas com tags HTML foram ignoradas.`);
  }

  return {
    channels,
    movies,
    series,
    others,
    totalParsed,
    stats: {
      liveCount: channels.length,
      movieCount: movies.length,
      seriesCount: series.length,
      otherCount: others.length
    },
    diagnostics
  };
}

/**
 * Parses a single #EXTINF line extracting duration, attributes and channel/media name.
 * Handles single quotes, double quotes, unquoted values and missing attributes.
 */
function parseExtInfLine(line: string) {
  // Example: #EXTINF:-1 tvg-id="CNN" tvg-name="CNN US" tvg-logo="http://..." group-title="News",CNN HD
  const commaIndex = line.lastIndexOf(',');
  let name = '';
  let attributesString = '';

  if (commaIndex !== -1) {
    name = line.substring(commaIndex + 1).trim();
    attributesString = line.substring(8, commaIndex).trim();
  } else {
    attributesString = line.substring(8).trim();
    name = 'Sem Nome';
  }

  const tvgId = extractAttribute(attributesString, 'tvg-id');
  const tvgName = extractAttribute(attributesString, 'tvg-name');
  const tvgLogo = extractAttribute(attributesString, 'tvg-logo') || extractAttribute(attributesString, 'logo');
  const groupTitle = extractAttribute(attributesString, 'group-title') || extractAttribute(attributesString, 'group');

  return {
    name: name || tvgName || 'Sem Nome',
    tvgId,
    tvgName,
    tvgLogo,
    groupTitle
  };
}

/**
 * Extracts attribute value like tvg-logo="..." or group-title='...' from attribute string
 */
function extractAttribute(attrStr: string, attrName: string): string | undefined {
  const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i');
  const match = attrStr.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback for unquoted attributes: attrName=value
  const unquotedRegex = new RegExp(`${attrName}=([^\\s,]+)`, 'i');
  const unquotedMatch = attrStr.match(unquotedRegex);
  if (unquotedMatch && unquotedMatch[1]) {
    return unquotedMatch[1].trim();
  }

  return undefined;
}

function extractNameFromUrl(url: string): string {
  try {
    const cleanUrl = url.split('?')[0];
    const segments = cleanUrl.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return decodeURIComponent(last).replace(/\.[^/.]+$/, '');
    }
  } catch {
    // ignore
  }
  return 'Transmissão IPTV';
}

function isValidUrl(stringUrl: string): boolean {
  try {
    return stringUrl.startsWith('http://') || stringUrl.startsWith('https://');
  } catch {
    return false;
  }
}
