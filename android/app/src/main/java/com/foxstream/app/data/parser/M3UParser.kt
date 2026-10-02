package com.foxstream.app.data.parser

import com.foxstream.app.data.model.EpisodeItem
import com.foxstream.app.data.model.LiveChannel
import com.foxstream.app.data.model.MovieItem
import com.foxstream.app.data.model.SeasonItem
import com.foxstream.app.data.model.SeriesItem
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.util.UUID
import java.util.regex.Pattern

data class M3UParseResult(
    val channels: List<LiveChannel>,
    val movies: List<MovieItem>,
    val series: List<SeriesItem>
)

object M3UParser {

    private val SERIES_PATTERN = Pattern.compile(
        """(?:^|[\s._\[\]-])(?:s|season|temp|temporada)\s*0*([0-9]{1,3})\s*[\s._\[\]-]*(?:e|ep|episode|episodio|cap|capitulo)\s*0*([0-9]{1,4})(?:[\s._\[\]-]|$)""",
        Pattern.CASE_INSENSITIVE
    )

    private val ALT_SERIES_PATTERN = Pattern.compile(
        """(?:^|[\s._\[\]-])0*([0-9]{1,3})\s*x\s*0*([0-9]{1,4})(?:[\s._\[\]-]|$)""",
        Pattern.CASE_INSENSITIVE
    )

    private val MOVIE_KEYWORDS = listOf("filme", "filmes", "movie", "movies", "vod", "cinema", "lancamento", "lançamento")
    private val SERIES_KEYWORDS = listOf("serie", "série", "series", "novela", "novelas", "temporada", "season", "anime")

    fun parse(inputStream: InputStream, playlistId: String): M3UParseResult {
        val reader = BufferedReader(InputStreamReader(inputStream))
        val channels = mutableListOf<LiveChannel>()
        val movies = mutableListOf<MovieItem>()
        val seriesMap = mutableMapOf<String, SeriesBuilder>()

        var currentExtInf: ExtInfData? = null
        val seenUrls = mutableSetOf<String>()

        reader.forEachLine { rawLine ->
            val line = rawLine.trim()
            if (line.isEmpty() || line.startsWith("#EXTM3U")) {
                return@forEachLine
            }

            if (line.startsWith("#EXTINF:")) {
                currentExtInf = parseExtInf(line)
                return@forEachLine
            }

            if (line.startsWith("#")) {
                return@forEachLine
            }

            var streamUrl = line.trim()
            if ((streamUrl.startsWith("\"") && streamUrl.endsWith("\"")) || (streamUrl.startsWith("'") && streamUrl.endsWith("'"))) {
                streamUrl = streamUrl.substring(1, streamUrl.length - 1).trim()
            }
            if (streamUrl.contains("|")) {
                streamUrl = streamUrl.substringBefore("|").trim()
            }
            if (streamUrl.isEmpty()) {
                currentExtInf = null
                return@forEachLine
            }
            if (seenUrls.contains(streamUrl)) {
                currentExtInf = null
                return@forEachLine
            }
            seenUrls.add(streamUrl)

            val name = currentExtInf?.name ?: "Sem Nome"
            val category = currentExtInf?.groupTitle ?: "Geral"
            val logoUrl = currentExtInf?.tvgLogo

            val categoryLower = category.lowercase()
            val nameLower = name.lowercase()
            val urlLower = streamUrl.lowercase()

            val seriesMatcher = SERIES_PATTERN.matcher(name)
            val altSeriesMatcher = ALT_SERIES_PATTERN.matcher(name)

            val isSeriesMatch = seriesMatcher.find() || altSeriesMatcher.find()
            val isSeriesGroup = SERIES_KEYWORDS.any { categoryLower.contains(it) } && !categoryLower.contains("ao vivo")
            val isMovieGroup = MOVIE_KEYWORDS.any { categoryLower.contains(it) } && !categoryLower.contains("ao vivo")

            if (isSeriesMatch || (isSeriesGroup && urlLower.contains("/series/"))) {
                // Group as Series
                val (seriesName, seasonNum, epNum) = extractSeriesMetadata(name)
                val builder = seriesMap.getOrPut(seriesName.lowercase()) {
                    SeriesBuilder(
                        id = "${playlistId}_series_${UUID.randomUUID()}",
                        name = seriesName,
                        posterUrl = logoUrl,
                        category = category
                    )
                }

                builder.addEpisode(
                    EpisodeItem(
                        id = UUID.randomUUID().toString(),
                        seriesId = builder.id,
                        title = "Episódio $epNum",
                        seasonNum = seasonNum,
                        episodeNum = epNum,
                        streamUrl = streamUrl
                    )
                )
            } else if (isMovieGroup || urlLower.contains("/movie/") || urlLower.endsWith(".mp4") || urlLower.endsWith(".mkv")) {
                movies.add(
                    MovieItem(
                        id = UUID.randomUUID().toString(),
                        playlistId = playlistId,
                        name = cleanName(name),
                        streamUrl = streamUrl,
                        posterUrl = logoUrl,
                        category = category
                    )
                )
            } else {
                channels.add(
                    LiveChannel(
                        id = UUID.randomUUID().toString(),
                        playlistId = playlistId,
                        name = cleanName(name),
                        streamUrl = streamUrl,
                        logoUrl = logoUrl,
                        category = category,
                        tvgId = currentExtInf?.tvgId
                    )
                )
            }

            currentExtInf = null
        }

        val finalizedSeries = seriesMap.values.map { it.build(playlistId) }

        return M3UParseResult(
            channels = channels,
            movies = movies,
            series = finalizedSeries
        )
    }

    private fun parseExtInf(line: String): ExtInfData {
        val commaIndex = line.lastIndexOf(',')
        val name = if (commaIndex != -1) line.substring(commaIndex + 1).trim() else "Sem Nome"
        val attrs = if (commaIndex != -1) line.substring(8, commaIndex) else line.substring(8)

        val tvgId = extractAttr(attrs, "tvg-id")
        val tvgLogo = extractAttr(attrs, "tvg-logo") ?: extractAttr(attrs, "logo")
        val groupTitle = extractAttr(attrs, "group-title") ?: extractAttr(attrs, "group")

        return ExtInfData(name, tvgId, tvgLogo, groupTitle)
    }

    private fun extractAttr(attrs: String, key: String): String? {
        val pattern = Pattern.compile("""$key=["']([^"']*)["']""", Pattern.CASE_INSENSITIVE)
        val matcher = pattern.matcher(attrs)
        return if (matcher.find()) matcher.group(1)?.trim() else null
    }

    private fun extractSeriesMetadata(name: String): Triple<String, Int, Int> {
        val seriesMatcher = SERIES_PATTERN.matcher(name)
        if (seriesMatcher.find()) {
            val s = seriesMatcher.group(1)?.toIntOrNull() ?: 1
            val e = seriesMatcher.group(2)?.toIntOrNull() ?: 1
            val rawName = name.substring(0, seriesMatcher.start()).trim()
            val cleanName = cleanName(if (rawName.isEmpty()) name else rawName)
            return Triple(cleanName, s, e)
        }
        val altMatcher = ALT_SERIES_PATTERN.matcher(name)
        if (altMatcher.find()) {
            val s = altMatcher.group(1)?.toIntOrNull() ?: 1
            val e = altMatcher.group(2)?.toIntOrNull() ?: 1
            val rawName = name.substring(0, altMatcher.start()).trim()
            val cleanName = cleanName(if (rawName.isEmpty()) name else rawName)
            return Triple(cleanName, s, e)
        }
        return Triple(cleanName(name), 1, 1)
    }

    private fun cleanName(raw: String): String {
        return raw.replace(Regex("""(?i)\b(4k|fhd|hd|sd|dual|dublado|legendado)\b"""), "").trim()
    }

    private data class ExtInfData(
        val name: String,
        val tvgId: String?,
        val tvgLogo: String?,
        val groupTitle: String?
    )

    private class SeriesBuilder(
        val id: String,
        val name: String,
        val posterUrl: String?,
        val category: String
    ) {
        val seasonsMap = mutableMapOf<Int, MutableList<EpisodeItem>>()

        fun addEpisode(ep: EpisodeItem) {
            val list = seasonsMap.getOrPut(ep.seasonNum) { mutableListOf() }
            list.add(ep)
        }

        fun build(playlistId: String): SeriesItem {
            val seasons = seasonsMap.entries.sortedBy { it.key }.map { entry ->
                SeasonItem(
                    seasonNum = entry.key,
                    name = "Temporada ${entry.key}",
                    episodes = entry.value.sortedBy { it.episodeNum }
                )
            }
            return SeriesItem(
                id = id,
                playlistId = playlistId,
                name = name,
                posterUrl = posterUrl,
                category = category,
                seasons = seasons
            )
        }
    }
}
