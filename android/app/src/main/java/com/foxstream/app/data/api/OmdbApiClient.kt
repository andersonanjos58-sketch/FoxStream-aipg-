package com.foxstream.app.data.api

import android.util.Log
import com.foxstream.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

object OmdbApiClient {
    private const val TAG = "OmdbApiClient"
    private const val BASE_URL = "https://www.omdbapi.com/"
    
    // In-memory cache to avoid repeated requests
    private val cache = ConcurrentHashMap<String, JSONObject>()

    data class OmdbResult(
        val title: String?,
        val originalTitle: String?,
        val year: String?,
        val rated: String?,
        val runtime: String?,
        val genre: String?,
        val director: String?,
        val cast: String?,
        val plot: String?,
        val poster: String?,
        val imdbRating: String?,
        val imdbVotes: String?,
        val imdbId: String?
    )

    fun normalizeTitle(rawTitle: String): Pair<String, String?> {
        val yearRegex = Regex("\\b(19\\d{2}|20\\d{2})\\b")
        val yearMatch = yearRegex.find(rawTitle)
        val extractedYear = yearMatch?.value

        // Remove extracted year from title string so it doesn't pollute the title query
        var title = if (yearMatch != null) {
            rawTitle.substring(0, yearMatch.range.first) + " " + rawTitle.substring(yearMatch.range.last + 1)
        } else {
            rawTitle
        }

        val cleanPatterns = listOf(
            Regex("(?i)\\b(1080p|720p|480p|4k|uhd|fhd|hd|sd|hdr|bluray|web-dl|webrip|hdtv|dvdrip|cam|ts)\\b"),
            Regex("(?i)\\b(dual|dublado|legendado|nacional|portugues|pt-br|audio|ac3|aac|x264|x265|hevc|remastered|extended|uncut|director's cut)\\b"),
            Regex("(?i)\\[.*?\\]"),
            Regex("(?i)\\(.*?\\)"),
            Regex("(?i)\\bS\\d{2}E\\d{2}\\b"),
            Regex("(?i)\\bseason\\s*\\d+\\b"),
            Regex("(?i)\\bepis[oó]dio\\s*\\d+\\b")
        )

        for (pattern in cleanPatterns) {
            title = title.replace(pattern, " ")
        }

        title = title.replace(Regex("[_\\.-]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

        if (title.isBlank()) {
            title = rawTitle.trim()
        }

        return Pair(title, extractedYear)
    }

    suspend fun getMovieDetails(
        rawTitle: String,
        rawYear: String? = null,
        imdbId: String? = null,
        originalTitle: String? = null,
        isSeries: Boolean = false
    ): OmdbResult? = withContext(Dispatchers.IO) {
        try {
            val apiKey = BuildConfig.OMDB_API_KEY
            if (apiKey.isBlank()) {
                Log.w(TAG, "OMDB API Key is blank")
                return@withContext null
            }

            val cacheKey = if (!imdbId.isNullOrBlank()) "id_$imdbId" else "title_${rawTitle}_$rawYear"
            cache[cacheKey]?.let { cachedJson ->
                return@withContext parseOmdbJson(cachedJson)
            }

            // 1. Direct query with IMDb ID if available
            val cleanImdb = imdbId?.trim()
            if (!cleanImdb.isNullOrBlank() && cleanImdb.startsWith("tt", ignoreCase = true)) {
                val url = "$BASE_URL?apikey=$apiKey&i=${URLEncoder.encode(cleanImdb, "UTF-8")}"
                val json = fetchJsonObject(url)
                if (json != null && isResponseTrue(json)) {
                    cache[cacheKey] = json
                    return@withContext parseOmdbJson(json)
                }
            }

            val (normalized, extractedYear) = normalizeTitle(rawTitle)
            // The year found directly in title name takes precedence over potentially wrong playlist upload year
            val yearToUse = extractedYear ?: rawYear?.takeIf { it.isNotBlank() && it.length == 4 }
            val mediaType = if (isSeries) "series" else "movie"

            // 2. Query with Original Title if provided (e.g. from Xtream info)
            if (!originalTitle.isNullOrBlank()) {
                val (normOrig, origYear) = normalizeTitle(originalTitle)
                val targetYear = origYear ?: yearToUse
                val res = queryExactOrSearch(apiKey, normOrig, targetYear, mediaType)
                if (res != null) {
                    cache[cacheKey] = res
                    return@withContext parseOmdbJson(res)
                }
            }

            // 3. Query with normalized title & year (exact t=)
            val res1 = queryExactOrSearch(apiKey, normalized, yearToUse, mediaType)
            if (res1 != null) {
                cache[cacheKey] = res1
                return@withContext parseOmdbJson(res1)
            }

            // 4. Query without year (exact t= or search s=)
            if (!yearToUse.isNullOrBlank()) {
                val res2 = queryExactOrSearch(apiKey, normalized, null, mediaType)
                if (res2 != null) {
                    cache[cacheKey] = res2
                    return@withContext parseOmdbJson(res2)
                }
            }

            // 5. Fallback for translated titles: prefix words + year (e.g. "Harry Potter" + 2002)
            if (!yearToUse.isNullOrBlank()) {
                val words = normalized.split(" ").filter { it.isNotBlank() }
                for (len in listOf(2, 1, 3)) {
                    if (words.size >= len) {
                        val prefix = words.take(len).joinToString(" ")
                        val searchUrl = "$BASE_URL?apikey=$apiKey&s=${URLEncoder.encode(prefix, "UTF-8")}&y=${URLEncoder.encode(yearToUse, "UTF-8")}&type=$mediaType"
                        val searchJson = fetchJsonObject(searchUrl)
                        if (searchJson != null && isResponseTrue(searchJson)) {
                            val items = searchJson.optJSONArray("Search")
                            if (items != null && items.length() > 0) {
                                val firstId = items.getJSONObject(0).optString("imdbID")
                                if (firstId.isNotBlank()) {
                                    val detailJson = fetchJsonObject("$BASE_URL?apikey=$apiKey&i=${URLEncoder.encode(firstId, "UTF-8")}")
                                    if (detailJson != null && isResponseTrue(detailJson)) {
                                        cache[cacheKey] = detailJson
                                        return@withContext parseOmdbJson(detailJson)
                                    }
                                }
                            }
                        }
                    }
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Error fetching from OMDb: ${e.message}", e)
        }
        null
    }

    private fun queryExactOrSearch(apiKey: String, title: String, year: String?, type: String): JSONObject? {
        // Try exact title (t=)
        var exactUrl = "$BASE_URL?apikey=$apiKey&t=${URLEncoder.encode(title, "UTF-8")}&type=$type"
        if (!year.isNullOrBlank()) {
            exactUrl += "&y=${URLEncoder.encode(year, "UTF-8")}"
        }
        val exactJson = fetchJsonObject(exactUrl)
        if (exactJson != null && isResponseTrue(exactJson)) {
            return exactJson
        }

        // Try search (s=)
        var searchUrl = "$BASE_URL?apikey=$apiKey&s=${URLEncoder.encode(title, "UTF-8")}&type=$type"
        if (!year.isNullOrBlank()) {
            searchUrl += "&y=${URLEncoder.encode(year, "UTF-8")}"
        }
        val searchJson = fetchJsonObject(searchUrl)
        if (searchJson != null && isResponseTrue(searchJson)) {
            val items = searchJson.optJSONArray("Search")
            if (items != null && items.length() > 0) {
                val firstId = items.getJSONObject(0).optString("imdbID")
                if (firstId.isNotBlank()) {
                    val detailJson = fetchJsonObject("$BASE_URL?apikey=$apiKey&i=${URLEncoder.encode(firstId, "UTF-8")}")
                    if (detailJson != null && isResponseTrue(detailJson)) {
                        return detailJson
                    }
                }
            }
        }

        return null
    }

    private fun isResponseTrue(json: JSONObject): Boolean {
        return json.optString("Response", "False").equals("True", ignoreCase = true)
    }

    private fun parseOmdbJson(json: JSONObject): OmdbResult {
        val poster = json.optString("Poster", null)
        val validPoster = if (!poster.isNullOrBlank() && !poster.equals("N/A", ignoreCase = true)) poster else null

        return OmdbResult(
            title = json.optString("Title", null)?.takeIf { it != "N/A" },
            originalTitle = json.optString("Title", null)?.takeIf { it != "N/A" },
            year = json.optString("Year", null)?.takeIf { it != "N/A" },
            rated = json.optString("Rated", null)?.takeIf { it != "N/A" },
            runtime = json.optString("Runtime", null)?.takeIf { it != "N/A" },
            genre = json.optString("Genre", null)?.takeIf { it != "N/A" },
            director = json.optString("Director", null)?.takeIf { it != "N/A" },
            cast = json.optString("Actors", null)?.takeIf { it != "N/A" },
            plot = json.optString("Plot", null)?.takeIf { it != "N/A" },
            poster = validPoster,
            imdbRating = json.optString("imdbRating", null)?.takeIf { it != "N/A" },
            imdbVotes = json.optString("imdbVotes", null)?.takeIf { it != "N/A" },
            imdbId = json.optString("imdbID", null)?.takeIf { it != "N/A" }
        )
    }

    private fun fetchJsonObject(urlString: String): JSONObject? {
        return try {
            val url = URL(urlString)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")
            
            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line)
                }
                reader.close()
                JSONObject(sb.toString())
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }
}
