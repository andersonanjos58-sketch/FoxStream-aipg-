package com.foxstream.app.util

import java.text.Normalizer
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class SmartMatchResult(
    val isMatch: Boolean,
    val score: Int,
    val textSimilarity: Double,
    val textScore: Int,
    val yearScore: Int,
    val genreScore: Int,
    val reason: String
)

object SmartMatch {

    // Threshold score: 85 / 100
    const val MATCH_THRESHOLD = 85

    private val DIACRITICS_REGEX = Regex("\\p{InCombiningDiacriticalMarks}+")
    private val YEAR_REGEX = Regex("""\b(19\d{2}|20\d{2})\b""")
    private val ROMAN_NUMERALS = setOf("i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii")

    // IPTV / Quality / Audio noise tokens
    private val IPTV_NOISE_PATTERN = Regex(
        """(?i)\b(1080p|4k|720p|480p|fhd|hd|sd|uhd|2160p|3d|imax|remux|hevc|x264|x265|h264|h265|""" +
        """aac|ac3|dts|atmos|10bit|dublado|dub|legendado|leg|dual|multi|nacional|legendas|sub|""" +
        """pt-br|ptbr|pt_br|pt|en|audio\s*5\.1|5\.1|7\.1|web-dl|webrip|bluray|bdrip|hdrip|cam|""" +
        """telesync|ts|rc|★rc|vod|cine|br|brasil|completo|filmes?|s[ée]ries?|canais|tv|stream)\b"""
    )

    // Category & VOD prefixes to strip
    private val PREFIX_NOISE_PATTERN = Regex(
        """^(?:filmes?|s[ée]ries?|vod|canais|tv|4k|fhd|hd|br|lan[çc]amentos?|populares?|cinema|telecine|hbo|netflix|prime|disney|globo|globo\s*play|assistir|ver)\s*[:|\-–|•|\/|\\|\|]\s*""",
        RegexOption.IGNORE_CASE
    )

    // Bracketed noise tags to strip
    private val BRACKETED_NOISE_PATTERN = Regex(
        """(?i)[\(\[\{]\s*(?:dublado|dub|legendado|leg|dual|audio|nacional|multi|legendas?|sub|pt-br|pt|br|en|latino|portugues|""" +
        """1080p|720p|480p|2160p|4k|uhd|fhd|hd|sd|cam|ts|tc|dvdrip|bluray|blu-ray|bdrip|web-dl|webrip|hdtv|""" +
        """hevc|x264|x265|h264|h265|10bit|ac3|dts|aac|mp4|mkv|avi|vod|cine|completo|s\d+|t\d+|\d{4})\s*[\)\]\}]"""
    )

    private val SERIES_EP_PATTERN = Regex("""(?i)\b(s\d{1,2}\s*e\d{1,2}|season\s*\d{1,2}|temporada\s*\d{1,2}|t\d{1,2}|cap[ií]tulo\s*\d+)\b""")
    private val PUNCTUATION_PATTERN = Regex("[^a-z0-9\\s]")
    private val MULTI_SPACE_PATTERN = Regex("""\s+""")

    /**
     * Cleans an IPTV title, extracts any embedded 4-digit release year,
     * and normalizes the title by stripping prefixes, codecs, audio tags, brackets, and diacritics.
     */
    fun cleanTitle(rawTitle: String): Pair<String, String?> {
        if (rawTitle.isBlank()) return Pair("", null)

        var extractedYear: String? = null
        val yearMatches = YEAR_REGEX.findAll(rawTitle).map { it.value }.toList()
        if (yearMatches.isNotEmpty()) {
            val candidate = yearMatches.last()
            val y = candidate.toIntOrNull()
            if (y != null && y in 1920..2035) {
                extractedYear = candidate
            }
        }

        // 1. Remove category prefixes (e.g. "FILMES |", "VOD |", "LANÇAMENTOS |", "BR:")
        var text = PREFIX_NOISE_PATTERN.replace(rawTitle, "")

        // 2. Remove series episode and season markers
        text = SERIES_EP_PATTERN.replace(text, " ")

        // 3. Remove known bracketed noise tags
        text = BRACKETED_NOISE_PATTERN.replace(text, " ")

        // 4. Remove loose IPTV noise words
        text = IPTV_NOISE_PATTERN.replace(text, " ")

        // 5. Strip release year from the title string so title comparison matches pure TMDb name
        if (extractedYear != null) {
            text = text.replace(Regex("""\b$extractedYear\b"""), " ")
        }

        // 6. Normalize diacritics & punctuation
        val nfd = Normalizer.normalize(text, Normalizer.Form.NFD)
        val withoutAccents = DIACRITICS_REGEX.replace(nfd, "").lowercase(Locale.ROOT)
        val withoutPunctuation = PUNCTUATION_PATTERN.replace(withoutAccents, " ")
        val cleaned = MULTI_SPACE_PATTERN.replace(withoutPunctuation, " ").trim()

        return Pair(cleaned, extractedYear)
    }

    /**
     * Extracts key numbers (e.g., "2001", "2", "3", "1984") and roman numerals ("ii", "iii")
     * from a cleaned title, ignoring the standard 4-digit release year if provided.
     */
    fun extractKeyNumbers(cleanedTitle: String, knownYear: String?): Set<String> {
        val tokens = cleanedTitle.split(" ").filter { it.isNotBlank() }
        val numbers = mutableSetOf<String>()

        for (token in tokens) {
            if (token == knownYear) continue // ignore release year

            if (token.all { it.isDigit() }) {
                numbers.add(token.trimStart('0').ifEmpty { "0" })
            } else if (ROMAN_NUMERALS.contains(token)) {
                val arabic = when (token) {
                    "i" -> "1"
                    "ii" -> "2"
                    "iii" -> "3"
                    "iv" -> "4"
                    "v" -> "5"
                    "vi" -> "6"
                    "vii" -> "7"
                    "viii" -> "8"
                    "ix" -> "9"
                    "x" -> "10"
                    "xi" -> "11"
                    "xii" -> "12"
                    else -> token
                }
                numbers.add(arabic)
            }
        }
        return numbers
    }

    /**
     * Strict Key Number Check:
     * If TMDb contains key numbers/roman numerals (e.g., "2001", "2", "III"),
     * the local title MUST contain those exact key numbers.
     * If local title has key numbers (e.g. "2"), TMDb must also contain them.
     */
    fun checkKeyNumbers(localNumbers: Set<String>, tmdbNumbers: Set<String>): Boolean {
        if (tmdbNumbers.isNotEmpty() && !localNumbers.containsAll(tmdbNumbers)) {
            return false
        }
        if (localNumbers.isNotEmpty() && !tmdbNumbers.containsAll(localNumbers)) {
            return false
        }
        return true
    }

    /**
     * Levenshtein Distance
     */
    private fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j

        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
                )
            }
        }
        return dp[s1.length][s2.length]
    }

    /**
     * Jaro-Winkler Similarity Metric
     */
    private fun jaroWinklerSimilarity(s1: String, s2: String): Double {
        if (s1 == s2) return 1.0
        if (s1.isEmpty() || s2.isEmpty()) return 0.0

        val maxDist = (max(s1.length, s2.length) / 2) - 1
        if (maxDist < 0) return 0.0

        val s1Matches = BooleanArray(s1.length)
        val s2Matches = BooleanArray(s2.length)
        var matches = 0

        for (i in s1.indices) {
            val start = max(0, i - maxDist)
            val end = min(i + maxDist + 1, s2.length)
            for (j in start until end) {
                if (s2Matches[j]) continue
                if (s1[i] == s2[j]) {
                    s1Matches[i] = true
                    s2Matches[j] = true
                    matches++
                    break
                }
            }
        }

        if (matches == 0) return 0.0

        var transpositions = 0
        var k = 0
        for (i in s1.indices) {
            if (!s1Matches[i]) continue
            while (!s2Matches[k]) k++
            if (s1[i] != s2[k]) transpositions++
            k++
        }

        val m = matches.toDouble()
        val jaro = ((m / s1.length) + (m / s2.length) + ((m - transpositions / 2.0) / m)) / 3.0

        // Winkler prefix bonus (up to 4 characters)
        var prefix = 0
        for (i in 0 until min(4, min(s1.length, s2.length))) {
            if (s1[i] == s2[i]) prefix++ else break
        }

        return jaro + (prefix * 0.1 * (1.0 - jaro))
    }

    /**
     * Computes combined text similarity ratio between 0.0 and 1.0.
     * Evaluates both standard space-separated and collapsed representations.
     */
    fun computeTextSimilarity(s1: String, s2: String): Double {
        if (s1.isBlank() || s2.isBlank()) return 0.0
        if (s1 == s2) return 1.0

        val maxLen = max(s1.length, s2.length).toDouble()
        val levSim = 1.0 - (levenshteinDistance(s1, s2).toDouble() / maxLen)
        val jwSim = jaroWinklerSimilarity(s1, s2)
        val standardSim = max(levSim, jwSim)

        // Collapsed (no spaces) comparison to handle cases like "(des)encanto" -> "des encanto" vs "desencanto"
        val c1 = s1.replace(" ", "")
        val c2 = s2.replace(" ", "")
        if (c1.isNotEmpty() && c2.isNotEmpty() && c1 != s1) {
            val maxLenC = max(c1.length, c2.length).toDouble()
            val levSimC = 1.0 - (levenshteinDistance(c1, c2).toDouble() / maxLenC)
            val jwSimC = jaroWinklerSimilarity(c1, c2)
            val collapsedSim = max(levSimC, jwSimC)
            return max(standardSim, collapsedSim)
        }

        return standardSim
    }

    /**
     * Evaluates Year Match:
     * - Difference <= 1 year: +15 points
     * - Unknown year (null/blank): +10 points (neutral tolerance, no penalty)
     * - Difference == 2 years: +5 points
     * - Difference >= 3 years (e.g. 1990 vs 2024): -35 points penalty (strictly prevents false positives like remakes/classics)
     */
    fun computeYearScore(localYear: String?, tmdbYear: String?): Int {
        val ly = localYear?.toIntOrNull()
        val ty = tmdbYear?.toIntOrNull()

        if (ly != null && ty != null) {
            val diff = kotlin.math.abs(ly - ty)
            return when {
                diff <= 1 -> 15
                diff == 2 -> 5
                else -> -35 // heavy penalty for diverging years (e.g. "Coração Selvagem (2024)" vs "Coração Selvagem (1990)")
            }
        }
        return 15 // neutral score when year is not available (do not penalize lists without year tags)
    }

    /**
     * Evaluates Genre / Category Compatibility (Max 15 points)
     */
    fun computeGenreScore(localCategory: String, tmdbGenres: String?): Int {
        val catNorm = Normalizer.normalize(localCategory, Normalizer.Form.NFD)
            .replace(DIACRITICS_REGEX, "").lowercase(Locale.ROOT)
        val genreNorm = if (tmdbGenres != null) {
            Normalizer.normalize(tmdbGenres, Normalizer.Form.NFD)
                .replace(DIACRITICS_REGEX, "").lowercase(Locale.ROOT)
        } else ""

        // Generic categories are neutral (+15 points)
        val genericWords = listOf("filmes", "series", "geral", "vod", "lancamentos", "4k", "fhd", "hd", "populares", "todos")
        if (genericWords.any { catNorm.contains(it) } && catNorm.length <= 15) {
            return 15
        }

        if (genreNorm.isBlank()) return 15

        // Genre checks
        val horrorWords = listOf("terror", "horror", "suspense", "crime", "slasher", "zumbi")
        val kidsWords = listOf("infantil", "kids", "desenho", "animacao", "animado", "familia")

        val isLocalKids = kidsWords.any { catNorm.contains(it) }
        val isTmdbHorror = horrorWords.any { genreNorm.contains(it) }

        val isLocalHorror = horrorWords.any { catNorm.contains(it) }
        val isTmdbKids = kidsWords.any { genreNorm.contains(it) }

        // Strong conflict: Kids vs Horror/Terror
        if ((isLocalKids && isTmdbHorror) || (isLocalHorror && isTmdbKids)) {
            return -35
        }

        // Direct overlap
        val categories = catNorm.split(" ", "/", "|", "-").filter { it.length >= 4 }
        val hasOverlap = categories.any { genreNorm.contains(it) }
        if (hasOverlap) {
            return 15
        }

        return 10
    }

    /**
     * Evaluates a potential Smart Match using a weighted score system (0 - 100).
     * Minimum required score: 85.
     */
    fun evaluate(
        localRawName: String = "",
        localCategory: String = "",
        localRawYear: String? = null,
        tmdbTitle: String = "",
        tmdbOriginalTitle: String? = null,
        tmdbYear: String? = null,
        tmdbGenres: String? = null,
        localRawTitle: String? = null
    ): SmartMatchResult {
        val effectiveName = if (!localRawTitle.isNullOrBlank()) localRawTitle else localRawName
        return evaluateMatch(
            localRawName = effectiveName,
            localCategory = localCategory,
            localRawYear = localRawYear,
            tmdbTitle = tmdbTitle,
            tmdbOriginalTitle = tmdbOriginalTitle,
            tmdbYear = tmdbYear,
            tmdbGenres = tmdbGenres
        )
    }

    fun evaluateMatch(
        localRawName: String,
        localCategory: String,
        localRawYear: String?,
        tmdbTitle: String,
        tmdbOriginalTitle: String?,
        tmdbYear: String?,
        tmdbGenres: String? = null
    ): SmartMatchResult {
        val (cleanedLocal, extractedLocalYear) = cleanTitle(localRawName)
        val (cleanedTmdb, extractedTmdbYear) = cleanTitle(tmdbTitle)
        val (cleanedTmdbOrig, _) = if (!tmdbOriginalTitle.isNullOrBlank()) cleanTitle(tmdbOriginalTitle) else Pair("", null)

        val finalLocalYear = extractedLocalYear ?: localRawYear?.takeIf { it.isNotBlank() }
        val finalTmdbYear = extractedTmdbYear ?: tmdbYear?.takeIf { it.isNotBlank() }

        // 1. Check Key Numbers & Roman Numerals
        val localKeyNumbers = extractKeyNumbers(cleanedLocal, finalLocalYear)
        val tmdbKeyNumbers = extractKeyNumbers(cleanedTmdb, finalTmdbYear)
        val tmdbOrigKeyNumbers = if (cleanedTmdbOrig.isNotBlank()) extractKeyNumbers(cleanedTmdbOrig, finalTmdbYear) else emptySet()

        val mainKeyCheck = checkKeyNumbers(localKeyNumbers, tmdbKeyNumbers)
        val origKeyCheck = if (cleanedTmdbOrig.isNotBlank()) checkKeyNumbers(localKeyNumbers, tmdbOrigKeyNumbers) else false

        if (!mainKeyCheck && !origKeyCheck && (tmdbKeyNumbers.isNotEmpty() || localKeyNumbers.isNotEmpty())) {
            return SmartMatchResult(
                isMatch = false,
                score = 0,
                textSimilarity = 0.0,
                textScore = 0,
                yearScore = 0,
                genreScore = 0,
                reason = "KeyNumberMismatch(Local=$localKeyNumbers, TMDb=$tmdbKeyNumbers)"
            )
        }

        // 2. Text Similarity (Max 70 points - Minimum 80% similarity required)
        val simMain = computeTextSimilarity(cleanedLocal, cleanedTmdb)
        val simOrig = if (cleanedTmdbOrig.isNotBlank()) computeTextSimilarity(cleanedLocal, cleanedTmdbOrig) else 0.0
        val bestSimilarity = max(simMain, simOrig)

        if (bestSimilarity < 0.80) {
            return SmartMatchResult(
                isMatch = false,
                score = 0,
                textSimilarity = bestSimilarity,
                textScore = 0,
                yearScore = 0,
                genreScore = 0,
                reason = "TextSimilarityBelow80(${(bestSimilarity * 100).roundToInt()}%)"
            )
        }

        val textScore = (bestSimilarity * 70.0).roundToInt()

        // 3. Year Score (Max 15 points)
        val yearScore = computeYearScore(finalLocalYear, finalTmdbYear)

        // 4. Genre Score (Max 15 points)
        val genreScore = computeGenreScore(localCategory, tmdbGenres)

        val totalScore = (textScore + yearScore + genreScore).coerceIn(0, 100)
        val isMatch = totalScore >= MATCH_THRESHOLD

        return SmartMatchResult(
            isMatch = isMatch,
            score = totalScore,
            textSimilarity = bestSimilarity,
            textScore = textScore,
            yearScore = yearScore,
            genreScore = genreScore,
            reason = if (isMatch) "MatchApproved($totalScore/100)" else "ScoreBelowThreshold($totalScore/100)"
        )
    }
}
