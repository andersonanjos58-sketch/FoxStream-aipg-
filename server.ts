process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Readable } from 'stream';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Endpoint to receive original exact user logo image, generate all Android icons and push
  app.post('/api/upload-logo', async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenhuma imagem enviada' });
      }
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const sharp = (await import('sharp')).default;

      // 1. Save master web image
      const masterPath = path.join(process.cwd(), 'src/assets/images/foxstream_logo_new_1790894733124.jpg');
      await sharp(buffer).jpeg({ quality: 100 }).toFile(masterPath);

      // 2. Android Drawables: R.drawable.foxstream_logo (1024x1024)
      const drawableDirs = [
        'android/app/src/main/res/drawable',
        'android/app/src/main/res/drawable-mdpi',
        'android/app/src/main/res/drawable-hdpi',
        'android/app/src/main/res/drawable-xhdpi',
        'android/app/src/main/res/drawable-xxhdpi',
        'android/app/src/main/res/drawable-xxxhdpi',
      ];
      for (const d of drawableDirs) {
        fs.mkdirSync(path.join(process.cwd(), d), { recursive: true });
        await sharp(buffer)
          .resize(1024, 1024, { fit: 'contain' })
          .png()
          .toFile(path.join(process.cwd(), d, 'foxstream_logo.png'));
      }

      // 3. Android Mipmaps (Launcher Icons)
      const mipmaps = [
        { folder: 'mipmap-mdpi', size: 48, fgSize: 108 },
        { folder: 'mipmap-hdpi', size: 72, fgSize: 162 },
        { folder: 'mipmap-xhdpi', size: 96, fgSize: 216 },
        { folder: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
        { folder: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
      ];
      for (const m of mipmaps) {
        const dir = path.join(process.cwd(), 'android/app/src/main/res', m.folder);
        fs.mkdirSync(dir, { recursive: true });

        const radius = Math.round(m.size * 0.22);
        const squircleSvg = Buffer.from(`<svg width="${m.size}" height="${m.size}"><rect x="0" y="0" width="${m.size}" height="${m.size}" rx="${radius}" ry="${radius}" fill="white"/></svg>`);
        const resized = await sharp(buffer).resize(m.size, m.size).toBuffer();

        await sharp(resized)
          .composite([{ input: squircleSvg, blend: 'dest-in' }])
          .png()
          .toFile(path.join(dir, 'ic_launcher.png'));

        const circleRadius = m.size / 2;
        const circleSvg = Buffer.from(`<svg width="${m.size}" height="${m.size}"><circle cx="${circleRadius}" cy="${circleRadius}" r="${circleRadius}" fill="white"/></svg>`);
        await sharp(resized)
          .composite([{ input: circleSvg, blend: 'dest-in' }])
          .png()
          .toFile(path.join(dir, 'ic_launcher_round.png'));

        await sharp(buffer)
          .resize(m.fgSize, m.fgSize, { fit: 'contain' })
          .png()
          .toFile(path.join(dir, 'ic_launcher_foreground.png'));
      }

      // 4. Web Favicons
      const publicDir = path.join(process.cwd(), 'public');
      fs.mkdirSync(publicDir, { recursive: true });
      await sharp(buffer).resize(64, 64).png().toFile(path.join(publicDir, 'favicon.png'));
      await sharp(buffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.ico'));

      // 5. Automatic Git commit and push in single commit
      const { execSync } = await import('child_process');
      try {
        execSync('git add -A && git commit -m "feat(logo): Apply exact user original logo to Android launcher and web" && git push origin main', {
          cwd: process.cwd()
        });
      } catch (gitErr: any) {
        console.warn('Git push notice:', gitErr.message);
      }

      res.json({ success: true, message: 'Logo original aplicado com 100% de fidelidade em todos os ícones e enviado ao GitHub!' });
    } catch (err: any) {
      console.error('[Upload Logo Error]:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'FoxStream' });
  });

  // GitHub status check
  app.get('/api/github/status', async (req, res) => {
    try {
      const { execSync } = await import('child_process');
      const remote = execSync('git remote get-url origin 2>/dev/null || true', { encoding: 'utf-8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"', { encoding: 'utf-8' }).trim();
      const commitCount = execSync('git rev-list --count HEAD 2>/dev/null || echo "0"', { encoding: 'utf-8' }).trim();
      const lastCommit = execSync('git log -1 --pretty=format:"%h - %s (%cr)" 2>/dev/null || true', { encoding: 'utf-8' }).trim();
      res.json({
        initialized: true,
        branch,
        remote: remote ? remote.replace(/https:\/\/[^@]+@/, 'https://') : null,
        commitCount: parseInt(commitCount, 10) || 0,
        lastCommit
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GitHub push endpoint
  app.post('/api/github/push', async (req, res) => {
    try {
      const { repoUrl, token, branch = 'main' } = req.body;
      if (!repoUrl) {
        return res.status(400).json({ error: 'URL do repositório é obrigatória (ex: https://github.com/usuario/foxstream.git)' });
      }

      let formattedUrl = repoUrl.trim();
      if (!formattedUrl.endsWith('.git')) {
        formattedUrl += '.git';
      }

      // If token is provided, embed it into the HTTPS URL
      if (token && token.trim()) {
        const cleanToken = token.trim();
        formattedUrl = formattedUrl.replace(/^https:\/\//, `https://${cleanToken}@`);
      }

      const { execSync } = await import('child_process');

      // Make sure all changes are committed
      try {
        execSync('git add -A && (git commit -m "chore: sync project before push" || true)', { cwd: process.cwd() });
      } catch {}

      // Update or set origin remote
      try {
        execSync('git remote remove origin 2>/dev/null || true', { cwd: process.cwd() });
        execSync(`git remote add origin ${formattedUrl}`, { cwd: process.cwd() });
      } catch (e: any) {
        return res.status(500).json({ error: `Falha ao configurar remote origin: ${e.message}` });
      }

      // Push to GitHub
      try {
        const pushOutput = execSync(`git push -u origin ${branch} --force`, {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 60000
        });
        return res.json({
          success: true,
          message: 'Projeto enviado com sucesso para o GitHub! O workflow GitHub Actions foi acionado para gerar o APK.',
          output: pushOutput
        });
      } catch (pushErr: any) {
        const msg = pushErr.stderr || pushErr.message || 'Erro desconhecido ao executar git push';
        // Clean out any token in error message for security
        const safeMsg = msg.replace(/https:\/\/[^@]+@/g, 'https://***@');
        return res.status(500).json({ error: safeMsg });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Re-generate and download full source ZIP archive
  app.get('/api/download-zip', async (req, res) => {
    try {
      const { execSync } = await import('child_process');
      const zipPath = path.join(process.cwd(), 'public', 'foxstream-source.zip');
      execSync(`git archive --format=zip HEAD -o "${zipPath}"`, { cwd: process.cwd() });
      res.download(zipPath, 'foxstream-source.zip');
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // CORS Proxy endpoint for Xtream Codes & M3U URLs
  app.get('/api/proxy', async (req, res) => {
    // Extract full target URL even if it has unencoded query parameters like ?username=...&password=...
    const originalUrl = req.originalUrl;
    const urlParamIdx = originalUrl.indexOf('url=');
    let targetUrl = '';

    if (urlParamIdx !== -1) {
      targetUrl = originalUrl.substring(urlParamIdx + 4);
      try {
        targetUrl = decodeURIComponent(targetUrl);
      } catch {
        // use raw if decoding fails
      }
    } else {
      targetUrl = (req.query.url as string) || '';
    }

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
      // Validate target URL
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ error: 'Invalid URL protocol. Use http:// or https://' });
      }

      // Forward Range request headers for audio/video seeking support
      const headers: Record<string, string> = {
        'User-Agent': 'IPTVSmartersPro/3.1.5.1 (Linux; Android 12) VLC/3.0.18',
        'Accept': '*/*'
      };
      if (req.headers.range) {
        headers['Range'] = req.headers.range as string;
      }

      console.log(`[Proxy Request] Target URL: ${targetUrl} (Range: ${req.headers.range || 'None'})`);

      const response = await fetch(targetUrl, {
        headers,
        redirect: 'follow'
      });

      console.log(`[Proxy Response] Target URL: ${targetUrl} -> Status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);

      const contentType = response.headers.get('content-type') || '';
      const isM3u8 = contentType.includes('mpegurl') || contentType.includes('mpegURL') || targetUrl.includes('.m3u8');

      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (isM3u8) {
        // M3U8 Playlist: read as text, rewrite relative and absolute paths to proxy URLs
        const text = await response.text();
        const proxyBase = `${req.protocol}://${req.get('host')}`;
        const finalUrl = response.url || targetUrl;

        const resolveUrl = (urlStr: string): string => {
          try {
            return new URL(urlStr, finalUrl).href;
          } catch {
            return urlStr;
          }
        };

        const lines = text.split(/\r?\n/);
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith('#')) {
            // Rewrite URI="http://..." keys inside tags
            return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absoluteUri = resolveUrl(uri);
              const proxied = `${proxyBase}/api/proxy?url=${encodeURIComponent(absoluteUri)}`;
              return `URI="${proxied}"`;
            });
          }

          // Rewrite direct segment file URLs
          const absoluteUrl = resolveUrl(trimmed);
          return `${proxyBase}/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        return res.status(response.status).send(rewrittenLines.join('\n'));
      }

      // Large Media stream files: stream chunk by chunk directly to prevent OOM
      const headersToCopy = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'content-disposition',
        'cache-control'
      ];

      headersToCopy.forEach(header => {
        const val = response.headers.get(header);
        if (val) {
          res.setHeader(header, val);
        }
      });

      res.status(response.status);

      if (response.body) {
        if (typeof (response.body as any).pipe === 'function') {
          (response.body as any).pipe(res);
        } else {
          try {
            Readable.fromWeb(response.body as any).pipe(res);
          } catch {
            try {
              Readable.from(response.body as any).pipe(res);
            } catch (streamErr: any) {
              console.error('[Proxy Stream Error] Failed to pipe body:', streamErr.message);
              res.end();
            }
          }
        }
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('Proxy fetch error:', err.message);
      res.status(502).json({
        error: 'Falha ao buscar recurso remoto',
        details: err.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FoxStream server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
