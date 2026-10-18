package com.foxstream.app.util

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.BufferedReader
import java.io.InputStreamReader

data class StreamSource(
    val id: String,
    val tmdbId: String? = null,
    val title: String,
    val year: Int? = null,
    val type: String = "movie",
    val streamUrl: String,
    val quality: String? = null,
    val format: String? = null
)

sealed class StreamResolutionState {
    object Idle : StreamResolutionState()
    object Loading : StreamResolutionState()
    data class Available(val stream: StreamSource, val matchType: String) : StreamResolutionState()
    object Unavailable : StreamResolutionState()
}

object StreamResolver {
    private const val TAG = "StreamResolver"
    private var cachedStreams: List<StreamSource>? = null

    /**
     * Lazily loads streams.json from app assets with in-memory caching
     */
    suspend fun loadStreams(context: Context, forceRefresh: Boolean = false): List<StreamSource> = withContext(Dispatchers.IO) {
        if (cachedStreams != null && !forceRefresh) {
            return@withContext cachedStreams!!
        }

        try {
            val inputStream = context.assets.open("streams.json")
            val reader = BufferedReader(InputStreamReader(inputStream))
            val jsonString = reader.use { it.readText() }
            val jsonArray = JSONArray(jsonString)

            val list = mutableListOf<StreamSource>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", "stream_$i")
                val tmdbId = if (obj.has("tmdb_id")) obj.optString("tmdb_id") else null
                val title = obj.optString("title", "")
                val year = if (obj.has("year")) obj.optInt("year") else null
                val type = obj.optString("type", "movie")
                val streamUrl = obj.optString("streamUrl", "")
                val quality = obj.optString("quality", "1080p")
                val format = obj.optString("format", "mp4")

                if (streamUrl.isNotBlank()) {
                    list.add(
                        StreamSource(
                            id = id,
                            tmdbId = tmdbId,
                            title = title,
                            year = year,
                            type = type,
                            streamUrl = streamUrl,
                            quality = quality,
                            format = format
                        )
                    )
                }
            }

            cachedStreams = list
            Log.d(TAG, "Loaded ${list.size} stream sources from assets/streams.json")
            list
        } catch (e: Exception) {
            Log.w(TAG, "Could not load streams.json from assets: ${e.message}")
            emptyList()
        }
    }

    /**
     * Priority Dual-Matching Resolution for Android Native:
     * 1. Primary Match (TMDB ID): Exact match against tmdb_id.
     * 2. Fallback Match (Normalized Title & Year): Fuzzy smart match using SmartMatch algorithm.
     */
    suspend fun resolveStream(
        context: Context,
        tmdbId: String? = null,
        title: String? = null,
        year: String? = null,
        type: String? = null
    ): StreamResolutionState = withContext(Dispatchers.Default) {
        val streams = loadStreams(context)

        // 1. PRIMARY MATCH: Exact TMDB ID
        if (!tmdbId.isNullOrBlank()) {
            val cleanTmdbId = tmdbId.trim()
            val match = streams.find { it.tmdbId?.trim() == cleanTmdbId }
            if (match != null) {
                Log.d(TAG, "Match Found (Primary TMDB ID: $cleanTmdbId): ${match.title}")
                return@withContext StreamResolutionState.Available(match, "tmdb_id")
            }
        }

        // 2. FALLBACK MATCH: Normalized Title & Year
        if (!title.isNullOrBlank()) {
            val (cleanTargetTitle, _) = SmartMatch.cleanTitle(title)
            val targetYearInt = year?.toIntOrNull()

            var bestStream: StreamSource? = null
            var highestScore = 0

            for (s in streams) {
                if (type != null && s.type.isNotBlank() && s.type != type && s.type != "live") {
                    continue
                }

                val (cleanSourceTitle, _) = SmartMatch.cleanTitle(s.title)

                // Exact normalized match
                if (cleanTargetTitle.equals(cleanSourceTitle, ignoreCase = true)) {
                    val yearDiff = if (targetYearInt != null && s.year != null) {
                        kotlin.math.abs(targetYearInt - s.year)
                    } else 0

                    if (yearDiff <= 1) {
                        return@withContext StreamResolutionState.Available(s, "title_year")
                    }
                }

                // Smart match calculation
                val res = SmartMatch.evaluate(
                    localRawTitle = s.title,
                    localCategory = s.type,
                    localRawYear = s.year?.toString(),
                    tmdbTitle = title,
                    tmdbOriginalTitle = null,
                    tmdbYear = year
                )

                if (res.isMatch && res.score > highestScore && res.score >= 75) {
                    highestScore = res.score
                    bestStream = s
                }
            }

            if (bestStream != null) {
                Log.d(TAG, "Match Found (Smart Match Score $highestScore): ${bestStream.title}")
                return@withContext StreamResolutionState.Available(bestStream, "title_year")
            }
        }

        StreamResolutionState.Unavailable
    }
}
