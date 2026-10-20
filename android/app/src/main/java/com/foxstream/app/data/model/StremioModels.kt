package com.foxstream.app.data.model

import com.google.gson.annotations.SerializedName

/**
 * Stremio Add-on Protocol Data Models
 * Specifications compliant with Stremio v4 Addon Protocol:
 * - Manifest (/manifest.json)
 * - Catalog (/catalog/{type}/{id}.json)
 * - Meta (/meta/{type}/{id}.json)
 * - Stream (/stream/{type}/{id}.json)
 */

data class StremioManifest(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("name")
    val name: String = "Add-on",

    @SerializedName("version")
    val version: String? = null,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("types")
    val types: List<String> = emptyList(),

    @SerializedName("catalogs")
    val catalogs: List<StremioCatalogDefinition> = emptyList(),

    @SerializedName("resources")
    val resources: List<Any>? = null,

    @SerializedName("idPrefixes")
    val idPrefixes: List<String>? = null,

    @SerializedName("icon")
    val icon: String? = null,

    @SerializedName("background")
    val background: String? = null,

    @SerializedName("behaviorHints")
    val behaviorHints: Map<String, Any>? = null
)

data class StremioCatalogDefinition(
    @SerializedName("type")
    val type: String = "movie",

    @SerializedName("id")
    val id: String = "top",

    @SerializedName("name")
    val name: String? = null,

    @SerializedName("extra")
    val extra: List<StremioCatalogExtra>? = null
) {
    val displayName: String
        get() = name ?: when (type.lowercase()) {
            "movie" -> "Filmes"
            "series" -> "Séries"
            "channel", "tv" -> "Canais TV"
            else -> type.replaceFirstChar { it.uppercase() }
        }
}

data class StremioCatalogExtra(
    @SerializedName("name")
    val name: String = "",

    @SerializedName("isRequired")
    val isRequired: Boolean? = false,

    @SerializedName("options")
    val options: List<String>? = null
)

data class StremioCatalogResponse(
    @SerializedName("metas")
    val metas: List<StremioMetaItem>? = emptyList()
)

data class StremioMetaItem(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("type")
    val type: String = "movie",

    @SerializedName("name")
    val name: String = "",

    @SerializedName("poster")
    val poster: String? = null,

    @SerializedName("posterShape")
    val posterShape: String? = "regular",

    @SerializedName("background")
    val background: String? = null,

    @SerializedName("banner")
    val banner: String? = null,

    @SerializedName("logo")
    val logo: String? = null,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("releaseInfo")
    val releaseInfo: String? = null,

    @SerializedName("year")
    val year: String? = null,

    @SerializedName("imdbRating")
    val imdbRating: String? = null,

    @SerializedName("genres")
    val genres: List<String>? = null
) {
    val cleanYear: String?
        get() = releaseInfo?.take(4) ?: year?.take(4)

    val cleanRating: String?
        get() = imdbRating?.takeIf { it.isNotBlank() }

    val formattedGenre: String
        get() = genres?.joinToString(", ") ?: ""

    fun toMovieItem(playlistId: String = "stremio_catalog"): MovieItem = MovieItem(
        id = id,
        playlistId = playlistId,
        name = name,
        streamUrl = "", // Resolved dynamically on demand
        posterUrl = poster,
        category = genres?.firstOrNull() ?: "Filmes",
        year = cleanYear,
        genre = formattedGenre,
        rating = cleanRating?.let { "$it/10" },
        description = description,
        backdropUrl = background ?: banner
    )

    fun toSeriesItem(playlistId: String = "stremio_catalog"): SeriesItem = SeriesItem(
        id = id,
        playlistId = playlistId,
        name = name,
        posterUrl = poster,
        category = genres?.firstOrNull() ?: "Séries",
        year = cleanYear,
        genre = formattedGenre,
        rating = cleanRating?.let { "$it/10" },
        description = description,
        backdropUrl = background ?: banner
    )
}

data class StremioMetaResponse(
    @SerializedName("meta")
    val meta: StremioMetaDetail? = null
)

data class StremioMetaDetail(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("type")
    val type: String = "movie",

    @SerializedName("name")
    val name: String = "",

    @SerializedName("genres")
    val genres: List<String>? = null,

    @SerializedName("poster")
    val poster: String? = null,

    @SerializedName("background")
    val background: String? = null,

    @SerializedName("logo")
    val logo: String? = null,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("releaseInfo")
    val releaseInfo: String? = null,

    @SerializedName("imdbRating")
    val imdbRating: String? = null,

    @SerializedName("runtime")
    val runtime: String? = null,

    @SerializedName("cast")
    val cast: List<String>? = null,

    @SerializedName("director")
    val director: List<String>? = null,

    @SerializedName("videos")
    val videos: List<StremioVideo>? = null
)

data class StremioVideo(
    @SerializedName("id")
    val id: String = "",

    @SerializedName("title")
    val title: String? = null,

    @SerializedName("released")
    val released: String? = null,

    @SerializedName("season")
    val season: Int? = null,

    @SerializedName("episode")
    val episode: Int? = null,

    @SerializedName("thumbnail")
    val thumbnail: String? = null,

    @SerializedName("overview")
    val overview: String? = null
)

data class StremioStreamResponse(
    @SerializedName("streams")
    val streams: List<StremioStreamItem>? = emptyList()
)

data class StremioStreamItem(
    @SerializedName("name")
    val name: String? = null,

    @SerializedName("title")
    val title: String? = null,

    @SerializedName("url")
    val url: String? = null,

    @SerializedName("infoHash")
    val infoHash: String? = null,

    @SerializedName("fileIdx")
    val fileIdx: Int? = null,

    @SerializedName("behaviorHints")
    val behaviorHints: Map<String, Any>? = null
)
