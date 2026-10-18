import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function run() {
  const inputPath = '/tmp/user_reference_logo.raw';
  if (!fs.existsSync(inputPath)) {
    console.error('Reference image not found at ' + inputPath);
    process.exit(1);
  }
  
  // Android mipmap paths
  const targets = [
    { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', size: 48 },
    { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', size: 72 },
    { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', size: 96 },
    { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', size: 144 },
    { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', size: 192 },
    { path: 'android/app/src/main/res/drawable/foxstream_logo.png', size: 1024 },
    { path: 'public/favicon.png', size: 192 },
    { path: 'public/apple-touch-icon.png', size: 180 }
  ];

  for (const target of targets) {
    console.log('Processing:', target.path, 'size:', target.size);
    // Ensure directory exists
    const dir = path.dirname(target.path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    await sharp(inputPath)
      .resize(target.size, target.size)
      .toFile(target.path);
  }
  console.log('All icons updated.');
}

run().catch(console.error);
