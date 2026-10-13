with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt') as f:
    text = f.read()

# Add imports if missing
imports_to_add = '''import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.extractors.DefaultExtractorsFactory
import okhttp3.OkHttpClient'''

if 'import androidx.media3.datasource.DefaultDataSource' not in text:
    text = text.replace('import androidx.media3.exoplayer.ExoPlayer', imports_to_add + '\nimport androidx.media3.exoplayer.ExoPlayer')

with open('android/app/src/main/java/com/foxstream/app/ui/screens/Screens.kt', 'w') as f:
    f.write(text)

print('Added imports.')
