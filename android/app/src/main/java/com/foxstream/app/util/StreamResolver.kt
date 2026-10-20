package com.foxstream.app.util

import android.content.Context
import android.util.Log
import com.foxstream.app.data.api.TmdbApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class StreamSource(
    val id: String,
    val tmdbId: String? = null,
    val title: String,
    val year: Int? = null,
    val type: String = "movie",
    val streamUrl: String,
    val quality: String? = null,
    val format: String? = null,
    val name: String? = null,
    val details: String? = null
)

sealed class StreamResolutionState {
    object Idle : StreamResolutionState()
    object Loading : StreamResolutionState()
    data class Available(
        val stream: StreamSource,
        val matchType: String,
        val allStreams: List<StreamSource> = listOf(stream)
    ) : StreamResolutionState()
    object Unavailable : StreamResolutionState()
}

object StreamResolver {
    private const val TAG = "StreamResolver"
    private const val DEFAULT_ADDON_URL = "https://torrentio.strem.fun/manifest.json"
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
                            format = format,
                            name = "Local Stream",
                            details = title
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
     * Resolves streams using Stremio Add-on Protocol (JSON endpoint)
     * e.g. /stream/movie/{imdb_id}.json or /stream/series/{imdb_id}:{season}:{episode}.json
     */
    private suspend fun resolveStreamFromStremioAddon(
        context: Context,
        tmdbId: String?,
        title: String?,
        type: String?,
        seasonNum: Int?,
        episodeNum: Int?
    ): List<StreamSource> = withContext(Dispatchers.IO) {
        val list = mutableListOf<StreamSource>()
        try {
            val sharedPrefs = context.getSharedPreferences("foxstream_prefs", Context.MODE_PRIVATE)
            val configuredAddon = sharedPrefs.getString("foxstream_active_addon_url", null)
            val addonUrl = if (!configuredAddon.isNullOrBlank()) configuredAddon.trim() else DEFAULT_ADDON_URL
            val addonBase = addonUrl.replace(Regex("""/manifest\.json$""", RegexOption.IGNORE_CASE), "").trimEnd('/')

            val isTv = type.equals("series", ignoreCase = true) || type.equals("tv", ignoreCase = true)
            var imdbId: String? = null

            if (!tmdbId.isNullOrBlank()) {
                if (tmdbId.startsWith("tt", ignoreCase = true)) {
                    imdbId = tmdbId
                } else {
                    val numericId = tmdbId.toIntOrNull()
                    if (numericId != null) {
                        imdbId = TmdbApiClient.fetchExternalIds(numericId, isTv)
                    }
                }
            }

            val mediaIdentifier = imdbId ?: if (!tmdbId.isNullOrBlank()) "tmdb:$tmdbId" else null
            if (mediaIdentifier.isNullOrBlank()) {
                return@withContext emptyList()
            }

            val streamUrl = if (isTv) {
                val sNum = seasonNum ?: 1
                val eNum = episodeNum ?: 1
                "$addonBase/stream/series/$mediaIdentifier:$sNum:$eNum.json"
            } else {
                "$addonBase/stream/movie/$mediaIdentifier.json"
            }

            Log.d(TAG, "Fetching Stremio streams from: $streamUrl")
            val url = URL(streamUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")
            conn.setRequestProperty("Accept", "application/json")

            if (conn.responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                val json = JSONObject(sb.toString())
                val streamsArr = json.optJSONArray("streams")
                if (streamsArr != null) {
                    for (i in 0 until streamsArr.length()) {
                        val sObj = streamsArr.getJSONObject(i)
                        val name = sObj.optString("name", "Stream")
                        val streamTitle = sObj.optString("title", title ?: "Stream $i")
                        val urlStr = sObj.optString("url", "")
                        val infoHash = sObj.optString("infoHash", "")
                        val finalUrl = when {
                            urlStr.isNotBlank() -> urlStr
                            infoHash.isNotBlank() -> "magnet:?xt=urn:btih:$infoHash"
                            else -> ""
                        }

                        if (finalUrl.isNotBlank()) {
                            val quality = when {
                                name.contains("4k", ignoreCase = true) || streamTitle.contains("4k", ignoreCase = true) || streamTitle.contains("2160p", ignoreCase = true) -> "4K"
                                name.contains("1080p", ignoreCase = true) || streamTitle.contains("1080p", ignoreCase = true) -> "1080p"
                                name.contains("720p", ignoreCase = true) || streamTitle.contains("720p", ignoreCase = true) -> "720p"
                                else -> "HD"
                            }

                            list.add(
                                StreamSource(
                                    id = "stremio_${imdbId ?: tmdbId}_$i",
                                    tmdbId = tmdbId,
                                    title = streamTitle,
                                    year = null,
                                    type = if (isTv) "series" else "movie",
                                    streamUrl = finalUrl,
                                    quality = quality,
                                    format = if (finalUrl.startsWith("magnet:")) "magnet" else "mp4",
                                    name = name,
                                    details = streamTitle
                                )
                            )
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error querying Stremio addon: ${e.message}")
        }
        list
    }

    /**
     * Priority Multi-Source Resolution:
     * 1. Stremio Add-on Protocol (/stream/movie/ or /stream/series/)
     * 2. Local/Asset streams.json exact match (tmdb_id)
     * 3. Local/Asset streams.json smart fuzzy match (SmartMatch)
     */
    suspend fun resolveStream(
        context: Context,
        tmdbId: String? = null,
        title: String? = null,
        year: String? = null,
        type: String? = null,
        seasonNum: Int? = null,
        episodeNum: Int? = null
    ): StreamResolutionState = withContext(Dispatchers.Default) {
        // 1. STREMIO ADD-ON ON-DEMAND PROTOCOL
        val stremioStreams = resolveStreamFromStremioAddon(context, tmdbId, title, type, seasonNum, episodeNum)
        if (stremioStreams.isNotEmpty()) {
            Log.d(TAG, "Match Found (Stremio Protocol): ${stremioStreams.size} streams available")
            return@withContext StreamResolutionState.Available(
                stream = stremioStreams.first(),
                matchType = "stremio_addon",
                allStreams = stremioStreams
            )
        }

        // 2. STATIC ASSETS FALLBACK (streams.json)
        val streams = loadStreams(context)

        // Exact TMDB ID match
        if (!tmdbId.isNullOrBlank()) {
            val cleanTmdbId = tmdbId.trim()
            val matches = streams.filter { it.tmdbId?.trim() == cleanTmdbId }
            if (matches.isNotEmpty()) {
                Log.d(TAG, "Match Found (Primary TMDB ID: $cleanTmdbId): ${matches.first().title}")
                return@withContext StreamResolutionState.Available(
                    stream = matches.first(),
                    matchType = "tmdb_id",
                    allStreams = matches
                )
            }
        }

        // Fuzzy match by Title & Year
        if (!title.isNullOrBlank()) {
            val (cleanTargetTitle, _) = SmartMatch.cleanTitle(title)
            val targetYearInt = year?.toIntOrNull()

            val matchingStreams = mutableListOf<StreamSource>()
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
                        matchingStreams.add(s)
                    }
                }

                // Smart match calculation
                val res = SmartMatch.evaluate(
                    localRawName = s.title,
                    localCategory = s.type,
                    localRawYear = s.year?.toString(),
                    tmdbTitle = title,
                    tmdbOriginalTitle = null,
                    tmdbYear = year
                )

                if (res.isMatch && res.score >= 75 && !matchingStreams.contains(s)) {
                    matchingStreams.add(s)
                    if (res.score > highestScore) {
                        highestScore = res.score
                        bestStream = s
                    }
                }
            }

            if (matchingStreams.isNotEmpty()) {
                val primary = bestStream ?: matchingStreams.first()
                Log.d(TAG, "Match Found (Smart Match Score $highestScore): ${primary.title}")
                return@withContext StreamResolutionState.Available(
                    stream = primary,
                    matchType = "title_year",
                    allStreams = matchingStreams
                )
            }
        }

        StreamResolutionState.Unavailable
    }
}
