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
    `INSERT INTO clients (id, team_id, first_name, last_name, address) VALUES ($1, $2, 'Jean', 'Martin', '2 rue du Moulin, 69001 Lyon')`,
    [clientId, teamId],
  );
  // Seed required team fields for document readiness validation
  await query(
    `INSERT INTO team_fields (id, team_id, key, label, value, zone, scope, show_quote, show_invoice, sort_order, is_system)
     VALUES ($1, $2, 'siret', 'SIRET', '12345678901234', 'identity', 'both', true, true, 0, true),
            ($3, $2, 'address', 'Adresse', '1 rue de Paris, 75001 Paris', 'identity', 'both', true, true, 1, true),
            ($4, $2, 'early_payment_discount', 'Escompte', 'Pas d''escompte', 'legal', 'invoice', false, true, 0, true),
            ($5, $2, 'late_penalty_rate', 'Penalites', '3x taux legal', 'legal', 'invoice', false, true, 1, true),
            ($6, $2, 'recovery_fee', 'Recouvrement', '4000', 'legal', 'invoice', false, true, 2, true)`,
    [generateId(), teamId, generateId(), generateId(), generateId(), generateId()],
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

  const status = input.status ?? 'draft';
  // Drafts use BROUILLON prefix; non-drafts simulate already-numbered invoices
  const number = status === 'draft' ? `BROUILLON-${invoiceId.slice(0, 8)}` : `FAC-${generateId().slice(0, 8)}`;

  await query(
    `INSERT INTO invoices (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6, $7)`,
    [invoiceId, input.teamId, userId, input.clientId, number, status, input.pdfUrl ?? null],
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

  it('cancels a sent invoice and creates avoir (legal requirement)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const userId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test')`,
      [userId, teamId, `user-${userId}@test.com`],
    );
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'sent' });

    const result = await updateInvoiceStatusUc({ teamId, userId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');

    // Avoir was created — sent invoice is a legal document
    const avoirRows = await query(
      "SELECT id, invoice_type, source_invoice_id FROM invoices WHERE team_id = $1 AND invoice_type = 'avoir'",
      [teamId],
    );
    expect(avoirRows.rows).toHaveLength(1);
    expect(avoirRows.rows[0]!.source_invoice_id).toBe(invoiceId);
  });

  it('cancels an overdue invoice and creates avoir (legal requirement)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const userId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test')`,
      [userId, teamId, `user-${userId}@test.com`],
    );
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'overdue' });

    const result = await updateInvoiceStatusUc({ teamId, userId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');

    // Avoir was created — overdue invoice was communicated to client
    const avoirRows = await query(
      "SELECT id, invoice_type, source_invoice_id FROM invoices WHERE team_id = $1 AND invoice_type = 'avoir'",
      [teamId],
    );
    expect(avoirRows.rows).toHaveLength(1);
    expect(avoirRows.rows[0]!.source_invoice_id).toBe(invoiceId);
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

  it('cancels a draft invoice without creating avoir (not communicated to client)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'cancelled' });

    expect(result.status).toBe('cancelled');

    // No avoir created — draft was never sent to client
    const avoirRows = await query(
      "SELECT id FROM invoices WHERE team_id = $1 AND invoice_type = 'avoir'",
      [teamId],
    );
    expect(avoirRows.rows).toHaveLength(0);
  });

  it('assigns sequential number when leaving draft', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const invoiceId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    // Before: number is BROUILLON-xxx
    const beforeRows = await query('SELECT number FROM invoices WHERE id = $1', [invoiceId]);
    expect(beforeRows.rows[0]!.number).toMatch(/^BROUILLON-/);

    const result = await updateInvoiceStatusUc({ teamId, invoiceId, status: 'sent' });

    // After: number is FAC-YYYY-NNNN
    expect(result.number).toMatch(/^FAC-\d{4}-\d{4}$/);

    const afterRows = await query('SELECT number FROM invoices WHERE id = $1', [invoiceId]);
    expect(afterRows.rows[0]!.number).toMatch(/^FAC-\d{4}-\d{4}$/);
  });

  it('deleting a draft does not consume a number', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    // Create and send first invoice to get FAC-YYYY-0001
    const invoiceId1 = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });
    await updateInvoiceStatusUc({ teamId, invoiceId: invoiceId1, status: 'sent' });

    // Create and delete a draft (should not consume number 0002)
    const draftId = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });
    // Delete the draft directly
    await query("DELETE FROM invoice_lines WHERE invoice_id = $1", [draftId]);
    await query("DELETE FROM invoices WHERE id = $1 AND status = 'draft'", [draftId]);

    // Create and send another invoice — should be 0002, not 0003
    const invoiceId3 = await insertInvoice({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });
    const result = await updateInvoiceStatusUc({ teamId, invoiceId: invoiceId3, status: 'sent' });

    const num1 = (await query('SELECT number FROM invoices WHERE id = $1', [invoiceId1])).rows[0]!.number;
    // Sequential: 0001 then 0002 with no gap
    const seq1 = parseInt(num1.split('-')[2]!);
    const seq3 = parseInt(result.number.split('-')[2]!);
    expect(seq3).toBe(seq1 + 1);
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

  it('rejects draft → sent when acompte total would exceed quote total', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    // Create a quote worth 10000 HT
    const quoteId = generateId();
    const userId = generateId();
    await query(
      `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test')`,
      [userId, teamId, `user-${userId}@test.com`],
    );
    await query(
      `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
       VALUES ($1, $2, $3, $4, $5, 10000, 12000, 'accepted')`,
      [quoteId, teamId, userId, clientId, `DEVIS-${generateId().slice(0, 8)}`],
    );
    await query(
      `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
       VALUES ($1, $2, 1, 'Service', 1, 'u', 10000, 2000, 10000)`,
      [generateId(), quoteId],
    );

    // Create a sent acompte for 6000 HT (already finalized)
    const acompte1Id = generateId();
    await query(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, total_ht, total_ttc, status, invoice_type, pdf_url)
       VALUES ($1, $2, $3, $4, $5, $6, 6000, 7200, 'sent', 'acompte', '/files/pdfs/a1.pdf')`,
      [acompte1Id, teamId, userId, clientId, quoteId, `FAC-${generateId().slice(0, 8)}`],
    );
    await query(
      `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
       VALUES ($1, $2, 1, 'Acompte 1', 1, 'u', 6000, 2000, 6000)`,
      [generateId(), acompte1Id],
    );

    // Create a draft acompte for 5000 HT — this would push total to 11000 > 10000
    const acompte2Id = generateId();
    await query(
      `INSERT INTO invoices (id, team_id, created_by, client_id, quote_id, number, total_ht, total_ttc, status, invoice_type)
       VALUES ($1, $2, $3, $4, $5, $6, 5000, 6000, 'draft', 'acompte')`,
      [acompte2Id, teamId, userId, clientId, quoteId, `BROUILLON-${acompte2Id.slice(0, 8)}`],
    );
    await query(
      `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
       VALUES ($1, $2, 1, 'Acompte 2', 1, 'u', 5000, 2000, 5000)`,
      [generateId(), acompte2Id],
    );

    // Trying to send it should fail — 6000 + 5000 >= 10000
    await expect(
      updateInvoiceStatusUc({ teamId, invoiceId: acompte2Id, status: 'sent' }),
    ).rejects.toThrow();

    // Status unchanged
    const rows = await query('SELECT status FROM invoices WHERE id = $1', [acompte2Id]);
    expect(rows.rows[0]!.status).toBe('draft');
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
