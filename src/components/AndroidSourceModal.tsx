import React, { useState } from 'react';
import { X, Smartphone, Copy, Check, FileCode, Layers, ShieldCheck, Terminal, Download } from 'lucide-react';

interface AndroidSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ANDROID_FILES = [
  {
    name: 'MainActivity.kt',
    path: 'android/app/src/main/java/com/foxstream/app/MainActivity.kt',
    lang: 'kotlin',
    code: `package com.foxstream.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.foxstream.app.ui.FoxStreamApp
import com.foxstream.app.ui.theme.FoxStreamTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FoxStreamTheme {
                FoxStreamApp()
            }
        }
    }
}`
  },
  {
    name: 'PlaybackHelper.kt',
    path: 'android/app/src/main/java/com/foxstream/app/util/PlaybackHelper.kt',
    lang: 'kotlin',
    code: `package com.foxstream.app.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

object PlaybackHelper {
    /**
     * Dispatches external playback prioritizing VLC Media Player on Android.
     * If VLC is not installed, falls back to Android's ACTION_VIEW video selector.
     */
    fun openExternalPlayer(context: Context, streamUrl: String, title: String) {
        val uri = Uri.parse(streamUrl)
        
        // 1. Try launching VLC directly via explicit package Intent
        val vlcIntent = Intent(Intent.ACTION_VIEW).apply {
            setPackage("org.videolan.vlc")
            setDataAndTypeAndNormalize(uri, "video/*")
            putExtra("title", title)
            putExtra("from_start", true)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            context.startActivity(vlcIntent)
            return
        } catch (e: Exception) {
            // VLC not installed or unavailable, fallback to system chooser
        }

        // 2. Generic System Video Intent
        val genericIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndTypeAndNormalize(uri, "video/*")
            putExtra("title", title)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            val chooser = Intent.createChooser(genericIntent, "Reproduzir: $title")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(context, "Nenhum reprodutor de vídeo encontrado.", Toast.LENGTH_SHORT).show()
        }
    }
}`
  },
  {
    name: 'FoxStreamApp.kt',
    path: 'android/app/src/main/java/com/foxstream/app/ui/FoxStreamApp.kt',
    lang: 'kotlin',
    code: `package com.foxstream.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.foxstream.app.ui.navigation.FoxStreamNavGraph

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FoxStreamApp() {
    val navController = rememberNavController()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.safeDrawing
    ) { paddingValues ->
        FoxStreamNavGraph(
            navController = navController,
            modifier = Modifier.padding(paddingValues)
        )
    }
}`
  },
  {
    name: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    lang: 'xml',
    code: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Queries package declaration for VLC Media Player -->
    <queries>
        <package android:name="org.videolan.vlc" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:mimeType="video/*" />
        </intent>
    </queries>

    <application
        android:name=".FoxStreamApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.FoxStream"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/Theme.FoxStream">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>`
  },
  {
    name: 'build.gradle.kts',
    path: 'android/app/build.gradle.kts',
    lang: 'kotlin',
    code: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.foxstream.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.foxstream.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.material3)
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.androidx.navigation.compose)
    implementation("io.coil-kt:coil-compose:2.6.0")
    implementation("androidx.room:room-runtime:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
}`
  },
  {
    name: 'proguard-rules.pro',
    path: 'android/app/proguard-rules.pro',
    lang: 'text',
    code: `# Proguard rules for FoxStream App
# Add custom Proguard rules here.
-keep class com.foxstream.app.** { *; }`
  },
  {
    name: 'ic_launcher.xml',
    path: 'android/app/src/main/res/mipmap/ic_launcher.xml',
    lang: 'xml',
    code: `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Dark square background for the app icon -->
    <path
        android:fillColor="#121212"
        android:pathData="M16,16 H92 V92 H16 Z" />
    <!-- FoxStream play triangular/stream logo -->
    <path
        android:fillColor="#FF2575FC"
        android:pathData="M42,34 L74,54 L42,74 Z" />
</vector>`
  },
  {
    name: 'ic_launcher_round.xml',
    path: 'android/app/src/main/res/mipmap/ic_launcher_round.xml',
    lang: 'xml',
    code: `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <!-- Dark circular background for the round app icon -->
    <path
        android:fillColor="#121212"
        android:pathData="M54,54 m-44,0 a44,44 0 1,1 88,0 a-44,-44 0 1,1 -88,0" />
    <!-- FoxStream play triangular/stream logo -->
    <path
        android:fillColor="#FF2575FC"
        android:pathData="M42,34 L74,54 L42,74 Z" />
</vector>`
  }
];

export const AndroidSourceModal: React.FC<AndroidSourceModalProps> = ({ isOpen, onClose }) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentFile = ANDROID_FILES[selectedFileIndex];

  const handleCopyCode = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(currentFile.code)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      id="android-source-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div 
        id="android-source-modal"
        className="relative w-full max-w-4xl max-h-[92vh] bg-[#10121a] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-[#0c0e15]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-['Outfit']">
                  Código Fonte Nativo Android (Kotlin & Jetpack Compose)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Nativo
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Arquivos do projeto Kotlin com suporte a Intents de reprodução externa VLC
              </p>
            </div>
          </div>

          <button
            id="android-source-close-btn"
            type="button"
            aria-label="Fechar código fonte Android"
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area with File Tabs */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* File sidebar tabs */}
          <div className="w-full md:w-64 bg-[#0a0c12] border-b md:border-b-0 md:border-r border-neutral-800/80 p-3 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
            <span className="hidden md:block text-[11px] font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">
              Arquivos do Projeto
            </span>
            {ANDROID_FILES.map((file, idx) => (
              <button
                key={file.name}
                type="button"
                onClick={() => setSelectedFileIndex(idx)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono text-left transition-colors shrink-0 md:shrink ${
                  selectedFileIndex === idx
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#07080c]">
            {/* File Path & Copy Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#090b10] border-b border-neutral-800/60 text-xs">
              <span className="font-mono text-[11px] text-neutral-400 truncate">
                {currentFile.path}
              </span>
              <button
                id="android-source-copy-code-btn"
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                <span>{copied ? 'Copiado!' : 'Copiar Código'}</span>
              </button>
            </div>

            {/* Code Display */}
            <div className="flex-1 overflow-auto p-4 font-mono text-[11px] sm:text-xs text-neutral-300 leading-relaxed bg-[#07080c]">
              <pre className="whitespace-pre">
                <code>{currentFile.code}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#0a0c12] border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Compatível com Android 8.0+ (API 26+) e Jetpack Compose Material 3</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
