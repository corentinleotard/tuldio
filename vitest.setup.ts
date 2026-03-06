import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import pg from 'pg';
import { __setQueryOverride } from './packages/core/src/lib/database/db.js';

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/tuldio_test';

let pool: pg.Pool;
let client: pg.PoolClient;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
  await pool.query('SELECT 1');
});

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
  __setQueryOverride((text, params) => client.query(text, params));
});

afterEach(async () => {
  __setQueryOverride(null);
  await client.query('ROLLBACK');
  client.release();
});

afterAll(async () => {
  await pool.end();
});
