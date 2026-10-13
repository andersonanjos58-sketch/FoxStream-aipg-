package com.foxstream.app.ui.screens

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.foxstream.app.MainActivity
import com.foxstream.app.data.model.ContentType
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.Media
import org.videolan.libvlc.util.VLCVideoLayout
import org.videolan.libvlc.interfaces.IVLCVout
import android.view.ViewGroup
import okhttp3.OkHttpClient
import okhttp3.ConnectionSpec
import okhttp3.TlsVersion
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(
    streamUrl: String,
    title: String,
    contentType: ContentType,
    isInPipMode: Boolean,
    initialPosition: Long = 0L,
    onProgressUpdate: (Long, Long) -> Unit = { _, _ -> },
    onMarkWatched: () -> Unit = {},
    onRemoveFromHistory: () -> Unit = {},
    hasNextEpisode: Boolean = false,
    nextEpisodeTitle: String? = null,
    onPlayNextEpisode: () -> Unit = {},
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val activity = context as? Activity

    // Intercept system Back button / gesture and close player returning to previous screen
    BackHandler {
        onClose()
    }

    // Initialize OkHttpClient with SSL/TLS config, cleartext, and HTTP/1.1 protocols
    val okHttpClient = remember {
        // Permissive TrustManager for IPTV/Xtream Codes servers
        val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })

        val sslContext = SSLContext.getInstance("TLS").apply {
            init(null, trustAllCerts, java.security.SecureRandom())
        }

        OkHttpClient.Builder()
            .protocols(listOf(okhttp3.Protocol.HTTP_1_1))
            .addInterceptor { chain ->
                val original = chain.request()
                val request = original.newBuilder()
                    .header("User-Agent", "VLC/3.0.18 LibVLC/3.0.18")
                    .header("Accept", "*/*")
                    .header("Connection", "keep-alive")
                    .build()
                chain.proceed(request)
            }
            .addNetworkInterceptor { chain ->
                val request = chain.request()
                android.util.Log.d("FoxStreamNetwork", "--> REQUISIÇÃO DE MÍDIA: ${request.method} ${request.url}")
                request.headers.names().forEach { name ->
                    android.util.Log.d("FoxStreamNetwork", "    $name: ${request.header(name)}")
                }
                
                val response = chain.proceed(request)
                android.util.Log.d("FoxStreamNetwork", "<-- RESPOSTA DE MÍDIA: ${response.code} para ${request.url}")
                response.headers.names().forEach { name ->
                    android.util.Log.d("FoxStreamNetwork", "    $name: ${response.header(name)}")
                }
                response
            }
            .sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true } // Permite qualquer hostname
            .followRedirects(true)
            .followSslRedirects(true)
            .retryOnConnectionFailure(true)
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .connectionSpecs(listOf(
                ConnectionSpec.MODERN_TLS,
                ConnectionSpec.COMPATIBLE_TLS,
                ConnectionSpec.CLEARTEXT
            ))
            .build()
    }

    // Player engine state (Default: VLC, Fallback: ExoPlayer)
    var useVlc by remember { mutableStateOf(true) }

    // Initialize LibVLC and VLC MediaPlayer
    val libVLC = remember {
        val options = ArrayList<String>().apply {
            add("--http-reconnect")
            add("--network-caching=5000") // 5 seconds cache
            add("-vvv") // Debug logs
        }
        val instance = LibVLC(context, options)
        instance.setUserAgent("FoxStream", "VLC/3.0.18 LibVLC/3.0.18")
        instance
    }

    val vlcMediaPlayer = remember(libVLC) {
        MediaPlayer(libVLC)
    }

    // Initialize ExoPlayer with OkHttp Data Source for standard/SSL redirects and lenient domain handling
    val exoPlayer = remember {
        val extractorsFactory = DefaultExtractorsFactory()
            .setConstantBitrateSeekingEnabled(true)

        val dataSourceFactory = DefaultDataSource.Factory(context, OkHttpDataSource.Factory(okHttpClient))
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory, extractorsFactory)

        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build().apply {
                playWhenReady = true
            }
    }

    // Player state trackers
    var isPlaying by remember { mutableStateOf(false) }
    var playbackState by remember { mutableStateOf(Player.STATE_IDLE) }
    var currentPosition by remember { mutableStateOf(0L) }
    var duration by remember { mutableStateOf(0L) }
    var errorDetails by remember { mutableStateOf<String?>(null) }
    var technicalErrorLog by remember { mutableStateOf<String?>(null) }
    var diagnosticLog by remember { mutableStateOf<String?>(null) }
    var initialSeekDone by remember { mutableStateOf(false) }
    var hasMarkedWatched by remember { mutableStateOf(false) }
    var watchSecondsCount by remember(streamUrl) { mutableIntStateOf(0) }
    var hasAddedToHistory by remember(streamUrl) { mutableStateOf(false) }
    var lastValidPosition by remember(streamUrl) { mutableLongStateOf(initialPosition) }
    var lastValidDuration by remember(streamUrl) { mutableLongStateOf(0L) }
    var autoPlayCancelled by remember { mutableStateOf(false) }
    var autoPlayTriggered by remember { mutableStateOf(false) }
    var nextEpisodeCountdown by remember { mutableIntStateOf(10) }

    // Volume controls (0f to 1f)
    var playerVolume by remember { mutableStateOf(1f) }
    var isMuted by remember { mutableStateOf(false) }

    // UI overlays visibility
    var showControls by remember { mutableStateOf(true) }
    var userIsSeeking by remember { mutableStateOf(false) }
    var seekPositionState by remember { mutableStateOf(0f) }

    // Video scale modes (Media3 AspectRatioFrameLayout)
    val scaleModes = remember {
        listOf(
            Triple(AspectRatioFrameLayout.RESIZE_MODE_FIT, "Ajustar", "FIT"),
            Triple(AspectRatioFrameLayout.RESIZE_MODE_FILL, "Preencher", "FILL"),
            Triple(AspectRatioFrameLayout.RESIZE_MODE_ZOOM, "Zoom", "ZOOM")
        )
    }
    var currentScaleIndex by remember { mutableStateOf(2) } // Padrão: Zoom (tela cheia). Ao tocar, alterna: Ajustar -> Preencher -> Zoom
    var scaleIndicatorText by remember { mutableStateOf<String?>(null) }

    val nextScaleMode: () -> Unit = {
        currentScaleIndex = (currentScaleIndex + 1) % scaleModes.size
        val mode = scaleModes[currentScaleIndex]
        scaleIndicatorText = mode.second
        Toast.makeText(context, mode.second, Toast.LENGTH_SHORT).show()
    }

    LaunchedEffect(scaleIndicatorText) {
        if (scaleIndicatorText != null) {
            delay(1500)
            scaleIndicatorText = null
        }
    }

    // Trigger player source preparation
    LaunchedEffect(streamUrl, useVlc) {
        try {
            errorDetails = null
            technicalErrorLog = null
            diagnosticLog = null
            initialSeekDone = false
            hasMarkedWatched = false
            watchSecondsCount = 0
            hasAddedToHistory = false
            lastValidPosition = initialPosition
            lastValidDuration = 0L
            autoPlayCancelled = false
            autoPlayTriggered = false
            nextEpisodeCountdown = 10
            val cleanedUrl = streamUrl.trim()
                .replace("\r", "")
                .replace("\n", "")
                .replace(" ", "%20")

            // Real-time Network Diagnostic
            launch(Dispatchers.IO) {
                try {
                    val request = okhttp3.Request.Builder()
                        .url(cleanedUrl)
                        .header("User-Agent", "VLC/3.0.18 LibVLC/3.0.18")
                        .header("Accept", "*/*")
                        .build()

                    val response = okHttpClient.newCall(request).execute()
                    try {
                        val code = response.code
                        val bodyObj = response.body
                        val contentType = bodyObj?.contentType()?.toString() ?: response.header("Content-Type") ?: "Desconhecido"
                        val contentLength = bodyObj?.contentLength() ?: -1L
                        val location = response.header("Location") ?: "Nenhum"
                        val isRedirect = response.isRedirect
                        val protocol = response.protocol.toString()
                        val handshake = response.handshake
                        val tlsName = handshake?.tlsVersion?.name ?: "Nenhum"

                        val redirectChain = mutableListOf<String>()
                        var prior = response.priorResponse
                        while (prior != null) {
                            redirectChain.add("${prior.code} -> ${prior.header("Location") ?: "Nenhum"}")
                            prior = prior.priorResponse
                        }

                        val logText = """
                            --- INFO DA REQUISIÇÃO ---
                            HTTP Status: $code
                            Protocolo: $protocol ($tlsName)
                            Content-Type: $contentType
                            Content-Length: $contentLength bytes
                            Redirect: $isRedirect ($location)
                            Caminho Redirect: ${if (redirectChain.isEmpty()) "Direto" else redirectChain.joinToString(" -> ")}
                        """.trimIndent()
                        diagnosticLog = logText
                        android.util.Log.d("FoxStreamPlayer", "Diag: $logText")
                    } finally {
                        response.close()
                    }
                } catch (e: Exception) {
                    val logText = "Diag Erro de Rede: ${e.localizedMessage}"
                    diagnosticLog = logText
                    android.util.Log.e("FoxStreamPlayer", logText)
                }
            }

            if (useVlc) {
                // Deactivate/stop ExoPlayer
                if (exoPlayer.isPlaying) {
                    exoPlayer.pause()
                }
                exoPlayer.stop()
                exoPlayer.clearMediaItems()

                // Setup and Play VLC with hardware decoding
                android.util.Log.d("FoxStreamPlayer", "Inicializando reprodução libVLC com aceleração de hardware para: $cleanedUrl")
                val media = Media(libVLC, Uri.parse(cleanedUrl)).apply {
                    setHWDecoderEnabled(true, false)
                    addOption(":codec=mediacodec,iomx,all")
                    addOption(":sout-keep")
                    addOption(":http-reconnect=1")
                    addOption(":network-caching=3000")
                    addOption(":live-caching=3000")
                    addOption(":file-caching=3000")
                    addOption(":clock-jitter=0")
                    addOption(":clock-synchro=0")
                    addOption(":drop-late-frames")
                    addOption(":skip-frames")
                    addOption(":http-user-agent=FoxStream/1.0 (Android; LibVLC)")
                    addOption(":http-referrer=")
                    addOption(":no-sub-autodetect-file")
                }
                try {
                    media.parseAsync(Media.Parse.ParseNetwork)
                } catch (_: Exception) {}
                vlcMediaPlayer.media = media
                media.release()
                if (vlcMediaPlayer.vlcVout.areViewsAttached()) {
                    vlcMediaPlayer.play()
                }
                isPlaying = true
                playbackState = Player.STATE_BUFFERING
            } else {
                // Deactivate/stop VLC
                if (vlcMediaPlayer.isPlaying) {
                    vlcMediaPlayer.pause()
                }
                vlcMediaPlayer.stop()

                // Setup and Play ExoPlayer
                android.util.Log.d("FoxStreamPlayer", "Inicializando reprodução ExoPlayer (Fallback) para: $cleanedUrl")
                val uri = Uri.parse(cleanedUrl)
                val mediaItem = MediaItem.fromUri(uri)
                exoPlayer.setMediaItem(mediaItem)
                exoPlayer.prepare()
                exoPlayer.playWhenReady = true
            }
        } catch (e: Exception) {
            val maskedUrl = maskCredentials(streamUrl.trim())
            errorDetails = "Não foi possível carregar o fluxo de transmissão."
            technicalErrorLog = "Erro: ${e.localizedMessage}\nURL: $maskedUrl\nTipo: $contentType"
        }
    }

    // Append Diagnostic Info dynamically when available
    LaunchedEffect(diagnosticLog) {
        val diag = diagnosticLog
        val techLog = technicalErrorLog
        if (diag != null && techLog != null && !techLog.contains("INFO DA REQUISIÇÃO")) {
            technicalErrorLog = "$techLog\n\n$diag"
        }
    }

    // Set volume helper
    LaunchedEffect(playerVolume, isMuted, useVlc) {
        if (useVlc) {
            vlcMediaPlayer.volume = if (isMuted) 0 else (playerVolume * 100).toInt()
        } else {
            exoPlayer.volume = if (isMuted) 0f else playerVolume
        }
    }

    // Immersive Fullscreen Mode and Keep Screen On
    DisposableEffect(activity) {
        val window = activity?.window
        if (window != null) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            val insetsController = WindowCompat.getInsetsController(window, window.decorView)
            insetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insetsController.hide(WindowInsetsCompat.Type.systemBars())
        }
        onDispose {
            if (window != null) {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                val insetsController = WindowCompat.getInsetsController(window, window.decorView)
                insetsController.show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    // Attach VLC listeners and manage its lifecycle
    DisposableEffect(vlcMediaPlayer) {
        val listener = MediaPlayer.EventListener { event ->
            when (event.type) {
                MediaPlayer.Event.Playing -> {
                    if (useVlc) {
                        isPlaying = true
                        playbackState = Player.STATE_READY
                        // 1. Retomar Vídeo de Onde Parou (Seek Inicial Seguro no VLC)
                        if (!initialSeekDone && initialPosition > 0L) {
                            vlcMediaPlayer.time = initialPosition
                            currentPosition = initialPosition
                            initialSeekDone = true
                            android.util.Log.d("FoxStreamPlayer", "VLC: Seek inicial aplicado em MediaPlayer.Event.Playing ($initialPosition ms)")
                        }
                    }
                }
                MediaPlayer.Event.Paused -> {
                    if (useVlc) {
                        isPlaying = false
                    }
                }
                MediaPlayer.Event.Stopped -> {
                    if (useVlc) {
                        isPlaying = false
                        playbackState = Player.STATE_IDLE
                    }
                }
                MediaPlayer.Event.EndReached -> {
                    if (useVlc) {
                        isPlaying = false
                        playbackState = Player.STATE_ENDED
                        // 2. Limpeza do "Continuar Assistindo" marcando como assistido no histórico ao terminar
                        if (contentType != ContentType.LIVE && !hasMarkedWatched) {
                            hasMarkedWatched = true
                            onMarkWatched()
                        }
                        // 3. Auto-play próximo episódio (Séries) ou fechar player (Filme ou último episódio)
                        if (contentType == ContentType.SERIES) {
                            if (hasNextEpisode && !autoPlayCancelled && !autoPlayTriggered) {
                                autoPlayTriggered = true
                                onPlayNextEpisode()
                            } else if (!hasNextEpisode) {
                                onClose()
                            }
                        } else if (contentType == ContentType.MOVIE) {
                            onClose()
                        }
                    }
                }
                MediaPlayer.Event.Buffering -> {
                    if (useVlc) {
                        if (event.buffering < 100f) {
                            playbackState = Player.STATE_BUFFERING
                        } else {
                            playbackState = Player.STATE_READY
                        }
                    }
                }
                MediaPlayer.Event.TimeChanged -> {
                    if (useVlc && !userIsSeeking) {
                        currentPosition = vlcMediaPlayer.time
                        // Seek inicial seguro de contingência caso Length tenha ficado disponível
                        if (!initialSeekDone && initialPosition > 0L && vlcMediaPlayer.length > 0L) {
                            vlcMediaPlayer.time = initialPosition
                            currentPosition = initialPosition
                            initialSeekDone = true
                            android.util.Log.d("FoxStreamPlayer", "VLC: Seek inicial aplicado em TimeChanged ($initialPosition ms)")
                        }
                    }
                }
                MediaPlayer.Event.LengthChanged -> {
                    if (useVlc) {
                        duration = vlcMediaPlayer.length
                        // 1. Retomar Vídeo de Onde Parou (Seek Inicial Seguro com primeira leitura de length > 0)
                        if (!initialSeekDone && initialPosition > 0L && vlcMediaPlayer.length > 0L) {
                            vlcMediaPlayer.time = initialPosition
                            currentPosition = initialPosition
                            initialSeekDone = true
                            android.util.Log.d("FoxStreamPlayer", "VLC: Seek inicial aplicado em LengthChanged ($initialPosition ms)")
                        }
                    }
                }
                MediaPlayer.Event.EncounteredError -> {
                    if (useVlc) {
                        isPlaying = false
                        errorDetails = "Erro de reprodução no player VLC."
                        technicalErrorLog = "O LibVLC encontrou uma falha de conexão ou incompatibilidade no stream."
                    }
                }
            }
        }
        vlcMediaPlayer.setEventListener(listener)

        onDispose {
            vlcMediaPlayer.setEventListener(null)
            vlcMediaPlayer.stop()
            vlcMediaPlayer.detachViews()
            vlcMediaPlayer.release()
            libVLC.release()
        }
    }

    // Attach Android Lifecycle Observer to VLC
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner, vlcMediaPlayer) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            when (event) {
                androidx.lifecycle.Lifecycle.Event.ON_PAUSE -> {
                    if (useVlc && vlcMediaPlayer.isPlaying) {
                        vlcMediaPlayer.pause()
                    }
                }
                androidx.lifecycle.Lifecycle.Event.ON_STOP -> {
                    if (useVlc && vlcMediaPlayer.isPlaying) {
                        vlcMediaPlayer.stop()
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

    // Attach ExoPlayer listeners
    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlayingChanged: Boolean) {
                if (!useVlc) {
                    isPlaying = isPlayingChanged
                }
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (!useVlc) {
                    playbackState = state
                    if (state == Player.STATE_READY) {
                        duration = exoPlayer.duration.coerceAtLeast(0L)
                        if (!initialSeekDone && initialPosition > 0L) {
                            exoPlayer.seekTo(initialPosition)
                            initialSeekDone = true
                        }
                    } else if (state == Player.STATE_ENDED) {
                        if (contentType != ContentType.LIVE && !hasMarkedWatched) {
                            hasMarkedWatched = true
                            onMarkWatched()
                        }
                        if (contentType == ContentType.SERIES) {
                            if (hasNextEpisode && !autoPlayCancelled && !autoPlayTriggered) {
                                autoPlayTriggered = true
                                onPlayNextEpisode()
                            } else if (!hasNextEpisode) {
                                onClose()
                            }
                        } else if (contentType == ContentType.MOVIE) {
                            onClose()
                        }
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                if (!useVlc) {
                    val maskedUrl = maskCredentials(streamUrl.trim())
                    val causeMsg = error.cause?.localizedMessage ?: error.localizedMessage ?: "Desconhecida"
                    val isToAsciiError = causeMsg.contains("toASCII", ignoreCase = true)
                    errorDetails = if (isToAsciiError) {
                        if (causeMsg.contains("null-null", ignoreCase = true)) {
                            "Canal indisponível no servidor: o provedor retornou um redirecionamento inválido ('null-null.shop'). O canal pode estar fora do ar na lista ou bloqueado."
                        } else {
                            "Erro de conexão: o endereço retornado pelo servidor contém caracteres incompatíveis com a resolução de rede."
                        }
                    } else {
                        "Erro de reprodução: Conexão interrompida ou formato incompatível."
                    }
                    val diagInfo = diagnosticLog ?: "Diagnóstico pendente ou indisponível"
                    technicalErrorLog = String.format(
                        Locale.US,
                        "Código: %s (%d)\nCausa: %s\nURL: %s\nTipo: %s\n\n%s",
                        error.errorCodeName,
                        error.errorCode,
                        causeMsg,
                        maskedUrl,
                        contentType.name,
                        diagInfo
                    )
                }
            }
        }
        exoPlayer.addListener(listener)

        // Set player state in Activity companion
        MainActivity.isPlayerActive = true

        onDispose {
            if (contentType != ContentType.LIVE) {
                val pos = lastValidPosition
                val dur = lastValidDuration
                val isCredits = (dur > 0L) && ((pos >= dur * 0.95f) || (dur > 180_000L && (dur - pos) <= 180_000L))
                if (hasMarkedWatched || isCredits) {
                    onMarkWatched()
                } else if (hasAddedToHistory || watchSecondsCount >= 3 || pos >= 3000L) {
                    onProgressUpdate(pos, dur)
                }
            }
            exoPlayer.removeListener(listener)
            exoPlayer.release()
            MainActivity.isPlayerActive = false
        }
    }

    // Background timer to update currentPosition progress bar, check credits and auto-play
    if (contentType != ContentType.LIVE) {
        LaunchedEffect(isPlaying, useVlc, streamUrl) {
            while (isActive && isPlaying) {
                if (!userIsSeeking) {
                    val rawPos = if (useVlc) vlcMediaPlayer.time else exoPlayer.currentPosition.coerceAtLeast(0L)
                    val rawDur = if (useVlc) vlcMediaPlayer.length else exoPlayer.duration.coerceAtLeast(0L)

                    val pos = if (rawPos > 0L) rawPos else lastValidPosition
                    val dur = if (rawDur > 0L) rawDur else lastValidDuration

                    currentPosition = pos
                    lastValidPosition = pos
                    if (dur > 0L) {
                        duration = dur
                        lastValidDuration = dur
                    }

                    // 1. Verificação adicional de Seek inicial seguro para VLC caso length já esteja disponível
                    if (useVlc && !initialSeekDone && initialPosition > 0L && dur > 0L) {
                        vlcMediaPlayer.time = initialPosition
                        currentPosition = initialPosition
                        lastValidPosition = initialPosition
                        initialSeekDone = true
                    }

                    watchSecondsCount += 1

                    // 2. Limpeza Automática do "Continuar Assistindo" marcando como assistido no histórico (Créditos / 95% da duração)
                    val isCreditsReached = (dur > 0L) && (
                        (pos >= dur * 0.95f) || (dur > 180_000L && (dur - pos) <= 180_000L)
                    )

                    if (isCreditsReached) {
                        if (!hasMarkedWatched) {
                            hasMarkedWatched = true
                            onMarkWatched()
                        }
                    } else if (!hasMarkedWatched) {
                        // REQUISITO: Ao assistir por no mínimo 3 segundos a mídia será adicionada ao continue assistindo
                        if (watchSecondsCount >= 3 || pos >= 3000L) {
                            hasAddedToHistory = true
                            onProgressUpdate(pos, dur)
                        }
                    }
                }
                delay(1000)
            }
        }
    }

    // 3. Auto-Play próximo episódio (Apenas para Séries): menos de 2 minutos para o fim ou créditos atingidos
    val isNearEndForNextEpisode = (contentType == ContentType.SERIES && hasNextEpisode && duration > 0L) && (
        (duration > 120_000L && (duration - currentPosition) <= 120_000L) ||
        (currentPosition >= duration * 0.95f) ||
        playbackState == Player.STATE_ENDED
    )

    val showNextEpisodeOverlay = isNearEndForNextEpisode && !autoPlayCancelled && !isInPipMode

    LaunchedEffect(showNextEpisodeOverlay, autoPlayCancelled, streamUrl) {
        if (showNextEpisodeOverlay && !autoPlayCancelled && !autoPlayTriggered) {
            nextEpisodeCountdown = 10
            while (nextEpisodeCountdown > 0 && !autoPlayCancelled && !autoPlayTriggered) {
                delay(1000)
                nextEpisodeCountdown -= 1
            }
            if (!autoPlayCancelled && !autoPlayTriggered) {
                autoPlayTriggered = true
                onPlayNextEpisode()
            }
        }
    }

    // Automatic fade out controls timer
    LaunchedEffect(showControls, isPlaying) {
        if (showControls && isPlaying) {
            delay(5000)
            showControls = false
        }
    }

        // Main Video Player view (VLC with fallback to ExoPlayer)
        if (useVlc) {
            AndroidView(
                factory = { ctx ->
                    VLCVideoLayout(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        addOnLayoutChangeListener { _, l, t, r, b, ol, ot, or, ob ->
                            val w = r - l
                            val h = b - t
                            if (w > 0 && h > 0 && (w != (or - ol) || h != (ob - ot))) {
                                try {
                                    vlcMediaPlayer.vlcVout.setWindowSize(w, h)
                                } catch (_: Exception) {}
                            }
                        }
                        val vout = vlcMediaPlayer.vlcVout
                        vout.addCallback(object : IVLCVout.Callback {
                            override fun onSurfacesCreated(v: IVLCVout?) {
                                if (vlcMediaPlayer.media != null && !vlcMediaPlayer.isPlaying) {
                                    vlcMediaPlayer.play()
                                }
                            }
                            override fun onSurfacesDestroyed(v: IVLCVout?) {}
                        })
                        try {
                            if (!vout.areViewsAttached()) {
                                vlcMediaPlayer.attachViews(this, null, true, true)
                            }
                        } catch (_: Exception) {}
                        // Initial scale mode application
                        when (currentScaleIndex) {
                            0 -> { // Fit
                                vlcMediaPlayer.aspectRatio = null
                                vlcMediaPlayer.scale = 0f
                            }
                            1 -> { // Fill
                                vlcMediaPlayer.aspectRatio = "16:9"
                            }
                            2 -> { // Zoom
                                vlcMediaPlayer.aspectRatio = null
                                vlcMediaPlayer.scale = 1.3f
                            }
                        }
                        try {
                            if (vlcMediaPlayer.media != null && !vlcMediaPlayer.isPlaying) {
                                vlcMediaPlayer.play()
                            }
                        } catch (_: Exception) {}
                    }
                },
                update = { _ ->
                    // Apply updated scale mode
                    when (currentScaleIndex) {
                        0 -> {
                            vlcMediaPlayer.aspectRatio = null
                            vlcMediaPlayer.scale = 0f
                        }
                        1 -> {
                            vlcMediaPlayer.aspectRatio = "16:9"
                        }
                        2 -> {
                            vlcMediaPlayer.aspectRatio = null
                            vlcMediaPlayer.scale = 1.3f
                        }
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        useController = false
                        player = exoPlayer
                        keepScreenOn = true
                        setBackgroundColor(android.graphics.Color.BLACK)
                        resizeMode = scaleModes[currentScaleIndex].first
                    }
                },
                update = { playerView ->
                    playerView.resizeMode = scaleModes[currentScaleIndex].first
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Click catcher overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) {
                    if (!isInPipMode) {
                        showControls = !showControls
                    }
                }
        )

        // Floating Video Scale Indicator overlay
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            AnimatedVisibility(
                visible = scaleIndicatorText != null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
            Surface(
                color = Color.Black.copy(alpha = 0.8f),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.25f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.AspectRatio,
                        contentDescription = null,
                        tint = Color(0xFFFF9800),
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = scaleIndicatorText ?: "",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
        }

        // Picture in Picture mode overrides controls completely
        if (!isInPipMode) {
            // Buffering Loading Spinner
            if (playbackState == Player.STATE_BUFFERING && errorDetails == null) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(54.dp)
                    )
                }
            }

            // Error Overlay screen
            errorDetails?.let { errMsg ->
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.85f))
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxHeight()
                    ) {
                        Icon(
                            imageVector = Icons.Default.ErrorOutline,
                            contentDescription = "Erro de reprodução",
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = errMsg,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                            textAlign = TextAlign.Center,
                            fontWeight = FontWeight.Bold
                        )
                        technicalErrorLog?.let { techLog ->
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = Color.DarkGray.copy(alpha = 0.5f),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = techLog,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.LightGray,
                                    modifier = Modifier.padding(12.dp),
                                    fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = {
                                    errorDetails = null
                                    technicalErrorLog = null
                                    if (useVlc) {
                                        vlcMediaPlayer.play()
                                    } else {
                                        exoPlayer.prepare()
                                        exoPlayer.play()
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Icon(Icons.Default.Replay, contentDescription = "Tentar Novamente", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Tentar Novamente")
                            }

                            Button(
                                onClick = { openInVlc(context, streamUrl) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF9800))
                            ) {
                                Icon(Icons.Default.OpenInNew, contentDescription = "VLC", tint = Color.Black, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Abrir no VLC", color = Color.Black, fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = onClose,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White)
                            ) {
                                Text("Voltar")
                            }
                        }
                    }
                }
            }

            // Controls Overlay
            AnimatedVisibility(
                visible = showControls && errorDetails == null,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.6f))
                ) {
                    // Header Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.TopCenter)
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        IconButton(onClick = onClose) {
                            Icon(
                                imageVector = Icons.Default.ArrowBack,
                                contentDescription = "Voltar",
                                tint = Color.White,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                            if (contentType == ContentType.LIVE) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(Color.Red, shape = RoundedCornerShape(4.dp))
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "AO VIVO",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color.Red,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            } else {
                                Text(
                                    text = if (contentType == ContentType.MOVIE) "Filme" else "Série",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.Gray
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            // Player selector chip (VLC default, EXO fallback)
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = if (useVlc) Color(0xFFFF9800) else Color.DarkGray,
                                modifier = Modifier
                                    .padding(end = 4.dp)
                                    .clickable {
                                        useVlc = !useVlc
                                        Toast.makeText(context, "Player ativo: ${if (useVlc) "VLC Player" else "ExoPlayer (Fallback)"}", Toast.LENGTH_SHORT).show()
                                    }
                            ) {
                                Text(
                                    text = if (useVlc) "VLC" else "EXO",
                                    color = if (useVlc) Color.Black else Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }

                            // Escala de Vídeo Button
                            IconButton(onClick = nextScaleMode) {
                                Icon(
                                    imageVector = Icons.Default.AspectRatio,
                                    contentDescription = "Escala de vídeo (${scaleModes[currentScaleIndex].second})",
                                    tint = Color.White
                                )
                            }

                            // VLC Button
                            IconButton(onClick = { openInVlc(context, streamUrl) }) {
                                Icon(
                                    imageVector = Icons.Default.OpenInNew,
                                    contentDescription = "Abrir no VLC",
                                    tint = Color.Yellow
                                )
                            }

                            // Picture in Picture Button
                            IconButton(onClick = {
                                try {
                                    val params = android.app.PictureInPictureParams.Builder().build()
                                    activity?.enterPictureInPictureMode(params)
                                } catch (e: Exception) {
                                    Toast.makeText(context, "PiP não suportado neste dispositivo", Toast.LENGTH_SHORT).show()
                                }
                            }) {
                                Icon(
                                    imageVector = Icons.Default.PictureInPicture,
                                    contentDescription = "Picture-in-Picture",
                                    tint = Color.White
                                )
                            }
                        }
                    }

                    // Center playback control (Play/Pause)
                    Row(
                        modifier = Modifier.align(Alignment.Center),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(32.dp)
                    ) {
                        if (contentType != ContentType.LIVE) {
                            IconButton(
                                onClick = {
                                    if (useVlc) {
                                        vlcMediaPlayer.time = (vlcMediaPlayer.time - 10000).coerceAtLeast(0)
                                    } else {
                                        exoPlayer.seekTo((exoPlayer.currentPosition - 10000).coerceAtLeast(0))
                                    }
                                },
                                modifier = Modifier.size(56.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Replay10,
                                    contentDescription = "Voltar 10s",
                                    tint = Color.White,
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }

                        IconButton(
                            onClick = {
                                if (useVlc) {
                                    if (vlcMediaPlayer.isPlaying) {
                                        vlcMediaPlayer.pause()
                                        isPlaying = false
                                    } else {
                                        vlcMediaPlayer.play()
                                        isPlaying = true
                                    }
                                } else {
                                    if (isPlaying) exoPlayer.pause() else exoPlayer.play()
                                }
                            },
                            modifier = Modifier
                                .size(72.dp)
                                .background(Color.White.copy(alpha = 0.2f), shape = RoundedCornerShape(36.dp))
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "Pausar" else "Reproduzir",
                                tint = Color.White,
                                modifier = Modifier.size(48.dp)
                            )
                        }

                        if (contentType != ContentType.LIVE) {
                            IconButton(
                                onClick = {
                                    if (useVlc) {
                                        vlcMediaPlayer.time = (vlcMediaPlayer.time + 10000).coerceAtMost(duration)
                                    } else {
                                        exoPlayer.seekTo((exoPlayer.currentPosition + 10000).coerceAtMost(duration))
                                    }
                                },
                                modifier = Modifier.size(56.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Forward10,
                                    contentDescription = "Avançar 10s",
                                    tint = Color.White,
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }

                        if (contentType == ContentType.SERIES && hasNextEpisode) {
                            IconButton(
                                onClick = {
                                    if (!autoPlayTriggered) {
                                        autoPlayTriggered = true
                                        onPlayNextEpisode()
                                    }
                                },
                                modifier = Modifier.size(56.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.SkipNext,
                                    contentDescription = "Próximo Episódio",
                                    tint = Color.White,
                                    modifier = Modifier.size(36.dp)
                                )
                            }
                        }
                    }

                    // Footer Bar: Progress seekbar (VOD only) and Volume Bar
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .align(Alignment.BottomCenter)
                            .padding(24.dp)
                    ) {
                        // VOD Progress seekbar
                        if (contentType != ContentType.LIVE && duration > 0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = formatTime(if (userIsSeeking) (seekPositionState * duration).toLong() else currentPosition),
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodySmall
                                )

                                val progressValue = if (userIsSeeking) seekPositionState else (currentPosition.toFloat() / duration)
                                Slider(
                                    value = progressValue.coerceIn(0f, 1f),
                                    onValueChange = {
                                        userIsSeeking = true
                                        seekPositionState = it
                                    },
                                    onValueChangeFinished = {
                                        if (useVlc) {
                                            vlcMediaPlayer.time = (seekPositionState * duration).toLong()
                                            currentPosition = (seekPositionState * duration).toLong()
                                        } else {
                                            exoPlayer.seekTo((seekPositionState * duration).toLong())
                                            currentPosition = (seekPositionState * duration).toLong()
                                        }
                                        userIsSeeking = false
                                    },
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(horizontal = 12.dp),
                                    colors = SliderDefaults.colors(
                                        activeTrackColor = MaterialTheme.colorScheme.primary,
                                        inactiveTrackColor = Color.DarkGray,
                                        thumbColor = MaterialTheme.colorScheme.primary
                                    )
                                )

                                Text(
                                    text = formatTime(duration),
                                    color = Color.White,
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                        }

                        // Bottom Actions: Volume Bar
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // Left Volume panel
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.width(180.dp)
                            ) {
                                IconButton(onClick = { isMuted = !isMuted }) {
                                    Icon(
                                        imageVector = if (isMuted || playerVolume == 0f) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                                        contentDescription = "Mudo/Som",
                                        tint = Color.White
                                    )
                                }
                                Slider(
                                    value = if (isMuted) 0f else playerVolume,
                                    onValueChange = {
                                        playerVolume = it
                                        isMuted = false
                                    },
                                    valueRange = 0f..1f,
                                    colors = SliderDefaults.colors(
                                        activeTrackColor = Color.White,
                                        inactiveTrackColor = Color.DarkGray,
                                        thumbColor = Color.White
                                    ),
                                    modifier = Modifier.weight(1f)
                                )
                            }

                            // Right Action controls: Scale Mode Chip and Open in VLC
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .clickable(onClick = nextScaleMode)
                                        .background(Color.White.copy(alpha = 0.15f), shape = RoundedCornerShape(16.dp))
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.AspectRatio,
                                        contentDescription = "Escala de vídeo",
                                        tint = Color.White,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = scaleModes[currentScaleIndex].second,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color.White,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                // Quick button: open in VLC hint text
                                Text(
                                    text = "Abrir no VLC",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color.Yellow,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier
                                        .clickable { openInVlc(context, streamUrl) }
                                        .padding(8.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        // 3. Auto-Play e Botão de Próximo Episódio (Overlay flutuante com contagem regressiva para séries)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(end = 24.dp, bottom = if (showControls) 120.dp else 36.dp),
            contentAlignment = Alignment.BottomEnd
        ) {
            AnimatedVisibility(
                visible = showNextEpisodeOverlay,
                enter = fadeIn() + slideInVertically { it / 2 },
                exit = fadeOut() + slideOutVertically { it / 2 }
            ) {
                Surface(
                    color = Color(0xFF141722).copy(alpha = 0.95f),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.2.dp, Color(0xFFFF9800).copy(alpha = 0.85f)),
                    shadowElevation = 10.dp,
                    modifier = Modifier.widthIn(min = 260.dp, max = 340.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.SkipNext,
                                contentDescription = null,
                                tint = Color(0xFFFF9800),
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Próximo Episódio",
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        IconButton(
                            onClick = { autoPlayCancelled = true },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Cancelar auto-play",
                                tint = Color.Gray,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    if (!nextEpisodeTitle.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = nextEpisodeTitle,
                            color = Color(0xFFCCCCCC),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Button(
                        onClick = {
                            if (!autoPlayTriggered) {
                                autoPlayTriggered = true
                                onPlayNextEpisode()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF9800)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = null,
                            tint = Color.Black,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = if (nextEpisodeCountdown > 0) "Reproduzir ($nextEpisodeCountdown s)" else "Reproduzir Agora",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
            }
        }
    }
}

// Security: Masks credentials in streamUrl for visual display
private fun maskCredentials(url: String): String {
    val regex = Regex("(/(live|movie|series)/)([^/]+)/([^/]+)/")
    return url.replace(regex, "$1***/***/")
}

private fun formatTime(millis: Long): String {
    val totalSecs = millis / 1000
    val hours = totalSecs / 3600
    val minutes = (totalSecs % 3600) / 60
    val seconds = totalSecs % 60
    return if (hours > 0) {
        String.format(Locale.US, "%02d:%02d:%02d", hours, minutes, seconds)
    } else {
        String.format(Locale.US, "%02d:%02d", minutes, seconds)
    }
}

private fun openInVlc(context: Context, streamUrl: String) {
    try {
        val uri = Uri.parse(streamUrl)
        val vlcIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndTypeAndNormalize(uri, "video/*")
            setPackage("org.videolan.vlc")
            putExtra("title", "FoxStream Player")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(vlcIntent)
    } catch (e: Exception) {
        try {
            val uri = Uri.parse(streamUrl)
            val genericIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndTypeAndNormalize(uri, "video/*")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val chooser = Intent.createChooser(genericIntent, "Abrir com...")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
        } catch (ex: Exception) {
            Toast.makeText(context, "Erro ao abrir player externo: ${ex.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }
}
