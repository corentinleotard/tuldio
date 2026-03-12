import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { updateQuote } from './update-quote.js';

async function seedTeamAndClient(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
}

async function insertQuote(input: {
  teamId: string;
  clientId: string;
  status?: string;
}) {
  const quoteId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
     VALUES ($1, $2, $3, $4, 'DEVIS-2026-0001', 10000, 12000, $5)`,
    [quoteId, input.teamId, userId, input.clientId, input.status ?? 'draft'],
  );

  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation initiale', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

const newLines = [
  { description: 'Pose carrelage', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 1000 },
  { description: 'Fourniture carrelage', quantity: 10, unit: 'm²', unitPrice: 3800, tvaRate: 2000 },
];

describe('updateQuote', () => {
  it('updates lines on a draft quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    const result = await updateQuote({ teamId, quoteId, lines: newLines });

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]!.description).toBe('Pose carrelage');
    expect(result.totalHt).toBe(83000);
  });

  it('rejects editing a sent quote (frozen after send)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'sent' });

    await expect(
      updateQuote({ teamId, quoteId, lines: newLines }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('rejects editing an accepted quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'accepted' });

    await expect(
      updateQuote({ teamId, quoteId, lines: newLines }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('rejects editing a refused quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'refused' });

    await expect(
      updateQuote({ teamId, quoteId, lines: newLines }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('rejects editing a cancelled quote', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'cancelled' });

    await expect(
      updateQuote({ teamId, quoteId, lines: newLines }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('rejects editing a draft quote with linked invoices', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    // Create a linked invoice
    const invoiceUserId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Invoice User')`,
      [invoiceUserId, teamId, `invoice-${invoiceUserId}@test.com`],
    );
    await query(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, total_ht, total_ttc, status)
       VALUES ($1, $2, $3, $4, $5, 'FAC-2026-0001', 10000, 12000, 'draft')`,
      [generateId(), teamId, invoiceUserId, clientId, quoteId],
    );

    await expect(
      updateQuote({ teamId, quoteId, lines: newLines }),
    ).rejects.toThrow('Ce devis ne peut plus être modifié');
  });

  it('allows editing a quote when linked invoices are all cancelled', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    // Create a cancelled linked invoice
    const invoiceUserId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Invoice User')`,
      [invoiceUserId, teamId, `invoice-${invoiceUserId}@test.com`],
    );
    await query(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, total_ht, total_ttc, status)
       VALUES ($1, $2, $3, $4, $5, 'FAC-2026-0001', 10000, 12000, 'cancelled')`,
      [generateId(), teamId, invoiceUserId, clientId, quoteId],
    );

    const result = await updateQuote({ teamId, quoteId, lines: newLines });
    expect(result.lines).toHaveLength(2);
  });
});
