package com.foxstream.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import coil.Coil
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.foxstream.app.ui.FoxStreamApp
import com.foxstream.app.ui.theme.FoxStreamTheme

class MainActivity : ComponentActivity() {
    private val isInPipModeState = mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize high-performance Coil image loader with memory/disk caching
        try {
            val imageLoader = ImageLoader.Builder(this)
                .memoryCache {
                    MemoryCache.Builder(this)
                        .maxSizePercent(0.25)
                        .build()
                }
                .diskCache {
                    DiskCache.Builder()
                        .directory(cacheDir.resolve("foxstream_image_cache"))
                        .maxSizeBytes(150L * 1024 * 1024) // 150 MB disk cache
                        .build()
                }
                .crossfade(true)
                .respectCacheHeaders(false)
                .build()
            Coil.setImageLoader(imageLoader)
        } catch (_: Exception) {}

        setContent {
            FoxStreamTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FoxStreamApp(isInPipMode = isInPipModeState.value)
                }
            }
        }
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: android.content.res.Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        isInPipModeState.value = isInPictureInPictureMode
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isPlayerActive) {
            try {
                val params = android.app.PictureInPictureParams.Builder().build()
                enterPictureInPictureMode(params)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    companion object {
        var isPlayerActive = false
    }
}
