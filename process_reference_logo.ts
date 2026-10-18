import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function run() {
  const inputPath = '/tmp/user_reference_logo.raw';
  if (!fs.existsSync(inputPath)) {
    console.error('Reference image not found at ' + inputPath);
    process.exit(1);
  }
  
  const targets = [
    { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48 },
    { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72 },
    { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96 },
    { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144 },
    { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192 },
    { path: 'android/app/src/main/res/drawable/foxstream_logo.png', size: 1024 },
    { path: 'android/app/src/main/res/drawable-mdpi/foxstream_logo.png', size: 160 },
    { path: 'android/app/src/main/res/drawable-hdpi/foxstream_logo.png', size: 240 },
    { path: 'android/app/src/main/res/drawable-xhdpi/foxstream_logo.png', size: 320 },
    { path: 'android/app/src/main/res/drawable-xxhdpi/foxstream_logo.png', size: 480 },
    { path: 'android/app/src/main/res/drawable-xxxhdpi/foxstream_logo.png', size: 640 },
    { path: 'public/favicon.png', size: 192 },
    { path: 'public/apple-touch-icon.png', size: 180 }
  ];

  for (const target of targets) {
    const dir = path.dirname(target.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    await sharp(inputPath)
      .resize(target.size, target.size)
      .toFile(target.path);
  }
  console.log('All icons and logos updated.');
}

run().catch(console.error);
