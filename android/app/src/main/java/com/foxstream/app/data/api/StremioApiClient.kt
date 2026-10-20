package com.foxstream.app.data.api

import android.util.Log
import com.foxstream.app.data.model.*
import com.foxstream.app.util.StreamSource
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Service interface definition for Stremio Add-on Protocol
 */
interface StremioApiService {
    suspend fun getManifest(addonBaseUrl: String): StremioManifest?
    suspend fun getCatalog(addonBaseUrl: String, type: String, catalogId: String, extraArgs: String? = null): List<StremioMetaItem>
    suspend fun getMeta(addonBaseUrl: String, type: String, id: String): StremioMetaDetail?
    suspend fun getStreams(addonBaseUrl: String, type: String, id: String): List<StreamSource>
    suspend fun parseDynamicJson(url: String): List<StreamSource>
}

/**
 * StremioApiClient: High-performance, zero-crash implementation of Stremio Protocol
 * and Flexible Dynamic JSON Parsing (par with FoxStream Web).
 */
object StremioApiClient : StremioApiService {

    private const val TAG = "StremioApiClient"
    private const val TIMEOUT_MS = 10000

    val gson: Gson = GsonBuilder()
        .setLenient()
        .create()

    /**
     * Sanitizes addon URL to base without trailing manifest.json or slashes
     */
    fun cleanAddonBaseUrl(rawUrl: String): String {
        return rawUrl.trim()
            .replace(Regex("""/manifest\.json$""", RegexOption.IGNORE_CASE), "")
            .trimEnd('/')
    }

    /**
     * Fetches and parses Stremio manifest.json
     */
    override suspend fun getManifest(addonBaseUrl: String): StremioManifest? = withContext(Dispatchers.IO) {
        try {
            val base = cleanAddonBaseUrl(addonBaseUrl)
            val manifestUrl = "$base/manifest.json"
            val jsonString = fetchRawHttp(manifestUrl) ?: return@withContext null
            gson.fromJson(jsonString, StremioManifest::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching manifest from $addonBaseUrl: ${e.message}", e)
            null
        }
    }

    /**
     * Fetches Stremio catalog items: /catalog/{type}/{id}.json or /catalog/{type}/{id}/{extraArgs}.json
     */
    override suspend fun getCatalog(
        addonBaseUrl: String,
        type: String,
        catalogId: String,
        extraArgs: String?
    ): List<StremioMetaItem> = withContext(Dispatchers.IO) {
        try {
            val base = cleanAddonBaseUrl(addonBaseUrl)
            val endpoint = if (!extraArgs.isNullOrBlank()) {
                "$base/catalog/$type/$catalogId/$extraArgs.json"
            } else {
                "$base/catalog/$type/$catalogId.json"
            }

            val jsonString = fetchRawHttp(endpoint) ?: return@withContext emptyList()
            val response = gson.fromJson(jsonString, StremioCatalogResponse::class.java)
            response.metas.orEmpty()
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching catalog from $addonBaseUrl ($type/$catalogId): ${e.message}", e)
            emptyList()
        }
    }

    /**
     * Fetches Stremio meta details: /meta/{type}/{id}.json
     */
    override suspend fun getMeta(
        addonBaseUrl: String,
        type: String,
        id: String
    ): StremioMetaDetail? = withContext(Dispatchers.IO) {
        try {
            val base = cleanAddonBaseUrl(addonBaseUrl)
            val endpoint = "$base/meta/$type/$id.json"
            val jsonString = fetchRawHttp(endpoint) ?: return@withContext null
            val response = gson.fromJson(jsonString, StremioMetaResponse::class.java)
            response.meta
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching meta $id: ${e.message}", e)
            null
        }
    }

    /**
     * Fetches Stremio streams for a movie or series episode: /stream/{type}/{id}.json
     */
    override suspend fun getStreams(
        addonBaseUrl: String,
        type: String,
        id: String
    ): List<StreamSource> = withContext(Dispatchers.IO) {
        try {
            val base = cleanAddonBaseUrl(addonBaseUrl)
            val endpoint = "$base/stream/$type/$id.json"
            val jsonString = fetchRawHttp(endpoint) ?: return@withContext emptyList()
            val response = gson.fromJson(jsonString, StremioStreamResponse::class.java)

            val streams = mutableListOf<StreamSource>()
            response.streams?.forEachIndexed { idx, s ->
                val finalUrl = when {
                    !s.url.isNullOrBlank() -> s.url
                    !s.infoHash.isNullOrBlank() -> "magnet:?xt=urn:btih:${s.infoHash}"
                    else -> ""
                }

                if (finalUrl.isNotBlank()) {
                    val rawTitle = s.title ?: s.name ?: "Stream $idx"
                    val quality = when {
                        rawTitle.contains("4k", ignoreCase = true) || rawTitle.contains("2160p", ignoreCase = true) -> "4K"
                        rawTitle.contains("1080p", ignoreCase = true) -> "1080p"
                        rawTitle.contains("720p", ignoreCase = true) -> "720p"
                        else -> "HD"
                    }

                    streams.add(
                        StreamSource(
                            id = "stremio_${id}_$idx",
                            title = rawTitle,
                            type = type,
                            streamUrl = finalUrl,
                            quality = quality,
                            format = if (finalUrl.startsWith("magnet:")) "magnet" else "mp4",
                            name = s.name ?: "Stremio Stream",
                            details = s.title
                        )
                    )
                }
            }
            streams
        } catch (e: Exception) {
            Log.e(TAG, "Error fetching streams for $id: ${e.message}", e)
            emptyList()
        }
    }

    /**
     * Flexible Dynamic JSON Parser (Complete Android port of parseFlexibleJsonManifest).
     * Parses arbitrary JSON formats:
     * - Direct Array: [ { ... } ]
     * - Nested arrays in keys: streams, items, channels, movies, series, vod, playlist, data, catalogs
     * - Stremio Manifest objects
     * - Key-value dictionaries: { "id1": { ... }, "id2": { ... } }
     */
    override suspend fun parseDynamicJson(url: String): List<StreamSource> = withContext(Dispatchers.IO) {
        try {
            val jsonString = fetchRawHttp(url) ?: return@withContext emptyList()
            parseFlexibleJsonString(jsonString)
        } catch (e: Exception) {
            Log.e(TAG, "Error downloading and parsing dynamic JSON from $url: ${e.message}", e)
            emptyList()
        }
    }

    fun parseFlexibleJsonString(jsonString: String): List<StreamSource> {
        val list = mutableListOf<StreamSource>()
        try {
            val rootElement = gson.fromJson(jsonString, JsonElement::class.java) ?: return emptyList()

            val rawItems = mutableListOf<JsonObject>()

            if (rootElement.isJsonArray) {
                rootElement.asJsonArray.forEach { elem ->
                    if (elem.isJsonObject) rawItems.add(elem.asJsonObject)
                }
            } else if (rootElement.isJsonObject) {
                val rootObj = rootElement.asJsonObject

                val candidateKeys = listOf(
                    "streams", "items", "channels", "movies", "series",
                    "vod", "playlist", "data", "catalogs", "resources"
                )

                var matchedKey = false
                for (key in candidateKeys) {
                    if (rootObj.has(key) && rootObj.get(key).isJsonArray) {
                        rootObj.getAsJsonArray(key).forEach { elem ->
                            if (elem.isJsonObject) rawItems.add(elem.asJsonObject)
                        }
                        matchedKey = true
                    }
                }

                // Check manifest nested keys
                if (rootObj.has("manifest") && rootObj.get("manifest").isJsonObject) {
                    val manifestObj = rootObj.getAsJsonObject("manifest")
                    for (key in listOf("streams", "catalogs")) {
                        if (manifestObj.has(key) && manifestObj.get(key).isJsonArray) {
                            manifestObj.getAsJsonArray(key).forEach { elem ->
                                if (elem.isJsonObject) rawItems.add(elem.asJsonObject)
                            }
                            matchedKey = true
                        }
                    }
                }

                // Fallback: Dictionary where keys are item IDs: { "id1": { "url": "..." } }
                if (!matchedKey) {
                    for ((_, value) in rootObj.entrySet()) {
                        if (value.isJsonObject) {
                            rawItems.add(value.asJsonObject)
                        } else if (value.isJsonArray) {
                            value.asJsonArray.forEach { elem ->
                                if (elem.isJsonObject) rawItems.add(elem.asJsonObject)
                            }
                        }
                    }
                }
            }

            // Map and normalize each entry into StreamSource
            rawItems.forEachIndexed { index, item ->
                val streamUrl = optString(item, "streamUrl", "url", "file", "link", "src", "stream", "playbackUrl")
                val title = optString(item, "title", "name", "label", "caption", "display_name")
                    .ifBlank { "Mídia ${index + 1}" }
                val tmdbId = optString(item, "tmdb_id", "tmdbId", "id", "imdb_id", "imdbId").takeIf { it.isNotBlank() }
                val rawType = optString(item, "type", "category").lowercase()
                val type = when {
                    rawType == "series" || rawType == "tv" || item.has("seasonNum") || item.has("episodeNum") -> "series"
                    rawType == "live" || rawType == "channel" -> "live"
                    else -> "movie"
                }
                val quality = optString(item, "quality", "res").ifBlank { "1080p" }
                val year = optInt(item, "year")

                if (streamUrl.isNotBlank() || tmdbId != null) {
                    list.add(
                        StreamSource(
                            id = optString(item, "id").ifBlank { "json_stream_${index}" },
                            tmdbId = tmdbId,
                            title = title,
                            year = year,
                            type = type,
                            streamUrl = streamUrl,
                            quality = quality,
                            format = optString(item, "format").ifBlank { "mp4" },
                            name = optString(item, "name", "provider").ifBlank { "Custom JSON" },
                            details = title
                        )
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in parseFlexibleJsonString: ${e.message}", e)
        }
        return list
    }

    private fun optString(obj: JsonObject, vararg keys: String): String {
        for (k in keys) {
            if (obj.has(k) && !obj.get(k).isJsonNull) {
                val elem = obj.get(k)
                if (elem.isJsonPrimitive) {
                    val str = elem.asString.trim()
                    if (str.isNotBlank() && str != "null") return str
                }
            }
        }
        return ""
    }

    private fun optInt(obj: JsonObject, vararg keys: String): Int? {
        for (k in keys) {
            if (obj.has(k) && !obj.get(k).isJsonNull) {
                val elem = obj.get(k)
                if (elem.isJsonPrimitive) {
                    try {
                        return elem.asInt
                    } catch (_: Exception) {
                        val str = elem.asString.trim()
                        val parsed = str.toIntOrNull()
                        if (parsed != null) return parsed
                    }
                }
            }
        }
        return null
    }

    /**
     * Reliable HTTP GET with timeout, headers and UTF-8 stream reading
     */
    private fun fetchRawHttp(urlString: String): String? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlString)
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android Native; StremioProtocol)")
            conn.setRequestProperty("Accept", "application/json, text/plain, */*")

            if (conn.responseCode in 200..299) {
                val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
                val sb = StringBuilder()
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    sb.append(line).append('\n')
                }
                reader.close()
                sb.toString()
            } else {
                Log.w(TAG, "HTTP error ${conn.responseCode} for $urlString")
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Network failure fetching $urlString: ${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }
}
