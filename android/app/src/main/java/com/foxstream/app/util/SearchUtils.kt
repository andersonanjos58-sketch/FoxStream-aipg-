package com.foxstream.app.util

import java.text.Normalizer
import java.util.Locale

object SearchUtils {
    private val DIACRITICS_REGEX = Regex("\\p{InCombiningDiacriticalMarks}+")
    private val MULTI_SPACE_REGEX = Regex("\\s+")
    // Replace non-alphanumeric characters (like :, -, [, ], (, ), ., _) with space
    private val PUNCTUATION_REGEX = Regex("""[^\p{L}\p{Nd}\s]""")

    /**
     * Normalizes a search query or target string:
     * 1. .trim() to ignore leading and trailing spaces.
     * 2. Replaces multiple consecutive spaces with a single space.
     * 3. Converts to lowercase (.lowercase()).
     * 4. Removes accents/diacritics using java.text.Normalizer (NFD).
     * 5. Replaces punctuation (:, -, [, ], etc.) with spaces.
     */
    fun normalize(text: String): String {
        if (text.isBlank()) return ""
        val trimmed = text.trim()
        val nfd = Normalizer.normalize(trimmed, Normalizer.Form.NFD)
        val withoutAccents = DIACRITICS_REGEX.replace(nfd, "").lowercase(Locale.ROOT)
        val withoutPunctuation = PUNCTUATION_REGEX.replace(withoutAccents, " ")
        return MULTI_SPACE_REGEX.replace(withoutPunctuation, " ").trim()
    }

    /**
     * Divides the search query into tokens (individual words).
     */
    fun extractTokens(query: String): List<String> {
        val normalized = normalize(query)
        if (normalized.isBlank()) return emptyList()
        return normalized.split(" ").filter { it.isNotBlank() }
    }

    /**
     * Tokenized Search:
     * Returns true if the target string contains all search query tokens,
     * ignoring accents, punctuation and word order.
     */
    fun matchesTokens(targetText: String, tokens: List<String>): Boolean {
        if (tokens.isEmpty()) return true
        val normalizedTarget = normalize(targetText)
        if (normalizedTarget.isBlank()) return false
        return tokens.all { token -> normalizedTarget.contains(token) }
    }

    /**
     * Matches if all tokens are present in any of the provided target fields
     * (e.g. title and category combined).
     */
    fun matchesAnyField(tokens: List<String>, vararg fields: String?): Boolean {
        if (tokens.isEmpty()) return true
        val combined = fields.filterNotNull().joinToString(" ") { normalize(it) }
        return tokens.all { token -> combined.contains(token) }
    }
}
