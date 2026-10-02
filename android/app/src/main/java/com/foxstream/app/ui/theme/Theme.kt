package com.foxstream.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val OrangePrimary = Color(0xFFFF6600)
val OrangeSecondary = Color(0xFFFF8533)
val DarkBackground = Color(0xFF090A0F)
val DarkSurface = Color(0xFF11131B)
val DarkSurfaceVariant = Color(0xFF1A1D28)
val TextPrimary = Color(0xFFF3F4F6)
val TextSecondary = Color(0xFF9CA3AF)
val AccentRed = Color(0xFFEF4444)
val AccentAmber = Color(0xFFF59E0B)

private val DarkColorScheme = darkColorScheme(
    primary = OrangePrimary,
    onPrimary = Color.White,
    primaryContainer = OrangeSecondary,
    onPrimaryContainer = Color.White,
    secondary = AccentAmber,
    onSecondary = Color.Black,
    background = DarkBackground,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = TextSecondary,
    error = AccentRed,
    onError = Color.White
)

@Composable
fun FoxStreamTheme(
    darkTheme: Boolean = true, // Force dark theme as requested
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
