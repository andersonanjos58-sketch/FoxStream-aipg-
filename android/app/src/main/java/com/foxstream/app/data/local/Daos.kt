package com.foxstream.app.data.local

import androidx.room.*
import com.foxstream.app.data.model.*

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY lastUpdated DESC")
    suspend fun getAllPlaylists(): List<Playlist>

    @Query("SELECT * FROM playlists WHERE id = :id LIMIT 1")
    suspend fun getPlaylistById(id: String): Playlist?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: Playlist)

    @Update
    suspend fun updatePlaylist(playlist: Playlist)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylistById(id: String)
}

@Dao
interface LiveChannelDao {
    @Query("SELECT * FROM live_channels WHERE playlistId = :playlistId ORDER BY name ASC")
    suspend fun getChannelsForPlaylist(playlistId: String): List<LiveChannel>

    @Query("SELECT * FROM live_channels WHERE playlistId = :playlistId AND category = :category ORDER BY name ASC")
    suspend fun getChannelsByCategory(playlistId: String, category: String): List<LiveChannel>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertChannels(channels: List<LiveChannel>)

    @Query("DELETE FROM live_channels WHERE playlistId = :playlistId")
    suspend fun deleteChannelsForPlaylist(playlistId: String)
}

@Dao
interface MovieDao {
    @Query("SELECT * FROM movies WHERE playlistId = :playlistId ORDER BY name ASC")
    suspend fun getMoviesForPlaylist(playlistId: String): List<MovieItem>

    @Query("SELECT * FROM movies WHERE playlistId = :playlistId AND category = :category ORDER BY name ASC")
    suspend fun getMoviesByCategory(playlistId: String, category: String): List<MovieItem>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMovies(movies: List<MovieItem>)

    @Query("DELETE FROM movies WHERE playlistId = :playlistId")
    suspend fun deleteMoviesForPlaylist(playlistId: String)
}

@Dao
interface SeriesDao {
    @Query("SELECT * FROM series WHERE playlistId = :playlistId ORDER BY name ASC")
    suspend fun getSeriesForPlaylist(playlistId: String): List<SeriesItem>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSeries(series: List<SeriesItem>)

    @Query("DELETE FROM series WHERE playlistId = :playlistId")
    suspend fun deleteSeriesForPlaylist(playlistId: String)
}

@Dao
interface FavoriteDao {
    @Query("SELECT * FROM favorites ORDER BY id DESC")
    suspend fun getAllFavorites(): List<FavoriteItem>

    @Query("SELECT * FROM favorites WHERE contentId = :contentId LIMIT 1")
    suspend fun getFavoriteByContentId(contentId: String): FavoriteItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFavorite(favorite: FavoriteItem)

    @Query("DELETE FROM favorites WHERE contentId = :contentId")
    suspend fun deleteFavoriteByContentId(contentId: String)
}

@Dao
interface HistoryDao {
    @Query("SELECT * FROM history ORDER BY playedAt DESC")
    suspend fun getAllHistory(): List<HistoryItem>

    @Query("SELECT * FROM history WHERE isWatched = 0 AND type != 'LIVE' AND (playbackPosition > 3000 OR (duration > 0 AND (CAST(playbackPosition AS REAL) / duration) >= 0.005)) AND (duration = 0 OR (CAST(playbackPosition AS REAL) / duration) <= 0.95) ORDER BY playedAt DESC")
    suspend fun getContinueWatchingHistory(): List<HistoryItem>

    @Query("SELECT * FROM history WHERE streamUrl = :streamUrl LIMIT 1")
    suspend fun getHistoryByStreamUrl(streamUrl: String): HistoryItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHistory(history: HistoryItem)

    @Query("DELETE FROM history WHERE streamUrl = :streamUrl")
    suspend fun deleteHistoryByStreamUrl(streamUrl: String)

    @Query("DELETE FROM history WHERE id = :id")
    suspend fun deleteHistoryById(id: String)
}
