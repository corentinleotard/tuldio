import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { cancelOrDeleteInvoice } from './cancel-or-delete-invoice.js';

async function seedTeamAndClient(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
}

async function insertInvoice(input: {
  teamId: string;
  clientId: string;
  status?: string;
}) {
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
     VALUES ($1, $2, 1, 'Prestation initiale', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), invoiceId],
  );

  return invoiceId;
}

describe('cancelOrDeleteInvoice', () => {
  it('deletes a draft invoice and its lines', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    const result = await cancelOrDeleteInvoice({ teamId, invoiceId });

    expect(result.action).toBe('deleted');
    expect(result.invoice).toBeNull();

    // Verify invoice is gone
    const invoiceRows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows).toHaveLength(0);

    // Verify lines are gone (cascade)
    const lineRows = await query('SELECT id FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
    expect(lineRows.rows).toHaveLength(0);
  });

  it('cancels a sent invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    const result = await cancelOrDeleteInvoice({ teamId, invoiceId });

    expect(result.action).toBe('cancelled');
    expect(result.invoice).not.toBeNull();
    expect(result.invoice!.status).toBe('cancelled');

    // Verify invoice still exists in DB
    const invoiceRows = await query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows[0]!.status).toBe('cancelled');
  });

  it('cancels an overdue invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'overdue' });

    const result = await cancelOrDeleteInvoice({ teamId, invoiceId });

    expect(result.action).toBe('cancelled');
    expect(result.invoice!.status).toBe('cancelled');
  });

  it('rejects cancellation of a paid invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'paid' });

    await expect(
      cancelOrDeleteInvoice({ teamId, invoiceId }),
    ).rejects.toThrow('Transition de statut invalide');

    // Verify status unchanged
    const invoiceRows = await query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows[0]!.status).toBe('paid');
  });

  it('rejects cancellation of an already cancelled invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'cancelled' });

    await expect(
      cancelOrDeleteInvoice({ teamId, invoiceId }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('throws when invoice not found', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    await expect(
      cancelOrDeleteInvoice({ teamId, invoiceId: generateId() }),
    ).rejects.toThrow('Facture introuvable');
  });

  it('rejects deletion of another team invoice', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await expect(
      cancelOrDeleteInvoice({ teamId: otherTeamId, invoiceId }),
    ).rejects.toThrow('Facture introuvable');

    // Verify invoice still exists
    const invoiceRows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows).toHaveLength(1);
  });
});
