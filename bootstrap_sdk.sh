#!/bin/bash
set -e

echo "Starting Android SDK & JDK 17 bootstrap..."

# 1. Prepare directories
mkdir -p /app/applet/android-sdk/cmdline-tools

# 2. Download and Extract JDK 17
if [ ! -d /app/applet/jdk-17 ]; then
    echo "Downloading JDK 17..."
    curl -L -o /tmp/jdk-17.tar.gz "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.10_7.tar.gz"
    echo "Extracting JDK 17..."
    tar -xzf /tmp/jdk-17.tar.gz -C /tmp/
    mv /tmp/jdk-17.0.10+7 /app/applet/jdk-17
    echo "JDK 17 installed successfully!"
fi

# Export Java environments
export JAVA_HOME=/app/applet/jdk-17
export PATH=$JAVA_HOME/bin:$PATH

# Verify Java works
java -version

# 3. Download latest command-line tools
if [ ! -f /tmp/cmdline-tools.zip ]; then
    echo "Downloading command-line tools..."
    curl -L -o /tmp/cmdline-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
fi

# 4. Extract command-line tools
echo "Extracting command-line tools..."
rm -rf /app/applet/android-sdk/cmdline-tools
mkdir -p /app/applet/android-sdk/cmdline-tools
unzip -q -o /tmp/cmdline-tools.zip -d /app/applet/android-sdk/cmdline-tools

# 5. Move to 'latest' structure as expected by sdkmanager
echo "Configuring directory structure..."
mv /app/applet/android-sdk/cmdline-tools/cmdline-tools /app/applet/android-sdk/cmdline-tools/latest

# 6. Accept licenses
echo "Accepting Android SDK licenses..."
yes | /app/applet/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/app/applet/android-sdk --licenses

# 7. Install target platform & build tools
echo "Installing platforms;android-34 and build-tools;34.0.0..."
/app/applet/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/app/applet/android-sdk "platforms;android-34" "build-tools;34.0.0" "platform-tools"

echo "Android SDK & JDK 17 bootstrap completed successfully!"
