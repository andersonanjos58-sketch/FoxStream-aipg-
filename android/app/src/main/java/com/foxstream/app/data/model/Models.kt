package com.foxstream.app.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

enum class PlaylistType {
    M3U,
    XTREAM
}

enum class ContentType {
    LIVE,
    MOVIE,
    SERIES
}

@Entity(tableName = "playlists")
data class Playlist(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val type: PlaylistType,
    val url: String? = null,
    val serverUrl: String? = null,
    val username: String? = null,
    val password: String? = null,
    val lastUpdated: Long = System.currentTimeMillis(),
    val liveCount: Int = 0,
    val movieCount: Int = 0,
    val seriesCount: Int = 0
)

@Entity(tableName = "live_channels")
data class LiveChannel(
    @PrimaryKey val id: String,
    val playlistId: String,
    val name: String,
    val streamUrl: String,
    val logoUrl: String? = null,
    val category: String = "Geral",
    val tvgId: String? = null,
    val isFavorite: Boolean = false
)

@Entity(tableName = "movies")
data class MovieItem(
    @PrimaryKey val id: String,
    val playlistId: String,
    val name: String,
    val streamUrl: String,
    val posterUrl: String? = null,
    val category: String = "Filmes",
    val year: String? = null,
    val genre: String? = null,
    val rating: String? = null,
    val description: String? = null,
    val isFavorite: Boolean = false,
    val backdropUrl: String? = null,
    val duration: String? = null,
    val director: String? = null,
    val cast: String? = null
)

data class EpisodeItem(
    val id: String,
    val seriesId: String,
    val title: String,
    val seasonNum: Int,
    val episodeNum: Int,
    val streamUrl: String,
    val duration: String? = null,
    val overview: String? = null,
    val isFavorite: Boolean = false
)

data class SeasonItem(
    val seasonNum: Int,
    val name: String,
    val episodes: List<EpisodeItem>
)

@Entity(tableName = "series")
data class SeriesItem(
    @PrimaryKey val id: String,
    val playlistId: String,
    val name: String,
    val posterUrl: String? = null,
    val category: String = "Séries",
    val year: String? = null,
    val genre: String? = null,
    val rating: String? = null,
    val description: String? = null,
    val seasons: List<SeasonItem> = emptyList(),
    val isFavorite: Boolean = false,
    val backdropUrl: String? = null,
    val cast: String? = null,
    val rated: String? = null
)

@Entity(tableName = "favorites")
data class FavoriteItem(
    @PrimaryKey val id: String,
    val contentId: String,
    val type: ContentType,
    val title: String,
    val category: String,
    val streamUrl: String?,
    val posterUrl: String?
)

@Entity(tableName = "history")
data class HistoryItem(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val contentId: String,
    val title: String,
    val type: ContentType,
    val streamUrl: String,
    val posterUrl: String? = null,
    val category: String? = null,
    val seriesName: String? = null,
    val seasonEpisode: String? = null,
    val playedAt: Long = System.currentTimeMillis(),
    val playbackPosition: Long = 0L,
    val duration: Long = 0L,
    val isWatched: Boolean = false
) {
    @get:androidx.room.Ignore
    val lastPositionMs: Long get() = playbackPosition

    @get:androidx.room.Ignore
    val totalDurationMs: Long get() = duration
}

data class HeroBannerItem(
    val id: String,
    val title: String,
    val imageUrl: String,
    val category: String,
    val type: ContentType,
    val streamUrl: String,
    val badgeInfo: String? = null,
    val overview: String? = null,
    val year: String? = null,
    val seriesItem: SeriesItem? = null,
    val movieItem: MovieItem? = null
)

@Entity(
    tableName = "tmdb_match_cache",
    primaryKeys = ["playlistId", "localId", "categoryType"]
)
data class TmdbMatchCache(
    val playlistId: String,
    val localId: String,
    val categoryType: String, // HERO_BANNER, TRENDING, POPULAR_MOVIES, POPULAR_SERIES, NOW_PLAYING
    val tmdbId: Int? = null,
    val title: String,
    val posterUrl: String? = null,
    val backdropUrl: String? = null,
    val rating: String? = null,
    val overview: String? = null,
    val year: String? = null,
    val genre: String? = null,
    val streamUrl: String = "",
    val badgeInfo: String? = null,
    val contentType: ContentType = ContentType.MOVIE,
    val extraJson: String? = null,
    val matchScore: Int = 100,
    val updatedAt: Long = System.currentTimeMillis()
)

data class CategoryCarouselItem(
    val title: String,
    val type: ContentType,
    val movies: List<MovieItem> = emptyList(),
    val series: List<SeriesItem> = emptyList(),
    val channels: List<LiveChannel> = emptyList()
)

data class EpgProgram(
    val id: String,
    val channelId: String,
    val title: String,
    val startTime: String,
    val endTime: String,
    val description: String,
    val category: String,
    val isLive: Boolean = false,
    val progressPercent: Float = 0f
)


