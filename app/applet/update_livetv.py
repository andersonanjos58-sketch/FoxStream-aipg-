with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt') as f:
    text = f.read()

# Add imports if missing
imports_to_add = '''import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.extractors.DefaultExtractorsFactory
import okhttp3.OkHttpClient'''

if 'import androidx.media3.datasource.DefaultDataSource' not in text:
    text = text.replace('import androidx.media3.exoplayer.ExoPlayer', imports_to_add + '\nimport androidx.media3.exoplayer.ExoPlayer')

# Now let's find the VLC setup block in LiveTvScreen and replace it with ExoPlayer setup
old_vlc_setup = '''    // Dedicated single LibVLC instance for embedded Live TV player
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

    // Playback state updates when activeChannel or retryTrigger changes
    LaunchedEffect(activeChannel?.streamUrl, retryTrigger) {
        val streamUrl = activeChannel?.streamUrl
        if (!streamUrl.isNullOrBlank()) {
            isLoadingStream = true
            playerError = null
            try {
                val cleanedUrl = streamUrl.trim().replace("\\r", "").replace("\\n", "").replace(" ", "%20")
                try {
                    vlcMediaPlayer.stop()
                } catch (_: Exception) {}
                try {
                    vlcMediaPlayer.detachViews()
                } catch (_: Exception) {}

                val media = Media(libVLC, Uri.parse(cleanedUrl)).apply {
                    addOption(":http-user-agent=VLC/3.0.18 LibVLC/3.0.18")
                    addOption(":http-referrer=")
                    addOption(":http-reconnect=1")
                    addOption(":network-caching=5000")
                }
                vlcMediaPlayer.media = media
                media.release()
                if (!isPaused) {
                    vlcMediaPlayer.play()
                    isPlaying = true
                }
                isLoadingStream = false
            } catch (e: Exception) {
                isLoadingStream = false
                playerError = "Falha ao conectar com o canal ao vivo."
            }
        } else {
            isLoadingStream = false
            isPlaying = false
        }
    }'''

new_exoplayer_setup = '''    // Video scale modes (Media3 AspectRatioFrameLayout)
    val scaleModes = remember {
        listOf(
            Triple(AspectRatioFrameLayout.RESIZE_MODE_FIT, "Ajustar", "FIT"),
            Triple(AspectRatioFrameLayout.RESIZE_MODE_FILL, "Preencher", "FILL"),
            Triple(AspectRatioFrameLayout.RESIZE_MODE_ZOOM, "Zoom", "ZOOM")
        )
    }
    var currentScaleIndex by remember { mutableStateOf(2) } // Padrão: Zoom (100% preenchimento)

    val okHttpClient = remember {
        OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    val exoPlayer = remember {
        val dataSourceFactory = DefaultDataSource.Factory(context, OkHttpDataSource.Factory(okHttpClient))
        val extractorsFactory = DefaultExtractorsFactory().setConstantBitrateSeekingEnabled(true)
        val mediaSourceFactory = DefaultMediaSourceFactory(dataSourceFactory, extractorsFactory)

        ExoPlayer.Builder(context)
            .setMediaSourceFactory(mediaSourceFactory)
            .build().apply {
                playWhenReady = true
            }
    }

    DisposableEffect(exoPlayer) {
        onDispose {
            exoPlayer.stop()
            exoPlayer.clearMediaItems()
            exoPlayer.release()
        }
    }

    DisposableEffect(lifecycleOwner, exoPlayer) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> exoPlayer.pause()
                Lifecycle.Event.ON_RESUME -> {
                    if (!isPaused && activeChannel != null) exoPlayer.play()
                }
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    DisposableEffect(exoPlayer) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_BUFFERING -> isLoadingStream = true
                    Player.STATE_READY -> {
                        isLoadingStream = false
                        playerError = null
                        isPlaying = exoPlayer.isPlaying
                    }
                    Player.STATE_ENDED -> isPlaying = false
                    Player.STATE_IDLE -> isLoadingStream = false
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                isLoadingStream = false
                playerError = "Erro de reprodução: Sinal indisponível ou formato incompatível."
            }
        }
        exoPlayer.addListener(listener)
        onDispose {
            exoPlayer.removeListener(listener)
        }
    }

    // Playback state updates when activeChannel or retryTrigger changes
    LaunchedEffect(activeChannel?.streamUrl, retryTrigger) {
        val streamUrl = activeChannel?.streamUrl
        if (!streamUrl.isNullOrBlank()) {
            isLoadingStream = true
            playerError = null
            try {
                val cleanedUrl = streamUrl.trim().replace("\\r", "").replace("\\n", "").replace(" ", "%20")
                exoPlayer.stop()
                exoPlayer.clearMediaItems()
                val mediaItem = MediaItem.fromUri(Uri.parse(cleanedUrl))
                exoPlayer.setMediaItem(mediaItem)
                exoPlayer.prepare()
                exoPlayer.playWhenReady = true
                isLoadingStream = false
            } catch (e: Exception) {
                isLoadingStream = false
                playerError = "Falha ao conectar com o canal ao vivo."
            }
        } else {
            exoPlayer.stop()
            isLoadingStream = false
            isPlaying = false
        }
    }'''

if old_vlc_setup in text:
    text = text.replace(old_vlc_setup, new_exoplayer_setup)
    print("Replaced LiveTvScreen player setup with ExoPlayer successfully!")
else:
    print("WARNING: old_vlc_setup not found exactly")

with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt', 'w') as f:
    f.write(text)

print('Update script executed.')
