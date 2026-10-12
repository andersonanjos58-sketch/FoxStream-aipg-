with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt') as f:
    text = f.read()

old_effect = '''    // Playback state updates when activeChannel or retryTrigger changes
    LaunchedEffect(activeChannel?.streamUrl, retryTrigger) {
        val streamUrl = activeChannel?.streamUrl
        if (!streamUrl.isNullOrBlank()) {
            isLoadingStream = true
            playerError = null
            try {
                val cleanedUrl = streamUrl.trim().replace("\\r", "").replace("\\n", "").replace(" ", "%20")
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

new_effect = '''    // Playback state updates when activeChannel or retryTrigger changes
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

if old_effect in text:
    text = text.replace(old_effect, new_effect)
    print("Replaced LaunchedEffect successfully!")
else:
    print("WARNING: old_effect not found exactly")

old_av1 = '''                AndroidView(
                    factory = { ctx ->
                        VLCVideoLayout(ctx).apply {
                            vlcMediaPlayer.attachViews(this, null, true, true)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )'''

new_av1 = '''                AndroidView(
                    factory = { ctx ->
                        VLCVideoLayout(ctx).apply {
                            try {
                                vlcMediaPlayer.detachViews()
                            } catch (_: Exception) {}
                            try {
                                vlcMediaPlayer.attachViews(this, null, true, true)
                            } catch (_: Exception) {}
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )'''

if old_av1 in text:
    text = text.replace(old_av1, new_av1)
    print("Replaced AndroidView successfully!")
else:
    print("WARNING: old_av1 not found")

with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt', 'w') as f:
    f.write(text)

print('Update script finished.')
