package com.foxstream.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.foxstream.app.data.api.StremioApiClient
import com.foxstream.app.data.model.StremioCatalogDefinition
import com.foxstream.app.data.model.StremioManifest
import com.foxstream.app.data.model.StremioMetaItem
import com.foxstream.app.util.StreamSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import java.util.concurrent.ConcurrentHashMap

sealed class Resource<out T> {
    object Loading : Resource<Nothing>()
    data class Success<out T>(val data: T) : Resource<T>()
    data class Error(val message: String, val cause: Throwable? = null) : Resource<Nothing>()
}

class StremioCatalogRepository(private val context: Context) {

    private val TAG = "StremioCatalogRepository"
    private val PREFS_NAME = "foxstream_prefs"
    private val KEY_ACTIVE_ADDON_URL = "foxstream_active_addon_url"
    val DEFAULT_ADDON_URL = "https://torrentio.strem.fun/manifest.json"

    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // In-memory cache for fast tab switches
    private val catalogCache = ConcurrentHashMap<String, List<StremioMetaItem>>()
    private var cachedManifest: StremioManifest? = null

    fun getActiveAddonUrl(): String {
        val stored = prefs.getString(KEY_ACTIVE_ADDON_URL, null)
        return if (!stored.isNullOrBlank()) stored.trim() else DEFAULT_ADDON_URL
    }

    fun setActiveAddonUrl(url: String) {
        val clean = url.trim()
        prefs.edit().putString(KEY_ACTIVE_ADDON_URL, clean).apply()
        // Invalidate cache
        cachedManifest = null
        catalogCache.clear()
    }

    /**
     * Loads the Stremio Add-on Manifest
     */
    fun loadManifest(addonUrl: String? = null, forceRefresh: Boolean = false): Flow<Resource<StremioManifest>> = flow {
        emit(Resource.Loading)

        if (!forceRefresh && cachedManifest != null) {
            emit(Resource.Success(cachedManifest!!))
            return@flow
        }

        val urlToUse = addonUrl ?: getActiveAddonUrl()
        try {
            val manifest = StremioApiClient.getManifest(urlToUse)
            if (manifest != null && manifest.id.isNotBlank()) {
                cachedManifest = manifest
                emit(Resource.Success(manifest))
            } else {
                emit(Resource.Error("Não foi possível carregar o manifesto do Add-on. Verifique a URL."))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading manifest: ${e.message}", e)
            emit(Resource.Error("Erro de conexão ao carregar Add-on: ${e.localizedMessage}", e))
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Loads items for a specific catalog (e.g. type="movie", catalogId="top")
     */
    fun loadCatalog(
        type: String,
        catalogId: String,
        addonBaseUrl: String? = null,
        extraArgs: String? = null,
        forceRefresh: Boolean = false
    ): Flow<Resource<List<StremioMetaItem>>> = flow {
        emit(Resource.Loading)

        val cacheKey = "${type}_${catalogId}_${extraArgs.orEmpty()}"
        if (!forceRefresh && catalogCache.containsKey(cacheKey)) {
            val cachedList = catalogCache[cacheKey]
            if (cachedList != null) {
                emit(Resource.Success(cachedList))
                return@flow
            }
        }

        val base = addonBaseUrl ?: getActiveAddonUrl()
        try {
            val items = StremioApiClient.getCatalog(base, type, catalogId, extraArgs)
            if (items.isNotEmpty()) {
                catalogCache[cacheKey] = items
                emit(Resource.Success(items))
            } else {
                // If specific catalog endpoint returned empty, check fallback or emit empty
                catalogCache[cacheKey] = emptyList()
                emit(Resource.Success(emptyList()))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading catalog $type/$catalogId: ${e.message}", e)
            emit(Resource.Error("Falha ao carregar catálogo: ${e.localizedMessage}", e))
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Loads dynamic external JSON playlist / feed
     */
    fun loadDynamicJsonFeed(url: String): Flow<Resource<List<StreamSource>>> = flow {
        emit(Resource.Loading)
        try {
            val streams = StremioApiClient.parseDynamicJson(url)
            if (streams.isNotEmpty()) {
                emit(Resource.Success(streams))
            } else {
                emit(Resource.Error("O JSON foi carregado mas não possui mídias ou streams válidos."))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error loading dynamic JSON from $url: ${e.message}", e)
            emit(Resource.Error("Falha ao processar arquivo JSON: ${e.localizedMessage}", e))
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Resolves streams for an item
     */
    fun resolveStreams(type: String, id: String, addonBaseUrl: String? = null): Flow<Resource<List<StreamSource>>> = flow {
        emit(Resource.Loading)
        val base = addonBaseUrl ?: getActiveAddonUrl()
        try {
            val streams = StremioApiClient.getStreams(base, type, id)
            emit(Resource.Success(streams))
        } catch (e: Exception) {
            emit(Resource.Error("Erro ao buscar streams: ${e.localizedMessage}", e))
        }
    }.flowOn(Dispatchers.IO)
}
