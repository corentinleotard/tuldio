import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { deleteInvoiceUc } from './delete-invoice-uc.js';

async function seedTeamAndClient(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
}

async function insertInvoice(input: { teamId: string; clientId: string; status?: string }) {
  const invoiceId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO invoices (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6)`,
    [invoiceId, input.teamId, userId, input.clientId, `FAC-${generateId().slice(0, 8)}`, input.status ?? 'draft'],
  );

  await query(
    `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), invoiceId],
  );

  return invoiceId;
}

describe('deleteInvoiceUc', () => {
  it('deletes a draft invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await deleteInvoiceUc({ teamId, invoiceId });

    const rows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(rows.rows).toHaveLength(0);
  });

  it('rejects deletion of a sent invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    await expect(
      deleteInvoiceUc({ teamId, invoiceId }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');

    const rows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(rows.rows).toHaveLength(1);
  });

  it('rejects deletion of a paid invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'paid' });

    await expect(
      deleteInvoiceUc({ teamId, invoiceId }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('rejects deletion of a cancelled invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'cancelled' });

    await expect(
      deleteInvoiceUc({ teamId, invoiceId }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('throws when invoice not found', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    await expect(
      deleteInvoiceUc({ teamId, invoiceId: generateId() }),
    ).rejects.toThrow('Facture introuvable');
  });

  it('rejects deletion of another team invoice', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await expect(
      deleteInvoiceUc({ teamId: otherTeamId, invoiceId }),
    ).rejects.toThrow('Facture introuvable');

    // Invoice still exists
    const rows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(rows.rows).toHaveLength(1);
  });
});
