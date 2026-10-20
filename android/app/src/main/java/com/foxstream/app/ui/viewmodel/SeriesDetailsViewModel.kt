package com.foxstream.app.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.api.TmdbApiClient
import com.foxstream.app.data.api.TmdbResult
import com.foxstream.app.data.model.EpisodeItem
import com.foxstream.app.data.model.SeasonItem
import com.foxstream.app.data.model.SeriesItem
import com.foxstream.app.util.StreamResolutionState
import com.foxstream.app.util.StreamResolver
import com.foxstream.app.util.StreamSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed class SeriesDetailsUiState {
    object Loading : SeriesDetailsUiState()
    data class Success(
        val series: SeriesItem?,
        val tmdbData: TmdbResult? = null,
        val isLoadingTmdb: Boolean = true,
        val selectedEpisode: EpisodeItem? = null,
        val episodeStreams: List<StreamSource> = emptyList(),
        val isResolvingEpisodeStreams: Boolean = false
    ) : SeriesDetailsUiState()
    data class Error(val message: String) : SeriesDetailsUiState()
}

class SeriesDetailsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<SeriesDetailsUiState>(SeriesDetailsUiState.Loading)
    val uiState: StateFlow<SeriesDetailsUiState> = _uiState.asStateFlow()

    fun loadSeriesDetails(localSeries: SeriesItem) {
        viewModelScope.launch {
            _uiState.value = SeriesDetailsUiState.Success(
                series = localSeries,
                tmdbData = null,
                isLoadingTmdb = true
            )

            fetchTmdbDetails(localSeries)
        }
    }

    private fun fetchTmdbDetails(series: SeriesItem) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val tmdbDetails = TmdbApiClient.getSeriesDetails(series.name, series.year)
                
                var updatedSeries = series
                if (series.seasons.isEmpty() && tmdbDetails?.tmdbId != null) {
                    // Fetch season 1 episodes from TMDB if local series has no seasons
                    val s1Episodes = TmdbApiClient.fetchSeasonEpisodes(tmdbDetails.tmdbId, 1)
                    if (s1Episodes.isNotEmpty()) {
                        val season1 = SeasonItem(
                            seasonNum = 1,
                            name = "Temporada 1",
                            episodes = s1Episodes
                        )
                        updatedSeries = series.copy(seasons = listOf(season1))
                    }
                }

                _uiState.update { currentState ->
                    if (currentState is SeriesDetailsUiState.Success) {
                        currentState.copy(
                            series = updatedSeries,
                            tmdbData = tmdbDetails,
                            isLoadingTmdb = false
                        )
                    } else currentState
                }
            } catch (e: Exception) {
                _uiState.update { currentState ->
                    if (currentState is SeriesDetailsUiState.Success) {
                        currentState.copy(isLoadingTmdb = false)
                    } else currentState
                }
            }
        }
    }

    fun loadSeasonEpisodes(seasonNum: Int) {
        viewModelScope.launch(Dispatchers.IO) {
            val state = _uiState.value
            if (state is SeriesDetailsUiState.Success) {
                val tmdbId = state.tmdbData?.tmdbId ?: return@launch
                val episodes = TmdbApiClient.fetchSeasonEpisodes(tmdbId, seasonNum)
                if (episodes.isNotEmpty()) {
                    val currentSeasons = state.series?.seasons.orEmpty().toMutableList()
                    val existingIdx = currentSeasons.indexOfFirst { it.seasonNum == seasonNum }
                    val newSeason = SeasonItem(
                        seasonNum = seasonNum,
                        name = "Temporada $seasonNum",
                        episodes = episodes
                    )
                    if (existingIdx >= 0) {
                        currentSeasons[existingIdx] = newSeason
                    } else {
                        currentSeasons.add(newSeason)
                    }
                    _uiState.update { curr ->
                        if (curr is SeriesDetailsUiState.Success) {
                            curr.copy(series = curr.series?.copy(seasons = currentSeasons.sortedBy { it.seasonNum }))
                        } else curr
                    }
                }
            }
        }
    }

    fun resolveEpisodeStreams(
        context: Context,
        episode: EpisodeItem,
        onStreamsReady: ((List<StreamSource>) -> Unit)? = null
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.update { curr ->
                if (curr is SeriesDetailsUiState.Success) {
                    curr.copy(
                        selectedEpisode = episode,
                        isResolvingEpisodeStreams = true,
                        episodeStreams = emptyList()
                    )
                } else curr
            }

            val state = _uiState.value as? SeriesDetailsUiState.Success
            val tmdbData = state?.tmdbData
            val tmdbId = tmdbData?.imdbId ?: tmdbData?.tmdbId?.toString() ?: state?.series?.id

            val result = StreamResolver.resolveStream(
                context = context,
                tmdbId = tmdbId,
                title = state?.series?.name,
                year = state?.series?.year,
                type = "series",
                seasonNum = episode.seasonNum,
                episodeNum = episode.episodeNum
            )

            val resolvedStreams = when (result) {
                is StreamResolutionState.Available -> result.allStreams
                else -> emptyList()
            }

            // Include original direct streamUrl if present
            val finalStreams = if (episode.streamUrl.isNotBlank()) {
                val direct = StreamSource(
                    id = episode.id,
                    title = episode.title,
                    type = "series",
                    streamUrl = episode.streamUrl,
                    quality = "HD",
                    name = "Stream Direto"
                )
                listOf(direct) + resolvedStreams.filter { it.streamUrl != episode.streamUrl }
            } else {
                resolvedStreams
            }

            _uiState.update { curr ->
                if (curr is SeriesDetailsUiState.Success) {
                    curr.copy(
                        isResolvingEpisodeStreams = false,
                        episodeStreams = finalStreams
                    )
                } else curr
            }

            onStreamsReady?.invoke(finalStreams)
        }
    }

    fun clearSelectedEpisode() {
        _uiState.update { curr ->
            if (curr is SeriesDetailsUiState.Success) {
                curr.copy(
                    selectedEpisode = null,
                    episodeStreams = emptyList(),
                    isResolvingEpisodeStreams = false
                )
            } else curr
        }
    }
}
