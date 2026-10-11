import { Playlist, LiveChannel, MovieItem, SeriesItem, HistoryItem, FavoriteItem, OtherItem } from '../types';
import { secureEncode, secureDecode } from './security';

const STORAGE_KEYS = {
  PLAYLISTS: 'foxstream_playlists_v1',
  ACTIVE_PLAYLIST_ID: 'foxstream_active_playlist_id_v1',
  FAVORITES: 'foxstream_favorites_v1',
  HISTORY: 'foxstream_history_v1',
  CONTENT_CACHE_PREFIX: 'foxstream_content_',
};

/**
 * Resilient IndexedDB Helper with an in-memory fallback.
 * Prevents QuotaExceeded errors and sandbox iframe blockages.
 */
class IndexedDBHelper {
  private static dbName = 'FoxStreamDB_v2';
  private static storeName = 'content_cache';
  private static dbPromise: Promise<IDBDatabase> | null = null;
  private static memFallback = new Map<string, any>();

  private static getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined' || !window.indexedDB) {
          reject(new Error('IndexedDB is not supported/available'));
          return;
        }

        const request = window.indexedDB.open(this.dbName, 1);
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error || new Error('Failed to open IndexedDB'));
        };
      } catch (err) {
        reject(err);
      }
    });

    return this.dbPromise;
  }

  public static async get(key: string): Promise<any | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.value);
          } else {
            resolve(this.memFallback.get(key) ?? null);
          }
        };
        request.onerror = () => {
          resolve(this.memFallback.get(key) ?? null);
        };
      });
    } catch (err) {
      return this.memFallback.get(key) ?? null;
    }
  }

  public static async set(key: string, value: any): Promise<void> {
    this.memFallback.set(key, value);
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put({ id: key, value });
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // Keep memory fallback
    }
  }

  public static async delete(key: string): Promise<void> {
    this.memFallback.delete(key);
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // Keep memory fallback
    }
  }
}

/**
 * Safe storage wrapper that guards against iframe sandbox restrictions,
 * private browsing mode, and QuotaExceeded errors with an in-memory fallback.
 */
class MemoryStorage {
  private mem = new Map<string, string>();
  private isAvailable: boolean;

  constructor() {
    this.isAvailable = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const testKey = '__foxstream_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        this.isAvailable = true;
      }
    } catch {
      this.isAvailable = false;
    }
  }

  getItem(key: string): string | null {
    try {
      if (this.isAvailable) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // Fallback
    }
    return this.mem.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    try {
      if (this.isAvailable) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Storage might be full or blocked
    }
    this.mem.set(key, value);
  }

  removeItem(key: string): void {
    try {
      if (this.isAvailable) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Fallback
    }
    this.mem.delete(key);
  }
}

const safeStorage = new MemoryStorage();

export class StorageService {
  /**
   * Get all registered playlists
   */
  public static getPlaylists(): Playlist[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // Decode secure passwords
      return parsed.map(p => ({
        ...p,
        password: p?.password ? secureDecode(p.password) : undefined
      }));
    } catch (err) {
      console.warn('Failed to load playlists from storage:', err);
      return [];
    }
  }

  /**
   * Save or update a playlist in the list
   */
  public static savePlaylist(playlist: Playlist): void {
    try {
      const playlists = this.getPlaylists();
      const existingIndex = playlists.findIndex(p => p.id === playlist.id);

      if (existingIndex >= 0) {
        playlists[existingIndex] = playlist;
      } else {
        playlists.push(playlist);
      }

      // Encode all passwords correctly before storing in localStorage
      const toSave = playlists.map(p => ({
        ...p,
        password: p.password ? secureEncode(p.password) : undefined
      }));

      safeStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(toSave));

      // If no active playlist set, set this one
      if (!this.getActivePlaylistId()) {
        this.setActivePlaylistId(playlist.id);
      }
    } catch (err) {
      console.warn('Failed to save playlist:', err);
    }
  }

  /**
   * Delete a playlist and its cached content
   */
  public static async deletePlaylist(playlistId: string): Promise<void> {
    try {
      let playlists = this.getPlaylists();
      playlists = playlists.filter(p => p.id !== playlistId);
      
      // Store remaining with encoded passwords
      const toSave = playlists.map(p => ({
        ...p,
        password: p.password ? secureEncode(p.password) : undefined
      }));
      safeStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(toSave));

      // Remove content cache asynchronously from IndexedDB
      await IndexedDBHelper.delete(`${STORAGE_KEYS.CONTENT_CACHE_PREFIX}${playlistId}`);

      // If deleted list was active, select another
      if (this.getActivePlaylistId() === playlistId) {
        const nextActive = playlists.length > 0 ? playlists[0].id : '';
        this.setActivePlaylistId(nextActive);
      }
    } catch (err) {
      console.warn('Failed to delete playlist:', err);
    }
  }

  /**
   * Rename an existing playlist
   */
  public static renamePlaylist(playlistId: string, newName: string): void {
    try {
      const playlists = this.getPlaylists();
      const target = playlists.find(p => p.id === playlistId);
      if (target) {
        target.name = newName;
        this.savePlaylist(target);
      }
    } catch (err) {
      console.warn('Failed to rename playlist:', err);
    }
  }

  /**
   * Clear all cached content items across all playlists
   */
  public static async clearAllCache(): Promise<void> {
    try {
      const playlists = this.getPlaylists();
      for (const p of playlists) {
        await IndexedDBHelper.delete(`${STORAGE_KEYS.CONTENT_CACHE_PREFIX}${p.id}`);
      }
    } catch (err) {
      console.warn('Failed to clear cache:', err);
    }
  }

  /**
   * Get ID of the currently active playlist
   */
  public static getActivePlaylistId(): string {
    try {
      return safeStorage.getItem(STORAGE_KEYS.ACTIVE_PLAYLIST_ID) || '';
    } catch {
      return '';
    }
  }

  /**
   * Set active playlist
   */
  public static setActivePlaylistId(id: string): void {
    try {
      safeStorage.setItem(STORAGE_KEYS.ACTIVE_PLAYLIST_ID, id);
    } catch (err) {
      console.warn('Failed to set active playlist id:', err);
    }
  }

  /**
   * Save content cache for a playlist (channels, movies, series, others)
   */
  public static async saveContentCache(
    playlistId: string,
    data: { channels: LiveChannel[]; movies: MovieItem[]; series: SeriesItem[]; others?: OtherItem[] }
  ): Promise<void> {
    try {
      await IndexedDBHelper.set(`${STORAGE_KEYS.CONTENT_CACHE_PREFIX}${playlistId}`, data);
    } catch (err) {
      console.warn('Storage limit reached when caching IPTV items:', err);
    }
  }

  /**
   * Load content cache for a playlist
   */
  public static async getContentCache(playlistId: string): Promise<{
    channels: LiveChannel[];
    movies: MovieItem[];
    series: SeriesItem[];
    others: OtherItem[];
  } | null> {
    try {
      const parsed = await IndexedDBHelper.get(`${STORAGE_KEYS.CONTENT_CACHE_PREFIX}${playlistId}`);
      if (!parsed) return null;
      return {
        channels: Array.isArray(parsed?.channels) ? parsed.channels : [],
        movies: Array.isArray(parsed?.movies) ? parsed.movies : [],
        series: Array.isArray(parsed?.series) ? parsed.series : [],
        others: Array.isArray(parsed?.others) ? parsed.others : [],
      };
    } catch (err) {
      console.warn('Failed to load content cache:', err);
      return null;
    }
  }

  /**
   * Favorites management
   */
  public static getFavorites(): FavoriteItem[] {
    try {
      const data = safeStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public static isFavorite(contentId: string): boolean {
    try {
      const favs = this.getFavorites();
      return favs.some(f => f && f.contentId === contentId);
    } catch {
      return false;
    }
  }

  public static toggleFavorite(item: Omit<FavoriteItem, 'id' | 'addedAt'>): FavoriteItem[] {
    try {
      let favs = this.getFavorites();
      const existingIndex = favs.findIndex(f => f && f.contentId === item.contentId);

      if (existingIndex >= 0) {
        favs.splice(existingIndex, 1);
      } else {
        const newFav: FavoriteItem = {
          ...item,
          id: `fav_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          addedAt: new Date().toISOString()
        };
        favs.unshift(newFav);
      }
      safeStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
      return favs;
    } catch (err) {
      console.warn('Failed to toggle favorite:', err);
      return [];
    }
  }

  /**
   * History / "Continue Assistindo"
   */
  public static getHistory(): HistoryItem[] {
    try {
      let data = safeStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!data) {
        data = safeStorage.getItem('foxstream_history');
      }
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      
      // Filter out corrupted/empty items and any movie/series with progress >= 95%
      return parsed.filter((item: HistoryItem) => {
        if (!item || typeof item !== 'object' || !item.id || !item.title) return false;
        if (!item.streamUrl && !item.contentId) return false;
        // 95% or higher is considered fully watched and excluded
        if (item.type !== 'live' && typeof item.progress === 'number' && item.progress >= 95) {
          return false;
        }
        return true;
      });
    } catch {
      return [];
    }
  }

  public static addToHistory(item: Omit<HistoryItem, 'id' | 'playedAt'>): void {
    try {
      // If 95% or more completed, don't add to continue watching, remove if exists
      if (item.type !== 'live' && typeof item.progress === 'number' && item.progress >= 95) {
        this.removeHistoryByContentOrStream(item.contentId, item.streamUrl);
        return;
      }

      let history = this.getHistory();
      // Remove previous entry matching contentId or streamUrl to put latest at top
      history = history.filter(h => h && h.contentId !== item.contentId && h.streamUrl !== item.streamUrl);

      const newItem: HistoryItem = {
        ...item,
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        playedAt: new Date().toISOString(),
        timestamp: Date.now()
      };

      history.unshift(newItem);
      // Keep max 50 recent items
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      safeStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to add to history:', err);
    }
  }

  public static removeHistoryByContentOrStream(contentId?: string, streamUrl?: string): void {
    try {
      let history = this.getHistory();
      history = history.filter(h => {
        if (contentId && h.contentId === contentId) return false;
        if (streamUrl && h.streamUrl === streamUrl) return false;
        return true;
      });
      safeStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to remove history item by content/stream:', err);
    }
  }

  public static updatePlaybackProgress(
    contentId: string,
    streamUrl: string,
    currentTime: number,
    duration: number,
    metadata?: Partial<HistoryItem>
  ): { removed: boolean; history: HistoryItem[] } {
    try {
      const isCompleted = duration > 0 && (currentTime / duration >= 0.95);

      if (isCompleted) {
        this.removeHistoryByContentOrStream(contentId, streamUrl);
        return { removed: true, history: this.getHistory() };
      }

      let history = this.getHistory();
      const progress = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : undefined;
      const existingIdx = history.findIndex(h => h.contentId === contentId || (streamUrl && h.streamUrl === streamUrl));

      if (existingIdx >= 0) {
        history[existingIdx] = {
          ...history[existingIdx],
          ...metadata,
          currentTime,
          duration,
          progress,
          playedAt: new Date().toISOString(),
          timestamp: Date.now()
        };
        const updated = history.splice(existingIdx, 1)[0];
        history.unshift(updated);
      } else if (metadata && metadata.title) {
        const newItem: HistoryItem = {
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          contentId,
          streamUrl,
          title: metadata.title,
          type: metadata.type || 'movie',
          posterUrl: metadata.posterUrl,
          category: metadata.category,
          seriesName: metadata.seriesName,
          seasonEpisode: metadata.seasonEpisode,
          currentTime,
          duration,
          progress,
          playedAt: new Date().toISOString(),
          timestamp: Date.now()
        };
        history.unshift(newItem);
      }

      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      safeStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      return { removed: false, history };
    } catch (err) {
      console.warn('Failed to update playback progress:', err);
      return { removed: false, history: this.getHistory() };
    }
  }

  public static clearHistory(): void {
    try {
      safeStorage.removeItem(STORAGE_KEYS.HISTORY);
    } catch (err) {
      console.warn('Failed to clear history:', err);
    }
  }

  public static removeHistoryItem(id: string): void {
    try {
      let history = this.getHistory();
      history = history.filter(h => h && h.id !== id);
      safeStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to remove history item:', err);
    }
  }
}
