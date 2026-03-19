import pg from 'pg';
import { logger } from '../infra/logger.js';

let pool: pg.Pool | null = null;
let queryOverride: ((text: string, params?: unknown[]) => Promise<pg.QueryResult>) | null = null;

export async function connectDb(): Promise<void> {
  if (pool) return;

  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  await pool.query('SELECT 1');
  logger.info('Connected to PostgreSQL');
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database not connected. Call connectDb() first.');
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  if (queryOverride) return queryOverride(text, params) as Promise<pg.QueryResult<T>>;
  return getPool().query<T>(text, params);
}

/** Run a function inside a database transaction using a dedicated client. */
export async function withTransaction<T>(fn: (tx: {
  query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<pg.QueryResult<R>>;
}) => Promise<T>): Promise<T> {
  if (queryOverride) {
    // In test mode, queries already run on a single client — skip client checkout
    await query('BEGIN');
    try {
      const result = await fn({ query });
      await query('COMMIT');
      return result;
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const tx = {
      query: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) =>
        client.query<R>(text, params),
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Test-only: override all query() calls to use a specific client (for transactional rollback). */
export function __setQueryOverride(fn: ((text: string, params?: unknown[]) => Promise<pg.QueryResult>) | null): void {
  queryOverride = fn;
}
