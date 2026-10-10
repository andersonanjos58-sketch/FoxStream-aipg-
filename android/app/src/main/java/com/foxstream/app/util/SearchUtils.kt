package com.foxstream.app.util

import java.text.Normalizer
import java.util.Locale

object SearchUtils {
    private val DIACRITICS_REGEX = Regex("\\p{InCombiningDiacriticalMarks}+")
    private val MULTI_SPACE_REGEX = Regex("\\s+")
    private val PUNCTUATION_REGEX = Regex("""[^\p{L}\p{Nd}\s]""")

    /**
     * Ultra-fast character-based normalization avoiding heavy regex allocations
     * and Form.NFD decompositions on high-frequency search loops.
     */
    fun fastNormalize(text: String): String {
        if (text.isEmpty()) return ""
        val len = text.length
        val sb = StringBuilder(len)
        var prevSpace = false

        for (i in 0 until len) {
            val c = text[i]
            val normChar: Char = when (c) {
                'á', 'à', 'â', 'ã', 'ä', 'Á', 'À', 'Â', 'Ã', 'Ä' -> 'a'
                'é', 'è', 'ê', 'ë', 'É', 'È', 'Ê', 'Ë' -> 'e'
                'í', 'ì', 'î', 'ï', 'Í', 'Ì', 'Î', 'Ï' -> 'i'
                'ó', 'ò', 'ô', 'õ', 'ö', 'Ó', 'Ò', 'Ô', 'Õ', 'Ö' -> 'o'
                'ú', 'ù', 'û', 'ü', 'Ú', 'Ù', 'Û', 'Ü' -> 'u'
                'ç', 'Ç' -> 'c'
                'ñ', 'Ñ' -> 'n'
                in 'A'..'Z' -> (c.code + 32).toChar()
                in 'a'..'z', in '0'..'9' -> c
                else -> ' '
            }

            if (normChar == ' ') {
                if (!prevSpace && sb.isNotEmpty()) {
                    sb.append(' ')
                    prevSpace = true
                }
            } else {
                sb.append(normChar)
                prevSpace = false
            }
        }
        return sb.toString().trim()
    }

    /**
     * Normalizes a search query or target string.
     */
    fun normalize(text: String): String {
        if (text.isBlank()) return ""
        return fastNormalize(text)
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
        if (targetText.isBlank()) return false
        
        // Fast path: direct case-insensitive containment
        var allDirectMatch = true
        for (token in tokens) {
            if (!targetText.contains(token, ignoreCase = true)) {
                allDirectMatch = false
                break
            }
        }
        if (allDirectMatch) return true

        val normalizedTarget = normalize(targetText)
        if (normalizedTarget.isBlank()) return false
        for (token in tokens) {
            if (!normalizedTarget.contains(token)) return false
        }
        return true
    }

    /**
     * Matches if all tokens are present in any of the provided target fields
     * (e.g. title and category combined).
     * Highly optimized for IPTV catalogs with 50,000+ items.
     */
    fun matchesAnyField(tokens: List<String>, vararg fields: String?): Boolean {
        if (tokens.isEmpty()) return true
        
        // Fast path: Direct sub-string check across non-null fields
        var allDirectMatch = true
        for (token in tokens) {
            var foundToken = false
            for (f in fields) {
                if (f != null && f.contains(token, ignoreCase = true)) {
                    foundToken = true
                    break
                }
            }
            if (!foundToken) {
                allDirectMatch = false
                break
            }
        }
        if (allDirectMatch) return true

        // Fallback: Normalized check
        val combined = StringBuilder()
        for (f in fields) {
            if (f != null && f.isNotBlank()) {
                if (combined.isNotEmpty()) combined.append(' ')
                combined.append(fastNormalize(f))
            }
        }
        val target = combined.toString()
        for (token in tokens) {
            if (!target.contains(token)) return false
        }
        return true
    }
}
