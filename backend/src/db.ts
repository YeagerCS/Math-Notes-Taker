import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config } from './config.js';

export const sql = postgres(config.databaseUrl, {
  max: 5,
  transform: postgres.camel,
  onnotice: () => {},
});

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** Applies pending *.sql files from /migrations in filename order inside one locked transaction. */
export async function migrate(): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(4242)`;
    const applied = new Set((await tx`SELECT name FROM schema_migrations`).map((r) => r.name as string));
    for (const file of files) {
      if (applied.has(file)) continue;
      await tx.unsafe(await readFile(path.join(MIGRATIONS_DIR, file), 'utf8'));
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      console.log(`migration applied: ${file}`);
    }
  });
}
