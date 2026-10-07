import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authPlugin } from './auth/plugin.js';
import { config } from './config.js';
import { sql } from './db.js';
import { authRoutes } from './routes/auth.js';
import { notebookRoutes } from './routes/notebooks.js';
import { pageRoutes } from './routes/pages.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: 20 * 1024 * 1024, // pages full of ink get big
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(authPlugin);

  app.get('/api/health', { logLevel: 'warn' }, async () => {
    await sql`SELECT 1`;
    return { ok: true };
  });

  await app.register(
    async (api) => {
      await api.register(authRoutes);

      // Everything else requires a valid admin token.
      await api.register(async (protectedApi) => {
        protectedApi.addHook('onRequest', protectedApi.authenticate);
        await protectedApi.register(notebookRoutes);
        await protectedApi.register(pageRoutes);
      });
    },
    { prefix: '/api' },
  );

  return app;
}
