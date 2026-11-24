import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { createApiRouter } from './server/routes.ts';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '6mb' }));
  app.use('/api', createApiRouter());
  return app;
}

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`XO WORLD server running on http://0.0.0.0:${port}`);
  });
}

// Start HTTP server only when executed directly (not when imported by test runner)
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), 'server.ts');

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('Failed to start XO WORLD server:', err);
    process.exit(1);
  });
}
