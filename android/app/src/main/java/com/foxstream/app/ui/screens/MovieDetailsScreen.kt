package com.foxstream.app.ui.screens

import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.compose.SubcomposeAsyncImage
import com.foxstream.app.data.model.ContentType
import com.foxstream.app.data.model.HistoryItem
import com.foxstream.app.data.model.MovieItem
import com.foxstream.app.ui.navigation.NavDestinations

import com.foxstream.app.ui.theme.OrangePrimary
import com.foxstream.app.ui.theme.DarkBackground
private val CardSurfaceColor = Color(0xFF161924)
private val ChipBackground = Color(0xFF1E2333)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun MovieDetailsScreen(
    movie: MovieItem,
    isFavorite: Boolean,
    historyItem: HistoryItem? = null,
    onBack: () -> Unit,
    onToggleFavorite: (MovieItem) -> Unit,
    onPlay: (streamUrl: String, title: String, type: ContentType, useVlc: Boolean) -> Unit,
    onNavigateToPlayer: ((String) -> Unit)? = null,
    onLoadDetails: ((MovieItem, (MovieItem) -> Unit) -> Unit)? = null
) {
    val context = LocalContext.current
    var currentMovie by remember(movie.id) { mutableStateOf(movie) }
    var selectedPlayerEngine by remember { mutableStateOf("VLC") } // "VLC" ou "ExoPlayer"
    var isLoadingDetails by remember { mutableStateOf(false) }
    var isFindingStream by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    // Intercepta o botão voltar nativo
    BackHandler {
        onBack()
    }

    // Carrega detalhes complementares (plot, diretor, elenco, backdrop, duração) sob demanda
    LaunchedEffect(movie.id) {
        if (onLoadDetails != null) {
            isLoadingDetails = true
            onLoadDetails(currentMovie) { updated ->
                currentMovie = updated
                isLoadingDetails = false
            }
        }
    }

    var availableStreams by remember { mutableStateOf<List<com.foxstream.app.util.StreamSource>>(emptyList()) }
    var showStreamOptionsSheet by remember { mutableStateOf(false) }

    LaunchedEffect(currentMovie.id, currentMovie.name) {
        val direct = if (currentMovie.streamUrl.isNotBlank()) {
            listOf(
                com.foxstream.app.util.StreamSource(
                    id = currentMovie.id,
                    title = currentMovie.name,
                    type = "movie",
                    streamUrl = currentMovie.streamUrl,
                    quality = "HD",
                    name = "Stream Direto"
                )
            )
        } else emptyList()

        val res = com.foxstream.app.util.StreamResolver.resolveStream(
            context = context,
            title = currentMovie.name,
            year = currentMovie.year,
            type = "movie"
        )

        val resolved = if (res is com.foxstream.app.util.StreamResolutionState.Available) {
            res.allStreams
        } else emptyList()

        availableStreams = (direct + resolved).distinctBy { it.streamUrl }
    }

    val scrollState = rememberScrollState()
    val configuration = LocalConfiguration.current
    val screenHeight = configuration.screenHeightDp.dp
    val backdropHeight = (screenHeight * 0.42f).coerceIn(260.dp, 360.dp)

    val backdropImage = remember(currentMovie) {
        currentMovie.backdropUrl ?: currentMovie.posterUrl
    }

    // Parsing das tags de gêneros
    val genres = remember(currentMovie.genre, currentMovie.category) {
        val raw = currentMovie.genre ?: currentMovie.category
        raw.split(",", "/", "|", "-")
            .map { it.trim() }
            .filter { it.isNotBlank() && !it.equals("filmes", ignoreCase = true) }
            .distinct()
            .ifEmpty { listOf(currentMovie.category.ifBlank { "Filme" }) }
    }

    // Elenco principal
    val castMembers = remember(currentMovie.cast) {
        val raw = currentMovie.cast ?: ""
        if (raw.contains("redecanais", ignoreCase = true)) {
            emptyList()
        } else {
            raw.split(",", ";")
                .map { it.trim().removePrefix("•").trim() }
                .filter { it.isNotBlank() }
        }
    }

    // Progresso salvo no histórico (Continuar Assistindo)
    val hasHistory = historyItem != null && historyItem.duration > 0L && historyItem.playbackPosition > 0L && !historyItem.isWatched
    val progressFraction = if (hasHistory) {
        (historyItem!!.playbackPosition.toFloat() / historyItem.duration.toFloat()).coerceIn(0f, 1f)
    } else 0f

    val resumePositionText = if (hasHistory) {
        val totalSecs = historyItem!!.playbackPosition / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        String.format("%02d:%02d", mins, secs)
    } else null

    Scaffold(
        containerColor = DarkBackground,
        bottomBar = {
            // ==========================================
            // Painel de Reprodução (Footer / Bottom Bar)
            // ==========================================
            Surface(
                color = CardSurfaceColor.copy(alpha = 0.98f),
                tonalElevation = 12.dp,
                border = BorderStroke(1.dp, Color(0x22FFFFFF)),
                shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 14.dp)
                ) {
                    // Barra de progresso do histórico caso o usuário tenha começado a assistir
                    if (hasHistory && progressFraction > 0.01f) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Progresso salvo: $resumePositionText assistido",
                                color = OrangePrimary,
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "${(progressFraction * 100).toInt()}%",
                                color = Color.Gray,
                                fontSize = 11.5.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = progressFraction,
                            color = OrangePrimary,
                            trackColor = Color(0x33FFFFFF),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp))
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                    }

                    // Seletor de Motor de Reprodução (LibVLC vs ExoPlayer) e Servidor
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Dns,
                                contentDescription = null,
                                tint = Color(0xFF8E95A5),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Servidor: Stream Direto (HLS/VOD)",
                                color = Color(0xFFB0B7C6),
                                fontSize = 11.5.sp
                            )
                        }

                        // Toggle VLC / ExoPlayer
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "Player:",
                                color = Color.Gray,
                                fontSize = 11.sp
                            )

                            // VLC Chip
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (selectedPlayerEngine == "VLC") OrangePrimary else Color(0xFF222634),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { selectedPlayerEngine = "VLC" }
                            ) {
                                Text(
                                    text = "LibVLC",
                                    color = if (selectedPlayerEngine == "VLC") Color.Black else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }

                            // ExoPlayer Chip
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (selectedPlayerEngine == "ExoPlayer") OrangePrimary else Color(0xFF222634),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { selectedPlayerEngine = "ExoPlayer" }
                            ) {
                                Text(
                                    text = "ExoPlayer",
                                    color = if (selectedPlayerEngine == "ExoPlayer") Color.Black else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Botão Principal "Assistir / Play" Destacado
                    Button(
                        enabled = !isFindingStream,
                        onClick = {
                            val useVlc = selectedPlayerEngine == "VLC"
                            val playTarget: (String) -> Unit = { targetUrl ->
                                if (onNavigateToPlayer != null) {
                                    val route = NavDestinations.buildPlayerRoute(targetUrl)
                                    onNavigateToPlayer(route)
                                } else {
                                    onPlay(targetUrl, currentMovie.name, ContentType.MOVIE, useVlc)
                                }
                            }

                            if (availableStreams.size > 1) {
                                showStreamOptionsSheet = true
                            } else if (availableStreams.size == 1) {
                                playTarget(availableStreams.first().streamUrl)
                            } else if (currentMovie.streamUrl.isNotBlank()) {
                                playTarget(currentMovie.streamUrl)
                            } else {
                                isFindingStream = true
                                coroutineScope.launch {
                                    val res = com.foxstream.app.util.StreamResolver.resolveStream(
                                        context = context,
                                        title = currentMovie.name,
                                        year = currentMovie.year,
                                        type = "movie"
                                    )
                                    isFindingStream = false
                                    if (res is com.foxstream.app.util.StreamResolutionState.Available) {
                                        availableStreams = res.allStreams
                                        if (res.allStreams.size > 1) {
                                            showStreamOptionsSheet = true
                                        } else {
                                            playTarget(res.stream.streamUrl)
                                        }
                                    } else {
                                        android.widget.Toast.makeText(context, "Nenhum stream disponível para este título.", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        if (isFindingStream) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                color = Color.Black,
                                strokeWidth = 2.5.dp
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Localizando transmissão...",
                                color = Color.Black,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.5.sp
                            )
                        } else {
                            Icon(
                                imageVector = if (availableStreams.size > 1) Icons.Default.FormatListBulleted else Icons.Default.PlayArrow,
                                contentDescription = null,
                                tint = Color.Black,
                                modifier = Modifier.size(22.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = when {
                                    availableStreams.size > 1 -> "Opções de Transmissão (${availableStreams.size} fontes)"
                                    hasHistory -> "Continuar Assistindo ($resumePositionText)"
                                    else -> "Assistir Agora ($selectedPlayerEngine)"
                                },
                                color = Color.Black,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = innerPadding.calculateBottomPadding())
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
            ) {
                // ==========================================
                // 1. Header Visual: Backdrop com Gradiente
                // ==========================================
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(backdropHeight)
                ) {
                    SubcomposeAsyncImage(
                        model = backdropImage,
                        contentDescription = currentMovie.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF141722)),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(color = OrangePrimary, modifier = Modifier.size(32.dp))
                            }
                        },
                        error = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF141722)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Movie,
                                    contentDescription = null,
                                    tint = Color.DarkGray,
                                    modifier = Modifier.size(64.dp)
                                )
                            }
                        }
                    )

                    // Gradiente escuro no rodapé do backdrop para contraste suave
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    colors = listOf(
                                        Color.Black.copy(alpha = 0.45f),
                                        Color.Transparent,
                                        DarkBackground.copy(alpha = 0.75f),
                                        DarkBackground
                                    )
                                )
                            )
                    )

                    // Ícone central de play decorativo
                    Surface(
                        shape = CircleShape,
                        color = Color.Black.copy(alpha = 0.55f),
                        border = BorderStroke(1.5.dp, Color.White.copy(alpha = 0.4f)),
                        modifier = Modifier
                            .size(54.dp)
                            .align(Alignment.Center)
                            .clickable {
                                val useVlc = selectedPlayerEngine == "VLC"
                                if (onNavigateToPlayer != null) {
                                    val route = NavDestinations.buildPlayerRoute(currentMovie.streamUrl)
                                    onNavigateToPlayer(route)
                                } else {
                                    onPlay(currentMovie.streamUrl, currentMovie.name, ContentType.MOVIE, useVlc)
                                }
                            }
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.PlayArrow,
                                contentDescription = "Play",
                                tint = OrangePrimary,
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }
                }

                // ==========================================
                // Conteúdo Principal: Título, Pôster, Info
                // ==========================================
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp)
                        .offset(y = (-30).dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        // Miniatura do pôster com elevação e borda
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            shadowElevation = 8.dp,
                            border = BorderStroke(1.5.dp, Color(0x33FFFFFF)),
                            modifier = Modifier
                                .width(110.dp)
                                .height(160.dp)
                        ) {
                            SubcomposeAsyncImage(
                                model = currentMovie.posterUrl,
                                contentDescription = currentMovie.name,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                                loading = {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(CardSurfaceColor),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(color = OrangePrimary, modifier = Modifier.size(24.dp))
                                    }
                                },
                                error = {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(CardSurfaceColor),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Movie, contentDescription = null, tint = Color.Gray)
                                    }
                                }
                            )
                        }

                        // Título e Categoria ao lado do pôster
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(bottom = 6.dp)
                        ) {
                            Text(
                                text = currentMovie.name,
                                color = Color.White,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.ExtraBold,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                                lineHeight = 24.sp
                            )

                            Spacer(modifier = Modifier.height(6.dp))

                            Text(
                                text = currentMovie.category.ifBlank { "Filme VOD" },
                                color = OrangePrimary,
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(18.dp))

                    // ==========================================
                    // 3. Informações Básicas (Duração, Ano, IMDb)
                    // ==========================================
                    Surface(
                        color = CardSurfaceColor,
                        shape = RoundedCornerShape(12.dp),
                        border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Duração
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.AccessTime,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(5.dp))
                                Text(
                                    text = currentMovie.duration?.takeIf { !it.contains("redecanais", ignoreCase = true) && it.isNotBlank() } ?: "120 min",
                                    color = Color.White,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }

                            // Ano de Lançamento
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.CalendarToday,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(15.dp)
                                )
                                Spacer(modifier = Modifier.width(5.dp))
                                Text(
                                    text = currentMovie.year ?: "2024",
                                    color = Color.White,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }

                            // Avaliação IMDb / Rating
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = Color(0xFFFFC107),
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = currentMovie.rating ?: "8.2",
                                    color = Color(0xFFFFC107),
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            // Selo de Qualidade
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = Color(0xFF22283A),
                                border = BorderStroke(1.dp, Color(0x33FFFFFF))
                            ) {
                                Text(
                                    text = "Full HD",
                                    color = Color(0xFFCCD2E3),
                                    fontSize = 10.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // ==========================================
                    // 4. Sinopse e Tags de Gêneros
                    // ==========================================
                    // Tags de Gêneros (Chips arredondados)
                    if (genres.isNotEmpty()) {
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            genres.forEach { genreTag ->
                                Surface(
                                    shape = RoundedCornerShape(16.dp),
                                    color = ChipBackground,
                                    border = BorderStroke(1.dp, Color(0x33FF6600))
                                ) {
                                    Text(
                                        text = genreTag,
                                        color = Color(0xFFE2E7F5),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                    }

                    // Sinopse
                    Text(
                        text = "Sinopse",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    val descriptionText = currentMovie.description?.ifBlank { null }
                        ?: "Acompanhe esta incrível produção no FoxStream com reprodução fluida em alta definição pelo motor LibVLC."

                    Text(
                        text = descriptionText,
                        color = Color(0xFFB8BFD0),
                        fontSize = 13.5.sp,
                        lineHeight = 20.sp
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // ==========================================
                    // 5. Ficha Técnica (Diretor e Elenco Principal)
                    // ==========================================
                    Text(
                        text = "Ficha Técnica",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Surface(
                        color = CardSurfaceColor,
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            // Direção / Diretor
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.width(85.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.MovieCreation,
                                        contentDescription = null,
                                        tint = OrangePrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Diretor",
                                        color = Color.Gray,
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                Text(
                                    text = currentMovie.director?.takeIf { !it.contains("redecanais", ignoreCase = true) && it.isNotBlank() } ?: "Informação disponível pelo servidor",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            Divider(
                                color = Color(0x1AFFFFFF),
                                thickness = 1.dp,
                                modifier = Modifier.padding(vertical = 10.dp)
                            )

                            // Elenco Principal (Cast)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.Top
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.width(85.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.People,
                                        contentDescription = null,
                                        tint = OrangePrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "Elenco",
                                        color = Color.Gray,
                                        fontSize = 12.5.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                if (castMembers.isNotEmpty()) {
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        verticalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        castMembers.take(6).forEach { actor ->
                                            Text(
                                                text = "• $actor",
                                                color = Color(0xFFD6DBE8),
                                                fontSize = 12.5.sp
                                            )
                                        }
                                    }
                                } else {
                                    Text(
                                        text = currentMovie.cast ?: "Elenco original da produção",
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(26.dp))
                }
            }

            // ==========================================
            // 2. Ações Superiores Flutuantes (Voltar, Compartilhar, Favoritar)
            // ==========================================
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Botão Voltar flutuante
                IconButton(
                    onClick = onBack,
                    modifier = Modifier
                        .size(40.dp)
                        .background(Color.Black.copy(alpha = 0.65f), shape = CircleShape)
                        .border(1.dp, Color(0x33FFFFFF), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Voltar",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Botões Compartilhar e Favoritar
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Compartilhar
                    IconButton(
                        onClick = {
                            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, currentMovie.name)
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "Estou assistindo ao filme \"${currentMovie.name}\" no FoxStream Player!"
                                )
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Compartilhar filme"))
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .background(Color.Black.copy(alpha = 0.65f), shape = CircleShape)
                            .border(1.dp, Color(0x33FFFFFF), CircleShape)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Compartilhar",
                            tint = Color.White,
                            modifier = Modifier.size(19.dp)
                        )
                    }

                    // Favoritar
                    IconButton(
                        onClick = { onToggleFavorite(currentMovie) },
                        modifier = Modifier
                            .size(40.dp)
                            .background(Color.Black.copy(alpha = 0.65f), shape = CircleShape)
                            .border(1.dp, Color(0x33FFFFFF), CircleShape)
                    ) {
                        Icon(
                            imageVector = if (isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Favoritar",
                            tint = if (isFavorite) OrangePrimary else Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Overlay de Transição Elegante (Solução 2)
            AnimatedVisibility(
                visible = isFindingStream,
                enter = fadeIn() + scaleIn(initialScale = 0.92f),
                exit = fadeOut() + scaleOut(targetScale = 0.92f)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.85f))
                        .clickable(enabled = false) {},
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = CardSurfaceColor),
                        border = BorderStroke(1.dp, Color(0x33FF6600)),
                        elevation = CardDefaults.cardElevation(16.dp),
                        modifier = Modifier
                            .padding(32.dp)
                            .widthIn(max = 300.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier.size(60.dp)
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.fillMaxSize(),
                                    color = OrangePrimary,
                                    strokeWidth = 3.dp
                                )
                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                            Spacer(modifier = Modifier.height(20.dp))
                            Text(
                                text = "Buscando transmissão...",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Consultando servidor IPTV",
                                color = Color.Gray,
                                fontSize = 12.5.sp
                            )
                        }
                    }
                }
            }
        }

        if (showStreamOptionsSheet && availableStreams.isNotEmpty()) {
            MovieStreamOptionsSheet(
                movie = currentMovie,
                streams = availableStreams,
                selectedPlayerEngine = selectedPlayerEngine,
                onDismiss = { showStreamOptionsSheet = false },
                onSelectStream = { streamUrl ->
                    showStreamOptionsSheet = false
                    val useVlc = selectedPlayerEngine == "VLC"
                    if (onNavigateToPlayer != null) {
                        val route = NavDestinations.buildPlayerRoute(streamUrl)
                        onNavigateToPlayer(route)
                    } else {
                        onPlay(streamUrl, currentMovie.name, ContentType.MOVIE, useVlc)
                    }
                }
            )
        }
    }
}

@Composable
fun MovieStreamOptionsSheet(
    movie: MovieItem,
    streams: List<com.foxstream.app.util.StreamSource>,
    selectedPlayerEngine: String,
    onDismiss: () -> Unit,
    onSelectStream: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.85f))
            .clickable(onClick = onDismiss),
        contentAlignment = Alignment.BottomCenter
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.75f)
                .clickable(enabled = false) {},
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            color = Color(0xFF141722),
            border = BorderStroke(1.dp, Color(0x22FFFFFF))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Fechar",
                            tint = Color.White
                        )
                    }

                    Text(
                        text = "Fontes Disponíveis (${streams.size})",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp
                    )

                    Spacer(modifier = Modifier.size(48.dp))
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "${movie.name} • Player: $selectedPlayerEngine",
                    color = OrangePrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(14.dp))

                androidx.compose.foundation.lazy.LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(streams) { stream ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { onSelectStream(stream.streamUrl) },
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFF1E2230),
                            border = BorderStroke(1.dp, Color(0x33FFFFFF))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(6.dp),
                                    color = OrangePrimary.copy(alpha = 0.2f),
                                    border = BorderStroke(1.dp, OrangePrimary)
                                ) {
                                    Text(
                                        text = stream.quality ?: "HD",
                                        color = OrangePrimary,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 11.sp,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.width(12.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = stream.name ?: "Stream",
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.5.sp
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = stream.details ?: stream.title,
                                        color = Color(0xFFAAAAAA),
                                        fontSize = 11.5.sp,
                                        maxLines = 4,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                Spacer(modifier = Modifier.width(8.dp))

                                Icon(
                                    imageVector = Icons.Default.PlayArrow,
                                    contentDescription = "Reproduzir",
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(26.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
