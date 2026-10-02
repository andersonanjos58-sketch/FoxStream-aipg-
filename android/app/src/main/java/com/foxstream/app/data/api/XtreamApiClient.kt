package com.foxstream.app.data.api

import com.foxstream.app.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
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
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p"
            
            val responseText = executeGet(endpoint)
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
        }
    }

    suspend fun getLiveCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_live_categories"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<XtreamCategory>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("category_id", "")
                val name = obj.optString("category_name", "Geral")
                if (id.isNotEmpty()) {
                    list.add(XtreamCategory(id, name))
                }
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getLiveStreams(playlistId: String, categoriesMap: Map<String, String>): List<LiveChannel> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_live_streams"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<LiveChannel>()
            val seenIds = mutableSetOf<String>()

            for (i in 0 until array.length()) {
                val s = array.getJSONObject(i)
                val streamId = s.optString("stream_id", "")
                if (streamId.isEmpty() || seenIds.contains(streamId)) continue
                seenIds.add(streamId)

                val name = s.optString("name", s.optString("stream_display_name", "Canal sem nome"))
                val catId = s.optString("category_id", "")
                val categoryName = categoriesMap[catId] ?: "TV Geral"
                val logo = s.optString("stream_icon", "")
                val cleanUser = username.trim()
                val cleanPass = password.trim()
                val streamUrl = "$baseUrl/live/$cleanUser/$cleanPass/$streamId.ts"

                list.add(
                    LiveChannel(
                        id = "${playlistId}_live_$streamId",
                        playlistId = playlistId,
                        name = name,
                        streamUrl = streamUrl,
                        logoUrl = if (logo.isNotEmpty()) logo else null,
                        category = categoryName,
                        tvgId = if (s.has("epg_channel_id")) s.optString("epg_channel_id", null) else null
                    )
                )
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getVodCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_vod_categories"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<XtreamCategory>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("category_id", "")
                val name = obj.optString("category_name", "Filmes")
                if (id.isNotEmpty()) {
                    list.add(XtreamCategory(id, name))
                }
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getVodStreams(playlistId: String, categoriesMap: Map<String, String>): List<MovieItem> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_vod_streams"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<MovieItem>()
            val seenIds = mutableSetOf<String>()

            for (i in 0 until array.length()) {
                val v = array.getJSONObject(i)
                val streamId = v.optString("stream_id", "")
                if (streamId.isEmpty() || seenIds.contains(streamId)) continue
                seenIds.add(streamId)

                val name = v.optString("name", "Filme sem título")
                val catId = v.optString("category_id", "")
                val categoryName = categoriesMap[catId] ?: "Filmes"
                val poster = v.optString("stream_icon", "")
                val cleanUser = username.trim()
                val cleanPass = password.trim()
                val rawExt = v.optString("container_extension", "mp4").trim().removePrefix(".")
                val ext = if (rawExt.isEmpty() || rawExt.equals("null", ignoreCase = true)) "mp4" else rawExt
                val streamUrl = "$baseUrl/movie/$cleanUser/$cleanPass/$streamId.$ext"
                val rating = if (v.has("rating_5based")) {
                    "${v.optDouble("rating_5based", 0.0)}/5"
                } else if (v.has("rating") && !v.isNull("rating")) {
                    "${v.optString("rating")}/10"
                } else null

                list.add(
                    MovieItem(
                        id = "${playlistId}_vod_$streamId",
                        playlistId = playlistId,
                        name = name,
                        streamUrl = streamUrl,
                        posterUrl = if (poster.isNotEmpty()) poster else null,
                        category = categoryName,
                        rating = rating,
                        genre = categoryName,
                        year = if (v.has("year") && !v.isNull("year")) v.optString("year", null) else null
                    )
                )
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getSeriesCategories(): List<XtreamCategory> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_series_categories"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<XtreamCategory>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val id = obj.optString("category_id", "")
                val name = obj.optString("category_name", "Séries")
                if (id.isNotEmpty()) {
                    list.add(XtreamCategory(id, name))
                }
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getSeries(playlistId: String, categoriesMap: Map<String, String>): List<SeriesItem> = withContext(Dispatchers.IO) {
        try {
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_series"
            val responseText = executeGet(endpoint)
            val array = JSONArray(responseText)
            val list = mutableListOf<SeriesItem>()
            val seenIds = mutableSetOf<String>()

            for (i in 0 until array.length()) {
                val s = array.getJSONObject(i)
                val seriesId = s.optString("series_id", "")
                if (seriesId.isEmpty() || seenIds.contains(seriesId)) continue
                seenIds.add(seriesId)

                val name = s.optString("name", "Série sem título")
                val catId = s.optString("category_id", "")
                val categoryName = categoriesMap[catId] ?: "Séries"
                val poster = s.optString("cover", s.optString("stream_icon", ""))
                val rating = if (s.has("rating_5based")) {
                    "${s.optDouble("rating_5based", 0.0)}/5"
                } else if (s.has("rating") && !s.isNull("rating")) {
                    "${s.optString("rating")}/10"
                } else null

                list.add(
                    SeriesItem(
                        id = "${playlistId}_series_$seriesId",
                        playlistId = playlistId,
                        name = name,
                        posterUrl = if (poster.isNotEmpty()) poster else null,
                        category = categoryName,
                        rating = rating,
                        year = if (s.has("releaseDate") && !s.isNull("releaseDate")) {
                            val r = s.optString("releaseDate", "")
                            if (r.length >= 4) r.substring(0, 4) else null
                        } else null,
                        genre = s.optString("genre", categoryName),
                        description = if (s.has("plot") && !s.isNull("plot")) s.optString("plot", null) else null,
                        seasons = emptyList() // Details fetched on-demand
                    )
                )
            }
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getSeriesDetails(seriesId: String, seriesObjId: String): List<SeasonItem> = withContext(Dispatchers.IO) {
        try {
            val cleanId = seriesId.replace(Regex(".*_series_"), "")
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_series_info&series_id=$cleanId"
            val responseText = executeGet(endpoint)
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
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun getVodDetails(vodId: String): JSONObject? = withContext(Dispatchers.IO) {
        try {
            val cleanId = vodId.replace(Regex(".*_vod_"), "")
            val u = URLEncoder.encode(username, "UTF-8")
            val p = URLEncoder.encode(password, "UTF-8")
            val endpoint = "$baseUrl/player_api.php?username=$u&password=$p&action=get_vod_info&vod_id=$cleanId"
            val responseText = executeGet(endpoint)
            JSONObject(responseText)
        } catch (e: Exception) {
            null
        }
    }

    private fun executeGet(urlString: String): String {
        val url = URL(urlString)
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "GET"
        conn.connectTimeout = 15000
        conn.readTimeout = 15000
        conn.setRequestProperty("User-Agent", "FoxStream/1.0 (Android)")

        val reader = BufferedReader(InputStreamReader(conn.inputStream))
        val sb = StringBuilder()
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            sb.append(line)
        }
        reader.close()
        return sb.toString()
    }
}
