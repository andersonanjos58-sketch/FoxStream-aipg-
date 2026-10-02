# Proguard rules for FoxStream App
-keep class com.foxstream.app.** { *; }
-keepclassmembers class com.foxstream.app.data.model.** { *; }

# LibVLC (Native JNI bindings - preserves all C/C++ engine methods)
-keep class org.videolan.libvlc.** { *; }
-keep interface org.videolan.libvlc.** { *; }
-keepclassmembers class org.videolan.libvlc.** { *; }
-dontwarn org.videolan.libvlc.**

# AndroidX Media3 / ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Room Database
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }

# Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
