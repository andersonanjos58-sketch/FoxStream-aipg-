package com.foxstream.app.ui.screens

import android.content.Context
import android.provider.Settings
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.compose.ui.graphics.RectangleShape
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.Media
import org.videolan.libvlc.util.VLCVideoLayout
import android.net.Uri
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import com.foxstream.app.R
import com.foxstream.app.data.model.*
import com.foxstream.app.ui.AppNavTab
import com.foxstream.app.ui.theme.OrangePrimary
import com.foxstream.app.util.SearchUtils
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers


// ==========================================
// IMAGE CACHING AND LOADER COMPOSABLE
// ==========================================
@Composable
fun CoilPosterImage(
    url: String?,
    placeholderIcon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    if (url.isNullOrBlank()) {
        Box(
            modifier = modifier.background(Color(0xFF141722)),
            contentAlignment = Alignment.Center
        ) {
            Icon(placeholderIcon, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(24.dp))
        }
    } else {
        Box(
            modifier = modifier.background(Color(0xFF141722)),
            contentAlignment = Alignment.Center
        ) {
            Icon(placeholderIcon, contentDescription = null, tint = Color.DarkGray, modifier = Modifier.size(20.dp))
            AsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = contentScale
            )
        }
    }
}

// ==========================================
// 1. SECTION HEADERS & HELPERS
// ==========================================
@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
    )
}

@Composable
fun SectionHeaderWithAction(
    title: String,
    actionText: String = "Ver todos",
    onAction: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        TextButton(
            onClick = onAction,
            contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Text(
                text = actionText,
                color = OrangePrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.width(2.dp))
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = OrangePrimary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun CategoryFilterRow(
    categories: List<String>,
    selectedCategory: String,
    onSelectCategory: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    if (categories.size <= 1) return

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(categories) { cat ->
            val isSelected = cat == selectedCategory
            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .clickable { onSelectCategory(cat) },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) OrangePrimary else Color(0xFF1C2030),
                contentColor = if (isSelected) Color.White else Color(0xFFB0B5C6),
                tonalElevation = if (isSelected) 4.dp else 0.dp
            ) {
                Text(
                    text = cat,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HeroBannerCarousel(
    items: List<HeroBannerItem>,
    isLoading: Boolean = false,
    onPlay: (String, String, ContentType) -> Unit,
    onOpenSeries: (SeriesItem) -> Unit,
    onOpenMovie: (MovieItem) -> Unit = {}
) {
    if (items.isEmpty()) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            shape = RoundedCornerShape(16.dp),
            color = Color(0xFF141722),
            tonalElevation = 2.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 32.dp, horizontal = 16.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        strokeWidth = 3.dp,
                        color = OrangePrimary
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Carregando destaques...",
                        color = Color.Gray,
                        fontSize = 13.sp
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Tv,
                        contentDescription = null,
                        tint = OrangePrimary.copy(alpha = 0.7f),
                        modifier = Modifier.size(40.dp)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Nenhum conteúdo com imagem em destaque disponível",
                        color = Color.Gray,
                        fontSize = 12.sp,
                        maxLines = 1
                    )
                }
            }
        }
        return
    }

    val pagerState = rememberPagerState(pageCount = { items.size })
    val isDragged by pagerState.interactionSource.collectIsDraggedAsState()

    // Auto-Scroll automático com intervalo de 3 segundos e pausa na interação/arrasto
    if (items.size > 1) {
        LaunchedEffect(pagerState, isDragged, items.size) {
            if (!isDragged) {
                while (true) {
                    delay(3000L)
                    if (!isDragged) {
                        try {
                            val nextPage = (pagerState.currentPage + 1) % items.size
                            pagerState.animateScrollToPage(nextPage)
                        } catch (_: Exception) {}
                    }
                }
            }
        }
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier
                .fillMaxWidth()
                .height(275.dp),
            contentPadding = PaddingValues(horizontal = 16.dp),
            pageSpacing = 12.dp
        ) { page ->
            val item = items[page]
            val typeBadge = when (item.type) {
                ContentType.LIVE -> "AO VIVO"
                ContentType.MOVIE -> "FILME"
                ContentType.SERIES -> "SÉRIE"
            }

            Surface(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(18.dp))
                    .clickable {
                        if (item.type == ContentType.SERIES && item.seriesItem != null) {
                            onOpenSeries(item.seriesItem)
                        } else if (item.type == ContentType.MOVIE && item.movieItem != null) {
                            onOpenMovie(item.movieItem)
                        } else if (item.streamUrl.isNotBlank()) {
                            onPlay(item.streamUrl, item.title, item.type)
                        }
                    },
                shape = RoundedCornerShape(18.dp),
                color = Color(0xFF141722),
                tonalElevation = 4.dp
            ) {
                Box(modifier = Modifier.fillMaxSize()) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )

                    // Cinematic dark gradient for text readability
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color(0x33000000),
                                        Color(0x550B0E14),
                                        Color(0xCC0B0E14),
                                        Color(0xF00B0E14)
                                    ),
                                    startY = 0f
                                )
                            )
                    )

                    // Top pill: Tipo
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = Color.Black.copy(alpha = 0.65f)
                        ) {
                            Text(
                                text = typeBadge,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                        }
                    }

                    // Bottom info & "Assistir" button
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        if (!item.badgeInfo.isNullOrBlank()) {
                            Text(
                                text = item.badgeInfo,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = OrangePrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                        }

                        Text(
                            text = item.title,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Botão Principal ("Assistir")
                        Button(
                            onClick = {
                                if (item.streamUrl.isNotBlank()) {
                                    onPlay(item.streamUrl, item.title, item.type)
                                } else if (item.type == ContentType.SERIES && item.seriesItem != null) {
                                    onOpenSeries(item.seriesItem)
                                } else if (item.type == ContentType.MOVIE && item.movieItem != null) {
                                    onOpenMovie(item.movieItem)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White,
                                contentColor = Color(0xFF0F1118)
                            ),
                            shape = RoundedCornerShape(50),
                            contentPadding = PaddingValues(horizontal = 18.dp, vertical = 6.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = Color(0xFF0F1118),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(5.dp))
                            Text(
                                text = "Assistir",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = Color(0xFF0F1118)
                            )
                        }
                    }
                }
            }
        }

        if (items.size > 1) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(items.size) { index ->
                    val isSelected = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .padding(horizontal = 3.dp)
                            .height(5.dp)
                            .width(if (isSelected) 20.dp else 6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(if (isSelected) OrangePrimary else Color.White.copy(alpha = 0.35f))
                    )
                }
            }
        }
    }
}

// ==========================================
// 1.1 SPOTLIGHT BANNER (LARGURA TOTAL 100%, BORDAS RETAS 0PX)
// ==========================================
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SpotlightBannerCarousel(
    items: List<HeroBannerItem>,
    onPlay: (String, String, ContentType) -> Unit,
    onOpenSeries: (SeriesItem) -> Unit,
    onOpenMovie: (MovieItem) -> Unit = {}
) {
    if (items.isEmpty()) return

    val pagerState = rememberPagerState(pageCount = { items.size })
    val isDragged by pagerState.interactionSource.collectIsDraggedAsState()

    // Auto-Scroll automático com intervalo de 3 segundos e pausa na interação
    if (items.size > 1) {
        LaunchedEffect(pagerState, isDragged, items.size) {
            if (!isDragged) {
                while (true) {
                    delay(3000L)
                    if (!isDragged) {
                        try {
                            val nextPage = (pagerState.currentPage + 1) % items.size
                            pagerState.animateScrollToPage(nextPage)
                        } catch (_: Exception) {}
                    }
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(160.dp) // Largura total 100%, mais retangular na horizontal (ajustado +20% conforme solicitado)
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(0.dp),
            pageSpacing = 0.dp
        ) { page ->
            val item = items[page]
            val typeBadge = when (item.type) {
                ContentType.LIVE -> "AO VIVO"
                ContentType.MOVIE -> "FILME"
                ContentType.SERIES -> "SÉRIE"
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable {
                        if (item.type == ContentType.SERIES && item.seriesItem != null) {
                            onOpenSeries(item.seriesItem)
                        } else if (item.type == ContentType.MOVIE && item.movieItem != null) {
                            onOpenMovie(item.movieItem)
                        } else if (item.streamUrl.isNotBlank()) {
                            onPlay(item.streamUrl, item.title, item.type)
                        }
                    }
            ) {
                // Imagem de largura total (100% da tela, sem margens laterais, bordas retas 0px)
                AsyncImage(
                    model = item.imageUrl,
                    contentDescription = item.title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Gradientes cinematográficos
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color(0x22000000),
                                    Color(0x66080A10),
                                    Color(0xCC080A10),
                                    Color(0xFF080A10)
                                ),
                                startY = 0f
                            )
                        )
                )

                // Textos e elementos sobrepostos na imagem do banner
                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    // Tags: "FILME • ★ 0.0/5 • ★RC | Dublado | Drama"
                    val ratingStr = item.movieItem?.rating ?: item.seriesItem?.rating
                    val ratingTag = if (!ratingStr.isNullOrBlank()) "★ $ratingStr/5" else "★ 0.0/5"
                    val catTag = item.category.trim().takeIf { it.isNotBlank() && it != "Filmes" && it != "Séries" }
                    val tagsText = listOfNotNull(typeBadge, ratingTag, catTag).joinToString(" • ")

                    Text(
                        text = tagsText,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = OrangePrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(2.dp))

                    // Título ("#Horror (Dublado) - 2015 - 1080p")
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    // Botão branco "Assistir" com ícone e texto pretos
                    Button(
                        onClick = {
                            if (item.type == ContentType.SERIES && item.seriesItem != null) {
                                onOpenSeries(item.seriesItem)
                            } else if (item.type == ContentType.MOVIE && item.movieItem != null) {
                                onOpenMovie(item.movieItem)
                            } else if (item.streamUrl.isNotBlank()) {
                                onPlay(item.streamUrl, item.title, item.type)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White,
                            contentColor = Color.Black
                        ),
                        shape = RoundedCornerShape(24.dp),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Assistir",
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Color.Black
                        )
                    }
                }
            }
        }

        // Pager Dots
        if (items.size > 1) {
            Row(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(items.size) { index ->
                    val isSelected = pagerState.currentPage == index
                    Box(
                        modifier = Modifier
                            .height(4.dp)
                            .width(if (isSelected) 18.dp else 5.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(if (isSelected) Color.White else Color.White.copy(alpha = 0.35f))
                    )
                }
            }
        }
    }
}

// ==========================================
// 2. HOME SCREEN
// ==========================================
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    playlists: List<Playlist>,
    activePlaylistId: String?,
    history: List<HistoryItem>,
    favorites: List<FavoriteItem>,
    channels: List<LiveChannel>,
    movies: List<MovieItem>,
    seriesList: List<SeriesItem>,
    popularMovies: List<MovieItem> = emptyList(),
    popularSeries: List<SeriesItem> = emptyList(),
    newReleases: List<MovieItem> = emptyList(),
    trendingMovies: List<MovieItem> = emptyList(),
    featuredBannerItems: List<HeroBannerItem> = emptyList(),
    precomputedCategoryCarousels: List<CategoryCarouselItem> = emptyList(),
    previewMovies: List<MovieItem> = emptyList(),
    previewSeries: List<SeriesItem> = emptyList(),
    favoriteIdsSet: Set<String> = emptySet(),
    isLoading: Boolean = false,
    onPlay: (String, String, ContentType) -> Unit,
    onNavigate: (AppNavTab) -> Unit,
    onOpenAdd: () -> Unit,
    onToggleFavoriteChannel: (LiveChannel) -> Unit = {},
    onToggleFavoriteMovie: (MovieItem) -> Unit = {},
    onOpenSeries: (SeriesItem) -> Unit = {},
    onOpenMovie: (MovieItem) -> Unit = {},
    onRemoveHistory: (HistoryItem) -> Unit = {}
) {

    if (playlists.isEmpty() && isLoading) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(16.dp))
                Text("Carregando listas...", color = Color.Gray, fontSize = 14.sp)
            }
        }
        return
    }

    if (playlists.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Image(
                    painter = painterResource(id = R.drawable.foxstream_logo),
                    contentDescription = "FoxStream Logo",
                    modifier = Modifier.size(80.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Bem-vindo ao FoxStream",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Adicione sua lista M3U/M3U8 ou conta Xtream Codes para começar.",
                    color = Color.Gray,
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = onOpenAdd,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Adicionar Lista")
                }
            }
        }
        return
    }

    // Fast O(1) favorite IDs lookup
    val effectiveFavoriteIds = remember(favorites, favoriteIdsSet) {
        if (favoriteIdsSet.isNotEmpty()) favoriteIdsSet
        else favorites.mapNotNull { it.contentId }.toSet()
    }

    // Pre-computed map of posters for history items (zero linear scan)
    val historyPosters = remember(history) {
        val map = mutableMapOf<String, String>()
        for (item in history) {
            if (!item.posterUrl.isNullOrBlank()) {
                map[item.id] = item.posterUrl
            }
        }
        map
    }

    // Pre-computed category carousels: prioritizes ViewModel pre-computed background result (0ms UI lag)
    val categoryCarousels = remember(precomputedCategoryCarousels, movies, seriesList, channels) {
        if (precomputedCategoryCarousels.isNotEmpty()) {
            precomputedCategoryCarousels
        } else {
            val catsWithCounts = mutableMapOf<String, Int>()
            movies.take(300).forEach { m ->
                val c = m.category.trim()
                if (c.isNotBlank() && !c.equals("Filmes", ignoreCase = true) && !c.equals("Geral", ignoreCase = true)) {
                    catsWithCounts[c] = (catsWithCounts[c] ?: 0) + 1
                }
            }
            val topCats = catsWithCounts.entries.sortedByDescending { it.value }.map { it.key }.take(6)
            val moviesByCat = movies.groupBy { it.category.trim().lowercase() }
            topCats.mapNotNull { catName ->
                val catMovies = moviesByCat[catName.lowercase()]?.take(25) ?: emptyList()
                if (catMovies.isNotEmpty()) {
                    CategoryCarouselItem(title = catName, type = ContentType.MOVIE, movies = catMovies)
                } else null
            }
        }
    }

    // Dynamic Hero Banner items: prioritizes TMDB matched content from user's active playlist
    val heroItems = remember(featuredBannerItems, movies, seriesList, channels) {
        if (featuredBannerItems.isNotEmpty()) {
            featuredBannerItems
        } else {
            val list = mutableListOf<HeroBannerItem>()

            // Movies with posters
            movies.take(6).forEach { movie ->
                list.add(
                    HeroBannerItem(
                        id = "movie_${movie.id}",
                        title = movie.name,
                        imageUrl = movie.backdropUrl ?: movie.posterUrl ?: "",
                        category = movie.category,
                        type = ContentType.MOVIE,
                        streamUrl = movie.streamUrl,
                        badgeInfo = listOfNotNull(
                            "FILME",
                            movie.year,
                            movie.rating?.let { "★ $it" },
                            movie.category.takeIf { it.isNotBlank() && it != "Filmes" }
                        ).joinToString(" • "),
                        overview = movie.description,
                        year = movie.year,
                        movieItem = movie
                    )
                )
            }

            // Series with posters
            seriesList.take(4).forEach { s ->
                val firstEpUrl = s.seasons.firstOrNull()?.episodes?.firstOrNull()?.streamUrl ?: ""
                list.add(
                    HeroBannerItem(
                        id = "series_${s.id}",
                        title = s.name,
                        imageUrl = s.posterUrl ?: "",
                        category = s.category,
                        type = ContentType.SERIES,
                        streamUrl = firstEpUrl,
                        badgeInfo = listOfNotNull(
                            "SÉRIE",
                            s.year,
                            s.rating?.let { "★ $it" },
                            s.category.takeIf { it.isNotBlank() && it != "Séries" }
                        ).joinToString(" • "),
                        overview = s.description,
                        year = s.year,
                        seriesItem = s
                    )
                )
            }

            // Live Channels with logos
            channels.filter { !it.logoUrl.isNullOrBlank() }.take(3).forEach { ch ->
                list.add(
                    HeroBannerItem(
                        id = "channel_${ch.id}",
                        title = ch.name,
                        imageUrl = ch.logoUrl!!,
                        category = ch.category,
                        type = ContentType.LIVE,
                        streamUrl = ch.streamUrl,
                        badgeInfo = listOfNotNull("AO VIVO", ch.category.ifBlank { null }).joinToString(" • ")
                    )
                )
            }

            list.distinctBy { it.id }.take(8)
        }
    }

    val homeListState = rememberLazyListState()

    LazyColumn(
        state = homeListState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {


            // 2. Destaques (Hero Banner Carousel)
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "EM DESTAQUE",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = OrangePrimary
                        )
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
                HeroBannerCarousel(
                    items = heroItems,
                    isLoading = isLoading,
                    onPlay = onPlay,
                    onOpenSeries = onOpenSeries,
                    onOpenMovie = onOpenMovie
                )
            }

            // 3. Continue Assistindo (History)
            if (history.isNotEmpty()) {
                item {
                    val continueCardWidth = (LocalConfiguration.current.screenWidthDp.dp * 0.47f).coerceIn(155.dp, 215.dp)
                    var selectedContinueWatchingId by remember { mutableStateOf<String?>(null) }
                    Spacer(modifier = Modifier.height(2.dp))
                    SectionHeader("Continue Assistindo")
                    Spacer(modifier = Modifier.height(4.dp))
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(history, key = { it.id }) { item ->
                            val isSelected = selectedContinueWatchingId == item.id
                            val posterToUse = historyPosters[item.id] ?: item.posterUrl
                            val placeholderIcon = when (item.type) {
                                ContentType.LIVE -> Icons.Default.Tv
                                ContentType.MOVIE -> Icons.Default.Movie
                                ContentType.SERIES -> Icons.Default.LiveTv
                            }
                            Surface(
                                modifier = Modifier
                                    .width(continueCardWidth)
                                    .combinedClickable(
                                        onClick = {
                                            if (selectedContinueWatchingId == item.id) {
                                                selectedContinueWatchingId = null
                                            } else {
                                                onPlay(item.streamUrl, item.title, item.type)
                                            }
                                        },
                                        onLongClick = {
                                            selectedContinueWatchingId = item.id
                                        }
                                    ),
                                shape = RoundedCornerShape(10.dp),
                                color = MaterialTheme.colorScheme.surface,
                                tonalElevation = 1.dp
                            ) {
                                Box {
                                    Column {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .aspectRatio(16f / 9.5f)
                                                .clip(RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                                        ) {
                                            CoilPosterImage(
                                                url = posterToUse,
                                                placeholderIcon = placeholderIcon,
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = ContentScale.Crop
                                            )
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxSize()
                                                    .background(
                                                        Brush.verticalGradient(
                                                            colors = listOf(
                                                                Color.Black.copy(alpha = 0.15f),
                                                                Color.Black.copy(alpha = 0.65f)
                                                            )
                                                        )
                                                    )
                                            )
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = if (item.type == ContentType.LIVE) Color(0xFFE50914) else Color.Black.copy(alpha = 0.75f),
                                                modifier = Modifier
                                                    .padding(6.dp)
                                                    .align(Alignment.TopStart)
                                            ) {
                                                Text(
                                                    text = when (item.type) {
                                                        ContentType.LIVE -> "LIVE"
                                                        ContentType.MOVIE -> "FILME"
                                                        ContentType.SERIES -> "SÉRIE"
                                                    },
                                                    color = Color.White,
                                                    fontSize = 8.5.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    letterSpacing = 0.5.sp,
                                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                                )
                                            }
                                            Surface(
                                                shape = CircleShape,
                                                color = Color.Black.copy(alpha = 0.55f),
                                                modifier = Modifier
                                                    .size(28.dp)
                                                    .align(Alignment.Center)
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Icon(
                                                        imageVector = Icons.Default.PlayArrow,
                                                        contentDescription = null,
                                                        tint = OrangePrimary,
                                                        modifier = Modifier.size(16.dp)
                                                    )
                                                }
                                            }
                                            if (item.type != ContentType.LIVE && item.duration > 0L) {
                                                val progress = (item.playbackPosition.toFloat() / item.duration.toFloat()).coerceIn(0f, 1f)
                                                if (progress > 0.01f) {
                                                    LinearProgressIndicator(
                                                        progress = progress,
                                                        modifier = Modifier
                                                            .fillMaxWidth()
                                                            .height(2.5.dp)
                                                            .align(Alignment.BottomCenter),
                                                        color = OrangePrimary,
                                                        trackColor = Color(0x66000000)
                                                    )
                                                }
                                            }
                                        }

                                        Text(
                                            text = item.title,
                                            fontWeight = FontWeight.SemiBold,
                                            color = Color.White,
                                            fontSize = 11.5.sp,
                                            lineHeight = 15.sp,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                        )
                                    }

                                    if (isSelected) {
                                        Box(
                                            modifier = Modifier
                                                .matchParentSize()
                                                .background(Color.Black.copy(alpha = 0.85f))
                                                .clickable { selectedContinueWatchingId = null }
                                                .padding(8.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Column(
                                                horizontalAlignment = Alignment.CenterHorizontally,
                                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Button(
                                                    onClick = {
                                                        selectedContinueWatchingId = null
                                                        onPlay(item.streamUrl, item.title, item.type)
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                                    modifier = Modifier.fillMaxWidth().height(30.dp),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Default.PlayArrow,
                                                        contentDescription = null,
                                                        tint = Color.White,
                                                        modifier = Modifier.size(13.dp)
                                                    )
                                                    Spacer(modifier = Modifier.width(3.dp))
                                                    Text("Continuar", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                                }

                                                Button(
                                                    onClick = {
                                                        selectedContinueWatchingId = null
                                                        onRemoveHistory(item)
                                                    },
                                                    colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray.copy(alpha = 0.9f)),
                                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                                    modifier = Modifier.fillMaxWidth().height(30.dp),
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Icon(
                                                        imageVector = Icons.Default.Delete,
                                                        contentDescription = null,
                                                        tint = Color.White,
                                                        modifier = Modifier.size(13.dp)
                                                    )
                                                    Spacer(modifier = Modifier.width(3.dp))
                                                    Text("Excluir", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                }
            }

            // 4. Favoritos
            if (favorites.isNotEmpty()) {
                item {
                    SectionHeader("Favoritos")
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(favorites) { item ->
                            Surface(
                                modifier = Modifier
                                    .width(140.dp)
                                    .clickable { item.streamUrl?.let { onPlay(it, item.title, item.type) } },
                                shape = RoundedCornerShape(16.dp),
                                color = MaterialTheme.colorScheme.surface
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    CoilPosterImage(
                                        url = item.posterUrl,
                                        placeholderIcon = Icons.Default.Favorite,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(110.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(item.title, fontWeight = FontWeight.SemiBold, color = Color.White, maxLines = 1)
                                    Text(item.category, fontSize = 10.sp, color = Color.Gray)
                                }
                            }
                        }
                    }
                }
            }

            // 5. Filmes (Lista Principal M3U / Xtream - amostra fluida otimizada para Home)
            val displayMovies = if (previewMovies.isNotEmpty()) previewMovies else movies.take(30)
            if (displayMovies.isNotEmpty()) {
                item {
                    SectionHeaderWithAction(
                        title = "Filmes",
                        actionText = "Ver todos",
                        onAction = { onNavigate(AppNavTab.MOVIES) }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    MoviesHorizontalCarousel(
                        movies = displayMovies,
                        favorites = favorites,
                        favoriteIds = effectiveFavoriteIds,
                        onPlay = onPlay,
                        onOpenMovie = onOpenMovie,
                        onToggleFavorite = onToggleFavoriteMovie
                    )
                }
            }

            // 6. Séries (Lista Principal M3U / Xtream - amostra fluida otimizada para Home)
            val displaySeries = if (previewSeries.isNotEmpty()) previewSeries else seriesList.take(30)
            if (displaySeries.isNotEmpty()) {
                item {
                    SectionHeaderWithAction(
                        title = "Séries",
                        actionText = "Ver todos",
                        onAction = { onNavigate(AppNavTab.SERIES) }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    SeriesHorizontalCarousel(
                        seriesList = displaySeries,
                        onOpenSeries = onOpenSeries
                    )
                }
            }

            // 7. Filmes Populares
            if (popularMovies.isNotEmpty()) {
                item {
                    SectionHeaderWithAction(
                        title = "Filmes populares",
                        actionText = "Ver todos",
                        onAction = { onNavigate(AppNavTab.MOVIES) }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    MoviesHorizontalCarousel(
                        movies = popularMovies,
                        favorites = favorites,
                        onPlay = onPlay,
                        onOpenMovie = onOpenMovie,
                        onToggleFavorite = onToggleFavoriteMovie
                    )
                }
            }

            // 8. Séries Populares
            if (popularSeries.isNotEmpty()) {
                item {
                    SectionHeaderWithAction(
                        title = "Séries populares",
                        actionText = "Ver todos",
                        onAction = { onNavigate(AppNavTab.SERIES) }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    SeriesHorizontalCarousel(
                        seriesList = popularSeries,
                        onOpenSeries = onOpenSeries
                    )
                }
            }

            // 9. Lançamentos
            if (newReleases.isNotEmpty()) {
                item {
                    SectionHeaderWithAction(
                        title = "Lançamentos",
                        actionText = "Ver todos",
                        onAction = { onNavigate(AppNavTab.MOVIES) }
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    MoviesHorizontalCarousel(
                        movies = newReleases,
                        favorites = favorites,
                        onPlay = onPlay,
                        onOpenMovie = onOpenMovie,
                        onToggleFavorite = onToggleFavoriteMovie
                    )
                }
            }

            // 10. Carrosséis Dinâmicos por Categorias (Reciclados de forma fluida e sob demanda)
            items(categoryCarousels, key = { "home_cat_${it.title}_${it.type}" }) { carousel ->
                val targetTab = when (carousel.type) {
                    ContentType.MOVIE -> AppNavTab.MOVIES
                    ContentType.SERIES -> AppNavTab.SERIES
                    ContentType.LIVE -> AppNavTab.LIVE
                }
                SectionHeaderWithAction(
                    title = carousel.title,
                    actionText = "Ver todos",
                    onAction = { onNavigate(targetTab) }
                )
                Spacer(modifier = Modifier.height(6.dp))
                when (carousel.type) {
                    ContentType.MOVIE -> MoviesHorizontalCarousel(
                        movies = carousel.movies,
                        favorites = favorites,
                        favoriteIds = effectiveFavoriteIds,
                        onPlay = onPlay,
                        onOpenMovie = onOpenMovie,
                        onToggleFavorite = onToggleFavoriteMovie
                    )
                    ContentType.SERIES -> SeriesHorizontalCarousel(
                        seriesList = carousel.series,
                        onOpenSeries = onOpenSeries
                    )
                    ContentType.LIVE -> LiveChannelsHorizontalCarousel(
                        channels = carousel.channels,
                        favorites = favorites,
                        favoriteIds = effectiveFavoriteIds,
                        onPlay = onPlay,
                        onToggleFavorite = onToggleFavoriteChannel
                    )
                }
            }
    }
}

@Composable
fun LiveChannelsHorizontalCarousel(
    channels: List<LiveChannel>,
    favorites: List<FavoriteItem>,
    onPlay: (String, String, ContentType) -> Unit,
    onLoadMore: (() -> Unit)? = null,
    onToggleFavorite: (LiveChannel) -> Unit,
    favoriteIds: Set<String> = emptySet()
) {
    val listState = rememberLazyListState()

    val shouldLoadMore = remember {
        derivedStateOf {
            val total = listState.layoutInfo.totalItemsCount
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            total > 0 && lastVisible >= total - 4
        }
    }

    LaunchedEffect(shouldLoadMore.value) {
        if (shouldLoadMore.value && onLoadMore != null) {
            onLoadMore()
        }
    }

    LazyRow(
        state = listState,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        items(channels, key = { it.id }) { channel ->
            val isFav = channel.isFavorite || (if (favoriteIds.isNotEmpty()) favoriteIds.contains(channel.id) else favorites.any { it.contentId == channel.id })
            Box(modifier = Modifier.width(175.dp)) {
                LiveChannelGridCard(
                    channel = channel,
                    isFavorite = isFav,
                    onPlay = onPlay,
                    onToggleFavorite = onToggleFavorite
                )
            }
        }
    }
}

@Composable
fun MoviesHorizontalCarousel(
    movies: List<MovieItem>,
    favorites: List<FavoriteItem>,
    onPlay: (String, String, ContentType) -> Unit,
    onOpenMovie: (MovieItem) -> Unit,
    onLoadMore: (() -> Unit)? = null,
    onToggleFavorite: (MovieItem) -> Unit,
    favoriteIds: Set<String> = emptySet()
) {
    val listState = rememberLazyListState()

    val shouldLoadMore = remember {
        derivedStateOf {
            val total = listState.layoutInfo.totalItemsCount
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            total > 0 && lastVisible >= total - 4
        }
    }

    LaunchedEffect(shouldLoadMore.value) {
        if (shouldLoadMore.value && onLoadMore != null) {
            onLoadMore()
        }
    }

    LazyRow(
        state = listState,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        items(movies, key = { it.id }) { movie ->
            val isFav = movie.isFavorite || (if (favoriteIds.isNotEmpty()) favoriteIds.contains(movie.id) else favorites.any { it.contentId == movie.id })
            Box(modifier = Modifier.width(135.dp)) {
                MovieGridCard(
                    movie = movie,
                    isFavorite = isFav,
                    onPlay = onPlay,
                    onOpenMovie = onOpenMovie,
                    onToggleFavorite = onToggleFavorite
                )
            }
        }
    }
}

@Composable
fun SeriesHorizontalCarousel(
    seriesList: List<SeriesItem>,
    onLoadMore: (() -> Unit)? = null,
    onOpenSeries: (SeriesItem) -> Unit
) {
    val listState = rememberLazyListState()

    val shouldLoadMore = remember {
        derivedStateOf {
            val total = listState.layoutInfo.totalItemsCount
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            total > 0 && lastVisible >= total - 4
        }
    }

    LaunchedEffect(shouldLoadMore.value) {
        if (shouldLoadMore.value && onLoadMore != null) {
            onLoadMore()
        }
    }

    LazyRow(
        state = listState,
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        items(seriesList, key = { it.id }) { s ->
            Box(modifier = Modifier.width(135.dp)) {
                SeriesGridCard(
                    series = s,
                    onSelect = { onOpenSeries(s) }
                )
            }
        }
    }
}

// ==========================================
// 2. LIVE TV SCREEN
// ==========================================
@Composable
fun LiveTvScreen(
    channels: List<LiveChannel>,
    onPlay: (String, String, ContentType) -> Unit,
    onToggleFavorite: (LiveChannel) -> Unit,
    favorites: List<FavoriteItem> = emptyList()
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val prefs = remember(context) {
        context.getSharedPreferences("foxstream_prefs", Context.MODE_PRIVATE)
    }

    // Persisted last watched channel recovery
    val lastSavedChannelId = remember(prefs) {
        prefs.getString("last_live_channel_id", null)
    }

    // Embedded Player States - automatically initialize with last watched channel
    var activeChannel by remember {
        val initial = if (!lastSavedChannelId.isNullOrBlank()) {
            channels.find { it.id == lastSavedChannelId } ?: channels.firstOrNull()
        } else {
            channels.firstOrNull()
        }
        mutableStateOf<LiveChannel?>(initial)
    }
    var isLoadingStream by remember { mutableStateOf(false) }
    var isPlaying by remember { mutableStateOf(false) }
    var isMuted by remember { mutableStateOf(false) }
    var isPaused by remember { mutableStateOf(false) }
    var playerError by remember { mutableStateOf<String?>(null) }
    var retryTrigger by remember { mutableIntStateOf(0) }
    var showControls by remember { mutableStateOf(true) }
    var isFullScreen by remember { mutableStateOf(false) }

    BackHandler(enabled = isFullScreen) {
        isFullScreen = false
    }

    // Keep active channel in sync if list loads after mount or returns from another tab
    LaunchedEffect(channels) {
        if (channels.isNotEmpty()) {
            val savedId = prefs.getString("last_live_channel_id", null)
            val restored = if (!savedId.isNullOrBlank()) {
                channels.find { it.id == savedId }
            } else null

            if (activeChannel == null) {
                activeChannel = restored ?: channels.firstOrNull()
            } else if (restored != null && activeChannel?.id != restored.id && activeChannel == channels.firstOrNull()) {
                activeChannel = restored
            }
        }
    }

    // Automatically persist last watched live channel whenever it changes
    LaunchedEffect(activeChannel?.id) {
        activeChannel?.id?.let { id ->
            prefs.edit().putString("last_live_channel_id", id).apply()
        }
    }

    // Dedicated LibVLC instance for embedded Live TV player
    val libVLC = remember(context) {
        val options = ArrayList<String>().apply {
            add("--http-reconnect")
            add("--network-caching=5000")
            add("-vvv")
        }
        val instance = LibVLC(context, options)
        instance.setUserAgent("FoxStream", "VLC/3.0.18 LibVLC/3.0.18")
        instance
    }

    val vlcMediaPlayer = remember(libVLC) {
        MediaPlayer(libVLC)
    }

    DisposableEffect(libVLC, vlcMediaPlayer) {
        onDispose {
            vlcMediaPlayer.stop()
            vlcMediaPlayer.detachViews()
            vlcMediaPlayer.release()
            libVLC.release()
        }
    }

    DisposableEffect(lifecycleOwner, vlcMediaPlayer) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> {
                    vlcMediaPlayer.pause()
                }
                Lifecycle.Event.ON_RESUME -> {
                    if (!isPaused && activeChannel != null) {
                        vlcMediaPlayer.play()
                    }
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(activeChannel?.streamUrl, retryTrigger) {
        val streamUrl = activeChannel?.streamUrl
        if (!streamUrl.isNullOrBlank()) {
            isLoadingStream = true
            playerError = null
            android.util.Log.d("FoxStreamDebug", "Tentando reproduzir: $streamUrl")
            try {
                val cleanedUrl = streamUrl.trim().replace("\r", "").replace("\n", "").replace(" ", "%20")
                val media = Media(libVLC, Uri.parse(cleanedUrl)).apply {
                    addOption(":http-user-agent=VLC/3.0.18 LibVLC/3.0.18")
                    addOption(":http-referrer=")
                    addOption(":http-reconnect=1")
                    addOption(":network-caching=5000")
                }
                vlcMediaPlayer.media = media
                media.release()
                if (!isPaused) {
                    val result = vlcMediaPlayer.play()
                    android.util.Log.d("FoxStreamDebug", "Resultado do play(): $result")
                    isPlaying = true
                }
                isLoadingStream = false
            } catch (e: Exception) {
                android.util.Log.e("FoxStreamDebug", "Erro ao reproduzir: ${e.message}")
                isLoadingStream = false
                playerError = "Falha ao carregar URL do canal."
            }
        }
    }

    LaunchedEffect(isMuted) {
        vlcMediaPlayer.volume = if (isMuted) 0 else 100
    }

    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying) {
            delay(4000)
            showControls = false
        }
    }

    // Search & Filtering States
    var searchQuery by remember { mutableStateOf("") }
    var debouncedSearchQuery by remember { mutableStateOf("") }
    var filtered by remember { mutableStateOf<List<LiveChannel>>(emptyList()) }
    var isEpgView by remember { mutableStateOf(false) }

    LaunchedEffect(searchQuery) {
        delay(300)
        debouncedSearchQuery = searchQuery
    }

    val favoriteIds = remember(favorites) { favorites.map { it.contentId }.toSet() }

    val categories = remember(channels, favorites) {
        val baseCategories = channels.map { it.category.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()
        val hasFavs = channels.any { it.isFavorite || favoriteIds.contains(it.id) }
        val list = mutableListOf("Todos os canais")
        if (hasFavs) {
            list.add("❤️ Favoritos")
        }
        list.addAll(baseCategories)
        list
    }
    var selectedCategory by remember { mutableStateOf("Todos os canais") }

    LaunchedEffect(debouncedSearchQuery, selectedCategory, channels, favorites) {
        val result = withContext(Dispatchers.Default) {
            var list = when {
                selectedCategory == "Todos os canais" || selectedCategory == "Todos" -> channels
                selectedCategory == "❤️ Favoritos" -> channels.filter { it.isFavorite || favoriteIds.contains(it.id) }
                else -> channels.filter { it.category.equals(selectedCategory, ignoreCase = true) }
            }
            val tokens = SearchUtils.extractTokens(debouncedSearchQuery)
            if (tokens.isNotEmpty()) {
                list = list.filter {
                    SearchUtils.matchesAnyField(tokens, it.name, it.category)
                }
            }
            list
        }
        filtered = result
    }

    // Current active EPG programs
    val activeEpgPrograms = remember(activeChannel?.id) {
        activeChannel?.let { generateEpgPrograms(it) } ?: emptyList()
    }
    val currentActiveProgram = activeEpgPrograms.find { it.isLive } ?: activeEpgPrograms.firstOrNull()
    val nextActiveProgram = activeEpgPrograms.firstOrNull { !it.isLive && it != currentActiveProgram }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = if (isFullScreen) Arrangement.Top else Arrangement.spacedBy(10.dp)
    ) {
        // ==========================================
        // 1. TOP EMBEDDED PLAYER CONTAINER
        // ==========================================
        if (activeChannel != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(if (!isFullScreen) Modifier.weight(0.3f) else Modifier.weight(1f))
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    shape = if (isFullScreen) RectangleShape else RoundedCornerShape(16.dp),
                    color = Color(0xFF0F111A),
                    border = BorderStroke(1.dp, Color(0xFF23283B)),
                    tonalElevation = 6.dp
                ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Video View Box with Overlays
                    Box(
                        modifier = if (isFullScreen) {
                            Modifier.fillMaxSize()
                        } else {
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 160.dp, max = 220.dp)
                                .aspectRatio(16f / 9f)
                        }
                            .background(Color.Black)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { showControls = !showControls },
                        contentAlignment = Alignment.Center
                    ) {
                        AndroidView(
                            factory = { ctx ->
                                VLCVideoLayout(ctx).apply {
                                    vlcMediaPlayer.attachViews(this, null, true, true)
                                }
                            },
                            modifier = Modifier.fillMaxSize()
                        )

                        // Buffering Overlay
                        if (isLoadingStream && playerError == null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.55f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(32.dp),
                                        color = OrangePrimary,
                                        strokeWidth = 3.dp
                                    )
                                    Text(
                                        text = "Conectando a ${activeChannel?.name}...",
                                        color = Color.White.copy(alpha = 0.9f),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }

                        // Error Overlay
                        if (playerError != null) {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.85f))
                                    .padding(16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Warning,
                                        contentDescription = null,
                                        tint = Color(0xFFFF5252),
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Text(
                                        text = playerError ?: "Erro na transmissão",
                                        color = Color.White,
                                        fontSize = 11.5.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { retryTrigger += 1 },
                                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Tentar Novamente", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                        Button(
                                            onClick = {
                                                activeChannel?.let { ch ->
                                                    onPlay(ch.streamUrl, ch.name, ContentType.LIVE)
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A2E40)),
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                            modifier = Modifier.height(32.dp)
                                        ) {
                                            Icon(Icons.Default.Fullscreen, contentDescription = null, modifier = Modifier.size(14.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Tela Cheia", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }

                        // Top Overlay (Channel Info, Live Badge & Favorite)
                        LivePlayerAnimatedVisibility(
                            visible = showControls || !isPlaying,
                            modifier = Modifier.align(Alignment.TopCenter)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        Brush.verticalGradient(
                                            colors = listOf(Color.Black.copy(alpha = 0.85f), Color.Transparent)
                                        )
                                    )
                                    .padding(horizontal = 10.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = Color(0xFF161926),
                                        modifier = Modifier.size(width = 38.dp, height = 28.dp),
                                        border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.15f))
                                    ) {
                                        if (activeChannel?.logoUrl.isNullOrBlank()) {
                                            Icon(
                                                imageVector = Icons.Default.LiveTv,
                                                contentDescription = null,
                                                tint = OrangePrimary,
                                                modifier = Modifier.padding(4.dp)
                                            )
                                        } else {
                                            AsyncImage(
                                                model = activeChannel?.logoUrl,
                                                contentDescription = null,
                                                modifier = Modifier.fillMaxSize().padding(2.dp),
                                                contentScale = ContentScale.Fit
                                            )
                                        }
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                                        ) {
                                            Surface(
                                                shape = RoundedCornerShape(4.dp),
                                                color = Color.Red.copy(alpha = 0.9f)
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(4.dp)
                                                            .clip(CircleShape)
                                                            .background(Color.White)
                                                    )
                                                    Spacer(modifier = Modifier.width(3.dp))
                                                    Text(
                                                        text = "AO VIVO",
                                                        color = Color.White,
                                                        fontSize = 8.sp,
                                                        fontWeight = FontWeight.Black
                                                    )
                                                }
                                            }
                                            Text(
                                                text = activeChannel?.category ?: "",
                                                color = Color(0xFFA0A5B5),
                                                fontSize = 9.5.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                        Text(
                                            text = activeChannel?.name ?: "",
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }

                                Surface(
                                    shape = CircleShape,
                                    color = Color.Black.copy(alpha = 0.6f),
                                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.2f)),
                                    modifier = Modifier
                                        .size(30.dp)
                                        .clickable {
                                            activeChannel?.let { onToggleFavorite(it) }
                                        }
                                ) {
                                    val isFav = activeChannel?.let { it.isFavorite || favoriteIds.contains(it.id) } ?: false
                                    Box(contentAlignment = Alignment.Center) {
                                        Icon(
                                            imageVector = if (isFav) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                                            contentDescription = "Favoritar",
                                            tint = if (isFav) OrangePrimary else Color.White,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }
                        }

                        // Bottom Overlay (Controls: Play/Pause, Mute, Reload, Fullscreen)
                        LivePlayerAnimatedVisibility(
                            visible = showControls || !isPlaying,
                            modifier = Modifier.align(Alignment.BottomCenter)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        Brush.verticalGradient(
                                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                                        )
                                    )
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    // Play/Pause button
                                    Surface(
                                        shape = CircleShape,
                                        color = OrangePrimary,
                                        modifier = Modifier
                                            .size(32.dp)
                                            .clickable {
                                                if (isPlaying) {
                                                    vlcMediaPlayer.pause()
                                                    isPaused = true
                                                    isPlaying = false
                                                } else {
                                                    vlcMediaPlayer.play()
                                                    isPaused = false
                                                    isPlaying = true
                                                }
                                            }
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                                contentDescription = null,
                                                tint = Color.White,
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                    }

                                    // Reload button
                                    Surface(
                                        shape = CircleShape,
                                        color = Color.Black.copy(alpha = 0.5f),
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clickable { retryTrigger += 1 }
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = Icons.Default.Refresh,
                                                contentDescription = "Recarregar",
                                                tint = Color.White,
                                                modifier = Modifier.size(15.dp)
                                            )
                                        }
                                    }

                                    // Mute button
                                    Surface(
                                        shape = CircleShape,
                                        color = Color.Black.copy(alpha = 0.5f),
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clickable { isMuted = !isMuted }
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Icon(
                                                imageVector = if (isMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                                                contentDescription = "Áudio",
                                                tint = if (isMuted) Color(0xFFFF5252) else Color.White,
                                                modifier = Modifier.size(15.dp)
                                            )
                                        }
                                    }
                                }

                                // Fullscreen button
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color.Black.copy(alpha = 0.6f),
                                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.2f)),
                                    modifier = Modifier
                                        .clickable {
                                            isFullScreen = !isFullScreen
                                        }
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Fullscreen,
                                            contentDescription = "Tela Cheia",
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = "Tela Cheia",
                                            color = Color.White,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // EPG Mini Bar under Video
                    if (currentActiveProgram != null && !isFullScreen) {
                        Surface(
                            color = Color(0xFF141724),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(5.dp)
                                                .clip(CircleShape)
                                                .background(OrangePrimary)
                                        )
                                        Text(
                                            text = "Agora: ${currentActiveProgram.title}",
                                            color = Color.White,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                    Text(
                                        text = "${currentActiveProgram.startTime} - ${currentActiveProgram.endTime}",
                                        color = Color(0xFFA0A5B5),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                if (currentActiveProgram.progressPercent > 0f) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    LinearProgressIndicator(
                                        progress = { currentActiveProgram.progressPercent },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(3.dp)
                                            .clip(RoundedCornerShape(2.dp)),
                                        color = OrangePrimary,
                                        trackColor = Color(0xFF23283B)
                                    )
                                }

                                if (nextActiveProgram != null) {
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = "A seguir: ${nextActiveProgram.title} (${nextActiveProgram.startTime})",
                                        color = Color(0xFF8E95A8),
                                        fontSize = 9.5.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // ==========================================
        // 2. HEADER: TITLE & VIEW MODE SWITCH
        // ==========================================
        if (!isFullScreen) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = OrangePrimary.copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, OrangePrimary.copy(alpha = 0.35f)),
                        modifier = Modifier.size(28.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.LiveTv,
                                contentDescription = null,
                                tint = OrangePrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                    Text(
                        text = "Grade de Canais",
                        color = Color.White,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black
                    )
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFF1E2233)
                    ) {
                        Text(
                            text = "${filtered.size}",
                            color = Color(0xFFA0A5B5),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 2.dp)
                        )
                    }
                }

                // View Mode Switcher
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (!isEpgView) OrangePrimary else Color(0xFF181B28),
                        border = BorderStroke(0.5.dp, if (!isEpgView) OrangePrimary else Color(0xFF2B3045)),
                        modifier = Modifier
                            .height(30.dp)
                            .clickable { isEpgView = false }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.GridView,
                                contentDescription = null,
                                tint = if (!isEpgView) Color.White else Color(0xFFA0A5B5),
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = "Grade",
                                color = if (!isEpgView) Color.White else Color(0xFFA0A5B5),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isEpgView) OrangePrimary else Color(0xFF181B28),
                        border = BorderStroke(0.5.dp, if (isEpgView) OrangePrimary else Color(0xFF2B3045)),
                        modifier = Modifier
                            .height(30.dp)
                            .clickable { isEpgView = true }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = if (isEpgView) Color.White else Color(0xFFA0A5B5),
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = "Guia EPG",
                                color = if (isEpgView) Color.White else Color(0xFFA0A5B5),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // ==========================================
        // 3. SEARCH BAR
        // ==========================================
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Buscar canal ou categoria...", fontSize = 12.sp, color = Color(0xFF8E95A8)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = null,
                    tint = OrangePrimary,
                    modifier = Modifier.size(18.dp)
                )
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Limpar busca",
                            tint = Color.Gray,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            singleLine = true,
            shape = RoundedCornerShape(10.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = OrangePrimary,
                unfocusedBorderColor = Color(0xFF252A3B),
                focusedContainerColor = Color(0xFF141724),
                unfocusedContainerColor = Color(0xFF141724),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            )
        )

        // ==========================================
        // 4. HORIZONTAL CATEGORY PILLS
        // ==========================================
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            contentPadding = PaddingValues(vertical = 2.dp)
        ) {
            items(categories) { cat ->
                val isSelected = cat == selectedCategory
                val count = when {
                    cat == "Todos os canais" || cat == "Todos" -> channels.size
                    cat == "❤️ Favoritos" -> channels.count { it.isFavorite || favoriteIds.contains(it.id) }
                    else -> channels.count { it.category.equals(cat, ignoreCase = true) }
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (isSelected) OrangePrimary else Color(0xFF161926),
                    border = BorderStroke(
                        0.5.dp,
                        if (isSelected) OrangePrimary else Color.White.copy(alpha = 0.08f)
                    ),
                    modifier = Modifier.clickable { selectedCategory = cat }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Text(
                            text = cat,
                            color = if (isSelected) Color.White else Color(0xFFB0B5C6),
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                        )
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (isSelected) Color.Black.copy(alpha = 0.25f) else Color(0xFF0F121C)
                        ) {
                            Text(
                                text = "$count",
                                color = if (isSelected) Color.White else Color(0xFF7E869B),
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                    }
                }
            }
        }

        // ==========================================
        // 5. MAIN CONTENT AREA
        // ==========================================
        if (filtered.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LiveTv,
                        contentDescription = null,
                        tint = Color(0xFF4A5568),
                        modifier = Modifier.size(46.dp)
                    )
                    Text(
                        text = if (searchQuery.isNotBlank() || selectedCategory != "Todos os canais") {
                            "Nenhum canal encontrado para estes filtros."
                        } else {
                            "Nenhum canal de TV disponível."
                        },
                        color = Color(0xFFA0A5B5),
                        fontSize = 13.sp
                    )
                    if (searchQuery.isNotBlank() || selectedCategory != "Todos os canais") {
                        Button(
                            onClick = {
                                searchQuery = ""
                                selectedCategory = "Todos os canais"
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Text("Limpar Filtros", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else if (isEpgView) {
            Box(modifier = Modifier.weight(1f)) {
                EpgGuideView(
                    channels = filtered,
                    onPlay = { url, name, type ->
                        val matchingChannel = filtered.find { it.streamUrl == url }
                        if (matchingChannel != null) {
                            activeChannel = matchingChannel
                            prefs.edit().putString("last_live_channel_id", matchingChannel.id).apply()
                        } else {
                            onPlay(url, name, type)
                        }
                    }
                )
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 145.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filtered, key = { it.id }) { channel ->
                    val isFav = channel.isFavorite || favoriteIds.contains(channel.id)
                    val isCurrent = activeChannel?.id == channel.id
                    LiveChannelGridCard(
                        channel = channel,
                        isFavorite = isFav,
                        isSelected = isCurrent,
                        onPlay = onPlay,
                        onSelect = { selectedCh ->
                            activeChannel = selectedCh
                            prefs.edit().putString("last_live_channel_id", selectedCh.id).apply()
                        },
                        onToggleFavorite = onToggleFavorite
                    )
                }
            }
        }
    }
}

private fun generateEpgPrograms(channel: LiveChannel): List<EpgProgram> {
    val now = java.util.Calendar.getInstance()
    val currentHour = now.get(java.util.Calendar.HOUR_OF_DAY)
    val currentMinute = now.get(java.util.Calendar.MINUTE)
    
    val categoryName = channel.category.lowercase()
    val isNews = categoryName.contains("notícia") || categoryName.contains("news") || categoryName.contains("jornal")
    val isSports = categoryName.contains("esporte") || categoryName.contains("sport") || categoryName.contains("futebol")
    val isMovies = categoryName.contains("filme") || categoryName.contains("movie") || categoryName.contains("cinema") || categoryName.contains("cine")
    val isKids = categoryName.contains("infantil") || categoryName.contains("kids") || categoryName.contains("desenho") || categoryName.contains("cartoon")

    val baseShows = when {
        isNews -> listOf(
            Triple("Jornal da Manhã", "Noticiário matutino com as principais notícias do dia e previsão do tempo.", "06:00 - 09:00"),
            Triple("Plantão Brasil", "Cobertura ao vivo dos fatos políticos e econômicos nacionais.", "09:00 - 12:00"),
            Triple("Telejornal 12H", "As notícias da sua região com apuração em tempo real e reportagens.", "12:00 - 15:00"),
            Triple("Foco Global", "Análise internacional, geopolítica e economia mundial.", "15:00 - 18:00"),
            Triple("Jornal da Noite", "O resumo completo dos acontecimentos de destaque do dia.", "18:00 - 21:00"),
            Triple("Edição Especial", "Reportagens especiais, investigações e entrevistas exclusivas.", "21:00 - 00:00")
        )
        isSports -> listOf(
            Triple("Mesa Redonda Matutina", "Debates quentes sobre o mundo do esporte e comentários editoriais.", "07:00 - 10:00"),
            Triple("Central Esportiva", "Notícias, transferências, lesões e bastidores dos clubes.", "10:00 - 13:00"),
            Triple("Futebol ao Vivo: Rodada Principal", "Transmissão exclusiva de partidas emocionantes com narração completa.", "13:00 - 17:00"),
            Triple("Arena dos Campeões", "Análise tática pós-jogo, estatísticas e polêmicas de arbitragem.", "17:00 - 20:00"),
            Triple("Esporte Total Prime", "Resumo das principais modalidades olímpicas e entrevistas.", "20:00 - 23:00"),
            Triple("Melhores Momentos da Rodada", "Compacto dos gols, lances espetaculares e entrevistas.", "23:00 - 02:00")
        )
        isMovies -> listOf(
            Triple("Cine Matinê: Aventura Suprema", "Filme de grande sucesso de bilheteria, aventura e magia.", "08:00 - 10:00"),
            Triple("Sessão Drama & Emoção", "Histórias marcantes e premiadas que tocam o coração.", "10:00 - 12:30"),
            Triple("Super Cine Tarde: Ação Total", "Efeitos visuais incríveis, perseguições e adrenalina pura.", "12:30 - 14:45"),
            Triple("Cine Família", "Comédia leve e diversão garantida para todas as idades.", "14:45 - 17:00"),
            Triple("Sessão Pipoca: Thriller & Mistério", "Suspense eletrizante e reviravoltas do início ao fim.", "17:00 - 19:30"),
            Triple("Super Produção da Noite", "Estreia exclusiva de sucesso internacional com atores renomados.", "19:30 - 22:00"),
            Triple("Cine Club da Meia-Noite", "Filmes aclamados pela crítica e clássicos cult.", "22:00 - 01:00")
        )
        isKids -> listOf(
            Triple("Turma da Manhã Feliz", "Desenhos animados divertidos para os pequenos aprenderem brincando.", "06:00 - 09:00"),
            Triple("Aventuras Mágicas", "Histórias encantadas, contos de fadas e muita alegria.", "09:00 - 12:00"),
            Triple("Hora do Recreio Animada", "Séries infantis dinâmicas e brincadeiras interativas.", "12:00 - 15:00"),
            Triple("Super Heróis Kids", "As missões mais empolgantes com desenhos de ação infantil.", "15:00 - 18:00"),
            Triple("Cinema Infantil da Tarde", "Filme animado especial para toda a família curtir junta.", "18:00 - 20:00"),
            Triple("Boa Noite Amiguinhos", "Desenhos relaxantes e historinhas para a hora de dormir.", "20:00 - 22:00")
        )
        else -> listOf(
            Triple("Programa Manhã Total", "Variedades, entrevistas, saúde e entretenimento geral.", "07:00 - 10:00"),
            Triple("Cozinha & Sabor", "Receitas deliciosas, chefs convidados e dicas culinárias.", "10:00 - 12:30"),
            Triple("Show da Tarde", "Música ao vivo, humor, auditório e diversão para o seu dia.", "12:30 - 16:00"),
            Triple("Série Especial: Mistérios", "Episódios sequenciais de grande sucesso internacional.", "16:00 - 19:00"),
            Triple("Grandes Espetáculos", "Shows musicais, festivais e entretenimento premium.", "19:00 - 22:00"),
            Triple("Sessão Noturna de Sucessos", "Filmes e séries selecionados especialmente para sua noite.", "22:00 - 01:00")
        )
    }

    return baseShows.mapIndexed { index, (title, desc, timeRange) ->
        val parts = timeRange.split(" - ")
        val startStr = parts[0]
        val endStr = parts[1]
        
        val startHour = startStr.substring(0, 2).toInt()
        val endHour = endStr.substring(0, 2).toInt()
        
        val isCurrent = currentHour in startHour until endHour || (endHour < startHour && (currentHour >= startHour || currentHour < endHour))
        
        val progress = if (isCurrent) {
            val totalMins = (endHour - startHour).let { if (it <= 0) it + 24 else it } * 60
            val elapsedMins = (currentHour - startHour).let { if (it < 0) it + 24 else it } * 60 + currentMinute
            (elapsedMins.toFloat() / totalMins.toFloat()).coerceIn(0f, 1f)
        } else if (currentHour > endHour || (startHour > endHour && currentHour < startHour)) {
            1f
        } else {
            0f
        }

        EpgProgram(
            id = "${channel.id}_prog_$index",
            channelId = channel.id,
            title = title,
            startTime = startStr,
            endTime = endStr,
            description = desc,
            category = channel.category,
            isLive = isCurrent,
            progressPercent = progress
        )
    }
}

@Composable
fun EpgGuideView(
    channels: List<LiveChannel>,
    onPlay: (String, String, ContentType) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        items(channels, key = { it.id }) { channel ->
            val programs = remember(channel.id) { generateEpgPrograms(channel) }
            val currentProgram = programs.find { it.isLive } ?: programs.firstOrNull()
            val upcomingPrograms = programs.filter { !it.isLive && it != currentProgram }

            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFF161926),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                tonalElevation = 2.dp
            ) {
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    // Channel Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = Color(0xFF10131F),
                                modifier = Modifier.size(width = 54.dp, height = 36.dp),
                                border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.1f))
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    if (channel.logoUrl.isNullOrBlank()) {
                                        Text(
                                            text = channel.name.take(3).uppercase(),
                                            color = OrangePrimary,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    } else {
                                        SubcomposeAsyncImage(
                                            model = channel.logoUrl,
                                            contentDescription = channel.name,
                                            modifier = Modifier.fillMaxSize(),
                                            contentScale = ContentScale.Fit
                                        )
                                    }
                                }
                            }

                            Column {
                                Text(
                                    text = channel.name,
                                    color = Color.White,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = channel.category,
                                    color = Color(0xFF94A3B8),
                                    fontSize = 11.sp
                                )
                            }
                        }

                        // Play Channel Button
                        Button(
                            onClick = { onPlay(channel.streamUrl, channel.name, ContentType.LIVE) },
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = Color.White
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "Assistir",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    HorizontalDivider(color = Color(0xFF23283B), thickness = 1.dp)
                    Spacer(modifier = Modifier.height(10.dp))

                    // Current Program card ("No Ar")
                    if (currentProgram != null) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF1E2336),
                            border = BorderStroke(1.dp, OrangePrimary.copy(alpha = 0.3f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Surface(
                                            shape = RoundedCornerShape(4.dp),
                                            color = Color.Red,
                                            modifier = Modifier.padding(end = 6.dp)
                                        ) {
                                            Text(
                                                text = " NO AR ",
                                                color = Color.White,
                                                fontSize = 8.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                                            )
                                        }
                                        Text(
                                            text = "${currentProgram.startTime} - ${currentProgram.endTime}",
                                            color = OrangePrimary,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = currentProgram.title,
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = currentProgram.description,
                                    color = Color(0xFFB0B5C6),
                                    fontSize = 11.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )

                                Spacer(modifier = Modifier.height(6.dp))
                                // Progress bar
                                LinearProgressIndicator(
                                    progress = { currentProgram.progressPercent },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(4.dp)
                                        .clip(CircleShape),
                                    color = OrangePrimary,
                                    trackColor = Color(0xFF2D3245)
                                )
                            }
                        }
                    }

                    // Upcoming Programs horizontal scroll row
                    if (upcomingPrograms.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Próximos Programas:",
                            color = Color(0xFF8E95A9),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(upcomingPrograms, key = { it.id }) { prog ->
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFF121520),
                                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.06f)),
                                    modifier = Modifier.width(180.dp)
                                ) {
                                    Column(modifier = Modifier.padding(8.dp)) {
                                        Text(
                                            text = "${prog.startTime} - ${prog.endTime}",
                                            color = OrangePrimary.copy(alpha = 0.9f),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = prog.title,
                                            color = Color.White,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text(
                                            text = prog.description,
                                            color = Color(0xFF94A3B8),
                                            fontSize = 10.sp,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}


@Composable
fun LiveChannelGridCard(
    channel: LiveChannel,
    isFavorite: Boolean,
    isSelected: Boolean = false,
    onPlay: (String, String, ContentType) -> Unit,
    onSelect: ((LiveChannel) -> Unit)? = null,
    onToggleFavorite: (LiveChannel) -> Unit
) {
    val programs = remember(channel.id) { generateEpgPrograms(channel) }
    val currentProg = programs.find { it.isLive } ?: programs.firstOrNull()

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable {
                if (onSelect != null) {
                    onSelect(channel)
                } else {
                    onPlay(channel.streamUrl, channel.name, ContentType.LIVE)
                }
            },
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) Color(0xFF1E1712) else Color(0xFF161926),
        border = BorderStroke(
            if (isSelected) 1.5.dp else 1.dp,
            if (isSelected) OrangePrimary else Color.White.copy(alpha = 0.09f)
        ),
        tonalElevation = if (isSelected) 6.dp else 3.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Container superior da logo do canal
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp),
                contentAlignment = Alignment.Center
            ) {
                if (channel.logoUrl.isNullOrBlank()) {
                    ChannelLogoPlaceholder(
                        channelName = channel.name,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    SubcomposeAsyncImage(
                        model = channel.logoUrl,
                        contentDescription = channel.name,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(110.dp),
                        contentScale = ContentScale.Fit,
                        loading = {
                            Box(
                                modifier = Modifier.fillMaxSize(),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = OrangePrimary.copy(alpha = 0.6f),
                                    strokeWidth = 2.dp
                                )
                            }
                        },
                        error = {
                            ChannelLogoPlaceholder(
                                channelName = channel.name,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    )
                }

                // Indicador de Reprodução Ativa se selecionado
                if (isSelected) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = Color.Black.copy(alpha = 0.65f),
                        border = BorderStroke(1.dp, OrangePrimary.copy(alpha = 0.8f)),
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp),
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(width = 3.dp, height = 12.dp)
                                    .clip(RoundedCornerShape(1.dp))
                                    .background(OrangePrimary)
                            )
                            Box(
                                modifier = Modifier
                                    .size(width = 3.dp, height = 16.dp)
                                    .clip(RoundedCornerShape(1.dp))
                                    .background(OrangePrimary)
                            )
                            Box(
                                modifier = Modifier
                                    .size(width = 3.dp, height = 10.dp)
                                    .clip(RoundedCornerShape(1.dp))
                                    .background(OrangePrimary)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "TOCANDO",
                                color = OrangePrimary,
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    }
                }

                // Badge AO VIVO no canto superior esquerdo
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color.Red.copy(alpha = 0.85f),
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(5.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = "AO VIVO",
                            color = Color.White,
                            fontSize = 8.5.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Botão de favorito circular translúcido no canto superior direito
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.65f),
                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.25f)),
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .size(28.dp)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { onToggleFavorite(channel) }
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = if (isFavorite) "Remover dos favoritos" else "Adicionar aos favoritos",
                            tint = if (isFavorite) OrangePrimary else Color.White.copy(alpha = 0.85f),
                            modifier = Modifier.size(15.dp)
                        )
                    }
                }
            }

            // Área de texto inferior
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Text(
                    text = channel.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.5.sp,
                    lineHeight = 16.sp,
                    color = if (isSelected) OrangePrimary else Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (channel.category.isNotBlank()) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(
                            modifier = Modifier
                                .size(5.dp)
                                .clip(CircleShape)
                                .background(OrangePrimary)
                        )
                        Spacer(modifier = Modifier.width(5.dp))
                        Text(
                            text = channel.category,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xFFA0A5B5),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Programa atual do Guia EPG com barra de progresso
                if (currentProg != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF0F121C))
                            .padding(horizontal = 6.dp, vertical = 4.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = currentProg.title,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isSelected) OrangePrimary else Color(0xFFCCD2E3),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = currentProg.startTime,
                                fontSize = 8.5.sp,
                                color = Color(0xFF8E95A8)
                            )
                        }
                        if (currentProg.progressPercent > 0f) {
                            Spacer(modifier = Modifier.height(3.dp))
                            LinearProgressIndicator(
                                progress = { currentProg.progressPercent },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(2.5.dp)
                                    .clip(RoundedCornerShape(2.dp)),
                                color = OrangePrimary,
                                trackColor = Color(0xFF23283B)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ChannelLogoPlaceholder(
    channelName: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF23283B), Color(0xFF0F121C))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = Color(0x33FF6600),
                border = BorderStroke(1.dp, Color(0x66FF6600)),
                modifier = Modifier.size(36.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.LiveTv,
                        contentDescription = null,
                        tint = OrangePrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            val initials = channelName.trim()
                .split(" ")
                .filter { it.isNotBlank() }
                .take(3)
                .joinToString("") { it.take(1).uppercase() }
                .takeIf { it.isNotBlank() } ?: "TV"
            Text(
                text = initials,
                color = Color(0xFFCCD2E3),
                fontSize = 11.5.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

// ==========================================
// 3. MOVIES SCREEN
// ==========================================
@Composable
fun MoviesScreen(
    movies: List<MovieItem>,
    trendingMovies: List<MovieItem> = emptyList(),
    onPlay: (String, String, ContentType) -> Unit,
    onOpenMovie: (MovieItem) -> Unit = {},
    onToggleFavorite: (MovieItem) -> Unit,
    favorites: List<FavoriteItem> = emptyList(),
    onTriggerSearch: () -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var debouncedSearchQuery by remember { mutableStateOf("") }
    var selectedCategoryForGrid by remember { mutableStateOf<String?>(null) }
    var showCategoriesDropdown by remember { mutableStateOf(false) }

    // Debounce the search input by 300ms to avoid constant filtering during active typing
    LaunchedEffect(searchQuery) {
        delay(300)
        debouncedSearchQuery = searchQuery
    }

    // Map of categories preserving list order
    val categoriesMap = remember(movies) {
        val map = linkedMapOf<String, MutableList<MovieItem>>()
        movies.forEach { m ->
            val cat = m.category.trim().ifBlank { "Geral" }
            map.getOrPut(cat) { mutableListOf() }.add(m)
        }
        map
    }

    val allCategoriesList = remember(categoriesMap) {
        categoriesMap.keys.toList()
    }

    // Destaques de Filmes (Carrossel Hero Banner - 100% TMDb API)
    val movieHeroItems = remember(trendingMovies) {
        trendingMovies.filter { !it.backdropUrl.isNullOrBlank() || !it.posterUrl.isNullOrBlank() }
            .take(8)
            .map { m ->
                HeroBannerItem(
                    id = "movie_hero_${m.id}",
                    title = m.name,
                    imageUrl = m.backdropUrl ?: m.posterUrl ?: "",
                    category = "Destaques TMDb",
                    type = ContentType.MOVIE,
                    streamUrl = m.streamUrl,
                    badgeInfo = listOfNotNull(
                        "FILME",
                        m.year,
                        m.rating?.let { "★ $it" },
                        "TMDb"
                    ).joinToString(" • "),
                    overview = m.description,
                    year = m.year,
                    movieItem = m
                )
            }
    }

    // Global Search across entire movie catalog (Instant, on-the-fly as user types!)
    val searchResults = remember(searchQuery, movies) {
        if (searchQuery.isBlank()) emptyList()
        else {
            val tokens = SearchUtils.extractTokens(searchQuery)
            movies.filter { SearchUtils.matchesAnyField(tokens, it.name, it.category, it.year ?: "") }
        }
    }

    // Handle Android back button when viewing category grid
    BackHandler(enabled = selectedCategoryForGrid != null && searchQuery.isBlank()) {
        selectedCategoryForGrid = null
    }

    // Layout: 1. Fixed Search Bar & Categories, 2. Dynamic content below (LazyColumn includes HeroBanner at top)
    Column(modifier = Modifier.fillMaxSize()) {

        // Barra de Busca e Botão Categorias FIXO (Mesmo nó Composable em Row horizontal para reter o foco e economizar espaço)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Elemento 1: Botão Categorias no formato pílula
            Box {
                Button(
                    onClick = { showCategoriesDropdown = !showCategoriesDropdown },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selectedCategoryForGrid != null) OrangePrimary else Color(0xFF1E2230),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(50),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.height(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (selectedCategoryForGrid != null) {
                            if (selectedCategoryForGrid!!.length > 8) selectedCategoryForGrid!!.take(6) + ".." else selectedCategoryForGrid!!
                        } else "Categorias ⬇️",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                DropdownMenu(
                    expanded = showCategoriesDropdown,
                    onDismissRequest = { showCategoriesDropdown = false },
                    modifier = Modifier
                        .background(Color(0xFF161924))
                        .widthIn(min = 220.dp, max = 290.dp)
                ) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = "Todas as Categorias (Carrosséis)",
                                fontSize = 12.5.sp,
                                fontWeight = if (selectedCategoryForGrid == null) FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedCategoryForGrid == null) OrangePrimary else Color.White
                            )
                        },
                        onClick = {
                            selectedCategoryForGrid = null
                            showCategoriesDropdown = false
                        }
                    )
                    Divider(color = Color.White.copy(alpha = 0.12f))
                    allCategoriesList.forEach { cat ->
                        val count = categoriesMap[cat]?.size ?: 0
                        val isSelected = selectedCategoryForGrid == cat
                        DropdownMenuItem(
                            text = {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = cat,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) OrangePrimary else Color(0xFFDCE1EF),
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color(0xFF23283B)
                                    ) {
                                        Text(
                                            text = "$count",
                                            fontSize = 10.sp,
                                            color = Color.Gray,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            },
                            onClick = {
                                selectedCategoryForGrid = cat
                                showCategoriesDropdown = false
                            }
                        )
                    }
                }
            }

            // Se uma categoria estiver selecionada, exibe o botão de voltar para limpar o filtro
            if (selectedCategoryForGrid != null) {
                IconButton(
                    onClick = { selectedCategoryForGrid = null },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Limpar filtro",
                        tint = OrangePrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Elemento 2: Barra de busca estática como botão clicável que abre a busca global instantaneamente
            Surface(
                onClick = { onTriggerSearch() },
                modifier = Modifier.weight(1f).height(46.dp),
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFF141722),
                border = BorderStroke(1.dp, Color(0xFF2D3245))
            ) {
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = OrangePrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Buscar em todos os filmes...",
                        color = Color.Gray,
                        fontSize = 11.sp
                    )
                }
            }
        }

        // ÁREA DE CONTEÚDO DINÂMICA
        if (searchQuery.isNotBlank()) {
            // VIEW 1: SEARCH RESULTS
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp)
            ) {
                if (searchResults.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "Nenhum filme encontrado para \"$searchQuery\".", color = Color.Gray)
                    }
                } else {
                    Text(
                        text = "Resultados da busca (${searchResults.size} filmes encontrados):",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(searchResults, key = { it.id }) { movie ->
                            val isFav = movie.isFavorite || favorites.any { it.contentId == movie.id }
                            MovieGridCard(
                                movie = movie,
                                isFavorite = isFav,
                                onPlay = onPlay,
                                onOpenMovie = onOpenMovie,
                                onToggleFavorite = onToggleFavorite
                            )
                        }
                    }
                }
            }
        } else if (selectedCategoryForGrid != null) {
            // VIEW 2: CATEGORY DETAIL ("VER TUDO" GRID)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp)
            ) {
                val catMovies = categoriesMap[selectedCategoryForGrid] ?: emptyList()
                Spacer(modifier = Modifier.height(6.dp))
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(catMovies, key = { it.id }) { movie ->
                        val isFav = movie.isFavorite || favorites.any { it.contentId == movie.id }
                        MovieGridCard(
                            movie = movie,
                            isFavorite = isFav,
                            onPlay = onPlay,
                            onOpenMovie = onOpenMovie,
                            onToggleFavorite = onToggleFavorite
                        )
                    }
                }
            }
        } else {
            // VIEW 3: MAIN VIEW (Carrosséis por categoria com Destaques no topo)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (movieHeroItems.isNotEmpty()) {
                    item(key = "movie_hero_banner") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "EM DESTAQUE",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        HeroBannerCarousel(
                            items = movieHeroItems,
                            onPlay = onPlay,
                            onOpenSeries = {},
                            onOpenMovie = onOpenMovie
                        )
                    }
                }
                categoriesMap.forEach { (catName, catMovies) ->
                    item(key = "cat_$catName") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp)
                        ) {
                            SectionHeaderWithAction(
                                title = catName,
                                actionText = "Ver tudo",
                                onAction = { selectedCategoryForGrid = catName }
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            MoviesHorizontalCarousel(
                                movies = catMovies,
                                favorites = favorites,
                                onPlay = onPlay,
                                onOpenMovie = onOpenMovie,
                                onToggleFavorite = onToggleFavorite
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MovieGridCard(
    movie: MovieItem,
    isFavorite: Boolean,
    onPlay: (String, String, ContentType) -> Unit = { _, _, _ -> },
    onOpenMovie: ((MovieItem) -> Unit)? = null,
    onToggleFavorite: (MovieItem) -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable {
                if (onOpenMovie != null) {
                    onOpenMovie(movie)
                } else {
                    onPlay(movie.streamUrl, movie.name, ContentType.MOVIE)
                }
            },
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.68f) // Proporção vertical tradicional de pôster de filme ~2:3
                    .background(Color(0xFF141722))
            ) {
                CoilPosterImage(
                    url = movie.posterUrl,
                    placeholderIcon = Icons.Default.Movie,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Botão de favorito
                IconButton(
                    onClick = { onToggleFavorite(movie) },
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(3.dp)
                        .size(24.dp)
                        .background(Color.Black.copy(alpha = 0.55f), shape = RoundedCornerShape(12.dp))
                ) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Favoritar",
                        tint = if (isFavorite) OrangePrimary else Color.White.copy(alpha = 0.85f),
                        modifier = Modifier.size(14.dp)
                    )
                }
            }

            // Título compacto abaixo da imagem (apenas o nome do filme)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp)
            ) {
                Text(
                    text = movie.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ==========================================
// 4. SERIES SCREEN & DETAILS
// ==========================================

fun formatEpisodeTitle(rawTitle: String, episodeNum: Int, seriesName: String): Pair<String, String> {
    val epBadge = if (episodeNum > 0) "EP %02d".format(episodeNum) else "EP"

    var clean = rawTitle.trim()
    // Remove series name prefix if it starts with the series name
    if (seriesName.isNotBlank() && clean.startsWith(seriesName, ignoreCase = true)) {
        clean = clean.substring(seriesName.length).trim()
    }
    // Remove language / dub tags at the start: DUB, DUB., LEG, LEG., DUBLADO, LEGENDADO, NACIONAL
    clean = clean.replace(Regex("^(?i)(DUB|LEG|DUBLADO|LEGENDADO|NACIONAL)\\s*[-_:/|.]*\\s*"), "")

    // Remove technical codes: S01E01, S01 E01, T01E01, T01 E01, 1x01, EP01T01, DUB-EP01T01, EP 01, EP01, Episodio 01, Episódio 01
    clean = clean.replace(Regex("^(?i)(S\\d+\\s*E\\d+|T\\d+\\s*E\\d+|\\d+x\\d+|EP\\s*\\d+\\s*T\\d+|EP\\s*\\d+|EPIS[OÓ]DIO\\s*\\d+)\\s*[-_:/|.]*\\s*"), "")

    // Remove leading punctuation / dashes
    clean = clean.replace(Regex("^[-_:/|.]+\\s*"), "").trim()
    // Remove trailing format tags
    clean = clean.replace(Regex("(?i)\\s*[-_:/|.]*\\s*(DUB|LEG|DUBLADO|LEGENDADO|720p|1080p|FHD|HD|4K)$"), "").trim()

    val displayTitle = if (clean.isBlank() || clean.matches(Regex("^(?i)(T\\d+|E\\d+|DUB|LEG|EP\\d+|EP\\s*\\d+)$"))) {
        if (episodeNum > 0) "Episódio $episodeNum" else rawTitle
    } else {
        clean
    }

    return Pair(epBadge, displayTitle)
}

@Composable
fun SeriesPosterPlaceholder(title: String, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFF141722)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(8.dp)
        ) {
            Image(
                painter = painterResource(id = R.drawable.foxstream_logo),
                contentDescription = null,
                modifier = Modifier.size(42.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = title.take(2).uppercase(),
                color = OrangePrimary,
                fontSize = 16.sp,
                fontWeight = FontWeight.ExtraBold
            )
        }
    }
}

@Composable
fun SeriesDetailHeader(
    series: SeriesItem,
    resumeEpisode: EpisodeItem?,
    onPlayResume: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFF0F1118))
    ) {
        // Wide backdrop image with vertical scrim gradient - prefers clean backdropUrl without watermarks
        val backdropToUse = series.backdropUrl?.takeIf { it.isNotBlank() } ?: series.posterUrl
        if (!backdropToUse.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(230.dp)
            ) {
                SubcomposeAsyncImage(
                    model = backdropToUse,
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color(0xB30F1118),
                                    Color(0xE60F1118),
                                    Color(0xFF0F1118)
                                )
                            )
                        )
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            // Top Bar with Back button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Surface(
                    shape = CircleShape,
                    color = Color.Black.copy(alpha = 0.55f),
                    border = BorderStroke(1.dp, Color(0x33FFFFFF)),
                    modifier = Modifier.size(38.dp)
                ) {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Voltar",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Main info row: Poster + Details
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Poster
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF161924),
                    border = BorderStroke(1.dp, Color(0x2AFFFFFF)),
                    shadowElevation = 8.dp,
                    modifier = Modifier
                        .width(115.dp)
                        .height(165.dp)
                ) {
                    if (!series.posterUrl.isNullOrBlank()) {
                        SubcomposeAsyncImage(
                            model = series.posterUrl,
                            contentDescription = series.name,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                            loading = {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(Color(0xFF141722)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Image(
                                        painter = painterResource(id = R.drawable.foxstream_logo),
                                        contentDescription = null,
                                        modifier = Modifier.size(36.dp)
                                    )
                                }
                            },
                            error = {
                                SeriesPosterPlaceholder(title = series.name)
                            }
                        )
                    } else {
                        SeriesPosterPlaceholder(title = series.name)
                    }
                }

                // Details Column
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(top = 2.dp)
                ) {
                    Text(
                        text = series.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // IMDb & Metadata Info Bar
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // Rating Badge (IMDb)
                        if (!series.rating.isNullOrBlank()) {
                            val rText = if (series.rating.contains("/10")) series.rating else "${series.rating}/10"
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0xFFE5A93B).copy(alpha = 0.15f),
                                border = BorderStroke(1.dp, Color(0xFFE5A93B).copy(alpha = 0.6f))
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Star,
                                        contentDescription = "Nota IMDb",
                                        tint = Color(0xFFE5A93B),
                                        modifier = Modifier.size(11.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = rText,
                                        color = Color(0xFFE5A93B),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }

                        // Exhibition Year
                        if (!series.year.isNullOrBlank()) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0x22FFFFFF)
                            ) {
                                Text(
                                    text = series.year,
                                    color = Color.LightGray,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        // Parental Rating (Classificação Indicativa)
                        if (!series.rated.isNullOrBlank()) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0x22FFFFFF)
                            ) {
                                Text(
                                    text = series.rated,
                                    color = Color.LightGray,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        // Seasons Count
                        if (series.seasons.isNotEmpty()) {
                            val seasonCount = series.seasons.size
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0x22FFFFFF)
                            ) {
                                Text(
                                    text = if (seasonCount == 1) "1 Temp." else "$seasonCount Temps.",
                                    color = Color.LightGray,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    // Chips de Gênero
                    if (!series.genre.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            series.genre.split(",").map { it.trim() }.filter { it.isNotBlank() }.take(3).forEach { g ->
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFF1E2130),
                                    border = BorderStroke(0.5.dp, Color.White.copy(alpha = 0.12f))
                                ) {
                                    Text(
                                        text = g,
                                        color = Color(0xFFCCD2E3),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }
                    }

                    // Plot Description
                    if (!series.description.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(
                            text = series.description,
                            fontSize = 12.sp,
                            color = Color(0xFFB0B0B0),
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis,
                            lineHeight = 16.sp
                        )
                    }

                    // Cast List (Elenco principal)
                    if (!series.cast.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Elenco: ${series.cast}",
                            fontSize = 11.sp,
                            color = Color(0xFF8C93A8),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            lineHeight = 14.sp
                        )
                    }

                    // "▶ Continuar assistindo" button when history exists!
                    if (resumeEpisode != null) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = onPlayResume,
                            colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(36.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Continuar T${resumeEpisode.seasonNum}:EP${resumeEpisode.episodeNum}",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SeasonsHorizontalSelector(
    seasons: List<SeasonItem>,
    selectedIndex: Int,
    onSelectSeason: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(seasons.size) { index ->
            val isSelected = (index == selectedIndex)
            val season = seasons[index]
            val seasonName = season.name.ifBlank { "Temporada ${season.seasonNum}" }

            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .clickable { onSelectSeason(index) },
                shape = RoundedCornerShape(20.dp),
                color = if (isSelected) OrangePrimary else Color(0xFF1E2230),
                border = if (isSelected) null else BorderStroke(1.dp, Color(0x22FFFFFF))
            ) {
                Text(
                    text = seasonName,
                    color = if (isSelected) Color.White else Color(0xFF9E9E9E),
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }
        }
    }
}

@Composable
fun EpisodeCard(
    series: SeriesItem,
    episode: EpisodeItem,
    history: List<HistoryItem>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val (epBadge, displayTitle) = remember(episode.title, episode.episodeNum, series.name) {
        formatEpisodeTitle(episode.title, episode.episodeNum, series.name)
    }

    val epHistory = remember(episode.streamUrl, history) {
        history.find { it.streamUrl == episode.streamUrl }
    }
    val isCompleted = remember(epHistory) {
        if (epHistory != null) {
            epHistory.isWatched || (epHistory.duration > 0 && (
                epHistory.playbackPosition.toFloat() / epHistory.duration.toFloat() >= 0.95f ||
                (epHistory.duration > 180_000L && (epHistory.duration - epHistory.playbackPosition) <= 180_000L)
            ))
        } else false
    }
    val progressFraction = remember(epHistory) {
        if (epHistory != null && epHistory.duration > 0) {
            (epHistory.playbackPosition.toFloat() / epHistory.duration.toFloat()).coerceIn(0f, 1f)
        } else 0f
    }

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFF161924),
        border = BorderStroke(1.dp, Color(0x1AFFFFFF))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Thumbnail container
            Box(
                modifier = Modifier
                    .width(108.dp)
                    .height(64.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF0F1118))
            ) {
                if (!series.posterUrl.isNullOrBlank()) {
                    SubcomposeAsyncImage(
                        model = series.posterUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF141722)),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.foxstream_logo),
                                    contentDescription = null,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        },
                        error = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF141722)),
                                contentAlignment = Alignment.Center
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.foxstream_logo),
                                    contentDescription = null,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color(0xFF141722)),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.foxstream_logo),
                            contentDescription = null,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                // Vignette overlay with center play icon
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    Surface(
                        shape = CircleShape,
                        color = Color.Black.copy(alpha = 0.6f),
                        modifier = Modifier.size(24.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = OrangePrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                // Badge visual de "Assistido" no canto superior direito da miniatura
                if (isCompleted) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color(0xE62E7D32),
                        modifier = Modifier
                            .padding(4.dp)
                            .align(Alignment.TopEnd)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Assistido",
                                tint = Color.White,
                                modifier = Modifier.size(10.dp)
                            )
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = "Assistido",
                                color = Color.White,
                                fontSize = 8.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Progress bar at the bottom of the thumbnail if watched
                if (progressFraction > 0.03f && !isCompleted) {
                    LinearProgressIndicator(
                        progress = progressFraction,
                        color = OrangePrimary,
                        trackColor = Color(0x55000000),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .align(Alignment.BottomCenter)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Center details
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = epBadge,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = OrangePrimary
                )

                Text(
                    text = displayTitle,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(2.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (!episode.duration.isNullOrBlank()) {
                        Text(
                            text = episode.duration,
                            fontSize = 11.sp,
                            color = Color(0xFF9E9E9E)
                        )
                    }

                    if (isCompleted) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = Color(0x334CAF50),
                            border = BorderStroke(1.dp, Color(0xFF4CAF50).copy(alpha = 0.5f))
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = null,
                                    tint = Color(0xFF4CAF50),
                                    modifier = Modifier.size(12.dp)
                                )
                                Spacer(modifier = Modifier.width(3.dp))
                                Text(
                                    text = "Assistido",
                                    color = Color(0xFF4CAF50),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    } else if (progressFraction > 0.05f) {
                        Text(
                            text = "${(progressFraction * 100).toInt()}% assistido",
                            color = OrangePrimary,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Right play action icon
            Surface(
                shape = CircleShape,
                color = OrangePrimary.copy(alpha = 0.15f),
                border = BorderStroke(1.dp, OrangePrimary.copy(alpha = 0.5f)),
                modifier = Modifier.size(34.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Reproduzir",
                        tint = OrangePrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

fun formatSeasonFeedback(season: SeasonItem): String {
    val seasonTitle = if (season.seasonNum > 0) {
        "Temporada ${season.seasonNum}"
    } else if (season.name.isNotBlank()) {
        season.name
    } else {
        "Temporada"
    }
    val count = season.episodes.size
    val epCountText = if (count == 1) "1 episódio" else "$count episódios"
    return "$seasonTitle • $epCountText"
}

@Composable
fun StaggeredEpisodeItem(
    index: Int,
    seasonKey: Any?,
    switchTimestamp: Long,
    isReducedMotion: Boolean,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    if (isReducedMotion) {
        Box(modifier = modifier) {
            content()
        }
        return
    }

    // Only stagger visible cards entering on a fresh season switch (< 700ms).
    // Subsequent lazy items rendered when scrolling down will appear immediately without delay.
    val isFreshSwitch = remember(seasonKey) {
        (System.currentTimeMillis() - switchTimestamp) < 700L
    }

    if (!isFreshSwitch) {
        Box(modifier = modifier) {
            content()
        }
        return
    }

    // Interval of 45ms per card, capped at 8 cards to guarantee total duration stays within 300-450ms
    val staggerDelay = remember(index) {
        (index.coerceAtMost(8) * 45L)
    }

    val animatable = remember(seasonKey) { Animatable(0f) }

    LaunchedEffect(seasonKey) {
        if (staggerDelay > 0) {
            delay(staggerDelay)
        }
        animatable.animateTo(
            targetValue = 1f,
            animationSpec = tween(
                durationMillis = 200,
                easing = FastOutSlowInEasing
            )
        )
    }

    val progress = animatable.value
    if (progress >= 1f) {
        Box(modifier = modifier) {
            content()
        }
    } else {
        val translateY = (1f - progress) * 18f
        Box(
            modifier = modifier.graphicsLayer {
                this.alpha = progress
                this.translationY = translateY * density
            }
        ) {
            content()
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SeriesDetailView(
    series: SeriesItem,
    history: List<HistoryItem>,
    onPlayEpisode: (SeriesItem, EpisodeItem) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val isReducedMotion = remember {
        try {
            val durationScale = Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1.0f
            )
            durationScale == 0f
        } catch (_: Exception) {
            false
        }
    }

    // Locate last watched episode from history
    val seriesHistory = remember(series.id, history) {
        history.filter { h ->
            series.seasons.any { season -> season.episodes.any { ep -> ep.streamUrl == h.streamUrl } } ||
            (h.type == ContentType.SERIES && h.seriesName.equals(series.name, ignoreCase = true))
        }.sortedByDescending { it.playedAt }
    }
    val lastPlayed = seriesHistory.firstOrNull()
    val allEpisodes = remember(series.seasons) {
        series.seasons.sortedBy { it.seasonNum }.flatMap { it.episodes }
    }
    val resumeEpisode = remember(lastPlayed, allEpisodes) {
        if (lastPlayed != null) {
            val matchedEp = allEpisodes.firstOrNull { it.streamUrl == lastPlayed.streamUrl }
                ?: allEpisodes.firstOrNull { ep -> lastPlayed.title.contains(ep.title, ignoreCase = true) }
            val epIdx = allEpisodes.indexOf(matchedEp)
            if (lastPlayed.isWatched && epIdx in 0 until allEpisodes.size - 1) {
                allEpisodes[epIdx + 1]
            } else {
                matchedEp ?: allEpisodes.firstOrNull()
            }
        } else null
    }

    var targetSeasonIndex by remember(series.id) {
        val initialIdx = if (resumeEpisode != null) {
            val sIdx = series.seasons.indexOfFirst { it.seasonNum == resumeEpisode.seasonNum }
            if (sIdx >= 0) sIdx else 0
        } else 0
        mutableStateOf(initialIdx)
    }

    var displayedSeasonIndex by remember(series.id) {
        mutableStateOf(targetSeasonIndex)
    }

    var seasonSwitchTimestamp by remember(series.id) {
        mutableStateOf(System.currentTimeMillis())
    }

    val listFadeAlpha = remember(series.id) { Animatable(1f) }
    val coroutineScope = rememberCoroutineScope()
    var transitionJob by remember { mutableStateOf<Job?>(null) }

    val safeTargetIndex = if (series.seasons.isNotEmpty()) {
        targetSeasonIndex.coerceIn(0, series.seasons.size - 1)
    } else 0

    val safeDisplayedIndex = if (series.seasons.isNotEmpty()) {
        displayedSeasonIndex.coerceIn(0, series.seasons.size - 1)
    } else 0

    val currentFeedbackSeason = series.seasons.getOrNull(safeTargetIndex)
    val currentSeason = series.seasons.getOrNull(safeDisplayedIndex)

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F1118))
    ) {
        val isTablet = maxWidth >= 600.dp

        if (series.seasons.isEmpty()) {
            Column(modifier = Modifier.fillMaxSize()) {
                SeriesDetailHeader(
                    series = series,
                    resumeEpisode = null,
                    onPlayResume = {},
                    onBack = onBack
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = OrangePrimary)
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Carregando temporadas e episódios...",
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp)
            ) {
                // Header
                item {
                    SeriesDetailHeader(
                        series = series,
                        resumeEpisode = resumeEpisode,
                        onPlayResume = { resumeEpisode?.let { onPlayEpisode(series, it) } },
                        onBack = onBack
                    )
                }

                // Sticky Seasons Bar & Feedback
                stickyHeader {
                    Surface(
                        color = Color(0xFF0F1118),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            SeasonsHorizontalSelector(
                                seasons = series.seasons,
                                selectedIndex = safeTargetIndex,
                                onSelectSeason = { newIndex ->
                                    if (newIndex != targetSeasonIndex && newIndex in series.seasons.indices) {
                                        targetSeasonIndex = newIndex
                                        transitionJob?.cancel()
                                        transitionJob = coroutineScope.launch {
                                            try {
                                                if (isReducedMotion) {
                                                    displayedSeasonIndex = newIndex
                                                    seasonSwitchTimestamp = System.currentTimeMillis()
                                                    listFadeAlpha.snapTo(1f)
                                                } else {
                                                    // Fade out current episodes list (~90ms)
                                                    listFadeAlpha.animateTo(
                                                        targetValue = 0f,
                                                        animationSpec = tween(
                                                            durationMillis = 90,
                                                            easing = FastOutLinearInEasing
                                                        )
                                                    )
                                                    displayedSeasonIndex = newIndex
                                                    seasonSwitchTimestamp = System.currentTimeMillis()
                                                    listFadeAlpha.snapTo(1f)
                                                }
                                            } finally {
                                                if (listFadeAlpha.value < 1f) {
                                                    listFadeAlpha.snapTo(1f)
                                                }
                                            }
                                        }
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(6.dp))

                            // Feedback da temporada: "Temporada X • Y episódios"
                            if (currentFeedbackSeason != null) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 2.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = formatSeasonFeedback(currentFeedbackSeason),
                                        color = Color(0xFFB0B0B0),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                        }
                    }
                }

                // Episodes list
                if (currentSeason == null || currentSeason.episodes.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(32.dp)
                                .graphicsLayer {
                                    alpha = listFadeAlpha.value
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Nenhum episódio encontrado para esta temporada.",
                                color = Color.Gray,
                                fontSize = 13.sp
                            )
                        }
                    }
                } else if (isTablet) {
                    val chunked = currentSeason.episodes.chunked(2)
                    items(chunked, key = { row -> "${safeDisplayedIndex}_${row.first().id}" }) { rowEpisodes ->
                        val rowIndex = chunked.indexOf(rowEpisodes)
                        StaggeredEpisodeItem(
                            index = if (rowIndex >= 0) rowIndex else 0,
                            seasonKey = safeDisplayedIndex,
                            switchTimestamp = seasonSwitchTimestamp,
                            isReducedMotion = isReducedMotion,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .graphicsLayer {
                                    alpha = listFadeAlpha.value
                                }
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                rowEpisodes.forEach { ep ->
                                    EpisodeCard(
                                        series = series,
                                        episode = ep,
                                        history = history,
                                        onClick = { onPlayEpisode(series, ep) },
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (rowEpisodes.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                } else {
                    items(currentSeason.episodes, key = { "${safeDisplayedIndex}_${it.id}" }) { ep ->
                        val epIndex = currentSeason.episodes.indexOf(ep)
                        StaggeredEpisodeItem(
                            index = if (epIndex >= 0) epIndex else 0,
                            seasonKey = safeDisplayedIndex,
                            switchTimestamp = seasonSwitchTimestamp,
                            isReducedMotion = isReducedMotion,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .graphicsLayer {
                                    alpha = listFadeAlpha.value
                                }
                        ) {
                            EpisodeCard(
                                series = series,
                                episode = ep,
                                history = history,
                                onClick = { onPlayEpisode(series, ep) },
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SeriesScreen(
    seriesList: List<SeriesItem>,
    popularSeries: List<SeriesItem> = emptyList(),
    onPlayEpisode: (SeriesItem, EpisodeItem) -> Unit,
    onLoadDetails: (SeriesItem, (List<SeasonItem>) -> Unit) -> Unit,
    initialSeries: SeriesItem? = null,
    onClearInitialSeries: () -> Unit = {},
    history: List<HistoryItem> = emptyList(),
    onTriggerSearch: () -> Unit = {}
) {
    var selectedSeries by remember { mutableStateOf<SeriesItem?>(initialSeries) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategoryForGrid by remember { mutableStateOf<String?>(null) }
    var showCategoriesDropdown by remember { mutableStateOf(false) }

    LaunchedEffect(initialSeries) {
        if (initialSeries != null) {
            selectedSeries = initialSeries
            onLoadDetails(initialSeries) { loadedSeasons ->
                selectedSeries = initialSeries.copy(seasons = loadedSeasons)
            }
            onClearInitialSeries()
        }
    }

    if (selectedSeries != null) {
        BackHandler {
            selectedSeries = null
        }
        SeriesDetailView(
            series = selectedSeries!!,
            history = history,
            onPlayEpisode = onPlayEpisode,
            onBack = { selectedSeries = null }
        )
        return
    }

    // Map of categories preserving list order
    val categoriesMap = remember(seriesList) {
        val map = linkedMapOf<String, MutableList<SeriesItem>>()
        seriesList.forEach { s ->
            val cat = s.category.trim().ifBlank { "Séries" }
            map.getOrPut(cat) { mutableListOf() }.add(s)
        }
        map
    }

    val allCategoriesList = remember(categoriesMap) {
        categoriesMap.keys.toList()
    }

    // Destaques de Séries (Carrossel Hero Banner - 100% TMDb API)
    val seriesHeroItems = remember(popularSeries) {
        popularSeries.filter { !it.posterUrl.isNullOrBlank() || !it.backdropUrl.isNullOrBlank() }
            .take(8)
            .map { s ->
                val firstEpUrl = s.seasons.firstOrNull()?.episodes?.firstOrNull()?.streamUrl ?: ""
                HeroBannerItem(
                    id = "series_hero_${s.id}",
                    title = s.name,
                    imageUrl = s.backdropUrl ?: s.posterUrl ?: "",
                    category = "Destaques TMDb",
                    type = ContentType.SERIES,
                    streamUrl = firstEpUrl,
                    badgeInfo = listOfNotNull(
                        "SÉRIE",
                        s.year,
                        s.rating?.let { "★ $it" },
                        "TMDb"
                    ).joinToString(" • "),
                    overview = s.description,
                    year = s.year,
                    seriesItem = s
                )
            }
    }

    // Global Search across entire series catalog
    val searchResults = remember(searchQuery, seriesList) {
        if (searchQuery.isBlank()) emptyList()
        else {
            val tokens = SearchUtils.extractTokens(searchQuery)
            seriesList.filter { SearchUtils.matchesAnyField(tokens, it.name, it.category) }
        }
    }

    // Handle Android back button when viewing category grid
    BackHandler(enabled = selectedCategoryForGrid != null && searchQuery.isBlank()) {
        selectedCategoryForGrid = null
    }

    val onOpenSeriesItem: (SeriesItem) -> Unit = { s ->
        selectedSeries = s
        onLoadDetails(s) { loadedSeasons ->
            selectedSeries = s.copy(seasons = loadedSeasons)
        }
    }

    // Layout: Search Bar & Categories, seguido dinamicamente pelo LazyColumn
    Column(modifier = Modifier.fillMaxSize()) {

        // Barra de Busca e Botão Categorias FIXO (Mesmo nó Composable em Row horizontal para reter o foco e economizar espaço)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Elemento 1: Botão Categorias no formato pílula
            Box {
                Button(
                    onClick = { showCategoriesDropdown = !showCategoriesDropdown },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (selectedCategoryForGrid != null) OrangePrimary else Color(0xFF1E2230),
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(50),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                    modifier = Modifier.height(44.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (selectedCategoryForGrid != null) {
                            if (selectedCategoryForGrid!!.length > 8) selectedCategoryForGrid!!.take(6) + ".." else selectedCategoryForGrid!!
                        } else "Categorias ⬇️",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                DropdownMenu(
                    expanded = showCategoriesDropdown,
                    onDismissRequest = { showCategoriesDropdown = false },
                    modifier = Modifier
                        .background(Color(0xFF161924))
                        .widthIn(min = 220.dp, max = 290.dp)
                ) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = "Todas as Categorias (Carrosséis)",
                                fontSize = 12.5.sp,
                                fontWeight = if (selectedCategoryForGrid == null) FontWeight.Bold else FontWeight.Medium,
                                color = if (selectedCategoryForGrid == null) OrangePrimary else Color.White
                            )
                        },
                        onClick = {
                            selectedCategoryForGrid = null
                            showCategoriesDropdown = false
                        }
                    )
                    Divider(color = Color.White.copy(alpha = 0.12f))
                    allCategoriesList.forEach { cat ->
                        val count = categoriesMap[cat]?.size ?: 0
                        val isSelected = selectedCategoryForGrid == cat
                        DropdownMenuItem(
                            text = {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = cat,
                                        fontSize = 12.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) OrangePrimary else Color(0xFFDCE1EF),
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color(0xFF23283B)
                                    ) {
                                        Text(
                                            text = "$count",
                                            fontSize = 10.sp,
                                            color = Color.Gray,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            },
                            onClick = {
                                selectedCategoryForGrid = cat
                                showCategoriesDropdown = false
                            }
                        )
                    }
                }
            }

            // Se uma categoria estiver selecionada, exibe o botão de voltar para limpar o filtro
            if (selectedCategoryForGrid != null) {
                IconButton(
                    onClick = { selectedCategoryForGrid = null },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Limpar filtro",
                        tint = OrangePrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Elemento 2: Barra de busca estática como botão clicável que abre a busca global instantaneamente
            Surface(
                onClick = { onTriggerSearch() },
                modifier = Modifier.weight(1f).height(46.dp),
                shape = RoundedCornerShape(16.dp),
                color = Color(0xFF141722),
                border = BorderStroke(1.dp, Color(0xFF2D3245))
            ) {
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = OrangePrimary,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Buscar em todas as séries...",
                        color = Color.Gray,
                        fontSize = 11.sp
                    )
                }
            }
        }

        // ÁREA DE CONTEÚDO DINÂMICA
        if (searchQuery.isNotBlank()) {
            // VIEW 1: SEARCH RESULTS
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp)
            ) {
                if (searchResults.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = "Nenhuma série encontrada para \"$searchQuery\".", color = Color.Gray)
                    }
                } else {
                    Text(
                        text = "Resultados da busca (${searchResults.size} séries encontradas):",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(3),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(searchResults, key = { it.id }) { s ->
                            SeriesGridCard(
                                series = s,
                                onSelect = { onOpenSeriesItem(s) }
                            )
                        }
                    }
                }
            }
        } else if (selectedCategoryForGrid != null) {
            // VIEW 2: CATEGORY DETAIL ("VER TUDO" GRID)
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp)
            ) {
                val catSeries = categoriesMap[selectedCategoryForGrid] ?: emptyList()
                Spacer(modifier = Modifier.height(6.dp))
                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(catSeries, key = { it.id }) { s ->
                        SeriesGridCard(
                            series = s,
                            onSelect = { onOpenSeriesItem(s) }
                        )
                    }
                }
            }
        } else {
            // VIEW 3: MAIN VIEW (Carrosséis por categoria com Destaques no topo)
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (seriesHeroItems.isNotEmpty()) {
                    item(key = "series_hero_banner") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "EM DESTAQUE",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        HeroBannerCarousel(
                            items = seriesHeroItems,
                            onPlay = { _, _, _ -> },
                            onOpenSeries = { onOpenSeriesItem(it) },
                            onOpenMovie = {}
                        )
                    }
                }
                // Carrosséis de cada categoria
                categoriesMap.forEach { (catName, catSeries) ->
                    item(key = "cat_$catName") {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp)
                        ) {
                            SectionHeaderWithAction(
                                title = catName,
                                actionText = "Ver tudo",
                                onAction = { selectedCategoryForGrid = catName }
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            SeriesHorizontalCarousel(
                                seriesList = catSeries,
                                onOpenSeries = { onOpenSeriesItem(it) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SeriesGridCard(
    series: SeriesItem,
    onSelect: (SeriesItem) -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable { onSelect(series) },
        shape = RoundedCornerShape(10.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 2.dp
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.68f) // Pôster vertical ~2:3
                    .background(Color(0xFF141722))
            ) {
                CoilPosterImage(
                    url = series.posterUrl,
                    placeholderIcon = Icons.Default.VideoLibrary,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
            }

            // Título compacto abaixo do pôster (apenas o nome da série)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 6.dp, vertical = 6.dp)
            ) {
                Text(
                    text = series.name,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                    color = Color.White,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ==========================================
// 5. FAVORITES SCREEN
// ==========================================
@Composable
fun FavoritesScreen(
    favorites: List<FavoriteItem>,
    onPlayFavorite: (FavoriteItem) -> Unit,
    onRemove: (FavoriteItem) -> Unit
) {
    if (favorites.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Nenhum favorito adicionado.", color = Color.Gray)
        }
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items(favorites) { item ->
            Surface(
                modifier = Modifier.fillMaxWidth().clickable { onPlayFavorite(item) },
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface
            ) {
                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Favorite, contentDescription = null, tint = Color.Red)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(item.title, fontWeight = FontWeight.Bold, color = Color.White)
                        Text(item.category, fontSize = 11.sp, color = Color.Gray)
                    }
                    IconButton(onClick = { onRemove(item) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Remover", tint = Color.Gray)
                    }
                }
            }
        }
    }
}

// ==========================================
// 6. PLAYLISTS SCREEN
// ==========================================
@Composable
fun PlaylistsScreen(
    playlists: List<Playlist>,
    activePlaylistId: String?,
    onSelect: (String) -> Unit,
    onOpenAdd: () -> Unit,
    onDelete: (String) -> Unit,
    onRename: (String, String) -> Unit,
    onUpdatePlaylist: (String) -> Unit,
    onUpdateAll: () -> Unit
) {
    var playlistToRename by remember { mutableStateOf<Playlist?>(null) }
    var renameText by remember { mutableStateOf("") }

    if (playlistToRename != null) {
        AlertDialog(
            onDismissRequest = { playlistToRename = null },
            title = { Text("Renomear Lista", color = Color.White) },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    label = { Text("Nome da Lista") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = Color.DarkGray
                    )
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        playlistToRename?.let { onRename(it.id, renameText) }
                        playlistToRename = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Text("Salvar")
                }
            },
            dismissButton = {
                TextButton(onClick = { playlistToRename = null }) {
                    Text("Cancelar", color = Color.Gray)
                }
            },
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = onOpenAdd,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Adicionar")
            }
            Button(
                onClick = onUpdateAll,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = Color.DarkGray)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Atualizar Todas")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(playlists) { p ->
                val isActive = p.id == activePlaylistId
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(p.id) },
                    shape = RoundedCornerShape(12.dp),
                    color = if (isActive) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(p.name, fontWeight = FontWeight.Bold, color = Color.White)
                            Text("Tipo: ${p.type.name} • Canais: ${p.liveCount} • Filmes: ${p.movieCount} • Séries: ${p.seriesCount}", fontSize = 11.sp, color = Color.Gray)
                            if (p.lastUpdated > 0L) {
                                val dateStr = java.text.SimpleDateFormat("dd/MM/yyyy HH:mm", java.util.Locale.getDefault()).format(java.util.Date(p.lastUpdated))
                                Text("Atualizado em: $dateStr", fontSize = 10.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                        Row {
                            IconButton(onClick = { onUpdatePlaylist(p.id) }) {
                                Icon(Icons.Default.Refresh, contentDescription = "Sincronizar", tint = MaterialTheme.colorScheme.primary)
                            }
                            IconButton(onClick = {
                                playlistToRename = p
                                renameText = p.name
                            }) {
                                Icon(Icons.Default.Edit, contentDescription = "Renomear", tint = Color.LightGray)
                            }
                            IconButton(onClick = { onDelete(p.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Remover", tint = Color.Gray)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// 7. SETTINGS SCREEN
// ==========================================
@Composable
fun SettingsScreen(
    onClearCache: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Configurações", style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.Bold)

        // App Branding Card
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(id = R.drawable.foxstream_logo),
                    contentDescription = "FoxStream Logo",
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text("FoxStream", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 18.sp)
                    Text("IPTV, Filmes & Séries", color = Color.Gray, fontSize = 12.sp)
                }
            }
        }

        // Player Info
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Player Externo Padrão", fontWeight = FontWeight.Bold, color = Color.White)
                Text("VLC for Android prioritário via Android Intent (org.videolan.vlc)", fontSize = 12.sp, color = Color.Gray)
            }
        }

        // Disclaimer
        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Aviso Legal", fontWeight = FontWeight.Bold, color = Color.White)
                Text(
                    "O FoxStream não fornece e não hospeda nenhum conteúdo de mídia. O aplicativo é apenas um gerenciador para as listas fornecidas pelo próprio usuário.",
                    fontSize = 12.sp,
                    color = Color.Gray
                )
            }
        }

        Button(
            onClick = onClearCache,
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(6.dp))
            Text("Limpar Cache Local")
        }
    }
}

// ==========================================
// 8. ADD PLAYLIST DIALOG
// ==========================================
@Composable
fun AddPlaylistDialog(
    isLoading: Boolean = false,
    onDismiss: () -> Unit,
    onAddM3U: (name: String, url: String) -> Unit,
    onAddXtream: (name: String, serverUrl: String, user: String, pass: String) -> Unit
) {
    var selectedMethod by remember { mutableStateOf("M3U / M3U8") }
    var playlistName by remember { mutableStateOf("") }
    var serverUrl by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var m3uUrl by remember { mutableStateOf("") }

    val methods = listOf("M3U / M3U8", "XTREAM CODES / API")

    Dialog(onDismissRequest = { if (!isLoading) onDismiss() }) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth().padding(8.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Adicionar Lista", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = Color.White)

                // Method selector: [M3U / M3U8]   [XTREAM CODES / API]
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    methods.forEach { method ->
                        val isSelected = selectedMethod == method
                        Surface(
                            onClick = { if (!isLoading) selectedMethod = method },
                            modifier = Modifier
                                .weight(1f)
                                .height(38.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = if (isSelected) MaterialTheme.colorScheme.primary else Color(0xFF1E2230),
                            border = if (isSelected) null else BorderStroke(1.dp, Color(0x33FFFFFF)),
                            enabled = !isLoading
                        ) {
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                                Text(
                                    text = method,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) Color.White else Color(0xFFB0B5C6),
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = playlistName,
                    onValueChange = { playlistName = it },
                    label = { Text("Nome da Lista") },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isLoading
                )

                if (selectedMethod == "M3U / M3U8") {
                    OutlinedTextField(
                        value = m3uUrl,
                        onValueChange = { m3uUrl = it },
                        label = { Text("URL M3U / M3U8") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading
                    )
                } else {
                    OutlinedTextField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it },
                        label = { Text("Servidor / URL (ex: http://servidor:8080)") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading
                    )
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("Usuário") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Senha") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !isLoading
                    )
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss, enabled = !isLoading) {
                        Text("Cancelar")
                    }
                    Button(
                        onClick = {
                            val isM3u = selectedMethod == "M3U / M3U8"
                            if (isM3u) {
                                onAddM3U(playlistName, m3uUrl)
                            } else {
                                onAddXtream(playlistName, serverUrl, username, password)
                            }
                        },
                        enabled = !isLoading && playlistName.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Salvando...")
                        } else {
                            Text("Salvar")
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// 9. GLOBAL SEARCH SCREEN
// ==========================================
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalSearchScreen(
    query: String,
    onQueryChange: (String) -> Unit,
    isSearching: Boolean,
    searchChannels: List<LiveChannel>,
    searchMovies: List<MovieItem>,
    searchSeries: List<SeriesItem>,
    searchEpisodes: List<Pair<SeriesItem, EpisodeItem>>,
    onPlay: (String, String, ContentType) -> Unit,
    onOpenMovie: (MovieItem) -> Unit = {},
    searchScope: String = "ALL", // "ALL", "MOVIE", "SERIES"
    onClose: () -> Unit
) {
    val placeholderText = when (searchScope) {
        "MOVIE" -> "Buscar em filmes..."
        "SERIES" -> "Buscar em séries..."
        else -> "Buscar TV, Filmes, Séries e Episódios..."
    }

    val emptyText = when (searchScope) {
        "MOVIE" -> "Digite algo para buscar em filmes"
        "SERIES" -> "Digite algo para buscar em séries"
        else -> "Digite algo para buscar no catálogo"
    }

    // Determine if we actually have any matched results shown for the current searchScope
    val showChannels = searchScope == "ALL" && searchChannels.isNotEmpty()
    val showMovies = (searchScope == "ALL" || searchScope == "MOVIE") && searchMovies.isNotEmpty()
    val showSeries = (searchScope == "ALL" || searchScope == "SERIES") && searchSeries.isNotEmpty()
    val showEpisodes = (searchScope == "ALL" || searchScope == "SERIES") && searchEpisodes.isNotEmpty()

    val hasResults = showChannels || showMovies || showSeries || showEpisodes

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            IconButton(onClick = onClose) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = Color.White)
            }
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = { Text(placeholderText) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(16.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = Color.DarkGray
                ),
                singleLine = true
            )
        }
        Spacer(modifier = Modifier.height(16.dp))

        if (isSearching) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else if (query.isBlank()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(48.dp), tint = Color.Gray)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(emptyText, color = Color.Gray)
                }
            }
        } else if (!hasResults) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Nenhum resultado encontrado.", color = Color.Gray)
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (showChannels) {
                    item {
                        Text("TV ao Vivo", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    items(searchChannels, key = { "srch_ch_${it.id}" }) { ch ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onPlay(ch.streamUrl, ch.name, ContentType.LIVE) },
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                CoilPosterImage(
                                    url = ch.logoUrl,
                                    placeholderIcon = Icons.Default.Tv,
                                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(6.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(ch.name, fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(ch.category, fontSize = 11.sp, color = Color.Gray)
                                }
                            }
                        }
                    }
                }

                if (showMovies) {
                    item {
                        Text("Filmes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    items(searchMovies, key = { "srch_m_${it.id}" }) { m ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onOpenMovie(m)
                                },
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                CoilPosterImage(
                                    url = m.posterUrl,
                                    placeholderIcon = Icons.Default.Movie,
                                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(6.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(m.name, fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(m.category, fontSize = 11.sp, color = Color.Gray)
                                }
                            }
                        }
                    }
                }

                if (showSeries) {
                    item {
                        Text("Séries", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    items(searchSeries, key = { "srch_s_${it.id}" }) { s ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    val firstEp = s.seasons.firstOrNull()?.episodes?.firstOrNull()
                                    if (firstEp != null) {
                                        onPlay(firstEp.streamUrl, "${s.name} - ${firstEp.title}", ContentType.SERIES)
                                    }
                                },
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                CoilPosterImage(
                                    url = s.posterUrl,
                                    placeholderIcon = Icons.Default.VideoLibrary,
                                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(6.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(s.name, fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(s.category, fontSize = 11.sp, color = Color.Gray)
                                }
                            }
                        }
                    }
                }

                if (showEpisodes) {
                    item {
                        Text("Episódios", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                    items(searchEpisodes, key = { "srch_ep_${it.first.id}_${it.second.id}" }) { (series, ep) ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onPlay(ep.streamUrl, "${series.name} - ${ep.title}", ContentType.SERIES) },
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surface
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                CoilPosterImage(
                                    url = series.posterUrl,
                                    placeholderIcon = Icons.Default.PlayArrow,
                                    modifier = Modifier.size(50.dp).clip(RoundedCornerShape(6.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(ep.title, fontWeight = FontWeight.Bold, color = Color.White)
                                    Text("${series.name} • Temporada ${ep.seasonNum}", fontSize = 11.sp, color = Color.Gray)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LivePlayerAnimatedVisibility(
    visible: Boolean,
    modifier: Modifier = Modifier,
    enter: EnterTransition = fadeIn(),
    exit: ExitTransition = fadeOut(),
    content: @Composable AnimatedVisibilityScope.() -> Unit
) {
    androidx.compose.animation.AnimatedVisibility(
        visible = visible,
        enter = enter,
        exit = exit,
        modifier = modifier,
        content = content
    )
}

