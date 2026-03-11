import { describe, it, expect, vi } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { updateInvoiceStatusUc } from './update-invoice-status-uc.js';

vi.mock('../../../lib/pdf/generate-pdf.js', () => ({
  generatePdf: vi.fn().mockResolvedValue('/files/pdfs/mocked.pdf'),
}));

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
  pdfUrl?: string;
}) {
  const invoiceId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO invoices (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6, $7)`,
    [invoiceId, input.teamId, userId, input.clientId, `FAC-${generateId().slice(0, 8)}`, input.status ?? 'draft', input.pdfUrl ?? null],
  );

  await query(
    `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation initiale', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), invoiceId],
  );

  return invoiceId;
}

describe('updateInvoiceStatusUc', () => {
  it('cancels a draft invoice (status change, no delete)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');

    // Invoice still exists with cancelled status
    const invoiceRows = await query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows).toHaveLength(1);
    expect(invoiceRows.rows[0]!.status).toBe('cancelled');
  });

  it('allows draft → sent', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'sent' });

    expect(result.status).toBe('sent');
  });

  it('allows sent → overdue', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'overdue' });

    expect(result.status).toBe('overdue');
  });

  it('cancels a sent invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');
  });

  it('cancels an overdue invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'overdue' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');
  });

  it('marks a sent invoice as paid', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'paid' });

    expect(result.status).toBe('paid');
  });

  it('allows draft → paid (skip sent)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'paid' });

    expect(result.status).toBe('paid');
  });

  it('freezes PDF when cancelling a draft invoice without PDF', async () => {
    const { generatePdf } = await import('../../../lib/pdf/generate-pdf.js');
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');
    expect(generatePdf).toHaveBeenCalled();
    expect(result.pdfUrl).toBe('/files/pdfs/mocked.pdf');
  });

  it('freezes PDF when sending a draft invoice without PDF', async () => {
    const { generatePdf } = await import('../../../lib/pdf/generate-pdf.js');
    (generatePdf as ReturnType<typeof vi.fn>).mockClear();
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'sent' });

    expect(result.status).toBe('sent');
    expect(generatePdf).toHaveBeenCalled();
    expect(result.pdfUrl).toBe('/files/pdfs/mocked.pdf');
  });

  it('does not regenerate PDF if already frozen', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/existing.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'sent' });

    expect(result.pdfUrl).toBe('/files/pdfs/existing.pdf');
  });

  it('does not regenerate PDF when moving sent → paid', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent', pdfUrl: '/files/pdfs/frozen.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'paid' });

    expect(result.pdfUrl).toBe('/files/pdfs/frozen.pdf');
  });

  it('cancels a paid invoice and creates avoir automatically', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const userId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test')`,
      [userId, teamId, `user-${userId}@test.com`],
    );
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'paid' });

    const result = await updateInvoiceStatusUc({ teamId, userId, invoiceId, status: 'cancelled' });

    // Returns the cancelled source invoice
    expect(result.status).toBe('cancelled');
    expect(result.id).toBe(invoiceId);

    // Avoir was created as a side-effect
    const avoirRows = await query(
      "SELECT id, invoice_type, source_invoice_id FROM invoices WHERE team_id = $1 AND invoice_type = 'avoir'",
      [teamId],
    );
    expect(avoirRows.rows).toHaveLength(1);
    expect(avoirRows.rows[0]!.source_invoice_id).toBe(invoiceId);
  });

  it('rejects cancellation of a paid invoice without userId', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'paid' });

    await expect(
      updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' }),
    ).rejects.toThrow();

    const invoiceRows = await query('SELECT status FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows[0]!.status).toBe('paid');
  });

  it('rejects cancellation of an already cancelled invoice', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'cancelled' });

    await expect(
      updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects going backwards (sent → draft)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    await expect(
      updateInvoiceStatusUc({ teamId, invoiceId, status: 'draft' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('throws when invoice not found', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    await expect(
      updateInvoiceStatusUc({ teamId, invoiceId: generateId(), status: 'paid' }),
    ).rejects.toThrow('Facture introuvable');
  });

  it('rejects status change on another team invoice', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft' });

    await expect(
      updateInvoiceStatusUc({ teamId: otherTeamId, invoiceId, status: 'cancelled' }),
    ).rejects.toThrow('Facture introuvable');

    const invoiceRows = await query('SELECT id FROM invoices WHERE id = $1', [invoiceId]);
    expect(invoiceRows.rows).toHaveLength(1);
  });
});
