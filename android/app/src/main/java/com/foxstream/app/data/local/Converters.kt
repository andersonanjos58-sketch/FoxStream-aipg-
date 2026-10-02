package com.foxstream.app.data.local

import androidx.room.TypeConverter
import com.foxstream.app.data.model.*
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class Converters {
    private val gson = Gson()

    @TypeConverter
    fun fromPlaylistType(value: PlaylistType): String {
        return value.name
    }

    @TypeConverter
    fun toPlaylistType(value: String): PlaylistType {
        return try {
            PlaylistType.valueOf(value)
        } catch (e: Exception) {
            PlaylistType.M3U
        }
    }

    @TypeConverter
    fun fromContentType(value: ContentType): String {
        return value.name
    }

    @TypeConverter
    fun toContentType(value: String): ContentType {
        return try {
            ContentType.valueOf(value)
        } catch (e: Exception) {
            ContentType.LIVE
        }
    }

    @TypeConverter
    fun fromSeasonList(seasons: List<SeasonItem>): String {
        return try {
            gson.toJson(seasons)
        } catch (e: Exception) {
            "[]"
        }
    }

    @TypeConverter
    fun toSeasonList(value: String): List<SeasonItem> {
        if (value.isBlank()) return emptyList()
        val type = object : TypeToken<List<SeasonItem>>() {}.type
        return try {
            gson.fromJson(value, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
}

