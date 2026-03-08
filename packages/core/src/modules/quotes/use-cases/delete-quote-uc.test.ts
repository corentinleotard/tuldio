import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { deleteQuoteUc } from './delete-quote-uc.js';

async function seedTeamAndClient(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
}

async function insertQuote(input: { teamId: string; clientId: string; status?: string }) {
  const quoteId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6)`,
    [quoteId, input.teamId, userId, input.clientId, `D-${generateId().slice(0, 8)}`, input.status ?? 'draft'],
  );

  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('deleteQuoteUc', () => {
  it('deletes a draft quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    await deleteQuoteUc({ teamId, quoteId });

    const rows = await query('SELECT id FROM quotes WHERE id = $1', [quoteId]);
    expect(rows.rows).toHaveLength(0);
  });

  it('rejects deletion of a sent quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'sent' });

    await expect(
      deleteQuoteUc({ teamId, quoteId }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');

    const rows = await query('SELECT id FROM quotes WHERE id = $1', [quoteId]);
    expect(rows.rows).toHaveLength(1);
  });

  it('rejects deletion of an accepted quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'accepted' });

    await expect(
      deleteQuoteUc({ teamId, quoteId }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('rejects deletion of a refused quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'refused' });

    await expect(
      deleteQuoteUc({ teamId, quoteId }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('throws when quote not found', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    await expect(
      deleteQuoteUc({ teamId, quoteId: generateId() }),
    ).rejects.toThrow('Devis introuvable');
  });

  it('rejects deletion of another team quote', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    await expect(
      deleteQuoteUc({ teamId: otherTeamId, quoteId }),
    ).rejects.toThrow('Devis introuvable');

    // Quote still exists
    const rows = await query('SELECT id FROM quotes WHERE id = $1', [quoteId]);
    expect(rows.rows).toHaveLength(1);
  });
});
