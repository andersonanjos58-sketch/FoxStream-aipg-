export type PlaylistType = 'm3u' | 'xtream' | 'addon_json';
export type ContentType = 'live' | 'movie' | 'series' | 'other';

export interface PlaylistStats {
  liveCount: number;
  movieCount: number;
  seriesCount: number;
  otherCount?: number;
}

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  // M3U specific
  url?: string;
  fileData?: string; // Cache or raw string if imported
  // Xtream specific
  serverUrl?: string;
  username?: string;
  password?: string; // Stored securely/encoded
  // Add-on JSON specific
  addonUrl?: string;
  // Metadata
  lastUpdated: string;
  status: 'active' | 'error' | 'syncing';
  errorMessage?: string;
  stats: PlaylistStats;
  diagnostics?: string[];
}

export interface OtherItem {
  id: string;
  playlistId: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  category: string;
  tvgId?: string;
  tvgName?: string;
  isFavorite?: boolean;
}

export interface LiveChannel {
  id: string;
  playlistId: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  category: string;
  tvgId?: string;
  tvgName?: string;
  isFavorite?: boolean;
}

export interface MovieItem {
  id: string;
  playlistId: string;
  name: string;
  streamUrl: string;
  posterUrl?: string;
  backdropUrl?: string;
  category: string;
  year?: string;
  duration?: string;
  genre?: string;
  rating?: string;
  description?: string;
  isFavorite?: boolean;
}

export interface EpisodeItem {
  id: string;
  seriesId: string;
  title: string;
  seasonNum: number;
  episodeNum: number;
  streamUrl: string;
  duration?: string;
  overview?: string;
  isFavorite?: boolean;
}

export interface SeasonItem {
  seasonNum: number;
  name: string;
  episodes: EpisodeItem[];
}

export interface SeriesItem {
  id: string;
  playlistId: string;
  name: string;
  posterUrl?: string;
  backdropUrl?: string;
  category: string;
  year?: string;
  genre?: string;
  rating?: string;
  description?: string;
  seasons: SeasonItem[];
  totalEpisodes?: number;
  isFavorite?: boolean;
}

export interface HistoryItem {
  id: string;
  contentId: string;
  title: string;
  type: ContentType;
  streamUrl: string;
  posterUrl?: string;
  category?: string;
  seriesName?: string;
  seasonEpisode?: string;
  playedAt: string;
  timestamp?: number;
  currentTime?: number;
  duration?: number;
  progress?: number;
}

export interface FavoriteItem {
  id: string;
  contentId: string;
  type: ContentType;
  title: string;
  category: string;
  posterUrl?: string;
  streamUrl?: string;
  seriesName?: string;
  seasonEpisode?: string;
  addedAt: string;
}

export interface XtreamUserInfo {
  username: string;
  status: string;
  auth?: number | string;
  exp_date?: string;
  is_trial?: string;
  active_cons?: string;
  created_at?: string;
  max_connections?: string;
  allowed_output_formats?: string[];
}

export interface XtreamServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  time_now: string;
}

export interface XtreamAuthResponse {
  user_info?: XtreamUserInfo;
  server_info?: XtreamServerInfo;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

// Structure for streams.json
export interface StreamSource {
  id: string;
  tmdb_id?: number | string;
  title: string;
  year?: number;
  type: 'movie' | 'series' | 'live';
  streamUrl: string;
  quality?: string; // e.g., "1080p", "4K"
  format?: 'mp4' | 'hls' | 'mkv';
}

// Internal Unified Playback State
export interface ActivePlaybackPayload {
  tmdbId: number;
  title: string;
  posterPath: string;
  backdropPath: string;
  streamUrl: string;
  format?: string;
  type?: 'movie' | 'series' | 'live';
  seasonEpisode?: string;
  seriesName?: string;
}

// TMDB Full Details Model
export interface TmdbMediaItem {
  id: number;
  title: string;
  originalTitle?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  year?: string;
  voteAverage: number;
  voteCount?: number;
  mediaType: 'movie' | 'tv';
  genres?: { id: number; name: string }[];
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  tagline?: string;
  cast?: { id: number; name: string; character: string; profilePath?: string }[];
  trailerUrl?: string;
}
