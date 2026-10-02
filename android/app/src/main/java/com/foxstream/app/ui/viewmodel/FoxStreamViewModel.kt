package com.foxstream.app.ui.viewmodel

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.api.XtreamApiClient
import com.foxstream.app.data.api.OmdbApiClient
import com.foxstream.app.data.api.TmdbApiClient
import com.foxstream.app.util.SearchUtils
import com.foxstream.app.data.local.AppDatabase
import com.foxstream.app.data.model.*
import com.foxstream.app.data.parser.M3UParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL
import android.util.Log
import java.util.Locale

// Helper for Quadruple result
data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

// Helper to normalize strings for search
fun String.normalize(): String = SearchUtils.normalize(this)

class FoxStreamViewModel(application: Application) : AndroidViewModel(application) {
    private val db = AppDatabase.getDatabase(application)
    
    // UI state collections
    val playlists = mutableStateListOf<Playlist>()
    var activePlaylistId by mutableStateOf<String?>(null)
        private set
    
    val channels = mutableStateListOf<LiveChannel>()
    val movies = mutableStateListOf<MovieItem>()
    val seriesList = mutableStateListOf<SeriesItem>()
    val favorites = mutableStateListOf<FavoriteItem>()
    val history = mutableStateListOf<HistoryItem>()
    val continueWatching = mutableStateListOf<HistoryItem>()
    
    // In-memory metadata cache for series details to avoid repeated network calls
    private val seriesMetadataCache = java.util.concurrent.ConcurrentHashMap<String, SeriesItem>()

    // Global search states
    var searchQuery by mutableStateOf("")
        private set
    val searchChannels = mutableStateListOf<LiveChannel>()
    val searchMovies = mutableStateListOf<MovieItem>()
    val searchSeries = mutableStateListOf<SeriesItem>()
    val searchEpisodes = mutableStateListOf<Pair<SeriesItem, EpisodeItem>>()
    var isSearching by mutableStateOf(false)
        private set
    private var searchJob: Job? = null

    var isLoading by mutableStateOf(false)
        private set
    
    var errorMessage by mutableStateOf<String?>(null)
        private set

    val featuredBannerItems = mutableStateListOf<HeroBannerItem>()

    init {
        loadInitialData()
    }

    private fun loadInitialData() {
        viewModelScope.launch {
            // Load playlists
            val allPlaylists = withContext(Dispatchers.IO) {
                db.playlistDao().getAllPlaylists()
            }
            playlists.clear()
            playlists.addAll(allPlaylists)

            // Load favorites
            val allFavs = withContext(Dispatchers.IO) {
                db.favoriteDao().getAllFavorites()
            }
            favorites.clear()
            favorites.addAll(allFavs)

            // Clean up and load history
            val allHist = withContext(Dispatchers.IO) {
                val rawHistory = db.historyDao().getAllHistory()
                val corruptItems = rawHistory.filter { it.streamUrl.contains("***") }
                for (item in corruptItems) {
                    db.historyDao().deleteHistoryById(item.id)
                    db.historyDao().deleteHistoryByStreamUrl(item.streamUrl)
                }
                db.historyDao().getAllHistory()
            }
            val contWatching = withContext(Dispatchers.IO) {
                db.historyDao().getContinueWatchingHistory()
            }
            history.clear()
            history.addAll(allHist)
            continueWatching.clear()
            continueWatching.addAll(contWatching)

            // Auto-select first playlist if available
            if (playlists.isNotEmpty()) {
                selectPlaylist(playlists.first().id)
            }
        }
    }

    fun selectPlaylist(playlistId: String) {
        activePlaylistId = playlistId
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val pChannels = withContext(Dispatchers.IO) {
                    db.liveChannelDao().getChannelsForPlaylist(playlistId)
                }
                val pMovies = withContext(Dispatchers.IO) {
                    db.movieDao().getMoviesForPlaylist(playlistId)
                }
                val pSeries = withContext(Dispatchers.IO) {
                    db.seriesDao().getSeriesForPlaylist(playlistId)
                }

                channels.clear()
                channels.addAll(pChannels)

                movies.clear()
                movies.addAll(pMovies)

                seriesList.clear()
                seriesList.addAll(pSeries)

                // Refresh featured banners using TMDB matching or cached/playlist fallback
                refreshFeaturedBanners(playlistId, pMovies, pSeries)
            } catch (e: Exception) {
                errorMessage = "Erro ao carregar conteúdo da lista: ${e.localizedMessage}"
            } finally {
                isLoading = false
            }
        }
    }

    private fun isMatch(
        localName: String,
        localYear: String?,
        tmdbTitle: String,
        tmdbOrigTitle: String?,
        tmdbYear: String?
    ): Boolean {
        val localNorm = SearchUtils.normalize(localName)
        val tmdbNorm = SearchUtils.normalize(tmdbTitle)
        val tmdbOrigNorm = tmdbOrigTitle?.let { SearchUtils.normalize(it) } ?: ""

        val titleMatches = localNorm.contains(tmdbNorm) || tmdbNorm.contains(localNorm) ||
                (tmdbOrigNorm.isNotBlank() && (localNorm.contains(tmdbOrigNorm) || tmdbOrigNorm.contains(localNorm)))

        if (!titleMatches) return false

        // Year check: allow +/- 1 year if both are present
        if (!localYear.isNullOrBlank() && !tmdbYear.isNullOrBlank()) {
            val ly = localYear.toIntOrNull()
            val ty = tmdbYear.toIntOrNull()
            if (ly != null && ty != null) {
                return Math.abs(ly - ty) <= 1
            }
        }
        return true
    }

    fun refreshFeaturedBanners(
        playlistId: String = activePlaylistId ?: "",
        currentMovies: List<MovieItem> = movies.toList(),
        currentSeries: List<SeriesItem> = seriesList.toList(),
        forceRefresh: Boolean = false
    ) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    val trendingMovies = TmdbApiClient.getTrendingMovies()
                    val trendingTv = TmdbApiClient.getTrendingTv()
                    val matchedBanners = mutableListOf<HeroBannerItem>()

                    // Match movies
                    for (tmdbMovie in trendingMovies.take(12)) {
                        val matchedMovie = currentMovies.find { m ->
                            isMatch(
                                localName = m.name,
                                localYear = m.year,
                                tmdbTitle = tmdbMovie.title ?: "",
                                tmdbOrigTitle = tmdbMovie.originalTitle,
                                tmdbYear = tmdbMovie.year
                            )
                        }

                        if (matchedMovie != null) {
                            val badge = listOfNotNull(
                                "FILME",
                                tmdbMovie.year ?: matchedMovie.year,
                                tmdbMovie.rating?.let { "★ $it" } ?: matchedMovie.rating?.let { "★ $it" },
                                matchedMovie.category.takeIf { it.isNotBlank() && it != "Filmes" }
                            ).joinToString(" • ")

                            matchedBanners.add(
                                HeroBannerItem(
                                    id = "movie_${matchedMovie.id}",
                                    title = matchedMovie.name,
                                    imageUrl = tmdbMovie.backdrop ?: tmdbMovie.poster ?: matchedMovie.backdropUrl ?: matchedMovie.posterUrl ?: "",
                                    category = matchedMovie.category,
                                    type = ContentType.MOVIE,
                                    streamUrl = matchedMovie.streamUrl,
                                    badgeInfo = badge,
                                    overview = tmdbMovie.plot ?: matchedMovie.description,
                                    year = tmdbMovie.year ?: matchedMovie.year,
                                    movieItem = matchedMovie
                                )
                            )
                        }
                    }

                    // Match series
                    for (tmdbTv in trendingTv.take(12)) {
                        val matchedS = currentSeries.find { s ->
                            isMatch(
                                localName = s.name,
                                localYear = s.year,
                                tmdbTitle = tmdbTv.title ?: "",
                                tmdbOrigTitle = tmdbTv.originalTitle,
                                tmdbYear = tmdbTv.year
                            )
                        }

                        if (matchedS != null) {
                            val firstEpUrl = matchedS.seasons.firstOrNull()?.episodes?.firstOrNull()?.streamUrl ?: ""
                            val badge = listOfNotNull(
                                "SÉRIE",
                                tmdbTv.year ?: matchedS.year,
                                tmdbTv.rating?.let { "★ $it" } ?: matchedS.rating?.let { "★ $it" },
                                matchedS.category.takeIf { it.isNotBlank() && it != "Séries" }
                            ).joinToString(" • ")

                            matchedBanners.add(
                                HeroBannerItem(
                                    id = "series_${matchedS.id}",
                                    title = matchedS.name,
                                    imageUrl = tmdbTv.backdrop ?: tmdbTv.poster ?: matchedS.posterUrl ?: "",
                                    category = matchedS.category,
                                    type = ContentType.SERIES,
                                    streamUrl = firstEpUrl,
                                    badgeInfo = badge,
                                    overview = tmdbTv.plot ?: matchedS.description,
                                    year = tmdbTv.year ?: matchedS.year,
                                    seriesItem = matchedS
                                )
                            )
                        }
                    }

                    if (matchedBanners.isNotEmpty()) {
                        // Sort or interleave to make it look perfectly mixed
                        val combined = matchedBanners.distinctBy { it.id }.shuffled().take(8)
                        withContext(Dispatchers.Main) {
                            featuredBannerItems.clear()
                            featuredBannerItems.addAll(combined)
                        }
                        return@withContext
                    }
                } catch (e: Exception) {
                    Log.e("FoxStreamViewModel", "Error crossing TMDB trending with local list: ${e.message}", e)
                }

                // Fallback Garantido
                val fallbackBanners = buildLocalFallbackBanners(currentMovies, currentSeries)
                withContext(Dispatchers.Main) {
                    featuredBannerItems.clear()
                    featuredBannerItems.addAll(fallbackBanners)
                }
            }
        }
    }

    private fun buildLocalFallbackBanners(
        currentMovies: List<MovieItem>,
        currentSeries: List<SeriesItem>
    ): List<HeroBannerItem> {
        val list = mutableListOf<HeroBannerItem>()
        currentMovies.filter { !it.posterUrl.isNullOrBlank() }.take(5).forEach { m ->
            val badge = listOfNotNull(
                "FILME",
                m.year,
                m.rating?.let { "★ $it" },
                m.category.takeIf { it.isNotBlank() && it != "Filmes" }
            ).joinToString(" • ")
            list.add(
                HeroBannerItem(
                    id = "movie_${m.id}",
                    title = m.name,
                    imageUrl = m.posterUrl!!,
                    category = m.category,
                    type = ContentType.MOVIE,
                    streamUrl = m.streamUrl,
                    badgeInfo = badge,
                    overview = m.description,
                    year = m.year,
                    movieItem = m
                )
            )
        }

        currentSeries.filter { !it.posterUrl.isNullOrBlank() }.take(4).forEach { s ->
            val firstEpUrl = s.seasons.firstOrNull()?.episodes?.firstOrNull()?.streamUrl ?: ""
            val badge = listOfNotNull(
                "SÉRIE",
                s.year,
                s.rating?.let { "★ $it" },
                s.category.takeIf { it.isNotBlank() && it != "Séries" }
            ).joinToString(" • ")
            list.add(
                HeroBannerItem(
                    id = "series_${s.id}",
                    title = s.name,
                    imageUrl = s.posterUrl!!,
                    category = s.category,
                    type = ContentType.SERIES,
                    streamUrl = firstEpUrl,
                    badgeInfo = badge,
                    overview = s.description,
                    year = s.year,
                    seriesItem = s
                )
            )
        }
        return list
    }

    fun addM3UPlaylist(name: String, m3uUrl: String, onComplete: () -> Unit) {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val playlistId = "pl_${System.currentTimeMillis()}"
                
                // 1. Download and Parse in background
                val parseResult = withContext(Dispatchers.IO) {
                    val url = URL(m3uUrl)
                    val conn = url.openConnection() as? java.net.HttpURLConnection 
                        ?: throw java.io.IOException("URL inválida")
                    conn.connectTimeout = 30000
                    conn.readTimeout = 30000
                    conn.instanceFollowRedirects = true
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                    
                    val responseCode = conn.responseCode
                    val stream = if (responseCode in 200..299) {
                        conn.inputStream
                    } else {
                        throw java.io.IOException("Erro HTTP: $responseCode")
                    }

                    stream.use { s ->
                        M3UParser.parse(s, playlistId)
                    }
                }

                // 2. Save items to Room DB
                withContext(Dispatchers.IO) {
                    val playlist = Playlist(
                        id = playlistId,
                        name = name.ifBlank { "Lista M3U" },
                        type = PlaylistType.M3U,
                        url = m3uUrl,
                        liveCount = parseResult.channels.size,
                        movieCount = parseResult.movies.size,
                        seriesCount = parseResult.series.size
                    )
                    db.playlistDao().insertPlaylist(playlist)
                    parseResult.channels.chunked(500).forEach { chunk ->
                        db.liveChannelDao().insertChannels(chunk)
                    }
                    parseResult.movies.chunked(500).forEach { chunk ->
                        db.movieDao().insertMovies(chunk)
                    }
                    parseResult.series.chunked(500).forEach { chunk ->
                        db.seriesDao().insertSeries(chunk)
                    }
                }

                // 3. Refresh lists
                refreshPlaylists()
                selectPlaylist(playlistId)
                onComplete()
            } catch (t: Throwable) {
                android.util.Log.e("FoxStreamViewModel", "Error importing M3U", t)
                val msg = t.localizedMessage ?: t.message ?: t.javaClass.simpleName
                errorMessage = "Erro ao importar M3U: $msg"
            } finally {
                isLoading = false
            }
        }
    }

    fun addXtreamPlaylist(name: String, serverUrl: String, user: String, pass: String, onComplete: () -> Unit) {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                val playlistId = "pl_${System.currentTimeMillis()}"
                val client = XtreamApiClient(serverUrl, user, pass)
                
                // Test connection first
                val authResult = client.testConnection()
                if (!authResult.success) {
                    errorMessage = authResult.message
                    return@launch
                }

                // Fetch data in background
                val (allChannels, allMovies, allSeries) = withContext(Dispatchers.IO) {
                    // Fetch categories first
                    val liveCats = client.getLiveCategories().associate { it.id to it.name }
                    val vodCats = client.getVodCategories().associate { it.id to it.name }
                    val seriesCats = client.getSeriesCategories().associate { it.id to it.name }

                    // Fetch actual streams
                    val chs = client.getLiveStreams(playlistId, liveCats)
                    val mvs = client.getVodStreams(playlistId, vodCats)
                    val srs = client.getSeries(playlistId, seriesCats)

                    Triple(chs, mvs, srs)
                }

                // Save to Room DB
                withContext(Dispatchers.IO) {
                    val playlist = Playlist(
                        id = playlistId,
                        name = name.ifBlank { "Lista Xtream" },
                        type = PlaylistType.XTREAM,
                        serverUrl = serverUrl,
                        username = user,
                        password = pass,
                        liveCount = allChannels.size,
                        movieCount = allMovies.size,
                        seriesCount = allSeries.size
                    )
                    db.playlistDao().insertPlaylist(playlist)
                    db.liveChannelDao().insertChannels(allChannels)
                    db.movieDao().insertMovies(allMovies)
                    db.seriesDao().insertSeries(allSeries)
                }

                // Refresh UI
                refreshPlaylists()
                selectPlaylist(playlistId)
                onComplete()
            } catch (e: Exception) {
                errorMessage = "Erro ao importar Xtream: ${e.localizedMessage ?: "Erro de conexão"}"
            } finally {
                isLoading = false
            }
        }
    }

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            isLoading = true
            try {
                withContext(Dispatchers.IO) {
                    // Delete playlist and cascade delete child items
                    db.playlistDao().deletePlaylistById(playlistId)
                    db.liveChannelDao().deleteChannelsForPlaylist(playlistId)
                    db.movieDao().deleteMoviesForPlaylist(playlistId)
                    db.seriesDao().deleteSeriesForPlaylist(playlistId)
                }
                
                refreshPlaylists()
                
                if (activePlaylistId == playlistId) {
                    if (playlists.isNotEmpty()) {
                        selectPlaylist(playlists.first().id)
                    } else {
                        activePlaylistId = null
                        channels.clear()
                        movies.clear()
                        seriesList.clear()
                    }
                }
            } catch (e: Exception) {
                errorMessage = "Erro ao deletar playlist: ${e.localizedMessage}"
            } finally {
                isLoading = false
            }
        }
    }

    fun toggleFavoriteChannel(channel: LiveChannel) {
        viewModelScope.launch {
            val existing = withContext(Dispatchers.IO) {
                db.favoriteDao().getFavoriteByContentId(channel.id)
            }
            withContext(Dispatchers.IO) {
                if (existing != null) {
                    db.favoriteDao().deleteFavoriteByContentId(channel.id)
                } else {
                    val fav = FavoriteItem(
                        id = "fav_${channel.id}",
                        contentId = channel.id,
                        type = ContentType.LIVE,
                        title = channel.name,
                        category = channel.category,
                        streamUrl = channel.streamUrl,
                        posterUrl = channel.logoUrl
                    )
                    db.favoriteDao().insertFavorite(fav)
                }
            }
            refreshFavorites()
        }
    }

    fun toggleFavoriteMovie(movie: MovieItem) {
        viewModelScope.launch {
            val existing = withContext(Dispatchers.IO) {
                db.favoriteDao().getFavoriteByContentId(movie.id)
            }
            withContext(Dispatchers.IO) {
                if (existing != null) {
                    db.favoriteDao().deleteFavoriteByContentId(movie.id)
                } else {
                    val fav = FavoriteItem(
                        id = "fav_${movie.id}",
                        contentId = movie.id,
                        type = ContentType.MOVIE,
                        title = movie.name,
                        category = movie.category,
                        streamUrl = movie.streamUrl,
                        posterUrl = movie.posterUrl
                    )
                    db.favoriteDao().insertFavorite(fav)
                }
            }
            refreshFavorites()
        }
    }

    fun removeFavorite(favorite: FavoriteItem) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                db.favoriteDao().deleteFavoriteByContentId(favorite.contentId)
            }
            refreshFavorites()
        }
    }

    fun addPlaybackToHistory(streamUrl: String, title: String, type: ContentType, posterUrl: String? = null, category: String? = null) {
        if (streamUrl.contains("***")) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val existing = db.historyDao().getHistoryByStreamUrl(streamUrl)
                val playbackPos = existing?.playbackPosition ?: 0L
                val dur = existing?.duration ?: 0L
                val watched = existing?.isWatched ?: false

                val hist = HistoryItem(
                    id = existing?.id ?: "hist_${System.currentTimeMillis()}",
                    contentId = streamUrl,
                    title = title,
                    type = type,
                    streamUrl = streamUrl,
                    posterUrl = posterUrl ?: existing?.posterUrl,
                    category = category ?: existing?.category,
                    playedAt = System.currentTimeMillis(),
                    playbackPosition = if (type == ContentType.LIVE) 0L else playbackPos,
                    duration = if (type == ContentType.LIVE) 0L else dur,
                    isWatched = watched
                )
                db.historyDao().deleteHistoryByStreamUrl(streamUrl)
                db.historyDao().insertHistory(hist)
            }
            refreshHistory()
        }
    }

    fun updatePlaybackProgress(streamUrl: String, position: Long, duration: Long) {
        // Regra dos Créditos: 95% da duração ou menos de 3 minutos (180.000 ms) restantes para vídeos > 3 min
        if (duration > 0L) {
            val isCredits = (position >= duration * 0.95f) || (duration > 180_000L && (duration - position) <= 180_000L)
            if (isCredits) {
                markAsWatched(streamUrl, duration)
                return
            }
        }
        viewModelScope.launch(Dispatchers.IO) {
            val existing = db.historyDao().getHistoryByStreamUrl(streamUrl)
            if (existing != null) {
                val updated = existing.copy(
                    playbackPosition = position,
                    duration = duration,
                    isWatched = false,
                    playedAt = System.currentTimeMillis()
                )
                db.historyDao().insertHistory(updated)
                withContext(Dispatchers.Main) {
                    refreshHistory()
                }
            }
        }
    }

    fun markAsWatched(streamUrl: String, duration: Long = 0L) {
        viewModelScope.launch(Dispatchers.IO) {
            val existing = db.historyDao().getHistoryByStreamUrl(streamUrl)
            val totalDur = if (duration > 0L) duration else (existing?.duration ?: 0L)
            if (existing != null) {
                val updated = existing.copy(
                    isWatched = true,
                    playbackPosition = totalDur,
                    duration = totalDur,
                    playedAt = System.currentTimeMillis()
                )
                db.historyDao().insertHistory(updated)
            } else {
                val newHist = HistoryItem(
                    contentId = streamUrl,
                    title = "",
                    type = ContentType.SERIES,
                    streamUrl = streamUrl,
                    playbackPosition = totalDur,
                    duration = totalDur,
                    isWatched = true,
                    playedAt = System.currentTimeMillis()
                )
                db.historyDao().insertHistory(newHist)
            }
            withContext(Dispatchers.Main) {
                refreshHistory()
            }
        }
    }

    fun removeHistoryByStreamUrl(streamUrl: String) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                db.historyDao().deleteHistoryByStreamUrl(streamUrl)
            }
            refreshHistory()
        }
    }

    fun removeHistoryItem(item: HistoryItem) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                db.historyDao().deleteHistoryById(item.id)
                db.historyDao().deleteHistoryByStreamUrl(item.streamUrl)
            }
            refreshHistory()
        }
    }

    fun renamePlaylist(playlistId: String, newName: String) {
        viewModelScope.launch {
            if (newName.isBlank()) return@launch
            withContext(Dispatchers.IO) {
                val playlist = db.playlistDao().getPlaylistById(playlistId)
                if (playlist != null) {
                    val updated = playlist.copy(name = newName)
                    db.playlistDao().insertPlaylist(updated)
                }
            }
            refreshPlaylists()
        }
    }

    fun updatePlaylist(playlistId: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            val playlist = withContext(Dispatchers.IO) {
                db.playlistDao().getPlaylistById(playlistId)
            } ?: return@launch
            
            isLoading = true
            errorMessage = null
            try {
                if (playlist.type == PlaylistType.M3U) {
                    val m3uUrl = playlist.url ?: throw Exception("URL vazia para esta playlist")
                    val parseResult = withContext(Dispatchers.IO) {
                        val conn = URL(m3uUrl).openConnection().apply {
                            connectTimeout = 30000
                            readTimeout = 30000
                            setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")
                        }
                        conn.getInputStream().use { stream ->
                            M3UParser.parse(stream, playlistId)
                        }
                    }
                    
                    withContext(Dispatchers.IO) {
                        db.liveChannelDao().deleteChannelsForPlaylist(playlistId)
                        db.movieDao().deleteMoviesForPlaylist(playlistId)
                        db.seriesDao().deleteSeriesForPlaylist(playlistId)
                        
                        parseResult.channels.chunked(500).forEach { chunk ->
                            db.liveChannelDao().insertChannels(chunk)
                        }
                        parseResult.movies.chunked(500).forEach { chunk ->
                            db.movieDao().insertMovies(chunk)
                        }
                        parseResult.series.chunked(500).forEach { chunk ->
                            db.seriesDao().insertSeries(chunk)
                        }
                        
                        val updated = playlist.copy(
                            liveCount = parseResult.channels.size,
                            movieCount = parseResult.movies.size,
                            seriesCount = parseResult.series.size,
                            lastUpdated = System.currentTimeMillis()
                        )
                        db.playlistDao().insertPlaylist(updated)
                    }
                } else {
                    val serverUrl = playlist.serverUrl ?: throw Exception("URL do servidor vazia")
                    val user = playlist.username ?: ""
                    val pass = playlist.password ?: ""
                    
                    val client = XtreamApiClient(serverUrl, user, pass)
                    val authResult = client.testConnection()
                    if (!authResult.success) {
                        throw Exception(authResult.message)
                    }
                    
                    val (allChannels, allMovies, allSeries) = withContext(Dispatchers.IO) {
                        val liveCats = client.getLiveCategories().associate { it.id to it.name }
                        val vodCats = client.getVodCategories().associate { it.id to it.name }
                        val seriesCats = client.getSeriesCategories().associate { it.id to it.name }
                        
                        val chs = client.getLiveStreams(playlistId, liveCats)
                        val mvs = client.getVodStreams(playlistId, vodCats)
                        val srs = client.getSeries(playlistId, seriesCats)
                        
                        Triple(chs, mvs, srs)
                    }
                    
                    withContext(Dispatchers.IO) {
                        db.liveChannelDao().deleteChannelsForPlaylist(playlistId)
                        db.movieDao().deleteMoviesForPlaylist(playlistId)
                        db.seriesDao().deleteSeriesForPlaylist(playlistId)
                        
                        db.liveChannelDao().insertChannels(allChannels)
                        db.movieDao().insertMovies(allMovies)
                        db.seriesDao().insertSeries(allSeries)
                        
                        val updated = playlist.copy(
                            liveCount = allChannels.size,
                            movieCount = allMovies.size,
                            seriesCount = allSeries.size,
                            lastUpdated = System.currentTimeMillis()
                        )
                        db.playlistDao().insertPlaylist(updated)
                    }
                }
                
                refreshPlaylists()
                if (activePlaylistId == playlistId) {
                    selectPlaylist(playlistId)
                }
                onComplete()
            } catch (t: Throwable) {
                android.util.Log.e("FoxStreamViewModel", "Error updating playlist", t)
                val msg = t.localizedMessage ?: t.message ?: t.javaClass.simpleName
                errorMessage = "Erro ao atualizar playlist: $msg"
            } finally {
                isLoading = false
            }
        }
    }

    fun updateAllPlaylists() {
        viewModelScope.launch {
            val all = withContext(Dispatchers.IO) {
                db.playlistDao().getAllPlaylists()
            }
            for (p in all) {
                updatePlaylist(p.id)
            }
        }
    }

    fun onSearchQueryChanged(query: String) {
        searchQuery = query
        searchJob?.cancel()
        if (query.isBlank()) {
            searchChannels.clear()
            searchMovies.clear()
            searchSeries.clear()
            searchEpisodes.clear()
            isSearching = false
            return
        }

        searchJob = viewModelScope.launch {
            isSearching = true
            delay(300)
            
            val tokens = SearchUtils.extractTokens(query)
            if (tokens.isEmpty()) {
                searchChannels.clear()
                searchMovies.clear()
                searchSeries.clear()
                searchEpisodes.clear()
                isSearching = false
                return@launch
            }
            
            val (filteredChannels, filteredMovies, filteredSeries, filteredEpisodes) = withContext(Dispatchers.Default) {
                val chs = channels.filter {
                    SearchUtils.matchesAnyField(tokens, it.name, it.category)
                }
                val mvs = movies.filter {
                    SearchUtils.matchesAnyField(tokens, it.name, it.category)
                }
                val srs = seriesList.filter {
                    SearchUtils.matchesAnyField(tokens, it.name, it.category)
                }
                val eps = mutableListOf<Pair<SeriesItem, EpisodeItem>>()
                for (series in seriesList) {
                    for (season in series.seasons) {
                        for (ep in season.episodes) {
                            if (SearchUtils.matchesAnyField(tokens, ep.title, series.name)) {
                                eps.add(series to ep)
                            }
                        }
                    }
                }
                
                Quadruple(chs.take(100), mvs.take(100), srs.take(100), eps.take(100))
            }

            searchChannels.clear()
            searchChannels.addAll(filteredChannels)

            searchMovies.clear()
            searchMovies.addAll(filteredMovies)

            searchSeries.clear()
            searchSeries.addAll(filteredSeries)

            searchEpisodes.clear()
            searchEpisodes.addAll(filteredEpisodes)
            
            isSearching = false
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                // Deleting history rows
                val allHist = db.historyDao().getAllHistory()
                for (item in allHist) {
                    db.historyDao().deleteHistoryById(item.id)
                }
            }
            refreshHistory()
        }
    }

    fun clearLocalCache() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                // Clears channels, movies, and series list for active playlist
                activePlaylistId?.let { id ->
                    db.liveChannelDao().deleteChannelsForPlaylist(id)
                    db.movieDao().deleteMoviesForPlaylist(id)
                    db.seriesDao().deleteSeriesForPlaylist(id)
                }
            }
            activePlaylistId?.let { selectPlaylist(it) }
        }
    }

    private fun sanitizeSeriesName(name: String): String {
        var clean = name
        // Remove bracketed or parenthesized tags (e.g., [DUBLADO], (720P))
        clean = Regex("""[\[\(].*?[\]\)]""").replace(clean, "")
        // Remove resolution, audio, format tags
        val tags = listOf(
            "dublado", "legendado", "dub", "leg", "dual", "audio", "nacional", "multi",
            "1080p", "720p", "480p", "4k", "uhd", "fhd", "hd", "sd", "hevc", "h264", "h265",
            "web-dl", "webrip", "bluray", "fhd", "tv", "redecanais"
        )
        for (tag in tags) {
            clean = Regex("\\b$tag\\b", RegexOption.IGNORE_CASE).replace(clean, " ")
        }
        // Remove extra dashes or hyphens
        clean = clean.replace(Regex("\\s-\\s"), " ")
        // Clean up extra spaces
        clean = Regex("\\s+").replace(clean, " ").trim()
        return if (clean.isBlank()) name else clean
    }

    fun getSeriesDetailsOnDemand(series: SeriesItem, onLoaded: (List<SeasonItem>) -> Unit) {
        val playlistId = series.playlistId

        // 1. Check in-memory metadata cache first for instant retrieval!
        val cachedSeries = seriesMetadataCache[series.id]
        if (cachedSeries != null) {
            viewModelScope.launch {
                // Instantly notify seasons/episodes from cache if available
                if (cachedSeries.seasons.isNotEmpty()) {
                    onLoaded(cachedSeries.seasons)
                }
            }
        }

        viewModelScope.launch(Dispatchers.IO) {
            // Retrieve playlist config
            val p = db.playlistDao().getPlaylistById(playlistId)

            // Asynchronous job to fetch seasons/episodes from Xtream Codes (if applicable)
            var seasons = series.seasons
            val iptvLoadJob = launch {
                if (p != null && p.type == PlaylistType.XTREAM && p.serverUrl != null && p.username != null && p.password != null) {
                    try {
                        val client = XtreamApiClient(p.serverUrl, p.username, p.password)
                        val fetchedSeasons = client.getSeriesDetails(series.id, series.id)
                        if (fetchedSeasons.isNotEmpty()) {
                            seasons = fetchedSeasons
                        }
                    } catch (e: Exception) {
                        Log.e("FoxStreamViewModel", "Error loading IPTV series episodes: ${e.message}")
                    }
                }
            }

            // Parallel Asynchronous job to fetch TMDb/OMDb metadata
            var updatedSeries = cachedSeries ?: series
            val metadataJob = launch {
                if (cachedSeries == null) {
                    try {
                        val cleanName = sanitizeSeriesName(series.name)
                        var matchedSeries = series

                        // Primary: TMDb (with full PT-BR support and high-resolution backdrop/posters)
                        val tmdb = TmdbApiClient.getSeriesDetails(
                            rawTitle = cleanName,
                            rawYear = series.year,
                            originalTitle = null
                        )
                        if (tmdb != null) {
                            matchedSeries = matchedSeries.copy(
                                posterUrl = tmdb.poster ?: matchedSeries.posterUrl,
                                backdropUrl = tmdb.backdrop ?: matchedSeries.backdropUrl,
                                year = tmdb.year ?: matchedSeries.year,
                                genre = tmdb.genre ?: matchedSeries.genre,
                                rating = tmdb.rating ?: matchedSeries.rating,
                                description = tmdb.plot ?: matchedSeries.description,
                                cast = tmdb.cast ?: matchedSeries.cast
                            )
                        } else {
                            // Secondary: OMDb fallback
                            val omdb = OmdbApiClient.getMovieDetails(
                                rawTitle = cleanName,
                                rawYear = series.year,
                                originalTitle = null,
                                isSeries = true
                            )
                            if (omdb != null) {
                                matchedSeries = matchedSeries.copy(
                                    posterUrl = omdb.poster ?: matchedSeries.posterUrl,
                                    year = omdb.year ?: matchedSeries.year,
                                    genre = omdb.genre ?: matchedSeries.genre,
                                    rating = omdb.imdbRating?.let { "$it/10" } ?: matchedSeries.rating,
                                    description = omdb.plot ?: matchedSeries.description,
                                    cast = omdb.cast ?: matchedSeries.cast,
                                    rated = omdb.rated ?: matchedSeries.rated
                                )
                            }
                        }

                        // Store in cache
                        seriesMetadataCache[series.id] = matchedSeries
                        updatedSeries = matchedSeries
                    } catch (e: Exception) {
                        Log.e("FoxStreamViewModel", "Error loading series metadata: ${e.message}")
                    }
                }
            }

            // Wait for both parallel loading jobs to complete
            iptvLoadJob.join()
            metadataJob.join()

            // Merge metadata and seasons
            val finalSeries = updatedSeries.copy(seasons = seasons)
            seriesMetadataCache[series.id] = finalSeries

            // Persist in Room database
            db.seriesDao().insertSeries(listOf(finalSeries))

            // Update UI state
            withContext(Dispatchers.Main) {
                onLoaded(seasons)
                val pSeries = withContext(Dispatchers.IO) {
                    db.seriesDao().getSeriesForPlaylist(playlistId)
                }
                seriesList.clear()
                seriesList.addAll(pSeries)
            }
        }
    }

    fun getMovieDetailsOnDemand(movie: MovieItem, onLoaded: (MovieItem) -> Unit) {
        val playlistId = movie.playlistId
        viewModelScope.launch {
            var currentUpdated = movie
            var xtreamImdbId: String? = null
            var xtreamOriginalName: String? = null

            val p = withContext(Dispatchers.IO) {
                db.playlistDao().getPlaylistById(playlistId)
            }
            if (p != null && p.type == PlaylistType.XTREAM && p.serverUrl != null && p.username != null && p.password != null) {
                val client = XtreamApiClient(p.serverUrl, p.username, p.password)
                val json = client.getVodDetails(movie.id)
                if (json != null && json.has("info")) {
                    val info = json.getJSONObject("info")
                    xtreamImdbId = info.optString("imdb_id").trim().takeIf { it.isNotBlank() && !it.equals("null", ignoreCase = true) }
                    xtreamOriginalName = if (info.has("o_name")) info.optString("o_name") else info.optString("original_name")
                    if (xtreamOriginalName.isNullOrBlank() || xtreamOriginalName.equals("null", ignoreCase = true)) {
                        xtreamOriginalName = null
                    }

                    val plot = info.optString("plot", info.optString("description", movie.description ?: ""))
                    val rawDirector = info.optString("director", movie.director ?: "")
                    val rawCast = info.optString("cast", movie.cast ?: "")
                    val durationSecs = info.optInt("duration_secs", 0)
                    val rawDuration = if (durationSecs > 0) {
                        "${Math.round(durationSecs.toFloat() / 60)} min"
                    } else {
                        info.optString("duration", movie.duration ?: "")
                    }
                    val genre = info.optString("genre", movie.genre ?: movie.category)
                    val rating = if (info.has("rating_5based")) {
                        "${info.optDouble("rating_5based", 0.0)}/5"
                    } else if (info.has("rating") && !info.isNull("rating")) {
                        "${info.optString("rating")}/10"
                    } else movie.rating
                    var backdrop: String? = null
                    if (info.has("backdrop_path")) {
                        val bArray = info.optJSONArray("backdrop_path")
                        if (bArray != null && bArray.length() > 0) {
                            backdrop = bArray.optString(0)
                        }
                    }

                    // Clean dummy placeholder text like "RedeCanais"
                    val cleanDirector = rawDirector.takeIf { !it.contains("redecanais", ignoreCase = true) && it.isNotBlank() }
                    val cleanCast = rawCast.takeIf { !it.contains("redecanais", ignoreCase = true) && it.isNotBlank() }
                    val cleanDuration = rawDuration.takeIf { !it.contains("redecanais", ignoreCase = true) && it.isNotBlank() }

                    currentUpdated = movie.copy(
                        description = if (plot.isNotBlank()) plot else movie.description,
                        director = cleanDirector ?: movie.director,
                        cast = cleanCast ?: movie.cast,
                        duration = cleanDuration ?: movie.duration,
                        genre = if (genre.isNotBlank()) genre else movie.genre,
                        rating = rating ?: movie.rating,
                        backdropUrl = backdrop ?: movie.backdropUrl
                    )
                }
            }

            // 1. Consultar TMDb (primário, com sinopse em PT-BR, backdrop 1280p, pôster HD, notas e elenco)
            val tmdb = TmdbApiClient.getMovieDetails(
                rawTitle = currentUpdated.name,
                rawYear = currentUpdated.year,
                imdbId = xtreamImdbId,
                originalTitle = xtreamOriginalName
            )
            if (tmdb != null) {
                currentUpdated = currentUpdated.copy(
                    posterUrl = tmdb.poster ?: currentUpdated.posterUrl,
                    backdropUrl = tmdb.backdrop ?: currentUpdated.backdropUrl,
                    year = tmdb.year ?: currentUpdated.year,
                    director = tmdb.director ?: currentUpdated.director,
                    cast = tmdb.cast ?: currentUpdated.cast,
                    duration = tmdb.runtime ?: currentUpdated.duration,
                    genre = tmdb.genre ?: currentUpdated.genre,
                    rating = tmdb.rating ?: currentUpdated.rating,
                    description = tmdb.plot ?: currentUpdated.description
                )
            } else {
                // 2. Fallback secundário para OMDb caso o TMDb não localize o título
                val omdb = OmdbApiClient.getMovieDetails(
                    rawTitle = currentUpdated.name,
                    rawYear = currentUpdated.year,
                    imdbId = xtreamImdbId,
                    originalTitle = xtreamOriginalName,
                    isSeries = false
                )
                if (omdb != null) {
                    currentUpdated = currentUpdated.copy(
                        posterUrl = omdb.poster ?: currentUpdated.posterUrl,
                        year = omdb.year ?: currentUpdated.year,
                        director = omdb.director ?: currentUpdated.director,
                        cast = omdb.cast ?: currentUpdated.cast,
                        duration = omdb.runtime ?: currentUpdated.duration,
                        genre = omdb.genre ?: currentUpdated.genre,
                        rating = omdb.imdbRating?.let { "$it/10" } ?: currentUpdated.rating,
                        description = omdb.plot ?: currentUpdated.description
                    )
                }
            }

            if (currentUpdated != movie) {
                withContext(Dispatchers.IO) {
                    db.movieDao().insertMovies(listOf(currentUpdated))
                }
                val idx = movies.indexOfFirst { it.id == currentUpdated.id }
                if (idx >= 0) {
                    movies[idx] = currentUpdated
                }
            }
            onLoaded(currentUpdated)
        }
    }

        fun isFavorite(contentId: String, onResult: (Boolean) -> Unit) {
        viewModelScope.launch {
            val fav = withContext(Dispatchers.IO) {
                db.favoriteDao().getFavoriteByContentId(contentId)
            }
            onResult(fav != null)
        }
    }

    private suspend fun refreshPlaylists() {
        val allPlaylists = withContext(Dispatchers.IO) {
            db.playlistDao().getAllPlaylists()
        }
        playlists.clear()
        playlists.addAll(allPlaylists)
    }

    private suspend fun refreshFavorites() {
        val allFavs = withContext(Dispatchers.IO) {
            db.favoriteDao().getAllFavorites()
        }
        favorites.clear()
        favorites.addAll(allFavs)
    }

    private suspend fun refreshHistory() {
        val allHist = withContext(Dispatchers.IO) {
            db.historyDao().getAllHistory()
        }
        val contWatching = withContext(Dispatchers.IO) {
            db.historyDao().getContinueWatchingHistory()
        }
        withContext(Dispatchers.Main) {
            history.clear()
            history.addAll(allHist)
            continueWatching.clear()
            continueWatching.addAll(contWatching)
        }
    }

    fun clearError() {
        errorMessage = null
    }
}
