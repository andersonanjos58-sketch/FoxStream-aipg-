plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.foxstream.app"
    compileSdk = 34

    val omdbKey = (project.findProperty("OMDB_API_KEY") as? String) ?: "f48df120"
    val tmdbKey = (project.findProperty("TMDB_API_KEY") as? String) ?: "6fb6ba516b5df9841c2ac73a2974bbfb"
    val tmdbToken = (project.findProperty("TMDB_READ_ACCESS_TOKEN") as? String) ?: "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2ZmI2YmE1MTZiNWRmOTg0MWMyYWM3M2EyOTc0YmJmYiIsIm5iZiI6MTc4OTk3NTY0MS4yNTUsInN1YiI6IjZhYjBkYzU5YmJiZGQ4MzdhNmM4YmIxYSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.5hLq_cry3Sh_KEKj-_Wo2DGNOFuugz6jjfy3J7ePDMQ"

    defaultConfig {
        buildConfigField("String", "OMDB_API_KEY", "\"$omdbKey\"")
        buildConfigField("String", "TMDB_API_KEY", "\"$tmdbKey\"")
        buildConfigField("String", "TMDB_READ_ACCESS_TOKEN", "\"$tmdbToken\"")
        applicationId = "com.foxstream.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a")
            isUniversalApk = true
        }
    }

    packaging {
        resources {
            excludes += listOf(
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE",
                "META-INF/LICENSE.txt",
                "META-INF/license.txt",
                "META-INF/NOTICE",
                "META-INF/NOTICE.txt",
                "META-INF/notice.txt",
                "META-INF/ASL2.0",
                "META-INF/*.kotlin_module"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation(libs.kotlinx.coroutines.android)

    // Room
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("com.google.code.gson:gson:2.10.1")

    // Media3 ExoPlayer
    implementation("androidx.media3:media3-exoplayer:1.3.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.3.1")
    implementation("androidx.media3:media3-ui:1.3.1")
    implementation("androidx.media3:media3-datasource-okhttp:1.3.1")

    // LibVLC for Android
    implementation("org.videolan.android:libvlc-all:3.6.5")
}
