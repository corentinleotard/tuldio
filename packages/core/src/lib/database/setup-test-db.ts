import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');
const DB_NAME = 'tuldio_test';
const BASE_URL = 'postgresql://postgres:postgres@localhost:5432';

async function run() {
  const adminClient = new pg.Client({ connectionString: `${BASE_URL}/postgres` });
  await adminClient.connect();

  const exists = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
  if (exists.rows.length === 0) {
    await adminClient.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`Created database ${DB_NAME}`);
  } else {
    console.log(`Database ${DB_NAME} already exists`);
  }
  await adminClient.end();

  // Run migrations against the test DB
  process.env.DATABASE_URL = `${BASE_URL}/${DB_NAME}`;

  const { connectDb, query } = await import('./db.js');
  await connectDb();

  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const applied = new Set(
    (await query<{ name: string }>('SELECT name FROM _migrations ORDER BY id')).rows.map((r) => r.name),
  );

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(MIGRATIONS_DIR, file), { encoding: 'utf8' });
    console.log(`Applying: ${file}`);
    await query('BEGIN');
    try {
      await query(sql);
      await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await query('COMMIT');
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  console.log(`Test database ready: ${BASE_URL}/${DB_NAME}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
