import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { createAvoir } from './create-avoir.js';

async function seedTeamAndClient(teamId: string, userId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, teamId, `test-${userId}@test.com`],
  );
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, address) VALUES ($1, $2, 'Jean', 'Martin', '2 rue du Moulin, 69001 Lyon')`,
    [clientId, teamId],
  );
}

async function insertInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  status: string;
  invoiceType?: string;
  avoirId?: string;
}) {
  const invoiceId = generateId();
  await query(
    `INSERT INTO invoices (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, invoice_type, avoir_id)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6, $7, $8)`,
    [invoiceId, input.teamId, input.userId, input.clientId, `FAC-${generateId().slice(0, 8)}`, input.status, input.invoiceType ?? 'standard', input.avoirId ?? null],
  );
  await query(
    `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation test', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), invoiceId],
  );
  return invoiceId;
}

describe('createAvoir', () => {
  it('creates avoir from a sent invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'sent' });

    const avoir = await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    expect(avoir.invoiceType).toBe('avoir');
    expect(avoir.totalHt).toBe(-10000);
    expect(avoir.totalTtc).toBe(-12000);
    expect(avoir.sourceInvoiceId).toBe(invoiceId);
    expect(avoir.number).toMatch(/^BROUILLON-/);
  });

  it('creates avoir from a paid invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'paid' });

    const avoir = await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    expect(avoir.invoiceType).toBe('avoir');
    expect(avoir.sourceInvoiceId).toBe(invoiceId);
  });

  it('creates avoir from an overdue invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'overdue' });

    const avoir = await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    expect(avoir.invoiceType).toBe('avoir');
    expect(avoir.sourceInvoiceId).toBe(invoiceId);
  });

  it('rejects avoir from a draft invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'draft' });

    await expect(
      createAvoir({ teamId, userId, sourceInvoiceId: invoiceId }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects avoir from a cancelled invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'cancelled' });

    await expect(
      createAvoir({ teamId, userId, sourceInvoiceId: invoiceId }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects avoir of an avoir', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'sent', invoiceType: 'avoir' });

    await expect(
      createAvoir({ teamId, userId, sourceInvoiceId: invoiceId }),
    ).rejects.toThrow('Données invalides');
  });

  it('rejects second avoir on same invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);

    // Create source + first avoir
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'sent' });
    await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    // Second avoir should fail
    await expect(
      createAvoir({ teamId, userId, sourceInvoiceId: invoiceId }),
    ).rejects.toThrow();
  });

  it('negates all source lines in the avoir', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'sent' });

    const avoir = await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    // Source line: 10000 unit_price, 10000 total_ht → avoir line: -10000
    expect(avoir.lines).toHaveLength(1);
    expect(avoir.lines[0]!.unitPrice).toBe(-10000);
    expect(avoir.lines[0]!.totalHt).toBe(-10000);
  });

  it('sets back-reference on source invoice', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);
    const invoiceId = await insertInvoice({ teamId, userId, clientId, status: 'sent' });

    const avoir = await createAvoir({ teamId, userId, sourceInvoiceId: invoiceId });

    const source = await query('SELECT avoir_id FROM invoices WHERE id = $1', [invoiceId]);
    expect(source.rows[0]!.avoir_id).toBe(avoir.id);
  });

  it('throws when source invoice not found', async () => {
    const teamId = generateId();
    const userId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, userId, clientId);

    await expect(
      createAvoir({ teamId, userId, sourceInvoiceId: generateId() }),
    ).rejects.toThrow('Facture introuvable');
  });
});
