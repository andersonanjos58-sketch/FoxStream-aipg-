package com.foxstream.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.api.TmdbApiClient
import com.foxstream.app.data.api.TmdbResult
import com.foxstream.app.data.model.MovieItem
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
        val isLoadingTmdb: Boolean = true
    ) : MovieDetailsUiState()
    data class Error(val message: String) : MovieDetailsUiState()
}

class MovieDetailsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<MovieDetailsUiState>(MovieDetailsUiState.Loading)
    val uiState: StateFlow<MovieDetailsUiState> = _uiState.asStateFlow()

    fun loadMovieDetails(localMovie: MovieItem) {
        viewModelScope.launch {
            // 1. Carrega dados do IPTV localmente primeiro (exibição INSTANTÂNEA)
            _uiState.value = MovieDetailsUiState.Success(
                movie = localMovie,
                tmdbData = null,
                isLoadingTmdb = true
            )

            // 2. Dispara a busca no TMDB em background sem bloquear a UI
            fetchTmdbDetails(localMovie.name, localMovie.year)
        }
    }

    private fun fetchTmdbDetails(rawTitle: String, rawYear: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                // Higieniza o título e busca dados adicionais do TMDB
                val tmdbDetails = TmdbApiClient.getMovieDetails(rawTitle, rawYear)
                
                if (tmdbDetails != null) {
                    // Atualiza o estado Reativo em tempo real
                    _uiState.update { currentState ->
                        if (currentState is MovieDetailsUiState.Success) {
                            currentState.copy(
                                tmdbData = tmdbDetails,
                                isLoadingTmdb = false
                            )
                        } else currentState
                    }
                } else {
                    _uiState.update { currentState ->
                        if (currentState is MovieDetailsUiState.Success) {
                            currentState.copy(isLoadingTmdb = false)
                        } else currentState
                    }
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
