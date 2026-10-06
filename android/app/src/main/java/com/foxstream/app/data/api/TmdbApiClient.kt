package com.foxstream.app.data.api

import android.util.Log
import com.foxstream.app.BuildConfig
import com.foxstream.app.util.SmartMatch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

data class TmdbResult(
    val title: String? = null,
    val originalTitle: String? = null,
    val year: String? = null,
    val runtime: String? = null,
    val genre: String? = null,
    val director: String? = null,
    val cast: String? = null,
    val plot: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val rating: String? = null,
    val voteCount: String? = null,
    val tmdbId: Int? = null,
    val imdbId: String? = null
)

object TmdbApiClient {
    private const val TAG = "TmdbApiClient"
    private const val BASE_URL = "https://api.themoviedb.org/3"
    private const val POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500"
    private const val BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280"

    private val cache = ConcurrentHashMap<String, TmdbResult>()

    private suspend fun fetchTmdbList(endpoint: String, isTv: Boolean): List<TmdbResult> = withContext(Dispatchers.IO) {
        val list = mutableListOf<TmdbResult>()
        try {
            val (apiKey, token) = getAuthCredentials()
            if (apiKey.isBlank() && token.isBlank()) {
                Log.w(TAG, "TMDb API Key / Token is blank")
                return@withContext emptyList()
            }

            val separator = if (endpoint.contains("?")) "&" else "?"
            val url = "$BASE_URL/$endpoint${separator}language=pt-BR"
            val json = fetchJson(url, apiKey, token) ?: return@withContext emptyList()
            val results = json.optJSONArray("results") ?: return@withContext emptyList()

            for (i in 0 until results.length()) {
                val item = results.getJSONObject(i)
                val id = item.optInt("id", 0)
                if (id <= 0) continue

                val title = (if (isTv) item.optString("name", null) else item.optString("title", null))?.takeIf { it.isNotBlank() }
                val origTitle = (if (isTv) item.optString("original_name", null) else item.optString("original_title", null))?.takeIf { it.isNotBlank() }
                val dateField = if (isTv) "first_air_date" else "release_date"
                val releaseDate = item.optString(dateField, null)
                val year = releaseDate?.take(4)?.takeIf { it.isNotBlank() }
                val plot = item.optString("overview", null)?.takeIf { it.isNotBlank() }
                val posterPath = item.optString("poster_path", null)?.takeIf { it.isNotBlank() && it != "null" }
                val poster = posterPath?.let { "$POSTER_BASE_URL$it" }
                val backdropPath = item.optString("backdrop_path", null)?.takeIf { it.isNotBlank() && it != "null" }
                val backdrop = backdropPath?.let { "$BACKDROP_BASE_URL$it" }
                val voteAvg = item.optDouble("vote_average", 0.0)
                val rating = if (voteAvg > 0.0) String.format(Locale.US, "%.1f/10", voteAvg) else null

                list.add(TmdbResult(
                    title = title,
                    originalTitle = origTitle,
                    year = year,
                    plot = plot,
                    poster = poster,
                    backdrop = backdrop,
                    rating = rating,
                    tmdbId = id
                ))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching TMDb list from $endpoint: ${e.message}", e)
        }
        list
    }

    suspend fun getTrendingMovies(): List<TmdbResult> = fetchTmdbList("trending/movie/week", isTv = false)

    suspend fun getTrendingTv(): List<TmdbResult> = fetchTmdbList("trending/tv/week", isTv = true)

    suspend fun getPopularMovies(): List<TmdbResult> = fetchTmdbList("movie/popular", isTv = false)

    suspend fun getPopularTv(): List<TmdbResult> = fetchTmdbList("tv/popular", isTv = true)

    suspend fun getNowPlayingMovies(): List<TmdbResult> = fetchTmdbList("movie/now_playing", isTv = false)

    fun normalizeTitle(rawTitle: String): Pair<String, String?> {
        var title = rawTitle.trim()
        var extractedYear: String? = null

        // 1. Remove initial category prefixes like "Filmes | ", "Series - ", "VOD: "
        title = title.replace(
            Regex("^(?:filmes?|s[ée]ries?|vod|canais|tv|4k|fhd|hd)\\s*[:|\\-–]\\s*", RegexOption.IGNORE_CASE),
            ""
        ).trim()

        // 2. Extract 4-digit year (e.g. (2024), [2023], 2022)
        val yearMatch = Regex("[\\(\\[\\s](\\d{4})[\\)\\]\\s]?").find(title)
        if (yearMatch != null) {
            val y = yearMatch.groupValues[1].toIntOrNull()
            if (y != null && y in 1920..2035) {
                extractedYear = y.toString()
            }
        }

        // 3. Remove common IPTV tags and encoding specs
        val noisePatterns = listOf(
            Regex("[\\(\\[]?\\b(?:1080p|720p|480p|2160p|4k|uhd|fhd|hd|sd|cam|ts|tc|dvdrip|bluray|blu-ray|bdrip|web-dl|webrip|hdtv)[\\)\\]]?", RegexOption.IGNORE_CASE),
            Regex("[\\(\\[]?\\b(?:dublado|legendado|dual|audio|nacional|multi|legendas?|pt-br|pt|br|en|latino|portugues)[\\)\\]]?", RegexOption.IGNORE_CASE),
            Regex("[\\(\\[]?\\b(?:x264|x265|hevc|h264|h265|10bit|ac3|dts|aac|mp4|mkv|avi)[\\)\\]]?", RegexOption.IGNORE_CASE),
            Regex("[\\(\\[]?\\b(?:redecanais|comando|topdez|filmesonline|assistir|completo)[\\)\\]]?", RegexOption.IGNORE_CASE),
            Regex("[\\(\\[]?\\b(?:s\\d{1,2}\\s*e\\d{1,2}|season\\s*\\d{1,2}|temporada\\s*\\d{1,2}|temp\\s*\\d{1,2}|t\\d{1,2}|ep\\s*\\d{1,2}|episodio\\s*\\d{1,2})[\\)\\]]?", RegexOption.IGNORE_CASE),
            Regex("[\\(\\[]\\d{4}[\\)\\]]"),
            Regex("\\b\\d{4}\\b")
        )

        for (pattern in noisePatterns) {
            title = pattern.replace(title, " ")
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
        originalTitle: String? = null
    ): TmdbResult? = withContext(Dispatchers.IO) {
        try {
            val (apiKey, token) = getAuthCredentials()
            if (apiKey.isBlank() && token.isBlank()) {
                Log.w(TAG, "TMDb API Key / Token is blank")
                return@withContext null
            }

            val (normalized, extractedYear) = normalizeTitle(rawTitle)
            val yearToUse = extractedYear ?: rawYear?.takeIf { it.isNotBlank() && it.length == 4 }

            val cacheKey = if (!imdbId.isNullOrBlank()) "id_$imdbId" else "movie_${normalized}_$yearToUse"
            cache[cacheKey]?.let { return@withContext it }

            // 1. Direct query with IMDb ID if available
            val cleanImdb = imdbId?.trim()
            if (!cleanImdb.isNullOrBlank() && cleanImdb.startsWith("tt", ignoreCase = true)) {
                val findUrl = "$BASE_URL/find/${URLEncoder.encode(cleanImdb, "UTF-8")}?external_source=imdb_id&language=pt-BR"
                val findJson = fetchJson(findUrl, apiKey, token)
                val movieResults = findJson?.optJSONArray("movie_results")
                if (movieResults != null && movieResults.length() > 0) {
                    val tmdbId = movieResults.getJSONObject(0).optInt("id", 0)
                    if (tmdbId > 0) {
                        val details = fetchMovieDetails(tmdbId, apiKey, token)
                        if (details != null) {
                            cache[cacheKey] = details
                            return@withContext details
                        }
                    }
                }
            }

            // 2. Query with normalized title & year in Brazilian Portuguese
            var movie = searchMovie(normalized, yearToUse, apiKey, token)

            // 3. Fallback without year if year might be slightly off
            if (movie == null && !yearToUse.isNullOrBlank()) {
                movie = searchMovie(normalized, null, apiKey, token)
            }

            // 4. Fallback with originalTitle if provided (e.g. from Xtream info)
            if (movie == null && !originalTitle.isNullOrBlank()) {
                val (normOrig, origYear) = normalizeTitle(originalTitle)
                movie = searchMovie(normOrig, origYear ?: yearToUse, apiKey, token)
                if (movie == null) {
                    movie = searchMovie(normOrig, null, apiKey, token)
                }
            }

            if (movie != null) {
                cache[cacheKey] = movie
                return@withContext movie
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching movie from TMDb: ${e.message}", e)
        }
        null
    }

    suspend fun getSeriesDetails(
        rawTitle: String,
        rawYear: String? = null,
        imdbId: String? = null,
        originalTitle: String? = null
    ): TmdbResult? = withContext(Dispatchers.IO) {
        try {
            val (apiKey, token) = getAuthCredentials()
            if (apiKey.isBlank() && token.isBlank()) {
                Log.w(TAG, "TMDb API Key / Token is blank")
                return@withContext null
            }

            val (normalized, extractedYear) = normalizeTitle(rawTitle)
            val yearToUse = extractedYear ?: rawYear?.takeIf { it.isNotBlank() && it.length == 4 }

            val cacheKey = if (!imdbId.isNullOrBlank()) "id_$imdbId" else "tv_${normalized}_$yearToUse"
            cache[cacheKey]?.let { return@withContext it }

            // 1. Direct query with IMDb ID if available
            val cleanImdb = imdbId?.trim()
            if (!cleanImdb.isNullOrBlank() && cleanImdb.startsWith("tt", ignoreCase = true)) {
                val findUrl = "$BASE_URL/find/${URLEncoder.encode(cleanImdb, "UTF-8")}?external_source=imdb_id&language=pt-BR"
                val findJson = fetchJson(findUrl, apiKey, token)
                val tvResults = findJson?.optJSONArray("tv_results")
                if (tvResults != null && tvResults.length() > 0) {
                    val tmdbId = tvResults.getJSONObject(0).optInt("id", 0)
                    if (tmdbId > 0) {
                        val details = fetchTvDetails(tmdbId, apiKey, token)
                        if (details != null) {
                            cache[cacheKey] = details
                            return@withContext details
                        }
                    }
                }
            }

            // 2. Query with normalized title & year
            var tv = searchTv(normalized, yearToUse, apiKey, token)

            // 3. Fallback without year
            if (tv == null && !yearToUse.isNullOrBlank()) {
                tv = searchTv(normalized, null, apiKey, token)
            }

            // 4. Fallback with originalTitle
            if (tv == null && !originalTitle.isNullOrBlank()) {
                val (normOrig, origYear) = normalizeTitle(originalTitle)
                tv = searchTv(normOrig, origYear ?: yearToUse, apiKey, token)
                if (tv == null) {
                    tv = searchTv(normOrig, null, apiKey, token)
                }
            }

            if (tv != null) {
                cache[cacheKey] = tv
                return@withContext tv
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching series from TMDb: ${e.message}", e)
        }
        null
    }

    private fun searchMovie(title: String, year: String?, apiKey: String, token: String): TmdbResult? {
        var url = "$BASE_URL/search/movie?query=${URLEncoder.encode(title, "UTF-8")}&language=pt-BR&include_adult=false"
        if (!year.isNullOrBlank()) {
            url += "&year=${URLEncoder.encode(year, "UTF-8")}"
        }
        val json = fetchJson(url, apiKey, token) ?: return null
        val results = json.optJSONArray("results") ?: return null
        if (results.length() == 0) return null

        var bestId: Int? = null
        var bestScore = 79

        for (i in 0 until minOf(results.length(), 6)) {
            val item = results.getJSONObject(i)
            val id = item.optInt("id", 0)
            if (id <= 0) continue
            val itemTitle = item.optString("title", "")
            val itemOrigTitle = item.optString("original_title", "")
            val itemYear = item.optString("release_date", "").take(4)

            val match = SmartMatch.evaluateMatch(
                localRawName = title,
                localCategory = "Filmes",
                localRawYear = year,
                tmdbTitle = itemTitle,
                tmdbOriginalTitle = itemOrigTitle,
                tmdbYear = itemYear
            )

            if (match.isMatch && match.score > bestScore) {
                bestScore = match.score
                bestId = id
                if (bestScore >= 95) break
            }
        }

        val finalId = bestId ?: results.getJSONObject(0).optInt("id", 0).takeIf { it > 0 } ?: return null
        return fetchMovieDetails(finalId, apiKey, token)
    }

    private fun searchTv(title: String, year: String?, apiKey: String, token: String): TmdbResult? {
        var url = "$BASE_URL/search/tv?query=${URLEncoder.encode(title, "UTF-8")}&language=pt-BR&include_adult=false"
        if (!year.isNullOrBlank()) {
            url += "&first_air_date_year=${URLEncoder.encode(year, "UTF-8")}"
        }
        val json = fetchJson(url, apiKey, token) ?: return null
        val results = json.optJSONArray("results") ?: return null
        if (results.length() == 0) return null

        var bestId: Int? = null
        var bestScore = 79

        for (i in 0 until minOf(results.length(), 6)) {
            val item = results.getJSONObject(i)
            val id = item.optInt("id", 0)
            if (id <= 0) continue
            val itemTitle = item.optString("name", "")
            val itemOrigTitle = item.optString("original_name", "")
            val itemYear = item.optString("first_air_date", "").take(4)

            val match = SmartMatch.evaluateMatch(
                localRawName = title,
                localCategory = "Séries",
                localRawYear = year,
                tmdbTitle = itemTitle,
                tmdbOriginalTitle = itemOrigTitle,
                tmdbYear = itemYear
            )

            if (match.isMatch && match.score > bestScore) {
                bestScore = match.score
                bestId = id
                if (bestScore >= 95) break
            }
        }

        val finalId = bestId ?: results.getJSONObject(0).optInt("id", 0).takeIf { it > 0 } ?: return null
        return fetchTvDetails(finalId, apiKey, token)
    }

    private fun fetchMovieDetails(id: Int, apiKey: String, token: String): TmdbResult? {
        val url = "$BASE_URL/movie/$id?language=pt-BR&append_to_response=credits"
        val json = fetchJson(url, apiKey, token) ?: return null

        val title = json.optString("title", null)?.takeIf { it.isNotBlank() }
        val origTitle = json.optString("original_title", null)?.takeIf { it.isNotBlank() }
        val releaseDate = json.optString("release_date", null)
        val year = releaseDate?.take(4)?.takeIf { it.isNotBlank() }

        val runtimeMins = json.optInt("runtime", 0)
        val runtimeStr = if (runtimeMins > 0) "$runtimeMins min" else null

        val genresList = mutableListOf<String>()
        val genresArr = json.optJSONArray("genres")
        if (genresArr != null) {
            for (i in 0 until genresArr.length()) {
                val g = genresArr.getJSONObject(i).optString("name")
                if (g.isNotBlank()) genresList.add(g)
            }
        }
        val genre = genresList.joinToString(", ").takeIf { it.isNotBlank() }

        val credits = json.optJSONObject("credits")
        var director: String? = null
        if (credits != null) {
            val crew = credits.optJSONArray("crew")
            if (crew != null) {
                val directors = mutableListOf<String>()
                for (i in 0 until crew.length()) {
                    val member = crew.getJSONObject(i)
                    if (member.optString("job").equals("Director", ignoreCase = true)) {
                        val name = member.optString("name")
                        if (name.isNotBlank()) directors.add(name)
                    }
                }
                director = directors.distinct().joinToString(", ").takeIf { it.isNotBlank() }
            }
        }

        var cast: String? = null
        if (credits != null) {
            val castArr = credits.optJSONArray("cast")
            if (castArr != null) {
                val castList = mutableListOf<String>()
                val limit = minOf(castArr.length(), 6)
                for (i in 0 until limit) {
                    val name = castArr.getJSONObject(i).optString("name")
                    if (name.isNotBlank()) castList.add(name)
                }
                cast = castList.joinToString(", ").takeIf { it.isNotBlank() }
            }
        }

        val plot = json.optString("overview", null)?.takeIf { it.isNotBlank() }

        val posterPath = json.optString("poster_path", null)?.takeIf { it.isNotBlank() && it != "null" }
        val poster = posterPath?.let { "$POSTER_BASE_URL$it" }

        val backdropPath = json.optString("backdrop_path", null)?.takeIf { it.isNotBlank() && it != "null" }
        val backdrop = backdropPath?.let { "$BACKDROP_BASE_URL$it" }

        val voteAvg = json.optDouble("vote_average", 0.0)
        val rating = if (voteAvg > 0.0) String.format(Locale.US, "%.1f/10", voteAvg) else null
        val voteCount = json.optInt("vote_count", 0).takeIf { it > 0 }?.toString()
        val imdbId = json.optString("imdb_id", null)?.takeIf { it.isNotBlank() && it != "null" }

        return TmdbResult(
            title = title,
            originalTitle = origTitle,
            year = year,
            runtime = runtimeStr,
            genre = genre,
            director = director,
            cast = cast,
            plot = plot,
            poster = poster,
            backdrop = backdrop,
            rating = rating,
            voteCount = voteCount,
            tmdbId = id,
            imdbId = imdbId
        )
    }

    private fun fetchTvDetails(id: Int, apiKey: String, token: String): TmdbResult? {
        val url = "$BASE_URL/tv/$id?language=pt-BR&append_to_response=credits"
        val json = fetchJson(url, apiKey, token) ?: return null

        val title = json.optString("name", null)?.takeIf { it.isNotBlank() }
        val origTitle = json.optString("original_name", null)?.takeIf { it.isNotBlank() }
        val firstAirDate = json.optString("first_air_date", null)
        val year = firstAirDate?.take(4)?.takeIf { it.isNotBlank() }

        val genresList = mutableListOf<String>()
        val genresArr = json.optJSONArray("genres")
        if (genresArr != null) {
            for (i in 0 until genresArr.length()) {
                val g = genresArr.getJSONObject(i).optString("name")
                if (g.isNotBlank()) genresList.add(g)
            }
        }
        val genre = genresList.joinToString(", ").takeIf { it.isNotBlank() }

        var director: String? = null
        val createdByArr = json.optJSONArray("created_by")
        if (createdByArr != null && createdByArr.length() > 0) {
            val creators = mutableListOf<String>()
            for (i in 0 until createdByArr.length()) {
                val name = createdByArr.getJSONObject(i).optString("name")
                if (name.isNotBlank()) creators.add(name)
            }
            director = creators.distinct().joinToString(", ").takeIf { it.isNotBlank() }
        }

        val credits = json.optJSONObject("credits")
        var cast: String? = null
        if (credits != null) {
            val castArr = credits.optJSONArray("cast")
            if (castArr != null) {
                val castList = mutableListOf<String>()
                val limit = minOf(castArr.length(), 6)
                for (i in 0 until limit) {
                    val name = castArr.getJSONObject(i).optString("name")
                    if (name.isNotBlank()) castList.add(name)
                }
                cast = castList.joinToString(", ").takeIf { it.isNotBlank() }
            }
        }

        val plot = json.optString("overview", null)?.takeIf { it.isNotBlank() }

        val posterPath = json.optString("poster_path", null)?.takeIf { it.isNotBlank() && it != "null" }
        val poster = posterPath?.let { "$POSTER_BASE_URL$it" }

        val backdropPath = json.optString("backdrop_path", null)?.takeIf { it.isNotBlank() && it != "null" }
        val backdrop = backdropPath?.let { "$BACKDROP_BASE_URL$it" }

        val voteAvg = json.optDouble("vote_average", 0.0)
        val rating = if (voteAvg > 0.0) String.format(Locale.US, "%.1f/10", voteAvg) else null
        val voteCount = json.optInt("vote_count", 0).takeIf { it > 0 }?.toString()

        return TmdbResult(
            title = title,
            originalTitle = origTitle,
            year = year,
            runtime = null,
            genre = genre,
            director = director,
            cast = cast,
            plot = plot,
            poster = poster,
            backdrop = backdrop,
            rating = rating,
            voteCount = voteCount,
            tmdbId = id,
            imdbId = null
        )
    }

    private const val DEFAULT_API_KEY = "6fb6ba516b5df9841c2ac73a2974bbfb"
    private const val DEFAULT_READ_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZmI2YmE1MTZiNWRmOTg0MWMyYWM3M2EyOTc0YmJmYiIsIm5iZiI6MTc4OTk3NTY0MS4yNTUsInN1YiI6IjZhYjBkYzU5YmJiZGQ4MzdhNmM4YmIxYSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.5hLq_cry3Sh_KEKj-_Wo2DGNOFuugz6jjfy3J7ePDMQ"

    private fun getAuthCredentials(): Pair<String, String> {
        val apiKey = (try { BuildConfig.TMDB_API_KEY } catch (e: Throwable) { "" }).ifBlank { DEFAULT_API_KEY }
        val token = (try { BuildConfig.TMDB_READ_ACCESS_TOKEN } catch (e: Throwable) { "" }).ifBlank { DEFAULT_READ_TOKEN }
        return Pair(apiKey, token)
    }

    private fun fetchJson(urlString: String, apiKey: String, token: String): JSONObject? {
        return try {
            var finalUrl = urlString
            if (apiKey.isNotBlank() && !finalUrl.contains("api_key=")) {
                val sep = if (finalUrl.contains("?")) "&" else "?"
                finalUrl += "${sep}api_key=${URLEncoder.encode(apiKey, "UTF-8")}"
            }

            val url = URL(finalUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = 8000
            conn.readTimeout = 8000
            conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")
            conn.setRequestProperty("Accept", "application/json")

            if (token.isNotBlank()) {
                conn.setRequestProperty("Authorization", "Bearer $token")
            }

            if (conn.responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
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
