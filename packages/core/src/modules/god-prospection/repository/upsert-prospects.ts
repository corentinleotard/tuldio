import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';

interface ProspectInput {
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  source: string;
  scraped: boolean;
}

/**
 * Insert prospects, skipping duplicates by email.
 * NEVER updates existing rows — existing data is sacred.
 */
export async function upsertProspects(input: {
  prospects: ProspectInput[];
}): Promise<{ inserted: number; skipped: number }> {
  if (input.prospects.length === 0) return { inserted: 0, skipped: 0 };

  let inserted = 0;
  let skipped = 0;

  // Batch insert with ON CONFLICT DO NOTHING (never override)
  const BATCH_SIZE = 100;
  for (let i = 0; i < input.prospects.length; i += BATCH_SIZE) {
    const batch = input.prospects.slice(i, i + BATCH_SIZE);

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const p = batch[j]!;
      const offset = j * 8;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
      );
      values.push(
        generateId(),
        p.profession,
        p.firstName,
        p.fullName,
        p.email.toLowerCase().trim(),
        p.phone || null,
        p.source,
        p.scraped,
      );
    }

    const result = await query(
      `INSERT INTO god_prospects (id, profession, first_name, full_name, email, phone, source, scraped)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (email) DO NOTHING`,
      values,
    );

    inserted += result.rowCount ?? 0;
    skipped += batch.length - (result.rowCount ?? 0);
  }

  return { inserted, skipped };
}
