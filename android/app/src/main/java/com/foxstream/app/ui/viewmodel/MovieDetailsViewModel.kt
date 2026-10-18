package com.foxstream.app.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.api.TmdbApiClient
import com.foxstream.app.data.api.TmdbResult
import com.foxstream.app.data.model.MovieItem
import com.foxstream.app.util.StreamResolutionState
import com.foxstream.app.util.StreamResolver
import com.foxstream.app.util.StreamSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed class MovieDetailsUiState {
    object Loading : MovieDetailsUiState()
    data class Success(
        val movie: MovieItem?,
        val tmdbData: TmdbResult? = null,
        val isLoadingTmdb: Boolean = true,
        val streamSource: StreamSource? = null,
        val isStreamAvailable: Boolean = false,
        val isResolvingStream: Boolean = false
    ) : MovieDetailsUiState()
    data class Error(val message: String) : MovieDetailsUiState()
}

class MovieDetailsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<MovieDetailsUiState>(MovieDetailsUiState.Loading)
    val uiState: StateFlow<MovieDetailsUiState> = _uiState.asStateFlow()

    fun loadMovieDetails(context: Context, localMovie: MovieItem) {
        viewModelScope.launch {
            // 1. Carrega dados do item
            _uiState.value = MovieDetailsUiState.Success(
                movie = localMovie,
                tmdbData = null,
                isLoadingTmdb = true,
                streamSource = null,
                isStreamAvailable = localMovie.streamUrl.isNotBlank(),
                isResolvingStream = localMovie.streamUrl.isBlank()
            )

            // 2. Dispara a busca no TMDB em background sem bloquear a UI
            fetchTmdbDetails(localMovie.name, localMovie.year)

            // 3. Se não tiver streamUrl direto, resolve sob demanda no streams.json
            if (localMovie.streamUrl.isBlank()) {
                resolveStream(context, localMovie.name, localMovie.year)
            }
        }
    }

    private fun resolveStream(context: Context, title: String, year: String?, tmdbId: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            val state = StreamResolver.resolveStream(
                context = context,
                tmdbId = tmdbId,
                title = title,
                year = year,
                type = "movie"
            )

            _uiState.update { current ->
                if (current is MovieDetailsUiState.Success) {
                    when (state) {
                        is StreamResolutionState.Available -> current.copy(
                            streamSource = state.stream,
                            isStreamAvailable = true,
                            isResolvingStream = false
                        )
                        else -> current.copy(
                            streamSource = null,
                            isStreamAvailable = false,
                            isResolvingStream = false
                        )
                    }
                } else current
            }
        }
    }

    private fun fetchTmdbDetails(rawTitle: String, rawYear: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val tmdbDetails = TmdbApiClient.getMovieDetails(rawTitle, rawYear)
                
                _uiState.update { currentState ->
                    if (currentState is MovieDetailsUiState.Success) {
                        currentState.copy(
                            tmdbData = tmdbDetails,
                            isLoadingTmdb = false
                        )
                    } else currentState
                }
            } catch (e: Exception) {
                _uiState.update { currentState ->
                    if (currentState is MovieDetailsUiState.Success) {
                        currentState.copy(isLoadingTmdb = false)
                    } else currentState
                }
            }
        }
    }
}
