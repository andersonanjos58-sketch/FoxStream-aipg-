package com.foxstream.app.data.local

import android.content.Context
import android.util.Log
import com.foxstream.app.data.model.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class HomeCacheData(
    val featuredBanners: List<HeroBannerItem>,
    val trendingMovies: List<MovieItem>,
    val popularMovies: List<MovieItem>,
    val popularSeries: List<SeriesItem>,
    val newReleases: List<MovieItem>,
    val timestamp: Long
)

object HomeCacheManager {
    private const val TAG = "HomeCacheManager"
    const val CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000L // 24 hours

    private fun getCacheFile(context: Context, playlistId: String): File {
        val safeId = playlistId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        return File(context.filesDir, "foxstream_home_cache_${safeId}.json")
    }

    /**
     * Loads cached home data from Room DB first, or fast JSON file fallback.
     */
    suspend fun load(context: Context, db: AppDatabase?, playlistId: String): HomeCacheData? {
        if (playlistId.isBlank()) return null

        // 1. Try loading from Room DB (tmdb_match_cache table)
        if (db != null) {
            try {
                val dbRows = db.tmdbMatchCacheDao().getCacheForPlaylist(playlistId)
                if (dbRows.isNotEmpty()) {
                    val banners = mutableListOf<HeroBannerItem>()
                    val trending = mutableListOf<MovieItem>()
                    val popM = mutableListOf<MovieItem>()
                    val popS = mutableListOf<SeriesItem>()
                    val releases = mutableListOf<MovieItem>()
                    var maxTimestamp = 0L

                    for (row in dbRows) {
                        if (row.updatedAt > maxTimestamp) {
                            maxTimestamp = row.updatedAt
                        }
                        when (row.categoryType) {
                            "HERO_BANNER" -> {
                                val movie = if (row.contentType == ContentType.MOVIE) {
                                    MovieItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        streamUrl = row.streamUrl,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                } else null

                                val series = if (row.contentType == ContentType.SERIES) {
                                    SeriesItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                } else null

                                banners.add(
                                    HeroBannerItem(
                                        id = row.localId,
                                        title = row.title,
                                        imageUrl = row.backdropUrl ?: row.posterUrl ?: "",
                                        category = row.genre ?: "Filmes",
                                        type = row.contentType,
                                        streamUrl = row.streamUrl,
                                        badgeInfo = row.badgeInfo,
                                        overview = row.overview,
                                        year = row.year,
                                        movieItem = movie,
                                        seriesItem = series
                                    )
                                )
                            }
                            "TRENDING" -> {
                                trending.add(
                                    MovieItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        streamUrl = row.streamUrl,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                )
                            }
                            "POPULAR_MOVIES" -> {
                                popM.add(
                                    MovieItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        streamUrl = row.streamUrl,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                )
                            }
                            "POPULAR_SERIES" -> {
                                popS.add(
                                    SeriesItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                )
                            }
                            "NOW_PLAYING" -> {
                                releases.add(
                                    MovieItem(
                                        id = row.localId,
                                        playlistId = row.playlistId,
                                        name = row.title,
                                        streamUrl = row.streamUrl,
                                        posterUrl = row.posterUrl,
                                        backdropUrl = row.backdropUrl,
                                        rating = row.rating,
                                        year = row.year,
                                        description = row.overview
                                    )
                                )
                            }
                        }
                    }

                    if (banners.isNotEmpty() || trending.isNotEmpty() || popM.isNotEmpty()) {
                        return HomeCacheData(
                            featuredBanners = banners,
                            trendingMovies = trending,
                            popularMovies = popM,
                            popularSeries = popS,
                            newReleases = releases,
                            timestamp = maxTimestamp
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load cache from Room DB: ${e.message}")
            }
        }

        // 2. Fast Fallback from Local File Cache
        return try {
            val file = getCacheFile(context, playlistId)
            if (!file.exists() || file.length() == 0L) return null

            val jsonString = file.readText()
            val root = JSONObject(jsonString)

            val timestamp = root.optLong("timestamp", 0L)

            val banners = mutableListOf<HeroBannerItem>()
            val bannersArray = root.optJSONArray("featuredBanners") ?: JSONArray()
            for (i in 0 until bannersArray.length()) {
                val obj = bannersArray.optJSONObject(i) ?: continue
                banners.add(jsonToBanner(obj))
            }

            val trending = mutableListOf<MovieItem>()
            val trendingArray = root.optJSONArray("trendingMovies") ?: JSONArray()
            for (i in 0 until trendingArray.length()) {
                val obj = trendingArray.optJSONObject(i) ?: continue
                trending.add(jsonToMovie(obj))
            }

            val popM = mutableListOf<MovieItem>()
            val popMArray = root.optJSONArray("popularMovies") ?: JSONArray()
            for (i in 0 until popMArray.length()) {
                val obj = popMArray.optJSONObject(i) ?: continue
                popM.add(jsonToMovie(obj))
            }

            val popS = mutableListOf<SeriesItem>()
            val popSArray = root.optJSONArray("popularSeries") ?: JSONArray()
            for (i in 0 until popSArray.length()) {
                val obj = popSArray.optJSONObject(i) ?: continue
                popS.add(jsonToSeries(obj))
            }

            val releases = mutableListOf<MovieItem>()
            val relArray = root.optJSONArray("newReleases") ?: JSONArray()
            for (i in 0 until relArray.length()) {
                val obj = relArray.optJSONObject(i) ?: continue
                releases.add(jsonToMovie(obj))
            }

            HomeCacheData(
                featuredBanners = banners,
                trendingMovies = trending,
                popularMovies = popM,
                popularSeries = popS,
                newReleases = releases,
                timestamp = timestamp
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to load home cache from file for playlist $playlistId: ${e.message}")
            null
        }
    }

    /**
     * Persists home matched data both to Room DB (tmdb_match_cache) and fast disk cache.
     */
    suspend fun save(
        context: Context,
        db: AppDatabase?,
        playlistId: String,
        featuredBanners: List<HeroBannerItem>,
        trendingMovies: List<MovieItem>,
        popularMovies: List<MovieItem>,
        popularSeries: List<SeriesItem>,
        newReleases: List<MovieItem>
    ) {
        if (playlistId.isBlank()) return
        val now = System.currentTimeMillis()

        // 1. Save to Room DB table (tmdb_match_cache)
        if (db != null) {
            try {
                val rows = mutableListOf<TmdbMatchCache>()

                featuredBanners.forEach { b ->
                    rows.add(
                        TmdbMatchCache(
                            playlistId = playlistId,
                            localId = b.id,
                            categoryType = "HERO_BANNER",
                            title = b.title,
                            posterUrl = b.movieItem?.posterUrl ?: b.seriesItem?.posterUrl ?: b.imageUrl,
                            backdropUrl = b.imageUrl,
                            rating = b.movieItem?.rating ?: b.seriesItem?.rating,
                            overview = b.overview,
                            year = b.year,
                            genre = b.category,
                            streamUrl = b.streamUrl,
                            badgeInfo = b.badgeInfo,
                            contentType = b.type,
                            updatedAt = now
                        )
                    )
                }

                trendingMovies.forEach { m ->
                    rows.add(
                        TmdbMatchCache(
                            playlistId = playlistId,
                            localId = m.id,
                            categoryType = "TRENDING",
                            title = m.name,
                            posterUrl = m.posterUrl,
                            backdropUrl = m.backdropUrl,
                            rating = m.rating,
                            overview = m.description,
                            year = m.year,
                            genre = m.genre ?: m.category,
                            streamUrl = m.streamUrl,
                            contentType = ContentType.MOVIE,
                            updatedAt = now
                        )
                    )
                }

                popularMovies.forEach { m ->
                    rows.add(
                        TmdbMatchCache(
                            playlistId = playlistId,
                            localId = m.id,
                            categoryType = "POPULAR_MOVIES",
                            title = m.name,
                            posterUrl = m.posterUrl,
                            backdropUrl = m.backdropUrl,
                            rating = m.rating,
                            overview = m.description,
                            year = m.year,
                            genre = m.genre ?: m.category,
                            streamUrl = m.streamUrl,
                            contentType = ContentType.MOVIE,
                            updatedAt = now
                        )
                    )
                }

                popularSeries.forEach { s ->
                    rows.add(
                        TmdbMatchCache(
                            playlistId = playlistId,
                            localId = s.id,
                            categoryType = "POPULAR_SERIES",
                            title = s.name,
                            posterUrl = s.posterUrl,
                            backdropUrl = s.backdropUrl,
                            rating = s.rating,
                            overview = s.description,
                            year = s.year,
                            genre = s.genre ?: s.category,
                            contentType = ContentType.SERIES,
                            updatedAt = now
                        )
                    )
                }

                newReleases.forEach { m ->
                    rows.add(
                        TmdbMatchCache(
                            playlistId = playlistId,
                            localId = m.id,
                            categoryType = "NOW_PLAYING",
                            title = m.name,
                            posterUrl = m.posterUrl,
                            backdropUrl = m.backdropUrl,
                            rating = m.rating,
                            overview = m.description,
                            year = m.year,
                            genre = m.genre ?: m.category,
                            streamUrl = m.streamUrl,
                            contentType = ContentType.MOVIE,
                            updatedAt = now
                        )
                    )
                }

                db.tmdbMatchCacheDao().deleteCacheForPlaylist(playlistId)
                db.tmdbMatchCacheDao().insertCache(rows)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to save cache to Room DB: ${e.message}", e)
            }
        }

        // 2. Also write to JSON file for ultra-fast startup retrieval
        try {
            val root = JSONObject()
            root.put("timestamp", now)

            val bArray = JSONArray()
            featuredBanners.forEach { bArray.put(bannerToJson(it)) }
            root.put("featuredBanners", bArray)

            val tArray = JSONArray()
            trendingMovies.forEach { tArray.put(movieToJson(it)) }
            root.put("trendingMovies", tArray)

            val pmArray = JSONArray()
            popularMovies.forEach { pmArray.put(movieToJson(it)) }
            root.put("popularMovies", pmArray)

            val psArray = JSONArray()
            popularSeries.forEach { psArray.put(seriesToJson(it)) }
            root.put("popularSeries", psArray)

            val nrArray = JSONArray()
            newReleases.forEach { nrArray.put(movieToJson(it)) }
            root.put("newReleases", nrArray)

            val file = getCacheFile(context, playlistId)
            file.writeText(root.toString())
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save cache to file for playlist $playlistId: ${e.message}")
        }
    }

    private fun movieToJson(m: MovieItem): JSONObject {
        return JSONObject().apply {
            put("id", m.id)
            put("playlistId", m.playlistId)
            put("name", m.name)
            put("streamUrl", m.streamUrl)
            put("posterUrl", m.posterUrl ?: "")
            put("category", m.category)
            put("year", m.year ?: "")
            put("genre", m.genre ?: "")
            put("rating", m.rating ?: "")
            put("description", m.description ?: "")
            put("backdropUrl", m.backdropUrl ?: "")
            put("duration", m.duration ?: "")
            put("director", m.director ?: "")
            put("cast", m.cast ?: "")
        }
    }

    private fun jsonToMovie(o: JSONObject): MovieItem {
        return MovieItem(
            id = o.optString("id", ""),
            playlistId = o.optString("playlistId", ""),
            name = o.optString("name", ""),
            streamUrl = o.optString("streamUrl", ""),
            posterUrl = o.optString("posterUrl", "").takeIf { it.isNotBlank() },
            category = o.optString("category", "Filmes"),
            year = o.optString("year", "").takeIf { it.isNotBlank() },
            genre = o.optString("genre", "").takeIf { it.isNotBlank() },
            rating = o.optString("rating", "").takeIf { it.isNotBlank() },
            description = o.optString("description", "").takeIf { it.isNotBlank() },
            backdropUrl = o.optString("backdropUrl", "").takeIf { it.isNotBlank() },
            duration = o.optString("duration", "").takeIf { it.isNotBlank() },
            director = o.optString("director", "").takeIf { it.isNotBlank() },
            cast = o.optString("cast", "").takeIf { it.isNotBlank() }
        )
    }

    private fun seriesToJson(s: SeriesItem): JSONObject {
        return JSONObject().apply {
            put("id", s.id)
            put("playlistId", s.playlistId)
            put("name", s.name)
            put("posterUrl", s.posterUrl ?: "")
            put("category", s.category)
            put("year", s.year ?: "")
            put("genre", s.genre ?: "")
            put("rating", s.rating ?: "")
            put("description", s.description ?: "")
            put("backdropUrl", s.backdropUrl ?: "")
            put("cast", s.cast ?: "")
            put("rated", s.rated ?: "")

            val seasonsArray = JSONArray()
            s.seasons.forEach { season ->
                val seasonObj = JSONObject().apply {
                    put("seasonNum", season.seasonNum)
                    put("name", season.name)
                    val epArray = JSONArray()
                    season.episodes.forEach { ep ->
                        epArray.put(JSONObject().apply {
                            put("id", ep.id)
                            put("seriesId", ep.seriesId)
                            put("title", ep.title)
                            put("seasonNum", ep.seasonNum)
                            put("episodeNum", ep.episodeNum)
                            put("streamUrl", ep.streamUrl)
                            put("duration", ep.duration ?: "")
                            put("overview", ep.overview ?: "")
                        })
                    }
                    put("episodes", epArray)
                }
                seasonsArray.put(seasonObj)
            }
            put("seasons", seasonsArray)
        }
    }

    private fun jsonToSeries(o: JSONObject): SeriesItem {
        val seasons = mutableListOf<SeasonItem>()
        val seasonsArray = o.optJSONArray("seasons") ?: JSONArray()
        for (i in 0 until seasonsArray.length()) {
            val sObj = seasonsArray.optJSONObject(i) ?: continue
            val eps = mutableListOf<EpisodeItem>()
            val epArray = sObj.optJSONArray("episodes") ?: JSONArray()
            for (j in 0 until epArray.length()) {
                val epObj = epArray.optJSONObject(j) ?: continue
                eps.add(
                    EpisodeItem(
                        id = epObj.optString("id", ""),
                        seriesId = epObj.optString("seriesId", ""),
                        title = epObj.optString("title", ""),
                        seasonNum = epObj.optInt("seasonNum", 1),
                        episodeNum = epObj.optInt("episodeNum", 1),
                        streamUrl = epObj.optString("streamUrl", ""),
                        duration = epObj.optString("duration", "").takeIf { it.isNotBlank() },
                        overview = epObj.optString("overview", "").takeIf { it.isNotBlank() }
                    )
                )
            }
            seasons.add(
                SeasonItem(
                    seasonNum = sObj.optInt("seasonNum", 1),
                    name = sObj.optString("name", "Temporada 1"),
                    episodes = eps
                )
            )
        }

        return SeriesItem(
            id = o.optString("id", ""),
            playlistId = o.optString("playlistId", ""),
            name = o.optString("name", ""),
            posterUrl = o.optString("posterUrl", "").takeIf { it.isNotBlank() },
            category = o.optString("category", "Séries"),
            year = o.optString("year", "").takeIf { it.isNotBlank() },
            genre = o.optString("genre", "").takeIf { it.isNotBlank() },
            rating = o.optString("rating", "").takeIf { it.isNotBlank() },
            description = o.optString("description", "").takeIf { it.isNotBlank() },
            seasons = seasons,
            backdropUrl = o.optString("backdropUrl", "").takeIf { it.isNotBlank() },
            cast = o.optString("cast", "").takeIf { it.isNotBlank() },
            rated = o.optString("rated", "").takeIf { it.isNotBlank() }
        )
    }

    private fun bannerToJson(b: HeroBannerItem): JSONObject {
        return JSONObject().apply {
            put("id", b.id)
            put("title", b.title)
            put("imageUrl", b.imageUrl)
            put("category", b.category)
            put("type", b.type.name)
            put("streamUrl", b.streamUrl)
            put("badgeInfo", b.badgeInfo ?: "")
            put("overview", b.overview ?: "")
            put("year", b.year ?: "")
            b.movieItem?.let { put("movieItem", movieToJson(it)) }
            b.seriesItem?.let { put("seriesItem", seriesToJson(it)) }
        }
    }

    private fun jsonToBanner(o: JSONObject): HeroBannerItem {
        val typeStr = o.optString("type", "MOVIE")
        val contentType = when (typeStr) {
            "LIVE" -> ContentType.LIVE
            "SERIES" -> ContentType.SERIES
            else -> ContentType.MOVIE
        }

        val movieItem = if (o.has("movieItem")) jsonToMovie(o.getJSONObject("movieItem")) else null
        val seriesItem = if (o.has("seriesItem")) jsonToSeries(o.getJSONObject("seriesItem")) else null

        return HeroBannerItem(
            id = o.optString("id", ""),
            title = o.optString("title", ""),
            imageUrl = o.optString("imageUrl", ""),
            category = o.optString("category", "Filmes"),
            type = contentType,
            streamUrl = o.optString("streamUrl", ""),
            badgeInfo = o.optString("badgeInfo", "").takeIf { it.isNotBlank() },
            overview = o.optString("overview", "").takeIf { it.isNotBlank() },
            year = o.optString("year", "").takeIf { it.isNotBlank() },
            movieItem = movieItem,
            seriesItem = seriesItem
        )
    }
}
