import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { updateInvoice } from './update-invoice.js';

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
     VALUES ($1, $2, $3, $4, 'FAC-2026-0001', 10000, 12000, $5)`,
    [invoiceId, input.teamId, userId, input.clientId, input.status ?? 'draft'],
  );

  await query(
    `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation initiale', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), invoiceId],
  );

  return invoiceId;
}

const newLines = [
  { description: 'Pose carrelage', quantity: 10, unit: 'm²', unitPrice: 4500, tvaRate: 1000 },
  { description: 'Fourniture carrelage', quantity: 10, unit: 'm²', unitPrice: 3800, tvaRate: 2000 },
];

describe('updateInvoice', () => {
  it('updates lines on a draft invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    const result = await updateInvoice({ teamId, invoiceId, lines: newLines });

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]!.description).toBe('Pose carrelage');
    expect(result.lines[1]!.description).toBe('Fourniture carrelage');
    expect(result.totalHt).toBe(83000); // 10*4500 + 10*3800
  });

  it('updates title on a draft invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    const result = await updateInvoice({
      teamId,
      invoiceId,
      lines: newLines,
      title: 'Rénovation cuisine',
    });

    expect(result.title).toBe('Rénovation cuisine');
  });

  it('rejects editing a sent invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    await expect(
      updateInvoice({ teamId, invoiceId, lines: newLines }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('rejects editing a paid invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'paid' });

    await expect(
      updateInvoice({ teamId, invoiceId, lines: newLines }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('rejects editing an overdue invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'overdue' });

    await expect(
      updateInvoice({ teamId, invoiceId, lines: newLines }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('rejects editing a cancelled invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'cancelled' });

    await expect(
      updateInvoice({ teamId, invoiceId, lines: newLines }),
    ).rejects.toThrow('Cette facture ne peut plus être modifiée');
  });

  it('rejects editing an invoice from another team', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await expect(
      updateInvoice({ teamId: otherTeamId, invoiceId, lines: newLines }),
    ).rejects.toThrow();
  });

  it('rejects invalid lines', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await expect(
      updateInvoice({
        teamId,
        invoiceId,
        lines: [{ description: '', quantity: 0, unitPrice: -1 }],
      }),
    ).rejects.toThrow();
  });
});
