package com.foxstream.app.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

object PlaybackIntentHelper {

    private const val VLC_PACKAGE_NAME = "org.videolan.vlc"

    /**
     * Opens an external video stream prioritizing VLC media player.
     * If VLC is not installed, falls back to a generic Android chooser intent.
     */
    fun playStream(
        context: Context,
        streamUrl: String,
        title: String? = null
    ) {
        val uri = Uri.parse(streamUrl)
        
        // 1. Try launching VLC directly
        val vlcIntent = Intent(Intent.ACTION_VIEW).apply {
            setPackage(VLC_PACKAGE_NAME)
            setDataAndTypeAndNormalize(uri, "video/*")
            putExtra("title", title ?: "FoxStream Video")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            context.startActivity(vlcIntent)
            return
        } catch (e: ActivityNotFoundException) {
            // VLC is not installed, fallback to generic player
        } catch (e: Exception) {
            // Other intent exception
        }

        // 2. Generic video player Intent with system chooser
        val genericIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndTypeAndNormalize(uri, "video/*")
            putExtra("title", title ?: "FoxStream Video")
            putExtra(Intent.EXTRA_TITLE, title ?: "FoxStream Video")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            val chooser = Intent.createChooser(genericIntent, "Reproduzir com:").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(
                context,
                "Nenhum reprodutor de vídeo encontrado. Recomendamos instalar o VLC.",
                Toast.LENGTH_LONG
            ).show()
        }
    }
}
