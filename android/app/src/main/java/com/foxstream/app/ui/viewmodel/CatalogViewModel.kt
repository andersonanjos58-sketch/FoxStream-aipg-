package com.foxstream.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.foxstream.app.data.model.StremioCatalogDefinition
import com.foxstream.app.data.model.StremioManifest
import com.foxstream.app.data.model.StremioMetaItem
import com.foxstream.app.data.repository.Resource
import com.foxstream.app.data.repository.StremioCatalogRepository
import com.foxstream.app.util.StreamSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed class CatalogUiState {
    object Loading : CatalogUiState()

    data class Success(
        val manifest: StremioManifest,
        val availableCatalogs: List<StremioCatalogDefinition>,
        val activeCatalog: StremioCatalogDefinition?,
        val items: List<StremioMetaItem>,
        val customStreams: List<StreamSource> = emptyList(),
        val isCustomJsonFeed: Boolean = false,
        val isRefreshing: Boolean = false
    ) : CatalogUiState()

    data class Error(
        val message: String,
        val canRetry: Boolean = true
    ) : CatalogUiState()
}

class CatalogViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = StremioCatalogRepository(application.applicationContext)

    private val _uiState = MutableStateFlow<CatalogUiState>(CatalogUiState.Loading)
    val uiState: StateFlow<CatalogUiState> = _uiState.asStateFlow()

    private val _activeAddonUrl = MutableStateFlow(repository.getActiveAddonUrl())
    val activeAddonUrl: StateFlow<String> = _activeAddonUrl.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    init {
        loadCatalogFromAddon()
    }

    fun updateSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setAddonUrl(newUrl: String) {
        val clean = newUrl.trim()
        if (clean.isBlank()) return

        repository.setActiveAddonUrl(clean)
        _activeAddonUrl.value = clean

        if (clean.endsWith(".json") && !clean.contains("manifest.json")) {
            // It's a direct dynamic JSON feed
            loadCustomJsonFeed(clean)
        } else {
            // It's a Stremio manifest
            loadCatalogFromAddon(clean, forceRefresh = true)
        }
    }

    fun refresh() {
        val current = _uiState.value
        if (current is CatalogUiState.Success) {
            _uiState.update { current.copy(isRefreshing = true) }
            if (current.isCustomJsonFeed) {
                loadCustomJsonFeed(_activeAddonUrl.value)
            } else {
                loadCatalogFromAddon(_activeAddonUrl.value, forceRefresh = true)
            }
        } else {
            loadCatalogFromAddon(forceRefresh = true)
        }
    }

    /**
     * Loads the Stremio Add-on Manifest and automatically fetches items from the first catalog
     */
    fun loadCatalogFromAddon(addonUrl: String? = null, forceRefresh: Boolean = false) {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = CatalogUiState.Loading

            repository.loadManifest(addonUrl, forceRefresh).collect { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        _uiState.value = CatalogUiState.Loading
                    }
                    is Resource.Error -> {
                        _uiState.value = CatalogUiState.Error(resource.message)
                    }
                    is Resource.Success -> {
                        val manifest = resource.data
                        val catalogs = manifest.catalogs.ifEmpty {
                            listOf(
                                StremioCatalogDefinition(type = "movie", id = "top", name = "Filmes"),
                                StremioCatalogDefinition(type = "series", id = "top", name = "Séries")
                            )
                        }
                        val firstCatalog = catalogs.firstOrNull()

                        if (firstCatalog != null) {
                            fetchCatalogItems(manifest, catalogs, firstCatalog, forceRefresh)
                        } else {
                            _uiState.value = CatalogUiState.Success(
                                manifest = manifest,
                                availableCatalogs = emptyList(),
                                activeCatalog = null,
                                items = emptyList()
                            )
                        }
                    }
                }
            }
        }
    }

    /**
     * Switches the active catalog tab (e.g. "Filmes" vs "Séries")
     */
    fun selectCatalog(catalog: StremioCatalogDefinition) {
        val current = _uiState.value as? CatalogUiState.Success ?: return
        if (current.activeCatalog == catalog) return

        viewModelScope.launch(Dispatchers.IO) {
            _uiState.update { current.copy(activeCatalog = catalog, isRefreshing = true) }
            fetchCatalogItems(current.manifest, current.availableCatalogs, catalog, forceRefresh = false)
        }
    }

    private suspend fun fetchCatalogItems(
        manifest: StremioManifest,
        catalogs: List<StremioCatalogDefinition>,
        catalog: StremioCatalogDefinition,
        forceRefresh: Boolean
    ) {
        repository.loadCatalog(
            type = catalog.type,
            catalogId = catalog.id,
            addonBaseUrl = _activeAddonUrl.value,
            forceRefresh = forceRefresh
        ).collect { res ->
            when (res) {
                is Resource.Loading -> {
                    // Keep current UI if refreshing
                }
                is Resource.Error -> {
                    _uiState.value = CatalogUiState.Error(res.message)
                }
                is Resource.Success -> {
                    _uiState.value = CatalogUiState.Success(
                        manifest = manifest,
                        availableCatalogs = catalogs,
                        activeCatalog = catalog,
                        items = res.data,
                        isCustomJsonFeed = false,
                        isRefreshing = false
                    )
                }
            }
        }
    }

    /**
     * Loads a dynamic custom JSON playlist / feed URL
     */
    fun loadCustomJsonFeed(feedUrl: String) {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.value = CatalogUiState.Loading

            repository.loadDynamicJsonFeed(feedUrl).collect { res ->
                when (res) {
                    is Resource.Loading -> {
                        _uiState.value = CatalogUiState.Loading
                    }
                    is Resource.Error -> {
                        _uiState.value = CatalogUiState.Error(res.message)
                    }
                    is Resource.Success -> {
                        val streams = res.data
                        // Map streams to StremioMetaItem for consistent grid presentation
                        val metas = streams.mapIndexed { idx, s ->
                            StremioMetaItem(
                                id = s.id,
                                type = s.type,
                                name = s.title,
                                poster = null,
                                releaseInfo = s.year?.toString(),
                                genres = listOfNotNull(s.quality, s.format)
                            )
                        }

                        val mockManifest = StremioManifest(
                            id = "custom_json_feed",
                            name = "JSON Custom Feed",
                            description = "${streams.size} mídias carregadas"
                        )

                        _uiState.value = CatalogUiState.Success(
                            manifest = mockManifest,
                            availableCatalogs = emptyList(),
                            activeCatalog = null,
                            items = metas,
                            customStreams = streams,
                            isCustomJsonFeed = true,
                            isRefreshing = false
                        )
                    }
                }
            }
        }
    }
}
