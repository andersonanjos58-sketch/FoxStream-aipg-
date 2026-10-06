/**
 * FoxStream - IPTV Media Catalog & Manager
 * Pure Client-driven / Android Native Jetpack Compose Architecture
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, NavTab } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { LiveTvScreen } from './components/LiveTvScreen';
import { MoviesScreen } from './components/MoviesScreen';
import { SeriesScreen } from './components/SeriesScreen';
import { FavoritesScreen } from './components/FavoritesScreen';
import { PlaylistsScreen } from './components/PlaylistsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AddPlaylistScreen } from './components/AddPlaylistScreen';
import { SearchModal } from './components/SearchModal';
import { MovieDetailsModal } from './components/MovieDetailsModal';
import { SeriesDetailsModal } from './components/SeriesDetailsModal';
import { InternalPlayer } from './components/InternalPlayer';
import { AndroidSourceModal } from './components/AndroidSourceModal';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

import { 
  Playlist, LiveChannel, MovieItem, SeriesItem, 
  HistoryItem, FavoriteItem, ContentType, EpisodeItem 
} from './types';
import { StorageService } from './services/storageService';
import { PlaybackService } from './services/playbackService';
import { parseM3U } from './services/m3uParser';
import { XtreamClient } from './services/xtreamClient';
import { evaluateSmartMatch } from './services/tmdbService';

export default function App() {
  // Navigation
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // Playlists & Content Data
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshingPlaylistId, setRefreshingPlaylistId] = useState<string | null>(null);

  // Modals & Dialogs
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesItem | null>(null);

  // Toast Notification (replaces unsafe window.alert)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Playback Dialog
  const [playbackDialog, setPlaybackDialog] = useState<{
    isOpen: boolean;
    title: string;
    streamUrl: string;
    posterUrl?: string;
    category?: string;
    type: ContentType;
    seriesName?: string;
    seasonEpisode?: string;
  }>({
    isOpen: false,
    title: '',
    streamUrl: '',
    type: 'live'
  });

  // Load initial data from Storage
  const reloadContent = useCallback(async (playlistId: string) => {
    if (!playlistId) {
      setChannels([]);
      setMovies([]);
      setSeries([]);
      return;
    }
    try {
      const cache = await StorageService.getContentCache(playlistId);
      if (cache) {
        setChannels(cache.channels || []);
        setMovies(cache.movies || []);
        setSeries(cache.series || []);
      } else {
        setChannels([]);
        setMovies([]);
        setSeries([]);
      }
    } catch (err) {
      console.warn('Failed to load cached content:', err);
      setChannels([]);
      setMovies([]);
      setSeries([]);
    }
  }, []);

  useEffect(() => {
    const loadedPlaylists = StorageService.getPlaylists();
    setPlaylists(loadedPlaylists);

    const activeId = StorageService.getActivePlaylistId();
    if (activeId && loadedPlaylists.some(p => p.id === activeId)) {
      setActivePlaylistId(activeId);
      reloadContent(activeId);
    } else if (loadedPlaylists.length > 0) {
      const firstId = loadedPlaylists[0].id;
      setActivePlaylistId(firstId);
      StorageService.setActivePlaylistId(firstId);
      reloadContent(firstId);
    }

    setHistory(StorageService.getHistory());
    setFavorites(StorageService.getFavorites());
  }, [reloadContent]);

  // Active playlist object
  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || null;

  // Helper to dynamically inject fresh/correct credentials into Xtream stream URLs.
  // This heals any cached streams that might have stale or corrupt username/password strings.
  const fixXtreamStreamUrl = useCallback((url: string): string => {
    if (!url || !activePlaylist || activePlaylist.type !== 'xtream') return url;
    const { serverUrl, username, password } = activePlaylist;
    if (!serverUrl || !username || !password) return url;

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // Xtream URL formats have live/username/password/id, movie/username/password/id, or series/username/password/id
      if (pathParts.length >= 5 && ['live', 'movie', 'series'].includes(pathParts[1])) {
        pathParts[2] = username;
        pathParts[3] = password;
        urlObj.pathname = pathParts.join('/');
        
        // Also ensure server domain/port is synced
        try {
          const serverUrlObj = new URL(serverUrl);
          urlObj.protocol = serverUrlObj.protocol;
          urlObj.host = serverUrlObj.host;
          urlObj.port = serverUrlObj.port;
        } catch {
          // ignore host swap if serverUrl is malformed
        }
        
        const finalHealedUrl = urlObj.toString();
        console.log(`[Xtream Heal] Input: ${url.replace(/\/[^/]+\/[^/]+\/(\d+)/, '/***/***/$1')} -> Output: ${finalHealedUrl.replace(/\/[^/]+\/[^/]+\/(\d+)/, '/***/***/$1')}`);
        return finalHealedUrl;
      }
    } catch (err) {
      console.warn('Failed to heal Xtream URL:', err);
    }
    return url;
  }, [activePlaylist]);

  // Change active playlist
  const handleSelectPlaylist = (id: string) => {
    setActivePlaylistId(id);
    StorageService.setActivePlaylistId(id);
    reloadContent(id);
  };

  // Play a Live Channel
  const handlePlayChannel = (channel: LiveChannel) => {
    const healedUrl = fixXtreamStreamUrl(channel.streamUrl);

    // Record history
    const historyItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      contentId: channel.id,
      title: channel.name,
      type: 'live',
      posterUrl: channel.logoUrl,
      playedAt: new Date().toISOString(),
      timestamp: Date.now(),
      streamUrl: healedUrl
    };
    StorageService.addToHistory(historyItem);
    setHistory(StorageService.getHistory());

    // Also open the Playback Dialog with VLC intents & options
    setPlaybackDialog({
      isOpen: true,
      title: channel.name,
      streamUrl: healedUrl,
      posterUrl: channel.logoUrl,
      category: channel.category,
      type: 'live'
    });
  };

  // Play a Movie
  const handlePlayMovie = (movie: MovieItem) => {
    setSelectedMovie(null); // close modal

    let streamUrl = movie.streamUrl;
    let finalMovie = movie;

    // On-Demand Smart Match for Showcase/TMDb-only items
    if (!streamUrl) {
      console.log(`[On-Demand Match] Searching stream for: ${movie.name} (${movie.year})`);
      let bestMovie: MovieItem | null = null;
      let bestScore = 64; // minimum score threshold of 65/100 for a valid match

      for (const m of movies) {
        const res = evaluateSmartMatch(m.name, m.category, m.year, movie.name, undefined, movie.year);
        if (res.isMatch && res.score > bestScore) {
          bestScore = res.score;
          bestMovie = m;
          if (bestScore >= 98) break;
        }
      }

      if (bestMovie) {
        console.log(`[On-Demand Match] Found match: ${bestMovie.name} with score: ${bestScore}`);
        streamUrl = bestMovie.streamUrl;
        finalMovie = {
          ...movie,
          id: bestMovie.id,
          streamUrl: bestMovie.streamUrl,
          category: bestMovie.category || movie.category
        };
      } else {
        showToast('Conteúdo não disponível no seu servidor IPTV', 'error');
        return;
      }
    }

    const healedUrl = fixXtreamStreamUrl(streamUrl);

    const historyItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      contentId: finalMovie.id,
      title: finalMovie.name,
      type: 'movie',
      posterUrl: finalMovie.posterUrl,
      playedAt: new Date().toISOString(),
      timestamp: Date.now(),
      streamUrl: healedUrl
    };
    StorageService.addToHistory(historyItem);
    setHistory(StorageService.getHistory());

    setPlaybackDialog({
      isOpen: true,
      title: finalMovie.name,
      streamUrl: healedUrl,
      posterUrl: finalMovie.posterUrl,
      category: finalMovie.category,
      type: 'movie'
    });
  };

  // Play a Series Episode
  const handlePlayEpisode = (seriesItem: SeriesItem, episode: EpisodeItem) => {
    setSelectedSeries(null); // close modal
    const healedUrl = fixXtreamStreamUrl(episode.streamUrl);

    const historyItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      contentId: episode.id,
      title: `${seriesItem.name} - ${episode.title}`,
      type: 'series',
      posterUrl: seriesItem.posterUrl,
      playedAt: new Date().toISOString(),
      timestamp: Date.now(),
      seriesName: seriesItem.name,
      seasonEpisode: `T${episode.seasonNum}:E${episode.episodeNum}`,
      streamUrl: healedUrl
    };
    StorageService.addToHistory(historyItem);
    setHistory(StorageService.getHistory());

    setPlaybackDialog({
      isOpen: true,
      title: `${seriesItem.name} • T${episode.seasonNum}:E${episode.episodeNum} - ${episode.title}`,
      streamUrl: healedUrl,
      posterUrl: seriesItem.posterUrl,
      category: seriesItem.category,
      type: 'series',
      seriesName: seriesItem.name,
      seasonEpisode: `T${episode.seasonNum}:E${episode.episodeNum}`
    });
  };

  // Update a series item with loaded seasons/episodes and save to cache
  const handleUpdateSeries = async (updatedSeries: SeriesItem) => {
    setSelectedSeries(updatedSeries);
    setSeries(prev => prev.map(s => s.id === updatedSeries.id ? updatedSeries : s));
    if (activePlaylistId) {
      try {
        const cache = await StorageService.getContentCache(activePlaylistId);
        if (cache) {
          cache.series = (cache.series || []).map(s => s.id === updatedSeries.id ? updatedSeries : s);
          await StorageService.saveContentCache(activePlaylistId, cache);
        }
      } catch (err) {
        console.warn('Failed to update series cache:', err);
      }
    }
  };

  // Play an item from the Continue Watching history
  const handlePlayHistory = (item: HistoryItem) => {
    if (item.streamUrl) {
      const healedUrl = fixXtreamStreamUrl(item.streamUrl);
      setPlaybackDialog({
        isOpen: true,
        title: item.title,
        streamUrl: healedUrl,
        posterUrl: item.posterUrl,
        type: item.type === 'other' ? 'live' : item.type,
        seriesName: item.seriesName,
        seasonEpisode: item.seasonEpisode
      });
    }
  };

  // Remove an item from the Continue Watching history
  const handleRemoveHistory = (id: string) => {
    StorageService.removeHistoryItem(id);
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  // Favorites logic
  const isFavorite = (contentId: string) => {
    return favorites.some(f => f.contentId === contentId);
  };

  const handleToggleFavorite = (
    item: { id: string; name: string; category?: string; posterUrl?: string; logoUrl?: string; streamUrl?: string },
    type: ContentType
  ) => {
    const favItem: FavoriteItem = {
      id: `fav_${item.id}`,
      contentId: item.id,
      title: item.name,
      type,
      category: item.category || 'Geral',
      posterUrl: item.posterUrl || item.logoUrl,
      streamUrl: item.streamUrl,
      addedAt: new Date().toISOString()
    };
    const updated = StorageService.toggleFavorite(favItem);
    setFavorites(updated);
  };

  // Add Playlist Success
  const handlePlaylistAdded = (newPlaylist: Playlist) => {
    const updated = StorageService.getPlaylists();
    setPlaylists(updated);
    setActivePlaylistId(newPlaylist.id);
    StorageService.setActivePlaylistId(newPlaylist.id);
    reloadContent(newPlaylist.id);
    setIsAddPlaylistOpen(false);
    setCurrentTab('home');
  };

  // Refresh Playlist Content
  const handleRefreshPlaylist = async (playlist: Playlist) => {
    setRefreshingPlaylistId(playlist.id);

    try {
      if (playlist.type === 'xtream' && playlist.serverUrl && playlist.username && playlist.password) {
        const client = new XtreamClient({
          serverUrl: playlist.serverUrl,
          username: playlist.username,
          password: playlist.password
        });

        const liveRes = await client.getLiveContent(playlist.id);
        const vodRes = await client.getVodContent(playlist.id);
        const seriesRes = await client.getSeriesContent(playlist.id);

        await StorageService.saveContentCache(playlist.id, {
          channels: liveRes.channels,
          movies: vodRes.movies,
          series: seriesRes.series
        });

        playlist.stats = {
          liveCount: liveRes.channels.length,
          movieCount: vodRes.movies.length,
          seriesCount: seriesRes.series.length
        };
        playlist.lastUpdated = new Date().toISOString();
        StorageService.savePlaylist(playlist);
      } else if (playlist.type === 'm3u' && playlist.url) {
        let rawM3U = '';
        try {
          const proxyUrl = `/api/proxy?url=${encodeURIComponent(playlist.url)}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          rawM3U = await res.text();
        } catch {
          const directRes = await fetch(playlist.url);
          rawM3U = await directRes.text();
        }

        const parsed = parseM3U(rawM3U, playlist.id);
        await StorageService.saveContentCache(playlist.id, {
          channels: parsed.channels,
          movies: parsed.movies,
          series: parsed.series
        });

        playlist.stats = {
          liveCount: parsed.channels.length,
          movieCount: parsed.movies.length,
          seriesCount: parsed.series.length
        };
        playlist.lastUpdated = new Date().toISOString();
        StorageService.savePlaylist(playlist);
      }

      setPlaylists(StorageService.getPlaylists());
      if (playlist.id === activePlaylistId) {
        await reloadContent(playlist.id);
      }
      showToast('Lista atualizada com sucesso!', 'success');
    } catch (err: any) {
      showToast(`Não foi possível atualizar a lista: ${err.message || 'Erro de conexão'}`, 'error');
    } finally {
      setRefreshingPlaylistId(null);
    }
  };

  // Rename playlist
  const handleRenamePlaylist = (id: string, newName: string) => {
    try {
      StorageService.renamePlaylist(id, newName);
      setPlaylists(StorageService.getPlaylists());
      showToast('Lista renomeada com sucesso!', 'success');
    } catch {
      showToast('Erro ao renomear lista.', 'error');
    }
  };

  // Delete playlist
  const handleDeletePlaylist = async (id: string) => {
    try {
      await StorageService.deletePlaylist(id);
      const updated = StorageService.getPlaylists();
      setPlaylists(updated);
      if (activePlaylistId === id) {
        if (updated.length > 0) {
          setActivePlaylistId(updated[0].id);
          StorageService.setActivePlaylistId(updated[0].id);
          await reloadContent(updated[0].id);
        } else {
          setActivePlaylistId('');
          await reloadContent('');
        }
      }
      showToast('Lista removida com sucesso.', 'info');
    } catch {
      showToast('Erro ao remover lista.', 'error');
    }
  };

  // Clear Cache
  const handleClearCache = async () => {
    try {
      await StorageService.clearAllCache();
      if (activePlaylistId) {
        await reloadContent(activePlaylistId);
      }
      showToast('Cache de conteúdos limpo com sucesso!', 'success');
    } catch {
      showToast('Erro ao limpar cache.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-neutral-100 flex flex-col selection:bg-orange-500 selection:text-white font-['Outfit',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          id="app-toast-notification"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-top-2 duration-200 text-xs font-medium max-w-sm ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="flex-1">{toastMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="p-1 hover:opacity-75 text-neutral-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        playlists={playlists}
        activePlaylist={activePlaylist}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={handleSelectPlaylist}
        onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenPlaylists={() => setCurrentTab('playlists')}
        onOpenAndroidSource={() => setIsAndroidModalOpen(true)}
        onRefreshActivePlaylist={() => activePlaylist && handleRefreshPlaylist(activePlaylist)}
        isRefreshing={!!refreshingPlaylistId}
      />

      {/* Main Screen Views */}
      <main className="flex-1 w-full">
        {currentTab === 'home' && (
          <HomeScreen
            activePlaylist={activePlaylist}
            history={history}
            favorites={favorites}
            channels={channels}
            movies={movies}
            series={series}
            onPlayChannel={handlePlayChannel}
            onSelectMovie={setSelectedMovie}
            onSelectSeries={setSelectedSeries}
            onPlayHistoryItem={handlePlayHistory}
            onRemoveHistoryItem={handleRemoveHistory}
            onNavigateTab={setCurrentTab}
            onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
          />
        )}

        {currentTab === 'live' && (
          <LiveTvScreen
            channels={channels}
            onPlayChannel={handlePlayChannel}
            onToggleFavorite={(c) => handleToggleFavorite(c, 'live')}
            isFavorite={isFavorite}
            onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
          />
        )}

        {currentTab === 'movies' && (
          <MoviesScreen
            movies={movies}
            onSelectMovie={setSelectedMovie}
            onToggleFavorite={(m) => handleToggleFavorite(m, 'movie')}
            isFavorite={isFavorite}
            onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
          />
        )}

        {currentTab === 'series' && (
          <SeriesScreen
            series={series}
            onSelectSeries={setSelectedSeries}
            onToggleFavorite={(s) => handleToggleFavorite(s, 'series')}
            isFavorite={isFavorite}
            onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
          />
        )}

        {currentTab === 'favorites' && (
          <FavoritesScreen
            favorites={favorites}
            channels={channels}
            movies={movies}
            series={series}
            onPlayChannel={handlePlayChannel}
            onSelectMovie={setSelectedMovie}
            onSelectSeries={setSelectedSeries}
            onRemoveFavorite={(fav) => {
              const updated = StorageService.toggleFavorite(fav);
              setFavorites(updated);
            }}
            onNavigateHome={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'playlists' && (
          <PlaylistsScreen
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onSelectPlaylist={handleSelectPlaylist}
            onOpenAddPlaylist={() => setIsAddPlaylistOpen(true)}
            onRefreshPlaylist={handleRefreshPlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onRenamePlaylist={handleRenamePlaylist}
            refreshingId={refreshingPlaylistId}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsScreen
            onNavigatePlaylists={() => setCurrentTab('playlists')}
            onRefreshAll={async () => {
              for (const p of playlists) {
                await handleRefreshPlaylist(p);
              }
            }}
            onClearCache={handleClearCache}
            onOpenAndroidSource={() => setIsAndroidModalOpen(true)}
          />
        )}
      </main>

      {/* Bottom Navigation for Mobile & Handheld Android */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        favoriteCount={favorites.length}
      />

      {/* Modals & Dialogs */}
      {isAddPlaylistOpen && (
        <AddPlaylistScreen
          onSuccess={handlePlaylistAdded}
          onCancel={() => setIsAddPlaylistOpen(false)}
        />
      )}

      {isSearchOpen && (
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          channels={channels}
          movies={movies}
          series={series}
          onPlayChannel={handlePlayChannel}
          onSelectMovie={setSelectedMovie}
          onSelectSeries={setSelectedSeries}
        />
      )}

      {selectedMovie && (
        <MovieDetailsModal
          movie={selectedMovie}
          isFavorite={isFavorite(selectedMovie.id)}
          onClose={() => setSelectedMovie(null)}
          onPlay={handlePlayMovie}
          onToggleFavorite={(m) => handleToggleFavorite(m, 'movie')}
        />
      )}

      {selectedSeries && (
        <SeriesDetailsModal
          series={selectedSeries}
          localSeries={series}
          isFavorite={isFavorite(selectedSeries.id)}
          onClose={() => setSelectedSeries(null)}
          onPlayEpisode={handlePlayEpisode}
          onToggleFavorite={(s) => handleToggleFavorite(s, 'series')}
          playlists={playlists}
          onUpdateSeries={handleUpdateSeries}
        />
      )}

      {playbackDialog.isOpen && (
        <InternalPlayer
          options={{
            title: playbackDialog.title,
            streamUrl: playbackDialog.streamUrl,
            posterUrl: playbackDialog.posterUrl,
            category: playbackDialog.category,
            type: playbackDialog.type === 'other' ? 'live' : playbackDialog.type,
            seriesName: playbackDialog.seriesName,
            seasonEpisode: playbackDialog.seasonEpisode
          }}
          onClose={() => setPlaybackDialog(prev => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* Android Kotlin & Jetpack Compose Native Source Modal */}
      <AndroidSourceModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />
    </div>
  );
}
