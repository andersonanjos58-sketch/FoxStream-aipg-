import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function updateIcons() {
  const sourceImage = path.resolve('src/assets/images/foxstream_app_icon_1791701792484.jpg');
  if (!fs.existsSync(sourceImage)) {
    console.error('Source image not found:', sourceImage);
    process.exit(1);
  }

  console.log('Processing app icons with Sharp...');

  // 1. Web Favicons
  await sharp(sourceImage)
    .resize(512, 512)
    .png()
    .toFile('public/favicon.png');

  await sharp(sourceImage)
    .resize(64, 64)
    .png()
    .toFile('public/favicon.ico');

  // 2. Android mipmap densities
  const densities = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const d of densities) {
    const dir = path.resolve(`android/app/src/main/res/${d.name}`);
    if (fs.existsSync(dir)) {
      await sharp(sourceImage)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(sourceImage)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      await sharp(sourceImage)
        .resize(d.size, d.size)
        .png()
        .toFile(path.join(dir, 'ic_launcher_foreground.png'));
    }
  }

  // 3. Android drawable densities (foxstream_logo)
  const drawables = [
    { name: 'drawable-mdpi', size: 120 },
    { name: 'drawable-hdpi', size: 160 },
    { name: 'drawable-xhdpi', size: 240 },
    { name: 'drawable-xxhdpi', size: 320 },
    { name: 'drawable-xxxhdpi', size: 480 },
    { name: 'drawable', size: 512 },
  ];

  for (const dr of drawables) {
    const dir = path.resolve(`android/app/src/main/res/${dr.name}`);
    if (fs.existsSync(dir)) {
      await sharp(sourceImage)
        .resize(dr.size, dr.size)
        .png()
        .toFile(path.join(dir, 'foxstream_logo.png'));
    }
  }

  console.log('All app icons and favicons updated successfully!');
}

updateIcons().catch(console.error);
