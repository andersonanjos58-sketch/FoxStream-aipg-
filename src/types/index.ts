export type PlaylistType = 'm3u' | 'xtream';
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
