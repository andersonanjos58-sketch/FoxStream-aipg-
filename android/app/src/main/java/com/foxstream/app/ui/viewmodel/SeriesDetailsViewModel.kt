package com.foxstream.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.api.TmdbApiClient
import com.foxstream.app.data.api.TmdbResult
import com.foxstream.app.data.model.SeriesItem
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
        val isLoadingTmdb: Boolean = true
    ) : SeriesDetailsUiState()
    data class Error(val message: String) : SeriesDetailsUiState()
}

class SeriesDetailsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<SeriesDetailsUiState>(SeriesDetailsUiState.Loading)
    val uiState: StateFlow<SeriesDetailsUiState> = _uiState.asStateFlow()

    fun loadSeriesDetails(localSeries: SeriesItem) {
        viewModelScope.launch {
            // 1. Carrega dados do IPTV localmente primeiro (exibição INSTANTÂNEA)
            _uiState.value = SeriesDetailsUiState.Success(
                series = localSeries,
                tmdbData = null,
                isLoadingTmdb = true
            )

            // 2. Dispara a busca no TMDB em background sem bloquear a UI
            fetchTmdbDetails(localSeries.name, localSeries.year)
        }
    }

    private fun fetchTmdbDetails(rawTitle: String, rawYear: String? = null) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                // Higieniza o título (remove "Dublado", "4K", etc) e busca no TMDB
                val tmdbDetails = TmdbApiClient.getSeriesDetails(rawTitle, rawYear)
                
                if (tmdbDetails != null) {
                    // Atualiza o estado Reativo em tempo real
                    _uiState.update { currentState ->
                        if (currentState is SeriesDetailsUiState.Success) {
                            currentState.copy(
                                tmdbData = tmdbDetails,
                                isLoadingTmdb = false
                            )
                        } else currentState
                    }
                } else {
                    _uiState.update { currentState ->
                        if (currentState is SeriesDetailsUiState.Success) {
                            currentState.copy(isLoadingTmdb = false)
                        } else currentState
                    }
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
}
