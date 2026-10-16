import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function run() {
  const inputPath = '/tmp/user_reference_logo.raw';
  if (!fs.existsSync(inputPath)) {
    console.error('Reference image not found at', inputPath);
    process.exit(1);
  }

  console.log('Loading source image from:', inputPath);
  const sourceBuffer = fs.readFileSync(inputPath);
  const meta = await sharp(sourceBuffer).metadata();
  console.log(`Source dimensions: ${meta.width}x${meta.height}, format: ${meta.format}`);

  // 1. Web Assets in src/assets/images
  const webImageDir = path.resolve('src/assets/images');
  if (!fs.existsSync(webImageDir)) {
    fs.mkdirSync(webImageDir, { recursive: true });
  }

  // Exact reference PNG copy
  fs.writeFileSync(path.join(webImageDir, 'foxstream_logo_reference.png'), sourceBuffer);
  fs.writeFileSync(path.join(webImageDir, 'foxstream_logo_original.png'), sourceBuffer);

  // Highest quality JPGs (quality: 100, chromaSubsampling: '4:4:4') for existing imported filenames
  const jpgFiles = [
    'foxstream_logo_new_1790894733124.jpg',
    'foxstream_app_icon_1791701792484.jpg',
    'app_icon_1791702297063.jpg',
    'foxstream_logo_1789948190966.jpg',
    'foxstream_logo_1790006129045.jpg',
  ];

  for (const file of jpgFiles) {
    const dest = path.join(webImageDir, file);
    await sharp(sourceBuffer)
      .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
      .toFile(dest);
    console.log(`Updated web asset: ${file}`);
  }

  // 2. Web Favicons in public/
  await sharp(sourceBuffer)
    .resize(512, 512, { fit: 'contain' })
    .png()
    .toFile('public/favicon.png');
  console.log('Updated public/favicon.png (512x512)');

  await sharp(sourceBuffer)
    .resize(64, 64, { fit: 'contain' })
    .png()
    .toFile('public/favicon.ico');
  console.log('Updated public/favicon.ico (64x64)');

  // 3. Android Drawables: foxstream_logo.png
  const drawables = [
    { name: 'drawable', size: 1024 },
    { name: 'drawable-mdpi', size: 120 },
    { name: 'drawable-hdpi', size: 160 },
    { name: 'drawable-xhdpi', size: 240 },
    { name: 'drawable-xxhdpi', size: 320 },
    { name: 'drawable-xxxhdpi', size: 480 },
  ];

  for (const dr of drawables) {
    const dir = path.resolve(`android/app/src/main/res/${dr.name}`);
    if (fs.existsSync(dir)) {
      await sharp(sourceBuffer)
        .resize(dr.size, dr.size, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'foxstream_logo.png'));
      console.log(`Updated android/${dr.name}/foxstream_logo.png (${dr.size}x${dr.size})`);
    }
  }

  // 4. Android Mipmap densities: ic_launcher, ic_launcher_round, ic_launcher_foreground
  const mipmaps = [
    { name: 'mipmap-mdpi', size: 48 },
    { name: 'mipmap-hdpi', size: 72 },
    { name: 'mipmap-xhdpi', size: 96 },
    { name: 'mipmap-xxhdpi', size: 144 },
    { name: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const mm of mipmaps) {
    const dir = path.resolve(`android/app/src/main/res/${mm.name}`);
    if (fs.existsSync(dir)) {
      await sharp(sourceBuffer)
        .resize(mm.size, mm.size, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'ic_launcher.png'));

      await sharp(sourceBuffer)
        .resize(mm.size, mm.size, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'ic_launcher_round.png'));

      await sharp(sourceBuffer)
        .resize(mm.size, mm.size, { fit: 'contain' })
        .png()
        .toFile(path.join(dir, 'ic_launcher_foreground.png'));

      console.log(`Updated android/${mm.name}/ (size: ${mm.size}x${mm.size})`);
    }
  }

  // Also update duplicate directory app/applet if present
  if (fs.existsSync('app/applet/update_icons.ts')) {
    console.log('Copying update script to app/applet/');
    fs.copyFileSync('process_reference_logo.ts', 'app/applet/update_icons.ts');
  }

  console.log('SUCCESS: All logos and icons have been replaced faithfully with the reference image!');
}

run().catch(console.error);
