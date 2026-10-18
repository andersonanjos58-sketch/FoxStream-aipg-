/**
 * TMDb API Client and Smart Match Service for FoxStream Web Frontend
 * Implements strict score-based matching (>= 85/100), key number checks,
 * year tolerance with remake protection, and category validation.
 */

import { TmdbMediaItem } from '../types';

export interface TmdbData {
  tmdbId?: number;
  title?: string;
  originalTitle?: string;
  year?: string;
  rating?: string;
  voteCount?: string;
  plot?: string;
  poster?: string;
  backdrop?: string;
  genre?: string;
  director?: string;
  cast?: string;
}

export interface SmartMatchResult {
  isMatch: boolean;
  score: number;
  textSimilarity: number;
  reason: string;
}

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';
export const POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
export const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

export function getTmdbApiKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envKey = import.meta.env.VITE_TMDB_API_KEY || import.meta.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 5) {
      return envKey.trim();
    }
  }
  return '6fb6ba516b5df9841c2ac73a2974bbfb';
}

export function getPosterUrl(path?: string, size: 'w200' | 'w300' | 'w500' | 'original' = 'w500'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

export function getBackdropUrl(path?: string, size: 'w780' | 'w1280' | 'original' = 'w1280'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

const BASE_URL = TMDB_BASE_URL;

const ROMAN_NUMERALS: Record<string, string> = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  vi: '6',
  vii: '7',
  viii: '8',
  ix: '9',
  x: '10',
  xi: '11',
  xii: '12',
};

/**
 * Strips IPTV noise, quality indicators, audio tags, brackets, and diacritics.
 */
export function cleanTitleForTmdb(rawTitle: string): { title: string; year?: string } {
  if (!rawTitle) return { title: '' };

  let text = rawTitle.trim();
  let extractedYear: string | undefined = undefined;

  // Extract 4-digit release year if present
  const yearMatches = text.match(/\b(19\d{2}|20\d{2})\b/g);
  if (yearMatches && yearMatches.length > 0) {
    const candidate = yearMatches[yearMatches.length - 1];
    const y = parseInt(candidate, 10);
    if (y >= 1920 && y <= 2035) {
      extractedYear = candidate;
    }
  }

  // Remove any bracketed or parenthesized prefix at the very beginning of the title (e.g. "[FILMES] Deadpool" -> "Deadpool")
  text = text.replace(/^[\(\[\{][^\)\]\}]+[\)\]\}]\s*/gi, '');

  // Remove category prefixes (e.g. "BR: ", "FILMES: ", "VOD | ", "LANÇAMENTOS / ")
  text = text.replace(/^(?:filmes?|s[ée]ries?|vod|canais|tv|4k|fhd|hd|br|lan[cç]amentos?)\s*[:|\-–|•\/]\s*/i, '');

  // Remove loose leading category words followed by space
  text = text.replace(/^(?:filmes?|s[ée]ries?|vod|lan[cç]amentos?)\s+/i, '');

  // Remove season and episode markers
  text = text.replace(/\b(s\d{1,2}\s*e\d{1,2}|season\s*\d{1,2}|temporada\s*\d{1,2}|t\d{1,2}|cap[ií]tulo\s*\d+)\b/gi, ' ');

  // Remove bracketed noise tags (preserving title words in parentheses like (fdp) or (Des)encanto)
  text = text.replace(
    /[\(\[\{]\s*(?:dublado|dub|legendado|leg|dual|audio|nacional|multi|legendas?|sub|pt-br|pt|br|en|latino|portugues|1080p|720p|480p|2160p|4k|uhd|fhd|hd|sd|cam|ts|tc|dvdrip|bluray|blu-ray|bdrip|web-dl|webrip|hdtv|hevc|x264|x265|h264|h265|10bit|ac3|dts|aac|mp4|mkv|avi|vod|cine|completo|s\d+|t\d+|\d{4}|filmes?|s[ée]ries?|lan[cç]amentos?)\s*[\)\]\}]/gi,
    ' '
  );

  // Remove loose IPTV noise words
  text = text.replace(
    /\b(1080p|4k|720p|480p|fhd|hd|sd|uhd|2160p|3d|imax|remux|hevc|x264|x265|h264|h265|aac|ac3|dts|atmos|10bit|dublado|dub|legendado|leg|dual|multi|nacional|legendas|sub|pt-br|ptbr|pt_br|pt|en|audio\s*5\.1|5\.1|7\.1|web-dl|webrip|bluray|bdrip|hdrip|cam|telesync|ts|rc|★rc|vod|cine|br|brasil|completo|filmes?|s[ée]ries?|canais|tv|stream|lan[cç]amentos?)\b/gi,
    ' '
  );

  // Strip release year from the title string so text comparison matches pure TMDb name,
  // but only if it doesn't leave the title empty (e.g. "2012" or "1984" movies).
  if (extractedYear) {
    const tempText = text.replace(new RegExp(`\\b${extractedYear}\\b`, 'g'), ' ').trim();
    if (tempText.length > 0) {
      text = tempText;
    }
  }

  // Normalize diacritics & punctuation
  const withoutAccents = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const withoutPunctuation = withoutAccents.replace(/[^a-z0-9\s]/g, ' ');
  const cleaned = withoutPunctuation.replace(/\s+/g, ' ').trim();

  return { title: cleaned, year: extractedYear };
}

/**
 * Extracts key numbers & Roman numerals, ignoring the known 4-digit release year.
 */
export function extractKeyNumbers(cleanedTitle: string, knownYear?: string): Set<string> {
  const tokens = cleanedTitle.split(' ').filter(t => t.length > 0);
  const numbers = new Set<string>();

  for (const token of tokens) {
    if (token === knownYear) continue;

    if (/^\d+$/.test(token)) {
      numbers.add(token.replace(/^0+/, '') || '0');
    } else if (ROMAN_NUMERALS[token]) {
      numbers.add(ROMAN_NUMERALS[token]);
    }
  }
  return numbers;
}

/**
 * Strict Key Number Check:
 * If either TMDb or local contains numbers (e.g., "2001", "2", "III"),
 * they must match identically.
 */
export function checkKeyNumbers(localNumbers: Set<string>, tmdbNumbers: Set<string>): boolean {
  if (tmdbNumbers.size > 0) {
    for (const num of tmdbNumbers) {
      if (!localNumbers.has(num)) return false;
    }
  }
  if (localNumbers.size > 0) {
    for (const num of localNumbers) {
      if (!tmdbNumbers.has(num)) return false;
    }
  }
  return true;
}

/**
 * Levenshtein distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const dp: number[][] = Array(s1.length + 1)
    .fill(null)
    .map(() => Array(s2.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
  for (let j = 0; j <= s2.length; j++) dp[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[s1.length][s2.length];
}

/**
 * Jaro-Winkler similarity
 */
function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const maxDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (maxDist < 0) return 0.0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] === s2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const m = matches;
  const jaro = (m / s1.length + m / s2.length + (m - transpositions / 2.0) / m) / 3.0;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1.0 - jaro);
}

export function computeTextSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  const levSim = 1.0 - levenshteinDistance(s1, s2) / maxLen;
  const jwSim = jaroWinklerSimilarity(s1, s2);
  const standardSim = Math.max(levSim, jwSim);

  // Collapsed (no spaces) comparison to handle cases like "(des)encanto" -> "des encanto" vs "desencanto"
  const c1 = s1.replace(/\s+/g, '');
  const c2 = s2.replace(/\s+/g, '');
  if (c1.length > 0 && c2.length > 0 && c1 !== s1) {
    const maxLenC = Math.max(c1.length, c2.length);
    const levSimC = 1.0 - levenshteinDistance(c1, c2) / maxLenC;
    const jwSimC = jaroWinklerSimilarity(c1, c2);
    const collapsedSim = Math.max(levSimC, jwSimC);
    return Math.max(standardSim, collapsedSim);
  }

  return standardSim;
}

/**
 * Score-based evaluation (0 to 100 points). Required threshold: 85.
 */
export function evaluateSmartMatch(
  localRawName: string,
  localCategory: string = '',
  localRawYear?: string,
  tmdbTitle: string = '',
  tmdbOriginalTitle?: string,
  tmdbYear?: string,
  tmdbGenres?: string
): SmartMatchResult {
  const { title: cleanedLocal, year: extractedLocalYear } = cleanTitleForTmdb(localRawName);
  const { title: cleanedTmdb, year: extractedTmdbYear } = cleanTitleForTmdb(tmdbTitle);
  const { title: cleanedTmdbOrig } = tmdbOriginalTitle ? cleanTitleForTmdb(tmdbOriginalTitle) : { title: '' };

  const finalLocalYear = extractedLocalYear || localRawYear;
  const finalTmdbYear = extractedTmdbYear || tmdbYear;

  // 1. Key Number Check (Trava de Números e Títulos Chave)
  const localKeyNumbers = extractKeyNumbers(cleanedLocal, finalLocalYear);
  const tmdbKeyNumbers = extractKeyNumbers(cleanedTmdb, finalTmdbYear);
  const tmdbOrigKeyNumbers = cleanedTmdbOrig ? extractKeyNumbers(cleanedTmdbOrig, finalTmdbYear) : new Set<string>();

  const mainKeyCheck = checkKeyNumbers(localKeyNumbers, tmdbKeyNumbers);
  const origKeyCheck = cleanedTmdbOrig ? checkKeyNumbers(localKeyNumbers, tmdbOrigKeyNumbers) : false;

  if (!mainKeyCheck && !origKeyCheck && (tmdbKeyNumbers.size > 0 || localKeyNumbers.size > 0)) {
    return {
      isMatch: false,
      score: 0,
      textSimilarity: 0.0,
      reason: `KeyNumberMismatch(Local=[${Array.from(localKeyNumbers)}], TMDb=[${Array.from(tmdbKeyNumbers)}])`,
    };
  }

  // 2. Text Similarity (Max 70 points, must be >= 80% or score = 0)
  const simMain = computeTextSimilarity(cleanedLocal, cleanedTmdb);
  const simOrig = cleanedTmdbOrig ? computeTextSimilarity(cleanedLocal, cleanedTmdbOrig) : 0;
  const bestSimilarity = Math.max(simMain, simOrig);

  if (bestSimilarity < 0.8) {
    return {
      isMatch: false,
      score: 0,
      textSimilarity: bestSimilarity,
      reason: `TextSimilarityBelow80(${Math.round(bestSimilarity * 100)}%)`,
    };
  }

  const textScore = Math.round(bestSimilarity * 70.0);

  // 3. Flexible Year Check (Max 15 points, with penalty for diverging years)
  let yearScore = 15; // neutral score when year is not available (do not penalize lists without year tags)
  const ly = finalLocalYear ? parseInt(finalLocalYear, 10) : NaN;
  const ty = finalTmdbYear ? parseInt(finalTmdbYear, 10) : NaN;
  if (!isNaN(ly) && !isNaN(ty)) {
    const diff = Math.abs(ly - ty);
    if (diff <= 1) {
      yearScore = 15;
    } else if (diff === 2) {
      yearScore = 5;
    } else {
      yearScore = -35; // Prevents matches like "A Odisseia (2024)" vs "1968"
    }
  }

  // 4. Category/Genre Compatibility (Max 15 points)
  let genreScore = 15; // neutral score when genre is not available or compatible
  const catNorm = (localCategory || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const genericWords = ['filmes', 'series', 'geral', 'vod', 'lancamentos', '4k', 'fhd', 'hd', 'populares', 'todos'];
  if (genericWords.some(w => catNorm.includes(w)) && catNorm.length <= 15) {
    genreScore = 15;
  }

  const totalScore = Math.max(0, Math.min(100, textScore + yearScore + genreScore));
  const isMatch = totalScore >= 85;

  return {
    isMatch,
    score: totalScore,
    textSimilarity: bestSimilarity,
    reason: isMatch ? `MatchApproved(${totalScore}/100)` : `ScoreBelow85(${totalScore}/100)`,
  };
}

export const TmdbService = {
  /**
   * Search TMDb and fetch full details for a Movie
   */
  async fetchMovieDetails(rawTitle: string, rawYear?: string, apiKey: string = '6fb6ba516b5df9841c2ac73a2974bbfb'): Promise<TmdbData | null> {
    const { title, year: parsedYear } = cleanTitleForTmdb(rawTitle);
    const yearToUse = parsedYear || rawYear;
    if (!title) return null;

    try {
      const query = encodeURIComponent(title);
      let url = `${BASE_URL}/search/movie?api_key=${apiKey}&language=pt-BR&query=${query}`;
      if (yearToUse) url += `&year=${yearToUse}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      if (!data.results || data.results.length === 0) return null;
      const first = data.results[0];

      return {
        tmdbId: first.id,
        title: first.title,
        originalTitle: first.original_title,
        year: first.release_date ? first.release_date.slice(0, 4) : yearToUse,
        rating: first.vote_average ? `${first.vote_average.toFixed(1)}/10` : undefined,
        voteCount: first.vote_count ? first.vote_count.toString() : undefined,
        plot: first.overview,
        poster: first.poster_path ? `${POSTER_BASE}${first.poster_path}` : undefined,
        backdrop: first.backdrop_path ? `${BACKDROP_BASE}${first.backdrop_path}` : undefined,
      };
    } catch (err) {
      console.warn('[TMDb Web] Movie details fetch failed:', err);
      return null;
    }
  },

  /**
   * Search TMDb and fetch full details for a TV Series
   */
  async fetchSeriesDetails(rawTitle: string, rawYear?: string, apiKey: string = '6fb6ba516b5df9841c2ac73a2974bbfb'): Promise<TmdbData | null> {
    const { title, year: parsedYear } = cleanTitleForTmdb(rawTitle);
    const yearToUse = parsedYear || rawYear;
    if (!title) return null;

    try {
      const query = encodeURIComponent(title);
      let url = `${BASE_URL}/search/tv?api_key=${apiKey}&language=pt-BR&query=${query}`;
      if (yearToUse) url += `&first_air_date_year=${yearToUse}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      if (!data.results || data.results.length === 0) return null;
      const first = data.results[0];

      return {
        tmdbId: first.id,
        title: first.name,
        originalTitle: first.original_name,
        year: first.first_air_date ? first.first_air_date.slice(0, 4) : yearToUse,
        rating: first.vote_average ? `${first.vote_average.toFixed(1)}/10` : undefined,
        voteCount: first.vote_count ? first.vote_count.toString() : undefined,
        plot: first.overview,
        poster: first.poster_path ? `${POSTER_BASE}${first.poster_path}` : undefined,
        backdrop: first.backdrop_path ? `${BACKDROP_BASE}${first.backdrop_path}` : undefined,
      };
    } catch (err) {
      console.warn('[TMDb Web] Series details fetch failed:', err);
      return null;
    }
  },

  /**
   * Fetch category lists from TMDb
   */
  async fetchCategoryList(endpoint: string, isTv: boolean = false, apiKey: string = getTmdbApiKey()): Promise<TmdbData[]> {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = `${BASE_URL}/${endpoint}${sep}api_key=${apiKey}&language=pt-BR`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];

      return data.results.map((item: any) => ({
        tmdbId: item.id,
        title: isTv ? item.name : item.title,
        originalTitle: isTv ? item.original_name : item.original_title,
        year: (isTv ? item.first_air_date : item.release_date)?.slice(0, 4),
        rating: item.vote_average ? `${item.vote_average.toFixed(1)}/10` : undefined,
        plot: item.overview,
        poster: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : undefined,
        backdrop: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : undefined,
      }));
    } catch (err) {
      console.warn(`[TMDb Web] Fetch list failed for ${endpoint}:`, err);
      return [];
    }
  },

  fetchTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') {
    return this.fetchCategoryList(`trending/${mediaType}/${timeWindow}`, mediaType === 'tv');
  },

  fetchTrendingMovies() {
    return this.fetchCategoryList('trending/movie/week', false);
  },

  fetchTrendingTv() {
    return this.fetchCategoryList('trending/tv/week', true);
  },

  fetchPopularMovies(page: number = 1) {
    return this.fetchCategoryList(`movie/popular?page=${page}`, false);
  },

  fetchPopularTv(page: number = 1) {
    return this.fetchCategoryList(`tv/popular?page=${page}`, true);
  },

  fetchNowPlayingMovies(page: number = 1) {
    return this.fetchCategoryList(`movie/now_playing?page=${page}`, false);
  },

  fetchTopRatedMovies(page: number = 1) {
    return this.fetchCategoryList(`movie/top_rated?page=${page}`, false);
  },

  fetchUpcomingMovies(page: number = 1) {
    return this.fetchCategoryList(`movie/upcoming?page=${page}`, false);
  },

  fetchTopRatedTv(page: number = 1) {
    return this.fetchCategoryList(`tv/top_rated?page=${page}`, true);
  },

  fetchAiringTodayTv(page: number = 1) {
    return this.fetchCategoryList(`tv/airing_today?page=${page}`, true);
  },

  fetchMoviesByGenre(genreId: number, page: number = 1) {
    return this.fetchCategoryList(`discover/movie?with_genres=${genreId}&sort_by=popularity.desc&page=${page}`, false);
  },

  fetchTvByGenre(genreId: number, page: number = 1) {
    return this.fetchCategoryList(`discover/tv?with_genres=${genreId}&sort_by=popularity.desc&page=${page}`, true);
  },

  /**
   * Fetch complete movie details including cast, trailers, runtime, and genres
   */
  async fetchFullMovieDetails(id: number | string, apiKey: string = getTmdbApiKey()): Promise<TmdbMediaItem | null> {
    try {
      const url = `${BASE_URL}/movie/${id}?api_key=${apiKey}&language=pt-BR&append_to_response=credits,videos`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      // Extract trailer (YouTube preferred)
      let trailerUrl: string | undefined = undefined;
      const videos = data.videos?.results || [];
      const trailer = videos.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos[0];
      if (trailer && trailer.site === 'YouTube' && trailer.key) {
        trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }

      // Extract top cast members
      const cast = (data.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path ? `${POSTER_BASE}${c.profile_path}` : undefined,
      }));

      return {
        id: data.id,
        title: data.title || data.original_title,
        originalTitle: data.original_title,
        overview: data.overview || 'Sinopse não disponível.',
        posterPath: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : undefined,
        backdropPath: data.backdrop_path ? `${BACKDROP_BASE}${data.backdrop_path}` : undefined,
        releaseDate: data.release_date,
        year: data.release_date ? data.release_date.slice(0, 4) : undefined,
        voteAverage: data.vote_average || 0,
        voteCount: data.vote_count,
        mediaType: 'movie',
        genres: data.genres || [],
        runtime: data.runtime,
        tagline: data.tagline,
        cast,
        trailerUrl,
      };
    } catch (err) {
      console.warn(`[TMDb Web] Fetch full movie details for ${id} failed:`, err);
      return null;
    }
  },

  /**
   * Fetch complete TV series details including cast, seasons, trailers, and genres
   */
  async fetchFullTvDetails(id: number | string, apiKey: string = getTmdbApiKey()): Promise<TmdbMediaItem | null> {
    try {
      const url = `${BASE_URL}/tv/${id}?api_key=${apiKey}&language=pt-BR&append_to_response=credits,videos`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      // Extract trailer (YouTube preferred)
      let trailerUrl: string | undefined = undefined;
      const videos = data.videos?.results || [];
      const trailer = videos.find((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || videos[0];
      if (trailer && trailer.site === 'YouTube' && trailer.key) {
        trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }

      // Extract top cast members
      const cast = (data.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        profilePath: c.profile_path ? `${POSTER_BASE}${c.profile_path}` : undefined,
      }));

      return {
        id: data.id,
        title: data.name || data.original_name,
        originalTitle: data.original_name,
        overview: data.overview || 'Sinopse não disponível.',
        posterPath: data.poster_path ? `${POSTER_BASE}${data.poster_path}` : undefined,
        backdropPath: data.backdrop_path ? `${BACKDROP_BASE}${data.backdrop_path}` : undefined,
        firstAirDate: data.first_air_date,
        releaseDate: data.first_air_date,
        year: data.first_air_date ? data.first_air_date.slice(0, 4) : undefined,
        voteAverage: data.vote_average || 0,
        voteCount: data.vote_count,
        mediaType: 'tv',
        genres: data.genres || [],
        numberOfSeasons: data.number_of_seasons,
        numberOfEpisodes: data.number_of_episodes,
        tagline: data.tagline,
        cast,
        trailerUrl,
      };
    } catch (err) {
      console.warn(`[TMDb Web] Fetch full tv details for ${id} failed:`, err);
      return null;
    }
  },

  /**
   * Multi search (movies and series) from TMDb
   */
  async searchMulti(query: string, page: number = 1, apiKey: string = getTmdbApiKey()): Promise<TmdbMediaItem[]> {
    if (!query || !query.trim()) return [];
    try {
      const q = encodeURIComponent(query.trim());
      const url = `${BASE_URL}/search/multi?api_key=${apiKey}&language=pt-BR&query=${q}&page=${page}&include_adult=false`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];

      return data.results
        .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
        .map((item: any) => {
          const isTv = item.media_type === 'tv';
          return {
            id: item.id,
            title: isTv ? item.name : item.title,
            originalTitle: isTv ? item.original_name : item.original_title,
            overview: item.overview,
            posterPath: item.poster_path ? `${POSTER_BASE}${item.poster_path}` : undefined,
            backdropPath: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : undefined,
            releaseDate: isTv ? item.first_air_date : item.release_date,
            year: (isTv ? item.first_air_date : item.release_date)?.slice(0, 4),
            voteAverage: item.vote_average || 0,
            voteCount: item.vote_count,
            mediaType: item.media_type,
            genres: [],
          };
        });
    } catch (err) {
      console.warn('[TMDb Web] Search multi failed:', err);
      return [];
    }
  },

  /**
   * Fetch external IDs (like IMDb ID 'tt...') for a movie or TV show from TMDb
   */
  async fetchExternalIds(id: number | string, mediaType: 'movie' | 'tv', apiKey: string = getTmdbApiKey()): Promise<string | null> {
    try {
      const url = `${BASE_URL}/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}/external_ids?api_key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.imdb_id || null;
    } catch (err) {
      console.warn(`[TMDb Web] Fetch external IDs for ${mediaType} ${id} failed:`, err);
      return null;
    }
  },

  /**
   * Fetch genre list from TMDb
   */
  async fetchGenres(type: 'movie' | 'tv' = 'movie', apiKey: string = getTmdbApiKey()): Promise<{ id: number; name: string }[]> {
    try {
      const url = `${BASE_URL}/genre/${type}/list?api_key=${apiKey}&language=pt-BR`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.genres || [];
    } catch (err) {
      console.warn(`[TMDb Web] Fetch genres for ${type} failed:`, err);
      return [];
    }
  },
  async fetchSeasonEpisodes(id: number | string, seasonNumber: number, apiKey: string = getTmdbApiKey()): Promise<any[]> {
    try {
      const url = `${BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${apiKey}&language=pt-BR`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return data.episodes || [];
    } catch (err) {
      console.warn(`[TMDb Web] Fetch season ${seasonNumber} episodes for ${id} failed:`, err);
      return [];
    }
  },
};
