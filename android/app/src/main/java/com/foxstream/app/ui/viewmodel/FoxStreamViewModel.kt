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
import com.foxstream.app.data.local.HomeCacheManager
import com.foxstream.app.util.SmartMatch
import com.foxstream.app.data.model.*
import com.foxstream.app.data.parser.M3UParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
    
    // In-memory metadata cache and O(1) title index maps to avoid main-thread linear scans
    private val seriesMetadataCache = java.util.concurrent.ConcurrentHashMap<String, SeriesItem>()
    private val movieCleanMap = java.util.concurrent.ConcurrentHashMap<String, MovieItem>()
    private val seriesCleanMap = java.util.concurrent.ConcurrentHashMap<String, SeriesItem>()

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
    val trendingMovies = mutableStateListOf<MovieItem>()
    val popularMovies = mutableStateListOf<MovieItem>()
    val popularSeries = mutableStateListOf<SeriesItem>()
    val newReleases = mutableStateListOf<MovieItem>()

    // Pre-computed HomeScreen carousels and previews to eliminate main-thread lag
    val homeCategoryCarousels = mutableStateListOf<CategoryCarouselItem>()
    val homePreviewMovies = mutableStateListOf<MovieItem>()
    val homePreviewSeries = mutableStateListOf<SeriesItem>()
    val favoriteIdsSet = mutableStateOf<Set<String>>(emptySet())

    // High-performance background search index structures (Zero runtime GC allocations)
    private val searchIndexLock = Any()
    private val indexedChannels = mutableListOf<Pair<LiveChannel, String>>()
    private val indexedMovies = mutableListOf<Pair<MovieItem, String>>()
    private val indexedSeries = mutableListOf<Pair<SeriesItem, String>>()
    private val indexedEpisodes = mutableListOf<Pair<Pair<SeriesItem, EpisodeItem>, String>>()

    init {
        loadInitialData()
        refreshFeaturedBanners(forceRefresh = true)
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
            favoriteIdsSet.value = allFavs.mapNotNull { it.contentId }.toSet()

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

                // 1. Asynchronously pre-compute search index and Home carousels in background (Zero UI thread work)
                viewModelScope.launch(Dispatchers.Default) {
                    // Pre-build Search Index
                    val chIdx = pChannels.map { it to SearchUtils.fastNormalize("${it.name} ${it.category}") }
                    val mvIdx = pMovies.map { it to SearchUtils.fastNormalize("${it.name} ${it.category} ${it.year ?: ""}") }
                    val srIdx = pSeries.map { it to SearchUtils.fastNormalize("${it.name} ${it.category}") }
                    val epIdx = mutableListOf<Pair<Pair<SeriesItem, EpisodeItem>, String>>()
                    for (s in pSeries) {
                        val normSeries = SearchUtils.fastNormalize(s.name)
                        for (season in s.seasons) {
                            for (ep in season.episodes) {
                                epIdx.add((s to ep) to "$normSeries ${SearchUtils.fastNormalize(ep.title)}")
                            }
                        }
                    }
                    synchronized(searchIndexLock) {
                        indexedChannels.clear()
                        indexedChannels.addAll(chIdx)
                        indexedMovies.clear()
                        indexedMovies.addAll(mvIdx)
                        indexedSeries.clear()
                        indexedSeries.addAll(srIdx)
                        indexedEpisodes.clear()
                        indexedEpisodes.addAll(epIdx)
                    }

                    // Pre-compute Category Carousels & Previews for HomeScreen
                    val catsWithCounts = mutableMapOf<String, Int>()
                    pMovies.forEach { m ->
                        val c = m.category.trim()
                        if (c.isNotBlank() && !c.equals("Filmes", ignoreCase = true) && !c.equals("Geral", ignoreCase = true) && !c.equals("Todos", ignoreCase = true)) {
                            catsWithCounts[c] = (catsWithCounts[c] ?: 0) + 1
                        }
                    }
                    pSeries.forEach { s ->
                        val c = s.category.trim()
                        if (c.isNotBlank() && !c.equals("Séries", ignoreCase = true) && !c.equals("Geral", ignoreCase = true) && !c.equals("Todos", ignoreCase = true)) {
                            catsWithCounts[c] = (catsWithCounts[c] ?: 0) + 1
                        }
                    }
                    pChannels.forEach { ch ->
                        val c = ch.category.trim()
                        if (c.isNotBlank() && !c.equals("Canais", ignoreCase = true) && !c.equals("TV ao Vivo", ignoreCase = true) && !c.equals("Geral", ignoreCase = true) && !c.equals("Todos", ignoreCase = true)) {
                            catsWithCounts[c] = (catsWithCounts[c] ?: 0) + 1
                        }
                    }
                    val topCats = catsWithCounts.entries.sortedByDescending { it.value }.map { it.key }.take(12)

                    val moviesByCat = pMovies.groupBy { it.category.trim().lowercase() }
                    val seriesByCat = pSeries.groupBy { it.category.trim().lowercase() }
                    val channelsByCat = pChannels.groupBy { it.category.trim().lowercase() }

                    val carousels = topCats.mapNotNull { catName ->
                        val key = catName.lowercase()
                        val cMovies = moviesByCat[key]?.take(25) ?: emptyList()
                        if (cMovies.isNotEmpty()) {
                            CategoryCarouselItem(title = catName, type = ContentType.MOVIE, movies = cMovies)
                        } else {
                            val cSeries = seriesByCat[key]?.take(25) ?: emptyList()
                            if (cSeries.isNotEmpty()) {
                                CategoryCarouselItem(title = catName, type = ContentType.SERIES, series = cSeries)
                            } else {
                                val cChannels = channelsByCat[key]?.take(25) ?: emptyList()
                                if (cChannels.isNotEmpty()) {
                                    CategoryCarouselItem(title = catName, type = ContentType.LIVE, channels = cChannels)
                                } else null
                            }
                        }
                    }

                    val previewM = pMovies.take(30)
                    val previewS = pSeries.take(30)

                    withContext(Dispatchers.Main) {
                        homeCategoryCarousels.clear()
                        homeCategoryCarousels.addAll(carousels)
                        homePreviewMovies.clear()
                        homePreviewMovies.addAll(previewM)
                        homePreviewSeries.clear()
                        homePreviewSeries.addAll(previewS)
                    }
                }

                // Asynchronously index titles for O(1) instant lookup
                viewModelScope.launch(Dispatchers.IO) {
                    val mMap = java.util.concurrent.ConcurrentHashMap<String, MovieItem>()
                    pMovies.forEach { m ->
                        val (cleaned, _) = SmartMatch.cleanTitle(m.name)
                        if (cleaned.isNotBlank() && !mMap.containsKey(cleaned)) {
                            mMap[cleaned] = m
                        }
                    }
                    movieCleanMap.clear()
                    movieCleanMap.putAll(mMap)

                    val sMap = java.util.concurrent.ConcurrentHashMap<String, SeriesItem>()
                    pSeries.forEach { s ->
                        val (cleaned, _) = SmartMatch.cleanTitle(s.name)
                        if (cleaned.isNotBlank() && !sMap.containsKey(cleaned)) {
                            sMap[cleaned] = s
                        }
                    }
                    seriesCleanMap.clear()
                    seriesCleanMap.putAll(sMap)
                }

                // Phase 1: Render cached TMDb Home carousels if available, otherwise fetch from TMDb API
                val cached = withContext(Dispatchers.IO) {
                    HomeCacheManager.load(getApplication(), db, playlistId)
                }
                
                if (cached != null) {
                    if (cached.featuredBanners.isNotEmpty()) {
                        featuredBannerItems.clear()
                        featuredBannerItems.addAll(cached.featuredBanners)
                    }
                    if (cached.trendingMovies.isNotEmpty()) {
                        trendingMovies.clear()
                        trendingMovies.addAll(cached.trendingMovies)
                    }
                    if (cached.popularMovies.isNotEmpty()) {
                        popularMovies.clear()
                        popularMovies.addAll(cached.popularMovies)
                    }
                    if (cached.popularSeries.isNotEmpty()) {
                        popularSeries.clear()
                        popularSeries.addAll(cached.popularSeries)
                    }
                    if (cached.newReleases.isNotEmpty()) {
                        newReleases.clear()
                        newReleases.addAll(cached.newReleases)
                    }
                }

                // Phase 2: Refresh TMDb API Home carousels if cache is stale or missing
                val isCacheFresh = cached != null && (System.currentTimeMillis() - cached.timestamp < HomeCacheManager.CACHE_EXPIRY_MS)
                if (!isCacheFresh || featuredBannerItems.isEmpty()) {
                    refreshFeaturedBanners(playlistId = playlistId)
                }
            } catch (e: Exception) {
                errorMessage = "Erro ao carregar conteúdo da lista: ${e.localizedMessage}"
            } finally {
                isLoading = false
            }
        }
    }

    fun findLocalMovieStream(name: String, year: String?): MovieItem? {
        if (name.isBlank()) return null
        val (cleanedTmdb, _) = SmartMatch.cleanTitle(name)

        // 1. O(1) Instant Title Map Lookup (< 0.1ms)
        if (cleanedTmdb.isNotBlank()) {
            movieCleanMap[cleanedTmdb]?.let { local ->
                val res = SmartMatch.evaluateMatch(
                    localRawName = local.name,
                    localCategory = local.category,
                    localRawYear = local.year,
                    tmdbTitle = name,
                    tmdbOriginalTitle = null,
                    tmdbYear = year,
                    tmdbGenres = null
                )
                if (res.isMatch) return local
            }
        }

        // 2. Thread-safe snapshot copy to prevent ConcurrentModification and main thread freezes
        val localList = movies.toList()
        var bestMovie: MovieItem? = null
        var bestScore = 64 // cut score of 65/100

        for (m in localList) {
            val res = SmartMatch.evaluateMatch(
                localRawName = m.name,
                localCategory = m.category,
                localRawYear = m.year,
                tmdbTitle = name,
                tmdbOriginalTitle = null,
                tmdbYear = year,
                tmdbGenres = null
            )
            if (res.isMatch && res.score > bestScore) {
                bestScore = res.score
                bestMovie = m
                if (bestScore >= 95) break
            }
        }
        return bestMovie
    }

    fun findLocalSeries(name: String, year: String?): SeriesItem? {
        if (name.isBlank()) return null
        val (cleanedTmdb, _) = SmartMatch.cleanTitle(name)

        // 1. O(1) Instant Title Map Lookup (< 0.1ms)
        if (cleanedTmdb.isNotBlank()) {
            seriesCleanMap[cleanedTmdb]?.let { local ->
                val res = SmartMatch.evaluateMatch(
                    localRawName = local.name,
                    localCategory = local.category,
                    localRawYear = local.year,
                    tmdbTitle = name,
                    tmdbOriginalTitle = null,
                    tmdbYear = year,
                    tmdbGenres = null
                )
                if (res.isMatch) return local
            }
        }

        // 2. Thread-safe snapshot copy
        val localList = seriesList.toList()
        var bestSeries: SeriesItem? = null
        var bestScore = 64

        for (s in localList) {
            val res = SmartMatch.evaluateMatch(
                localRawName = s.name,
                localCategory = s.category,
                localRawYear = s.year,
                tmdbTitle = name,
                tmdbOriginalTitle = null,
                tmdbYear = year,
                tmdbGenres = null
            )
            if (res.isMatch && res.score > bestScore) {
                bestScore = res.score
                bestSeries = s
                if (bestScore >= 95) break
            }
        }
        return bestSeries
    }

    fun refreshFeaturedBanners(
        playlistId: String = activePlaylistId ?: "",
        forceRefresh: Boolean = false
    ) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                try {
                    // Parallel fetch of all 5 TMDb endpoints - 100% exclusively from TMDb API
                    val (trendingMoviesData, trendingTvData, popMoviesData, popTvData, nowPlayingData) = coroutineScope {
                        val d1 = async { TmdbApiClient.getTrendingMovies() }
                        val d2 = async { TmdbApiClient.getTrendingTv() }
                        val d3 = async { TmdbApiClient.getPopularMovies() }
                        val d4 = async { TmdbApiClient.getPopularTv() }
                        val d5 = async { TmdbApiClient.getNowPlayingMovies() }
                        listOf(d1.await(), d2.await(), d3.await(), d4.await(), d5.await())
                    }

                    // 1. Hero banners (Directly powered 100% by TMDb Trending Movies & TV)
                    val matchedBanners = mutableListOf<HeroBannerItem>()
                    for (tmdbMovie in trendingMoviesData.take(10)) {
                        val mTitle = tmdbMovie.title ?: continue
                        val poster = tmdbMovie.poster ?: ""
                        val backdrop = tmdbMovie.backdrop ?: poster
                        val year = tmdbMovie.year
                        val rating = tmdbMovie.rating
                        val badge = listOfNotNull(
                            "FILME",
                            year,
                            rating?.let { "★ $it" },
                            "TMDb"
                        ).joinToString(" • ")

                        val mItem = MovieItem(
                            id = "tmdb_m_${tmdbMovie.tmdbId}",
                            playlistId = "",
                            name = mTitle,
                            streamUrl = "",
                            posterUrl = poster,
                            backdropUrl = backdrop,
                            rating = rating,
                            description = tmdbMovie.plot,
                            year = year,
                            category = "Destaques TMDb"
                        )

                        matchedBanners.add(
                            HeroBannerItem(
                                id = "hero_m_${tmdbMovie.tmdbId}",
                                title = mTitle,
                                imageUrl = backdrop.ifBlank { poster },
                                category = "Filmes em Destaque",
                                type = ContentType.MOVIE,
                                streamUrl = "",
                                badgeInfo = badge,
                                overview = tmdbMovie.plot,
                                year = year,
                                movieItem = mItem
                            )
                        )
                    }

                    for (tmdbTv in trendingTvData.take(10)) {
                        val sTitle = tmdbTv.title ?: continue
                        val poster = tmdbTv.poster ?: ""
                        val backdrop = tmdbTv.backdrop ?: poster
                        val year = tmdbTv.year
                        val rating = tmdbTv.rating
                        val badge = listOfNotNull(
                            "SÉRIE",
                            year,
                            rating?.let { "★ $it" },
                            "TMDb"
                        ).joinToString(" • ")

                        val sItem = SeriesItem(
                            id = "tmdb_s_${tmdbTv.tmdbId}",
                            playlistId = "",
                            name = sTitle,
                            posterUrl = poster,
                            backdropUrl = backdrop,
                            rating = rating,
                            description = tmdbTv.plot,
                            year = year,
                            category = "Destaques TMDb",
                            seasons = emptyList()
                        )

                        matchedBanners.add(
                            HeroBannerItem(
                                id = "hero_s_${tmdbTv.tmdbId}",
                                title = sTitle,
                                imageUrl = backdrop.ifBlank { poster },
                                category = "Séries em Destaque",
                                type = ContentType.SERIES,
                                streamUrl = "",
                                badgeInfo = badge,
                                overview = tmdbTv.plot,
                                year = year,
                                seriesItem = sItem
                            )
                        )
                    }

                    val finalBanners = matchedBanners.distinctBy { it.id }.shuffled().take(12)

                    // 2. Em Alta (Trending Movies TMDb)
                    val finalTrending = trendingMoviesData.map { tmdb ->
                        MovieItem(
                            id = "tmdb_m_${tmdb.tmdbId}",
                            playlistId = "",
                            name = tmdb.title ?: "",
                            streamUrl = "",
                            posterUrl = tmdb.poster,
                            backdropUrl = tmdb.backdrop,
                            rating = tmdb.rating,
                            description = tmdb.plot,
                            year = tmdb.year,
                            category = "Em Alta"
                        )
                    }.distinctBy { it.id }

                    // 3. Filmes Populares (Popular Movies TMDb)
                    val finalPopMovies = popMoviesData.map { tmdb ->
                        MovieItem(
                            id = "tmdb_m_${tmdb.tmdbId}",
                            playlistId = "",
                            name = tmdb.title ?: "",
                            streamUrl = "",
                            posterUrl = tmdb.poster,
                            backdropUrl = tmdb.backdrop,
                            rating = tmdb.rating,
                            description = tmdb.plot,
                            year = tmdb.year,
                            category = "Populares"
                        )
                    }.distinctBy { it.id }

                    // 4. Séries Populares (Popular TV TMDb)
                    val finalPopSeries = popTvData.map { tmdb ->
                        SeriesItem(
                            id = "tmdb_s_${tmdb.tmdbId}",
                            playlistId = "",
                            name = tmdb.title ?: "",
                            posterUrl = tmdb.poster,
                            backdropUrl = tmdb.backdrop,
                            rating = tmdb.rating,
                            description = tmdb.plot,
                            year = tmdb.year,
                            category = "Populares",
                            seasons = emptyList()
                        )
                    }.distinctBy { it.id }

                    // 5. Lançamentos (Now Playing Movies TMDb)
                    val finalReleases = nowPlayingData.map { tmdb ->
                        MovieItem(
                            id = "tmdb_m_${tmdb.tmdbId}",
                            playlistId = "",
                            name = tmdb.title ?: "",
                            streamUrl = "",
                            posterUrl = tmdb.poster,
                            backdropUrl = tmdb.backdrop,
                            rating = tmdb.rating,
                            description = tmdb.plot,
                            year = tmdb.year,
                            category = "Lançamentos"
                        )
                    }.distinctBy { it.id }

                    // Update UI on Main Dispatcher
                    withContext(Dispatchers.Main) {
                        featuredBannerItems.clear()
                        featuredBannerItems.addAll(finalBanners)
                        trendingMovies.clear()
                        trendingMovies.addAll(finalTrending)
                        popularMovies.clear()
                        popularMovies.addAll(finalPopMovies)
                        popularSeries.clear()
                        popularSeries.addAll(finalPopSeries)
                        newReleases.clear()
                        newReleases.addAll(finalReleases)
                    }

                    // PERSIST TO DISK AND ROOM DB CACHE SO NEXT LAUNCH IS INSTANT (0 ms)
                    HomeCacheManager.save(
                        context = getApplication(),
                        db = db,
                        playlistId = playlistId,
                        featuredBanners = finalBanners,
                        trendingMovies = finalTrending,
                        popularMovies = finalPopMovies,
                        popularSeries = finalPopSeries,
                        newReleases = finalReleases
                    )
                } catch (e: Exception) {
                    Log.e("FoxStreamViewModel", "Error refreshing TMDb categories: ${e.message}", e)
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

    fun toggleFavoriteSeries(series: SeriesItem) {
        viewModelScope.launch {
            val existing = withContext(Dispatchers.IO) {
                db.favoriteDao().getFavoriteByContentId(series.id)
            }
            withContext(Dispatchers.IO) {
                if (existing != null) {
                    db.favoriteDao().deleteFavoriteByContentId(series.id)
                } else {
                    val fav = FavoriteItem(
                        id = "fav_${series.id}",
                        contentId = series.id,
                        type = ContentType.SERIES,
                        title = series.name,
                        category = series.category,
                        streamUrl = series.posterUrl ?: "",
                        posterUrl = series.posterUrl
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

    fun recordPlaybackProgress(
        streamUrl: String,
        title: String,
        type: ContentType,
        position: Long,
        duration: Long,
        posterUrl: String? = null,
        category: String? = null
    ) {
        if (streamUrl.contains("***")) return
        // Regra dos Créditos / 95%: se assistiu 95% ou faltam menos de 3 min para vídeos longos, marca como assistido e exclui do Continue Assistindo
        if (duration > 0L) {
            val isCredits = (position >= duration * 0.95f) || (duration > 180_000L && (duration - position) <= 180_000L)
            if (isCredits) {
                markAsWatched(streamUrl, duration)
                return
            }
        }
        viewModelScope.launch(Dispatchers.IO) {
            val existing = db.historyDao().getHistoryByStreamUrl(streamUrl)
            val hist = existing?.copy(
                title = if (existing.title.isNotBlank()) existing.title else title,
                type = type,
                playbackPosition = position,
                duration = duration,
                isWatched = false,
                playedAt = System.currentTimeMillis(),
                posterUrl = posterUrl ?: existing.posterUrl,
                category = category ?: existing.category
            ) ?: HistoryItem(
                id = "hist_${System.currentTimeMillis()}",
                contentId = streamUrl,
                title = title,
                type = type,
                streamUrl = streamUrl,
                posterUrl = posterUrl,
                category = category,
                playedAt = System.currentTimeMillis(),
                playbackPosition = position,
                duration = duration,
                isWatched = false
            )
            db.historyDao().insertHistory(hist)
            withContext(Dispatchers.Main) {
                refreshHistory()
            }
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
                continueWatching.removeAll { it.streamUrl == streamUrl }
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

    fun onSearchQueryChanged(query: String, scope: String = "ALL") {
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
            delay(50) // Ultra-responsive 50ms debounce
            
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
                var chSnapshot: List<Pair<LiveChannel, String>>
                var mvSnapshot: List<Pair<MovieItem, String>>
                var srSnapshot: List<Pair<SeriesItem, String>>
                var epSnapshot: List<Pair<Pair<SeriesItem, EpisodeItem>, String>>

                synchronized(searchIndexLock) {
                    if (indexedChannels.isEmpty() && channels.isNotEmpty()) {
                        indexedChannels.addAll(channels.map { it to SearchUtils.fastNormalize("${it.name} ${it.category}") })
                    }
                    if (indexedMovies.isEmpty() && movies.isNotEmpty()) {
                        indexedMovies.addAll(movies.map { it to SearchUtils.fastNormalize("${it.name} ${it.category} ${it.year ?: ""}") })
                    }
                    if (indexedSeries.isEmpty() && seriesList.isNotEmpty()) {
                        indexedSeries.addAll(seriesList.map { it to SearchUtils.fastNormalize("${it.name} ${it.category}") })
                    }
                    chSnapshot = indexedChannels.toList()
                    mvSnapshot = indexedMovies.toList()
                    srSnapshot = indexedSeries.toList()
                    epSnapshot = indexedEpisodes.toList()
                }

                val chs = if (scope == "ALL") {
                    val list = mutableListOf<LiveChannel>()
                    for ((ch, key) in chSnapshot) {
                        var match = true
                        for (token in tokens) {
                            if (!key.contains(token)) {
                                match = false
                                break
                            }
                        }
                        if (match) {
                            list.add(ch)
                            if (list.size >= 50) break
                        }
                    }
                    list
                } else emptyList()

                val mvs = if (scope == "ALL" || scope == "MOVIE") {
                    val list = mutableListOf<MovieItem>()
                    for ((m, key) in mvSnapshot) {
                        var match = true
                        for (token in tokens) {
                            if (!key.contains(token)) {
                                match = false
                                break
                            }
                        }
                        if (match) {
                            list.add(m)
                            if (list.size >= 50) break
                        }
                    }
                    list
                } else emptyList()

                val srs = if (scope == "ALL" || scope == "SERIES") {
                    val list = mutableListOf<SeriesItem>()
                    for ((s, key) in srSnapshot) {
                        var match = true
                        for (token in tokens) {
                            if (!key.contains(token)) {
                                match = false
                                break
                            }
                        }
                        if (match) {
                            list.add(s)
                            if (list.size >= 50) break
                        }
                    }
                    list
                } else emptyList()

                val eps = if (scope == "ALL" || scope == "SERIES") {
                    val list = mutableListOf<Pair<SeriesItem, EpisodeItem>>()
                    for ((pair, key) in epSnapshot) {
                        var match = true
                        for (token in tokens) {
                            if (!key.contains(token)) {
                                match = false
                                break
                            }
                        }
                        if (match) {
                            list.add(pair)
                            if (list.size >= 50) break
                        }
                    }
                    list
                } else emptyList()
                
                Quadruple(chs, mvs, srs, eps)
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
        val targetSeries = if (series.id.startsWith("tmdb_") || series.playlistId.isBlank() || series.seasons.isEmpty()) {
            findLocalSeries(series.name, series.year) ?: series
        } else {
            series
        }
        val playlistId = targetSeries.playlistId

        // 1. Check in-memory metadata cache first for instant retrieval!
        val cachedSeries = seriesMetadataCache[targetSeries.id]
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
            var seasons = targetSeries.seasons
            val iptvLoadJob = launch {
                if (p != null && p.type == PlaylistType.XTREAM && p.serverUrl != null && p.username != null && p.password != null) {
                    try {
                        val client = XtreamApiClient(p.serverUrl, p.username, p.password)
                        val fetchedSeasons = client.getSeriesDetails(targetSeries.id, targetSeries.id)
                        if (fetchedSeasons.isNotEmpty()) {
                            seasons = fetchedSeasons
                        }
                    } catch (e: Exception) {
                        Log.e("FoxStreamViewModel", "Error loading IPTV series episodes: ${e.message}")
                    }
                }
            }

            // Parallel Asynchronous job to fetch TMDb/OMDb metadata
            var updatedSeries = cachedSeries ?: targetSeries
            val metadataJob = launch {
                if (cachedSeries == null) {
                    try {
                        val cleanName = sanitizeSeriesName(targetSeries.name)
                        var matchedSeries = targetSeries

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
        viewModelScope.launch(Dispatchers.IO) {
            val targetMovie = if (movie.id.startsWith("tmdb_") || movie.streamUrl.isBlank() || movie.playlistId.isBlank()) {
                findLocalMovieStream(movie.name, movie.year)?.let { local ->
                    movie.copy(
                        id = local.id,
                        playlistId = local.playlistId,
                        streamUrl = local.streamUrl
                    )
                } ?: movie
            } else {
                movie
            }
            val playlistId = targetMovie.playlistId
            var currentUpdated = targetMovie
            var xtreamImdbId: String? = null
            var xtreamOriginalName: String? = null

            val p = db.playlistDao().getPlaylistById(playlistId)
            if (p != null && p.type == PlaylistType.XTREAM && p.serverUrl != null && p.username != null && p.password != null) {
                try {
                    val client = XtreamApiClient(p.serverUrl, p.username, p.password)
                    val json = client.getVodDetails(targetMovie.id)
                    if (json != null && json.has("info")) {
                        val info = json.getJSONObject("info")
                        xtreamImdbId = info.optString("imdb_id").trim().takeIf { it.isNotBlank() && !it.equals("null", ignoreCase = true) }
                        xtreamOriginalName = if (info.has("o_name")) info.optString("o_name") else info.optString("original_name")
                        if (xtreamOriginalName.isNullOrBlank() || xtreamOriginalName.equals("null", ignoreCase = true)) {
                            xtreamOriginalName = null
                        }

                        val plot = info.optString("plot", info.optString("description", targetMovie.description ?: ""))
                        val rawDirector = info.optString("director", targetMovie.director ?: "")
                        val rawCast = info.optString("cast", targetMovie.cast ?: "")
                        val durationSecs = info.optInt("duration_secs", 0)
                        val rawDuration = if (durationSecs > 0) {
                            "${Math.round(durationSecs.toFloat() / 60)} min"
                        } else {
                            info.optString("duration", targetMovie.duration ?: "")
                        }
                        val genre = info.optString("genre", targetMovie.genre ?: targetMovie.category)
                        val rating = if (info.has("rating_5based")) {
                            "${info.optDouble("rating_5based", 0.0)}/5"
                        } else if (info.has("rating") && !info.isNull("rating")) {
                            "${info.optString("rating")}/10"
                        } else targetMovie.rating
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

                        currentUpdated = targetMovie.copy(
                            description = if (plot.isNotBlank()) plot else targetMovie.description,
                            director = cleanDirector ?: targetMovie.director,
                            cast = cleanCast ?: targetMovie.cast,
                            duration = cleanDuration ?: targetMovie.duration,
                            genre = if (genre.isNotBlank()) genre else targetMovie.genre,
                            rating = rating ?: targetMovie.rating,
                            backdropUrl = backdrop ?: targetMovie.backdropUrl
                        )
                    }
                } catch (e: Exception) {
                    Log.e("FoxStreamViewModel", "Error fetching Xtream VOD details: ${e.message}")
                }
            }

            // 1. Consultar TMDb (primário, com sinopse em PT-BR, backdrop 1280p, pôster HD, notas e elenco)
            try {
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
            } catch (e: Exception) {
                Log.e("FoxStreamViewModel", "Error fetching movie TMDb/OMDb details: ${e.message}")
            }

            if (currentUpdated != movie) {
                db.movieDao().insertMovies(listOf(currentUpdated))
                withContext(Dispatchers.Main) {
                    val idx = movies.indexOfFirst { it.id == currentUpdated.id }
                    if (idx >= 0) {
                        movies[idx] = currentUpdated
                    }
                }
            }

            withContext(Dispatchers.Main) {
                onLoaded(currentUpdated)
            }
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
        withContext(Dispatchers.Main) {
            favorites.clear()
            favorites.addAll(allFavs)
            favoriteIdsSet.value = allFavs.mapNotNull { it.contentId }.toSet()
        }
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
