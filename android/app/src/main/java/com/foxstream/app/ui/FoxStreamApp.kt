package com.foxstream.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.foxstream.app.R
import com.foxstream.app.data.model.*
import com.foxstream.app.ui.navigation.NavDestinations
import com.foxstream.app.ui.screens.*
import com.foxstream.app.ui.viewmodel.FoxStreamViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppNavTab(val title: String, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    HOME("Início", Icons.Default.Home),
    LIVE("TV ao Vivo", Icons.Default.Tv),
    MOVIES("Filmes", Icons.Default.Movie),
    SERIES("Séries", Icons.Default.VideoLibrary),
    FAVORITES("Favoritos", Icons.Default.Favorite),
    PLAYLISTS("Listas", Icons.Default.FormatListBulleted),
    SETTINGS("Ajustes", Icons.Default.Settings)
}

data class PlayingMedia(
    val url: String,
    val title: String,
    val type: ContentType,
    val initialPosition: Long = 0L,
    val seriesItem: SeriesItem? = null,
    val currentEpisode: EpisodeItem? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoxStreamApp(
    isInPipMode: Boolean = false,
    viewModel: FoxStreamViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var currentTab by remember { mutableStateOf(AppNavTab.HOME) }
    var showAddPlaylistDialog by remember { mutableStateOf(false) }
    var showSearchScreen by remember { mutableStateOf(false) }
    var searchScope by remember { mutableStateOf("ALL") } // "ALL", "MOVIE", "SERIES"
    var activePlayingMedia by remember { mutableStateOf<PlayingMedia?>(null) }
    var selectedSeriesForDetails by remember { mutableStateOf<SeriesItem?>(null) }
    var selectedMovieForDetails by remember { mutableStateOf<MovieItem?>(null) }

    val playlists = viewModel.playlists
    val activePlaylistId = viewModel.activePlaylistId
    val channels = viewModel.channels
    val movies = viewModel.movies
    val seriesList = viewModel.seriesList
    val favorites = viewModel.favorites
    val history = viewModel.history
    val continueWatching = viewModel.continueWatching

    // Playback launcher
    val playMedia: (String, String, ContentType, SeriesItem?, EpisodeItem?) -> Unit = { streamUrl, title, type, sItem, epItem ->
        val existingHist = viewModel.history.find { it.streamUrl == streamUrl }
        val savedPos = if (existingHist?.isWatched == true) 0L else (existingHist?.playbackPosition ?: 0L)
        activePlayingMedia = PlayingMedia(streamUrl, title, type, savedPos, sItem, epItem)

        val seriesPoster = sItem?.posterUrl 
            ?: (if (type == ContentType.SERIES) seriesList.find { s -> s.seasons.any { se -> se.episodes.any { ep -> ep.streamUrl == streamUrl } } }?.posterUrl else null)
            ?: (if (type == ContentType.MOVIE) movies.find { m -> m.streamUrl == streamUrl }?.posterUrl else null)

        val seriesCat = sItem?.category
            ?: (if (type == ContentType.SERIES) seriesList.find { s -> s.seasons.any { se -> se.episodes.any { ep -> ep.streamUrl == streamUrl } } }?.category else null)

        viewModel.addPlaybackToHistory(
            streamUrl = streamUrl,
            title = title,
            type = type,
            posterUrl = seriesPoster,
            category = seriesCat
        )
    }

    val onPlayStream: (String, String, ContentType) -> Unit = { streamUrl, title, type ->
        playMedia(streamUrl, title, type, null, null)
    }

    // Dynamic Route Navigator (NavGraph.kt integration)
    val navigateToRoute: (String) -> Unit = { route ->
        when {
            route.startsWith("movie_details/") -> {
                val rawId = route.removePrefix("movie_details/")
                val movieId = NavDestinations.parseMovieId(rawId)
                val foundMovie = movies.find { it.id == movieId } ?: movies.find { it.streamUrl == movieId } ?:
                    (viewModel.popularMovies + viewModel.trendingMovies + viewModel.newReleases).find { it.id == movieId }
                if (foundMovie != null) {
                    selectedMovieForDetails = foundMovie
                }
            }
            route.startsWith("player_screen/") -> {
                val rawUrl = route.removePrefix("player_screen/")
                val streamUrl = NavDestinations.parseStreamUrl(rawUrl)
                val matchedMovie = movies.find { it.streamUrl == streamUrl }
                val title = matchedMovie?.name ?: "Vídeo"
                playMedia(streamUrl, title, ContentType.MOVIE, null, null)
            }
        }
    }

    // Contextual BackHandlers
    BackHandler(enabled = showSearchScreen) {
        showSearchScreen = false
        viewModel.onSearchQueryChanged("")
    }

    BackHandler(enabled = selectedMovieForDetails != null && activePlayingMedia == null) {
        selectedMovieForDetails = null
    }

    BackHandler(enabled = currentTab != AppNavTab.HOME && activePlayingMedia == null && selectedMovieForDetails == null && !showSearchScreen && !showAddPlaylistDialog) {
        currentTab = AppNavTab.HOME
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Image(
                                    painter = painterResource(id = R.drawable.foxstream_logo),
                                    contentDescription = "FoxStream Logo",
                                    modifier = Modifier
                                        .size(34.dp)
                                        .padding(end = 8.dp)
                                )
                                Text(
                                    text = buildAnnotatedString {
                                        withStyle(style = SpanStyle(color = Color.White)) {
                                            append("Fox")
                                        }
                                        withStyle(style = SpanStyle(color = MaterialTheme.colorScheme.primary)) {
                                            append("Stream")
                                        }
                                    },
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.width(7.dp))
                                Surface(
                                    modifier = Modifier.size(width = 46.dp, height = 28.dp),
                                    shape = RoundedCornerShape(6.dp),
                                    color = Color.Black.copy(alpha = 0.25f),
                                    border = BorderStroke(1.2.dp, MaterialTheme.colorScheme.primary)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        Text(
                                            text = "IPTV",
                                            color = Color(0xFFE6E8F0),
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            letterSpacing = 0.5.sp
                                        )
                                    }
                                }
                            }
                            Row {
                                IconButton(onClick = { searchScope = "ALL"; showSearchScreen = true }) {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = "Buscar Global",
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                                IconButton(onClick = { showAddPlaylistDialog = true }) {
                                    Icon(
                                        imageVector = Icons.Default.Add,
                                        contentDescription = "Adicionar Lista",
                                        tint = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )
            },
            bottomBar = {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF0A0C13),
                    tonalElevation = 0.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                    ) {
                        // Divisor superior extremamente sutil
                        HorizontalDivider(
                            color = Color(0xFF1A1E2B),
                            thickness = 0.5.dp
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp)
                                .padding(horizontal = 2.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            val navTabs = remember {
                                listOf(
                                    AppNavTab.HOME,
                                    AppNavTab.LIVE,
                                    AppNavTab.MOVIES,
                                    AppNavTab.SERIES,
                                    AppNavTab.FAVORITES,
                                    AppNavTab.PLAYLISTS,
                                    AppNavTab.SETTINGS
                                )
                            }

                            navTabs.forEach { tab ->
                                val isSelected = currentTab == tab
                                val interactionSource = remember { MutableInteractionSource() }

                                Column(
                                    modifier = Modifier
                                        .weight(1f)
                                        .fillMaxHeight()
                                        .clickable(
                                            interactionSource = interactionSource,
                                            indication = null
                                        ) {
                                            currentTab = tab
                                        },
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    // Cápsula discreta em tom escuro de laranja atrás do ícone selecionado
                                    Box(
                                        modifier = Modifier
                                            .height(24.dp)
                                            .background(
                                                color = if (isSelected) Color(0xFFFF6600).copy(alpha = 0.16f) else Color.Transparent,
                                                shape = RoundedCornerShape(12.dp)
                                            )
                                            .padding(horizontal = 8.dp, vertical = 2.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = tab.icon,
                                            contentDescription = tab.title,
                                            modifier = Modifier.size(18.dp),
                                            tint = if (isSelected) Color(0xFFFF6600) else Color(0xFF8E95A5)
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(2.dp))

                                    Text(
                                        text = tab.title,
                                        maxLines = 1,
                                        softWrap = false,
                                        overflow = TextOverflow.Ellipsis,
                                        fontSize = 9.5.sp,
                                        fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                                        color = if (isSelected) Color(0xFFFF6600) else Color(0xFF8E95A5),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }
                }
            },
            containerColor = MaterialTheme.colorScheme.background
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when (currentTab) {
                    AppNavTab.HOME -> HomeScreen(
                        playlists = playlists,
                        activePlaylistId = activePlaylistId,
                        history = if (continueWatching.isNotEmpty()) continueWatching else history.filter { !it.isWatched && it.type != ContentType.LIVE && it.playbackPosition > 3000L },
                        favorites = favorites,
                        channels = channels,
                        movies = movies,
                        seriesList = seriesList,
                        popularMovies = viewModel.popularMovies,
                        popularSeries = viewModel.popularSeries,
                        newReleases = viewModel.newReleases,
                        trendingMovies = viewModel.trendingMovies,
                        featuredBannerItems = viewModel.featuredBannerItems,
                        isLoading = viewModel.isLoading,
                        onPlay = onPlayStream,
                        onNavigate = { currentTab = it },
                        onOpenAdd = { showAddPlaylistDialog = true },
                        onToggleFavoriteChannel = { viewModel.toggleFavoriteChannel(it) },
                        onToggleFavoriteMovie = { viewModel.toggleFavoriteMovie(it) },
                        onOpenSeries = { s ->
                            selectedSeriesForDetails = s
                            currentTab = AppNavTab.SERIES
                        },
                        onOpenMovie = { movie: MovieItem ->
                            if (movie.id.startsWith("series_") || movie.id.startsWith("-")) {
                                val sId = movie.id.removePrefix("series_").removePrefix("-")
                                val s = seriesList.find { it.id == sId }
                                if (s != null) {
                                    selectedSeriesForDetails = s
                                    currentTab = AppNavTab.SERIES
                                }
                            } else {
                                val route = NavDestinations.buildMovieDetailsRoute(movie.id)
                                navigateToRoute(route)
                            }
                        },
                        onRemoveHistory = { item ->
                            viewModel.removeHistoryItem(item)
                        }
                    )
                    AppNavTab.LIVE -> LiveTvScreen(
                        channels = channels,
                        favorites = favorites,
                        onPlay = onPlayStream,
                        onToggleFavorite = { channel ->
                            viewModel.toggleFavoriteChannel(channel)
                        }
                    )
                    AppNavTab.MOVIES -> MoviesScreen(
                        movies = movies,
                        favorites = favorites,
                        onPlay = onPlayStream,
                        onOpenMovie = { movie ->
                            val route = NavDestinations.buildMovieDetailsRoute(movie.id)
                            navigateToRoute(route)
                        },
                        onToggleFavorite = { movie ->
                            viewModel.toggleFavoriteMovie(movie)
                        },
                        onTriggerSearch = { searchScope = "MOVIE"; showSearchScreen = true }
                    )
                    AppNavTab.SERIES -> SeriesScreen(
                        seriesList = seriesList,
                        initialSeries = selectedSeriesForDetails,
                        onClearInitialSeries = { selectedSeriesForDetails = null },
                        history = history,
                        onPlayEpisode = { s, ep ->
                            playMedia(ep.streamUrl, "${s.name} - ${ep.title}", ContentType.SERIES, s, ep)
                        },
                        onLoadDetails = { s, callback ->
                            viewModel.getSeriesDetailsOnDemand(s, callback)
                        },
                        onTriggerSearch = { searchScope = "SERIES"; showSearchScreen = true }
                    )
                    AppNavTab.FAVORITES -> FavoritesScreen(
                        favorites = favorites,
                        onPlayFavorite = { fav ->
                            if (fav.type == ContentType.MOVIE) {
                                val matched = movies.find { it.streamUrl == fav.streamUrl || it.id == fav.contentId }
                                if (matched != null) {
                                    val route = NavDestinations.buildMovieDetailsRoute(matched.id)
                                    navigateToRoute(route)
                                } else {
                                    fav.streamUrl?.let { onPlayStream(it, fav.title, fav.type) }
                                }
                            } else {
                                fav.streamUrl?.let { onPlayStream(it, fav.title, fav.type) }
                            }
                        },
                        onRemove = { favoriteItem ->
                            viewModel.removeFavorite(favoriteItem)
                        }
                    )
                    AppNavTab.PLAYLISTS -> PlaylistsScreen(
                        playlists = playlists,
                        activePlaylistId = activePlaylistId,
                        onSelect = { viewModel.selectPlaylist(it) },
                        onOpenAdd = { showAddPlaylistDialog = true },
                        onDelete = { viewModel.deletePlaylist(it) },
                        onRename = { id, newName -> viewModel.renamePlaylist(id, newName) },
                        onUpdatePlaylist = { id -> viewModel.updatePlaylist(id) },
                        onUpdateAll = { viewModel.updateAllPlaylists() }
                    )
                    AppNavTab.SETTINGS -> SettingsScreen(
                        onClearCache = {
                            viewModel.clearLocalCache()
                        }
                    )
                }

                if (showSearchScreen) {
                    GlobalSearchScreen(
                        query = viewModel.searchQuery,
                        onQueryChange = { viewModel.onSearchQueryChanged(it) },
                        isSearching = viewModel.isSearching,
                        searchChannels = viewModel.searchChannels,
                        searchMovies = viewModel.searchMovies,
                        searchSeries = viewModel.searchSeries,
                        searchEpisodes = viewModel.searchEpisodes,
                        onPlay = { url, title, type ->
                            onPlayStream(url, title, type)
                            showSearchScreen = false
                        },
                        onOpenMovie = { movie ->
                            showSearchScreen = false
                            val route = NavDestinations.buildMovieDetailsRoute(movie.id)
                            navigateToRoute(route)
                        },
                        searchScope = searchScope,
                        onClose = {
                            showSearchScreen = false
                            viewModel.onSearchQueryChanged("")
                        }
                    )
                }

                if (viewModel.isLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.5f)),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                }

                viewModel.errorMessage?.let { msg ->
                    AlertDialog(
                        onDismissRequest = { viewModel.clearError() },
                        title = { Text("Ops!") },
                        text = { Text(msg) },
                        confirmButton = {
                            Button(onClick = { viewModel.clearError() }) {
                                Text("Entendido")
                            }
                        }
                    )
                }

                if (showAddPlaylistDialog) {
                    AddPlaylistDialog(
                        isLoading = viewModel.isLoading,
                        onDismiss = { if (!viewModel.isLoading) showAddPlaylistDialog = false },
                        onAddM3U = { name, url ->
                            viewModel.addM3UPlaylist(name, url) {
                                showAddPlaylistDialog = false
                            }
                        },
                        onAddXtream = { name, serverUrl, user, pass ->
                            viewModel.addXtreamPlaylist(name, serverUrl, user, pass) {
                                showAddPlaylistDialog = false
                            }
                        }
                    )
                }
            }
        }

        // Resolve Next Episode for Series if applicable
        val nextEpisodeInfo = remember(activePlayingMedia, seriesList) {
            val media = activePlayingMedia
            if (media?.type == ContentType.SERIES) {
                val currentUrl = media.url
                val directSeries = media.seriesItem
                val directEpisode = media.currentEpisode

                val resolvedSeries = directSeries ?: seriesList.find { s ->
                    s.seasons.any { season -> season.episodes.any { it.streamUrl == currentUrl } }
                } ?: seriesList.find { s ->
                    val seriesTitlePrefix = media.title.substringBefore(" - ").trim()
                    s.name.equals(seriesTitlePrefix, ignoreCase = true)
                }

                if (resolvedSeries != null) {
                    val allEpisodes = resolvedSeries.seasons.sortedBy { it.seasonNum }.flatMap { it.episodes }
                    val currentIndex = if (directEpisode != null) {
                        allEpisodes.indexOfFirst { it.id == directEpisode.id || it.streamUrl == currentUrl }
                    } else {
                        allEpisodes.indexOfFirst { it.streamUrl == currentUrl }
                    }
                    if (currentIndex in 0 until allEpisodes.size - 1) {
                        val nextEp = allEpisodes[currentIndex + 1]
                        Triple(resolvedSeries, nextEp, true)
                    } else {
                        Triple(resolvedSeries, null, false)
                    }
                } else {
                    Triple(null, null, false)
                }
            } else {
                Triple(null, null, false)
            }
        }

        // Overlay MovieDetailsScreen
        if (selectedMovieForDetails != null) {
            val movie = selectedMovieForDetails!!
            val isFav = favorites.any { it.contentId == movie.id }
            val hist = history.find { it.streamUrl == movie.streamUrl }
            MovieDetailsScreen(
                movie = movie,
                isFavorite = isFav,
                historyItem = hist,
                onBack = { selectedMovieForDetails = null },
                onToggleFavorite = { viewModel.toggleFavoriteMovie(it) },
                onPlay = { streamUrl, title, type, _ ->
                    if (streamUrl.isNotBlank()) {
                        playMedia(streamUrl, title, type, null, null)
                    } else {
                        coroutineScope.launch(Dispatchers.IO) {
                            val matched = viewModel.findLocalMovieStream(movie.name, movie.year)
                            withContext(Dispatchers.Main) {
                                if (matched != null && matched.streamUrl.isNotBlank()) {
                                    playMedia(matched.streamUrl, title, type, null, null)
                                } else {
                                    android.widget.Toast.makeText(context, "Conteúdo não disponível no seu servidor IPTV", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    }
                },
                onNavigateToPlayer = { route ->
                    val rawUrl = NavDestinations.parseStreamUrl(route.removePrefix("player_screen/"))
                    if (rawUrl.isNotBlank()) {
                        navigateToRoute(route)
                    } else {
                        coroutineScope.launch(Dispatchers.IO) {
                            val matched = viewModel.findLocalMovieStream(movie.name, movie.year)
                            withContext(Dispatchers.Main) {
                                if (matched != null && matched.streamUrl.isNotBlank()) {
                                    navigateToRoute(NavDestinations.buildPlayerRoute(matched.streamUrl))
                                } else {
                                    android.widget.Toast.makeText(context, "Conteúdo não disponível no seu servidor IPTV", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    }
                },
                onLoadDetails = { m, callback ->
                    viewModel.getMovieDetailsOnDemand(m, callback)
                }
            )
        }

        // Overlay PlayerScreen in full screen above previous view without destroying navigation state
        if (activePlayingMedia != null) {
            val media = activePlayingMedia!!
            val series = nextEpisodeInfo.first
            val nextEp = nextEpisodeInfo.second
            val hasNext = nextEpisodeInfo.third
            val nextTitle = if (series != null && nextEp != null) "${series.name} - ${nextEp.title}" else null

            PlayerScreen(
                streamUrl = media.url,
                title = media.title,
                contentType = media.type,
                isInPipMode = isInPipMode,
                initialPosition = media.initialPosition,
                onProgressUpdate = { pos, dur ->
                    viewModel.updatePlaybackProgress(media.url, pos, dur)
                },
                onMarkWatched = {
                    viewModel.markAsWatched(media.url)
                },
                hasNextEpisode = hasNext,
                nextEpisodeTitle = nextTitle,
                onPlayNextEpisode = {
                    if (series != null && nextEp != null) {
                        playMedia(nextEp.streamUrl, "${series.name} - ${nextEp.title}", ContentType.SERIES, series, nextEp)
                    }
                },
                onClose = { activePlayingMedia = null }
            )
        }
    }
}
