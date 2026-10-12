package com.foxstream.app.data.api

import com.foxstream.app.data.model.*
import com.google.gson.stream.JsonReader
import com.google.gson.stream.JsonToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class XtreamAuthResult(
    val success: Boolean,
    val message: String,
    val status: String? = null
)

data class XtreamCategory(
    val id: String,
    val name: String
)

class XtreamApiClient(
    serverUrl: String,
    private val username: String,
    private val password: String
) {
    val baseUrl: String = normalizeUrl(serverUrl)

    private fun normalizeUrl(url: String): String {
        var clean = url.trim()
        if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
            clean = "http://$clean"
        }
        return clean.trimEnd('/')
    }

    suspend fun testConnection(): XtreamAuthResult = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p"
            
            conn = openConnection(endpoint)
            val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream ?: conn.inputStream
            val responseText = stream.bufferedReader().use { it.readText() }
            val json = JSONObject(responseText)
            if (json.has("user_info")) {
                val userInfo = json.getJSONObject("user_info")
                val auth = userInfo.optInt("auth", 0)
                val status = userInfo.optString("status", "Unknown")

                if (auth == 1 || status.equals("Active", ignoreCase = true)) {
                    return@withContext XtreamAuthResult(
                        success = true,
                        message = "Conexão realizada com sucesso",
                        status = status
                    )
                } else {
                    return@withContext XtreamAuthResult(
                        success = false,
                        message = "Conta recusada pelo servidor. Status: $status",
                        status = status
                    )
                }
            }

            XtreamAuthResult(
                success = false,
                message = "Resposta recebida, mas autenticação falhou."
            )
        } catch (e: Exception) {
            XtreamAuthResult(
                success = false,
                message = "Não foi possível conectar: ${e.localizedMessage ?: "Erro de rede"}"
            )
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getLiveCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        parseCategories("get_live_categories", "Geral")
    }

    suspend fun getVodCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        parseCategories("get_vod_categories", "Filmes")
    }

    suspend fun getSeriesCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        parseCategories("get_series_categories", "Séries")
    }

    private fun parseCategories(action: String, defaultName: String): List<XtreamCategory> {
        var conn: HttpURLConnection? = null
        try {
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=$action"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return emptyList()

            val list = mutableListOf<XtreamCategory>()
            val reader = JsonReader(InputStreamReader(conn.inputStream, "UTF-8"))
            reader.isLenient = true
            if (reader.peek() == JsonToken.BEGIN_ARRAY) {
                reader.beginArray()
                while (reader.hasNext() && reader.peek() == JsonToken.BEGIN_OBJECT) {
                    reader.beginObject()
                    var id = ""
                    var name = defaultName
                    while (reader.hasNext()) {
                        when (reader.nextName()) {
                            "category_id" -> id = readString(reader)
                            "category_name" -> name = readString(reader).ifBlank { defaultName }
                            else -> reader.skipValue()
                        }
                    }
                    reader.endObject()
                    if (id.isNotEmpty()) {
                        list.add(XtreamCategory(id, name))
                    }
                }
                reader.endArray()
            }
            reader.close()
            return list
        } catch (_: Exception) {
            return emptyList()
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getLiveStreams(playlistId: String, categoriesMap: Map<String, String>): List<LiveChannel> = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_live_streams"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return@withContext emptyList()

            val list = mutableListOf<LiveChannel>()
            val seenIds = mutableSetOf<String>()
            val cleanUser = username.trim()
            val cleanPass = password.trim()

            val reader = JsonReader(InputStreamReader(conn.inputStream, "UTF-8"))
            reader.isLenient = true
            if (reader.peek() == JsonToken.BEGIN_ARRAY) {
                reader.beginArray()
                while (reader.hasNext() && reader.peek() == JsonToken.BEGIN_OBJECT) {
                    reader.beginObject()
                    var streamId = ""
                    var name = "Canal sem nome"
                    var catId = ""
                    var logo: String? = null
                    var tvgId: String? = null

                    while (reader.hasNext()) {
                        when (reader.nextName()) {
                            "stream_id" -> streamId = readString(reader)
                            "name" -> {
                                val n = readString(reader)
                                if (n.isNotBlank()) name = n
                            }
                            "stream_display_name" -> {
                                val dn = readString(reader)
                                if (name == "Canal sem nome" && dn.isNotBlank()) name = dn
                            }
                            "category_id" -> catId = readString(reader)
                            "stream_icon" -> {
                                val ic = readString(reader)
                                if (ic.isNotBlank()) logo = ic
                            }
                            "epg_channel_id" -> {
                                val epg = readString(reader)
                                if (epg.isNotBlank()) tvgId = epg
                            }
                            else -> reader.skipValue()
                        }
                    }
                    reader.endObject()

                    if (streamId.isNotEmpty() && !seenIds.contains(streamId)) {
                        seenIds.add(streamId)
                        val categoryName = categoriesMap[catId] ?: "TV Geral"
                        val streamUrl = "$baseUrl/live/$cleanUser/$cleanPass/$streamId.ts"
                        list.add(
                            LiveChannel(
                                id = "${playlistId}_live_$streamId",
                                playlistId = playlistId,
                                name = name,
                                streamUrl = streamUrl,
                                logoUrl = logo,
                                category = categoryName,
                                tvgId = tvgId
                            )
                        )
                    }
                }
                reader.endArray()
            }
            reader.close()
            list
        } catch (_: Exception) {
            emptyList()
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getVodStreams(playlistId: String, categoriesMap: Map<String, String>): List<MovieItem> = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_vod_streams"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return@withContext emptyList()

            val list = mutableListOf<MovieItem>()
            val seenIds = mutableSetOf<String>()
            val cleanUser = username.trim()
            val cleanPass = password.trim()

            val reader = JsonReader(InputStreamReader(conn.inputStream, "UTF-8"))
            reader.isLenient = true
            if (reader.peek() == JsonToken.BEGIN_ARRAY) {
                reader.beginArray()
                while (reader.hasNext() && reader.peek() == JsonToken.BEGIN_OBJECT) {
                    reader.beginObject()
                    var streamId = ""
                    var name = "Filme sem título"
                    var catId = ""
                    var poster: String? = null
                    var rawExt = "mp4"
                    var rating: String? = null
                    var year: String? = null

                    while (reader.hasNext()) {
                        when (reader.nextName()) {
                            "stream_id" -> streamId = readString(reader)
                            "name" -> {
                                val n = readString(reader)
                                if (n.isNotBlank()) name = n
                            }
                            "category_id" -> catId = readString(reader)
                            "stream_icon" -> {
                                val ic = readString(reader)
                                if (ic.isNotBlank()) poster = ic
                            }
                            "container_extension" -> {
                                val ce = readString(reader).removePrefix(".")
                                if (ce.isNotBlank() && !ce.equals("null", ignoreCase = true)) rawExt = ce
                            }
                            "rating_5based" -> {
                                val r = readString(reader)
                                if (r.isNotBlank()) rating = "$r/5"
                            }
                            "rating" -> {
                                if (rating == null) {
                                    val r = readString(reader)
                                    if (r.isNotBlank() && !r.equals("null", ignoreCase = true)) rating = "$r/10"
                                } else {
                                    reader.skipValue()
                                }
                            }
                            "year" -> {
                                val y = readString(reader)
                                if (y.isNotBlank() && !y.equals("null", ignoreCase = true)) year = y
                            }
                            else -> reader.skipValue()
                        }
                    }
                    reader.endObject()

                    if (streamId.isNotEmpty() && !seenIds.contains(streamId)) {
                        seenIds.add(streamId)
                        val categoryName = categoriesMap[catId] ?: "Filmes"
                        val streamUrl = "$baseUrl/movie/$cleanUser/$cleanPass/$streamId.$rawExt"
                        list.add(
                            MovieItem(
                                id = "${playlistId}_vod_$streamId",
                                playlistId = playlistId,
                                name = name,
                                streamUrl = streamUrl,
                                posterUrl = poster,
                                category = categoryName,
                                rating = rating,
                                genre = categoryName,
                                year = year
                            )
                        )
                    }
                }
                reader.endArray()
            }
            reader.close()
            list
        } catch (_: Exception) {
            emptyList()
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getSeries(playlistId: String, categoriesMap: Map<String, String>): List<SeriesItem> = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_series"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return@withContext emptyList()

            val list = mutableListOf<SeriesItem>()
            val seenIds = mutableSetOf<String>()

            val reader = JsonReader(InputStreamReader(conn.inputStream, "UTF-8"))
            reader.isLenient = true
            if (reader.peek() == JsonToken.BEGIN_ARRAY) {
                reader.beginArray()
                while (reader.hasNext() && reader.peek() == JsonToken.BEGIN_OBJECT) {
                    reader.beginObject()
                    var seriesId = ""
                    var name = "Série sem título"
                    var catId = ""
                    var poster: String? = null
                    var rating: String? = null
                    var year: String? = null
                    var genre: String? = null
                    var description: String? = null

                    while (reader.hasNext()) {
                        when (reader.nextName()) {
                            "series_id" -> seriesId = readString(reader)
                            "name" -> {
                                val n = readString(reader)
                                if (n.isNotBlank()) name = n
                            }
                            "category_id" -> catId = readString(reader)
                            "cover" -> {
                                val c = readString(reader)
                                if (c.isNotBlank()) poster = c
                            }
                            "stream_icon" -> {
                                if (poster == null) {
                                    val ic = readString(reader)
                                    if (ic.isNotBlank()) poster = ic
                                } else {
                                    reader.skipValue()
                                }
                            }
                            "rating_5based" -> {
                                val r = readString(reader)
                                if (r.isNotBlank()) rating = "$r/5"
                            }
                            "rating" -> {
                                if (rating == null) {
                                    val r = readString(reader)
                                    if (r.isNotBlank() && !r.equals("null", ignoreCase = true)) rating = "$r/10"
                                } else {
                                    reader.skipValue()
                                }
                            }
                            "releaseDate" -> {
                                val r = readString(reader)
                                if (r.length >= 4) year = r.substring(0, 4)
                            }
                            "genre" -> {
                                val g = readString(reader)
                                if (g.isNotBlank()) genre = g
                            }
                            "plot" -> {
                                val pl = readString(reader)
                                if (pl.isNotBlank() && !pl.equals("null", ignoreCase = true)) description = pl
                            }
                            else -> reader.skipValue()
                        }
                    }
                    reader.endObject()

                    if (seriesId.isNotEmpty() && !seenIds.contains(seriesId)) {
                        seenIds.add(seriesId)
                        val categoryName = categoriesMap[catId] ?: "Séries"
                        list.add(
                            SeriesItem(
                                id = "${playlistId}_series_$seriesId",
                                playlistId = playlistId,
                                name = name,
                                posterUrl = poster,
                                category = categoryName,
                                rating = rating,
                                year = year,
                                genre = genre ?: categoryName,
                                description = description,
                                seasons = emptyList()
                            )
                        )
                    }
                }
                reader.endArray()
            }
            reader.close()
            list
        } catch (_: Exception) {
            emptyList()
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getSeriesDetails(seriesId: String, seriesObjId: String): List<SeasonItem> = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val cleanId = seriesId.replace(Regex(".*_series_"), "")
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_series_info&series_id=$cleanId"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return@withContext emptyList()

            val responseText = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(responseText)

            if (json.has("episodes")) {
                val seasonsMap = mutableMapOf<Int, MutableList<EpisodeItem>>()
                val epsContainer = json.getJSONObject("episodes")
                val keys = epsContainer.keys()

                while (keys.hasNext()) {
                    val seasonKey = keys.next()
                    val seasonNum = seasonKey.toIntOrNull() ?: 1
                    val epList = seasonsMap.getOrPut(seasonNum) { mutableListOf() }
                    val array = epsContainer.getJSONArray(seasonKey)

                    for (i in 0 until array.length()) {
                        val epObj = array.getJSONObject(i)
                        val epId = epObj.optString("id", "")
                        val epNum = epObj.optString("episode_num", "1").toIntOrNull() ?: 1
                        val cleanUser = username.trim()
                        val cleanPass = password.trim()
                        val rawExt = epObj.optString("container_extension", "mp4").trim().removePrefix(".")
                        val ext = if (rawExt.isEmpty() || rawExt.equals("null", ignoreCase = true)) "mp4" else rawExt
                        val epStreamUrl = "$baseUrl/series/$cleanUser/$cleanPass/$epId.$ext"
                        
                        var duration: String? = null
                        var overview: String? = null
                        if (epObj.has("info")) {
                            val info = epObj.getJSONObject("info")
                            val durationSecs = info.optInt("duration_secs", 0)
                            if (durationSecs > 0) {
                                duration = "${Math.round(durationSecs.toFloat() / 60)} min"
                            }
                            overview = info.optString("plot", null)
                        }

                        epList.add(
                            EpisodeItem(
                                id = "${seriesObjId}_ep_$epId",
                                seriesId = seriesObjId,
                                title = epObj.optString("title", "Episódio $epNum"),
                                seasonNum = seasonNum,
                                episodeNum = epNum,
                                streamUrl = epStreamUrl,
                                duration = duration,
                                overview = overview
                            )
                        )
                    }
                }
                return@withContext seasonsMap.entries.sortedBy { it.key }.map { entry ->
                    SeasonItem(
                        seasonNum = entry.key,
                        name = "Temporada ${entry.key}",
                        episodes = entry.value.sortedBy { it.episodeNum }
                    )
                }
            }
            emptyList()
        } catch (_: Exception) {
            emptyList()
        } finally {
            conn?.disconnect()
        }
    }

    suspend fun getVodDetails(vodId: String): JSONObject? = withContext(Dispatchers.IO) {
        var conn: HttpURLConnection? = null
        try {
            val cleanId = vodId.replace(Regex(".*_vod_"), "")
            val u = URLEncoder.encode(username.trim(), "UTF-8")
            val p = URLEncoder.encode(password.trim(), "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_vod_info&vod_id=$cleanId"
            conn = openConnection(endpoint)
            if (conn.responseCode !in 200..299) return@withContext null

            val responseText = conn.inputStream.bufferedReader().use { it.readText() }
            JSONObject(responseText)
        } catch (_: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }

    private fun openConnection(urlString: String): HttpURLConnection {
        val url = URL(urlString)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 30000
        conn.readTimeout = 30000
        conn.instanceFollowRedirects = true
        conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")
        conn.setRequestProperty("Accept", "*/*")
        return conn
    }

    private fun readString(reader: JsonReader): String {
        return when (reader.peek()) {
            JsonToken.STRING -> reader.nextString().trim()
            JsonToken.NUMBER -> reader.nextString().trim()
            JsonToken.BOOLEAN -> reader.nextBoolean().toString()
            JsonToken.NULL -> {
                reader.nextNull()
                ""
            }
            else -> {
                reader.skipValue()
                ""
            }
        }
    }
}
