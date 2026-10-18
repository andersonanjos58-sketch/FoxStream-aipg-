import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer } from 'vite';

async function startServer() {
  const app = express();

  // Proxy Endpoint
  app.get('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send('Missing url parameter');
    }

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Range': req.headers.range || '',
          'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
        },
      });

      // Set CORS Headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
      
      if (response.headers.get('content-length')) {
        res.setHeader('Content-Length', response.headers.get('content-length')!);
      }
      if (response.headers.get('content-range')) {
        res.setHeader('Content-Range', response.headers.get('content-range')!);
      }
      
      res.status(response.status);
      
      // Stream the response
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (error) {
      console.error('Proxy Error:', error);
      res.status(500).send('Proxy Error');
    }
  });

  // Vite Integration
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}

startServer();
