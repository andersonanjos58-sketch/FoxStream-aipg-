package com.foxstream.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.SubcomposeAsyncImage
import com.foxstream.app.R
import com.foxstream.app.data.model.MovieItem
import com.foxstream.app.data.model.SeriesItem
import com.foxstream.app.data.model.StremioCatalogDefinition
import com.foxstream.app.data.model.StremioMetaItem
import com.foxstream.app.ui.theme.DarkBackground
import com.foxstream.app.ui.theme.OrangePrimary
import com.foxstream.app.ui.viewmodel.CatalogUiState
import com.foxstream.app.ui.viewmodel.CatalogViewModel
import com.foxstream.app.util.StreamSource

private val CardBackground = Color(0xFF161924)
private val ChipBackground = Color(0xFF1E2333)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CatalogScreen(
    viewModel: CatalogViewModel = viewModel(),
    onOpenMovie: (MovieItem) -> Unit,
    onOpenSeries: (SeriesItem) -> Unit,
    onPlayDirectStream: (streamUrl: String, title: String) -> Unit = { _, _ -> }
) {
    val uiState by viewModel.uiState.collectAsState()
    val activeAddonUrl by viewModel.activeAddonUrl.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    var showConfigDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = DarkBackground,
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(DarkBackground)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                // Header Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = "Catálogo Stremio & JSON",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        val addonLabel = when (val state = uiState) {
                            is CatalogUiState.Success -> state.manifest.name
                            else -> "Add-on Desacoplado"
                        }
                        Text(
                            text = addonLabel,
                            color = OrangePrimary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    // Config Addon Button
                    Button(
                        onClick = { showConfigDialog = true },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E2333)),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.SettingsInputAntenna,
                            contentDescription = null,
                            tint = OrangePrimary,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Add-on",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.updateSearchQuery(it) },
                    placeholder = { Text("Buscar no catálogo...", color = Color.Gray, fontSize = 13.5.sp) },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(20.dp))
                    },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                Icon(imageVector = Icons.Default.Close, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
                            }
                        }
                    },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF13151F),
                        unfocusedContainerColor = Color(0xFF13151F),
                        focusedBorderColor = OrangePrimary,
                        unfocusedBorderColor = Color(0x22FFFFFF),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                )

                // Catalog Category Tabs (when Stremio Addon has catalogs)
                val successState = uiState as? CatalogUiState.Success
                if (successState != null && successState.availableCatalogs.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(successState.availableCatalogs) { cat ->
                            val isSelected = cat == successState.activeCatalog
                            Surface(
                                shape = RoundedCornerShape(50),
                                color = if (isSelected) OrangePrimary else ChipBackground,
                                border = if (isSelected) null else BorderStroke(1.dp, Color(0x22FFFFFF)),
                                modifier = Modifier
                                    .clip(RoundedCornerShape(50))
                                    .clickable { viewModel.selectCatalog(cat) }
                            ) {
                                Text(
                                    text = cat.displayName,
                                    color = if (isSelected) Color.Black else Color.White,
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is CatalogUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = OrangePrimary)
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Carregando catálogo Stremio...",
                                color = Color.Gray,
                                fontSize = 13.5.sp
                            )
                        }
                    }
                }

                is CatalogUiState.Error -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = CardBackground),
                            shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, Color(0x33FF6600)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.CloudOff,
                                    contentDescription = null,
                                    tint = OrangePrimary,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Text(
                                    text = "Falha no Catálogo",
                                    color = Color.White,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = state.message,
                                    color = Color.Gray,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = { viewModel.refresh() },
                                    colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Icon(imageVector = Icons.Default.Refresh, contentDescription = null, tint = Color.Black)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Tentar Novamente", color = Color.Black, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                is CatalogUiState.Success -> {
                    val filteredList = remember(state.items, searchQuery) {
                        if (searchQuery.isBlank()) state.items
                        else {
                            val q = searchQuery.trim().lowercase()
                            state.items.filter {
                                it.name.lowercase().contains(q) ||
                                (it.genres?.any { g -> g.lowercase().contains(q) } == true)
                            }
                        }
                    }

                    if (filteredList.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (searchQuery.isNotBlank()) "Nenhum resultado para \"$searchQuery\"" else "Nenhum item neste catálogo.",
                                color = Color.Gray,
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 130.dp),
                            contentPadding = PaddingValues(12.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(filteredList, key = { it.id }) { item ->
                                CatalogMetaCard(
                                    item = item,
                                    onClick = {
                                        if (state.isCustomJsonFeed) {
                                            val matchedStream = state.customStreams.firstOrNull { it.id == item.id }
                                            if (matchedStream != null && matchedStream.streamUrl.isNotBlank()) {
                                                onPlayDirectStream(matchedStream.streamUrl, matchedStream.title)
                                            } else if (item.type.lowercase() == "series") {
                                                onOpenSeries(item.toSeriesItem())
                                            } else {
                                                onOpenMovie(item.toMovieItem())
                                            }
                                        } else if (item.type.lowercase() == "series" || item.type.lowercase() == "tv") {
                                            onOpenSeries(item.toSeriesItem())
                                        } else {
                                            onOpenMovie(item.toMovieItem())
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Addon URL Configuration Dialog
    if (showConfigDialog) {
        AddonConfigDialog(
            currentUrl = activeAddonUrl,
            onDismiss = { showConfigDialog = false },
            onSave = { newUrl ->
                showConfigDialog = false
                viewModel.setAddonUrl(newUrl)
            }
        )
    }
}

@Composable
fun CatalogMetaCard(
    item: StremioMetaItem,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        border = BorderStroke(1.dp, Color(0x1AFFFFFF)),
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Poster Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.68f)
                    .background(Color(0xFF0F1118))
            ) {
                if (!item.poster.isNullOrBlank()) {
                    SubcomposeAsyncImage(
                        model = item.poster,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = {
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color(0xFF141722)),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    color = OrangePrimary,
                                    strokeWidth = 2.dp,
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
                                    modifier = Modifier.size(36.dp)
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
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                // Gradient Overlay at bottom of poster
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .align(Alignment.BottomCenter)
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color(0xCC000000))
                            )
                        )
                )

                // Top Type Pill (Filme / Série)
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color.Black.copy(alpha = 0.75f),
                    border = BorderStroke(0.5.dp, Color(0x44FFFFFF)),
                    modifier = Modifier
                        .padding(6.dp)
                        .align(Alignment.TopStart)
                ) {
                    Text(
                        text = if (item.type.equals("series", ignoreCase = true)) "SÉRIE" else "FILME",
                        color = OrangePrimary,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                    )
                }

                // Rating Pill (if available)
                if (!item.imdbRating.isNullOrBlank()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = Color.Black.copy(alpha = 0.8f),
                        modifier = Modifier
                            .padding(6.dp)
                            .align(Alignment.TopEnd)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                        ) {
                            Text(text = "★", color = Color(0xFFFFD700), fontSize = 9.5.sp)
                            Spacer(modifier = Modifier.width(2.dp))
                            Text(
                                text = item.imdbRating,
                                color = Color.White,
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Info details
            Column(modifier = Modifier.padding(8.dp)) {
                Text(
                    text = item.name,
                    color = Color.White,
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(2.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.cleanYear ?: "",
                        color = Color.Gray,
                        fontSize = 11.sp
                    )

                    if (!item.genres.isNullOrEmpty()) {
                        Text(
                            text = item.genres.first(),
                            color = OrangePrimary,
                            fontSize = 10.5.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun AddonConfigDialog(
    currentUrl: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var urlText by remember { mutableStateOf(currentUrl) }

    val presets = listOf(
        Pair("Torrentio (Default)", "https://torrentio.strem.fun/manifest.json"),
        Pair("Cinemeta (Oficial)", "https://v3-cinemeta.strem.io/manifest.json"),
        Pair("Streams JSON Demo", "https://raw.githubusercontent.com/teste/streams.json")
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF181B26),
        title = {
            Text(
                text = "Configuração do Add-on",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Insira a URL do manifesto Stremio (/manifest.json) ou arquivo JSON dinâmico:",
                    color = Color(0xFFB0B0B0),
                    fontSize = 12.5.sp
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = urlText,
                    onValueChange = { urlText = it },
                    singleLine = true,
                    placeholder = { Text("https://exemplo.com/manifest.json", color = Color.Gray, fontSize = 12.sp) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = Color(0xFF10121A),
                        unfocusedContainerColor = Color(0xFF10121A),
                        focusedBorderColor = OrangePrimary,
                        unfocusedBorderColor = Color(0x33FFFFFF),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "Pré-configurados:",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(6.dp))

                presets.forEach { (name, presetUrl) ->
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFF222636),
                        border = BorderStroke(1.dp, Color(0x22FFFFFF)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp)
                            .clickable { urlText = presetUrl }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = name, color = OrangePrimary, fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.weight(1f))
                            Text(text = "Usar", color = Color.Gray, fontSize = 11.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(urlText) },
                colors = ButtonDefaults.buttonColors(containerColor = OrangePrimary),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Conectar & Salvar", color = Color.Black, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar", color = Color.Gray)
            }
        }
    )
}
