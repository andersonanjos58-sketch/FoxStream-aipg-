package com.foxstream.app.ui.navigation

import java.net.URLDecoder
import java.net.URLEncoder

/**
 * Rotas e constantes de navegação do FoxStream
 */
object NavDestinations {
    const val ROUTE_HOME = "home"
    const val ROUTE_LIVE = "live"
    const val ROUTE_MOVIES = "movies"
    const val ROUTE_SERIES = "series"
    const val ROUTE_FAVORITES = "favorites"
    const val ROUTE_PLAYLISTS = "playlists"
    const val ROUTE_SETTINGS = "settings"

    // 1. Rota de detalhes do filme: "movie_details/{movieId}"
    const val ARG_MOVIE_ID = "movieId"
    const val ROUTE_MOVIE_DETAILS = "movie_details/{$ARG_MOVIE_ID}"

    fun buildMovieDetailsRoute(movieId: String): String {
        val encodedId = URLEncoder.encode(movieId, "UTF-8")
        return "movie_details/$encodedId"
    }

    fun parseMovieId(rawArg: String): String {
        return try {
            URLDecoder.decode(rawArg, "UTF-8")
        } catch (_: Exception) {
            rawArg
        }
    }

    // 2. Rota do player: "player_screen/{streamUrl}"
    const val ARG_STREAM_URL = "streamUrl"
    const val ROUTE_PLAYER = "player_screen/{$ARG_STREAM_URL}"

    fun buildPlayerRoute(streamUrl: String): String {
        val encodedUrl = URLEncoder.encode(streamUrl, "UTF-8")
        return "player_screen/$encodedUrl"
    }

    fun parseStreamUrl(rawArg: String): String {
        return try {
            URLDecoder.decode(rawArg, "UTF-8")
        } catch (_: Exception) {
            rawArg
        }
    }
}
