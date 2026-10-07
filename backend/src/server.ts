import { buildApp } from './app.js';
import { config } from './config.js';
import { migrate, sql } from './db.js';

await migrate();
const app = await buildApp();
await app.listen({ host: '0.0.0.0', port: config.port });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
}
