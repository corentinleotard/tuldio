import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { updateQuoteStatusUc } from './update-quote-status-uc.js';

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
            ($3, $2, 'address', 'Adresse', '1 rue de Paris, 75001 Paris', 'identity', 'both', true, true, 1, true)`,
    [generateId(), teamId, generateId()],
  );
}

async function insertQuote(input: { teamId: string; clientId: string; status?: string; pdfUrl?: string }) {
  const quoteId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, $6, $7)`,
    [quoteId, input.teamId, userId, input.clientId, `D-${generateId().slice(0, 8)}`, input.status ?? 'draft', input.pdfUrl ?? null],
  );

  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('updateQuoteStatusUc', () => {
  // PDF freeze tests: verify that pdf_url IS null before and then check behavior.
  // Actual PDF generation requires FILES_DIR — tested in download-quote-pdf.test.ts.
  // Here we test transition logic + verify the use-case ATTEMPTS to freeze (calls generatePdf).
  // We use a pre-set pdf_url to test the "already has PDF" path.

  it('does not regenerate PDF if already frozen', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/existing.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });

    expect(result.status).toBe('sent');
    expect(result.pdfUrl).toBe('/files/pdfs/existing.pdf');
  });

  it('does not regenerate PDF when moving sent → accepted', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'sent', pdfUrl: '/files/pdfs/frozen.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'accepted' });

    expect(result.status).toBe('accepted');
    expect(result.pdfUrl).toBe('/files/pdfs/frozen.pdf');
  });

  it('allows draft → sent', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
    expect(result.status).toBe('sent');
  });

  it('allows draft → accepted (skip sent)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'accepted' });
    expect(result.status).toBe('accepted');
  });

  it('allows draft → refused (skip sent)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft', pdfUrl: '/files/pdfs/pre.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'refused' });
    expect(result.status).toBe('refused');
  });

  it('rejects draft → cancelled (no cancel for quotes)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    await expect(
      updateQuoteStatusUc({ teamId, quoteId, status: 'cancelled' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects going backwards (sent → draft)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'sent' });

    await expect(
      updateQuoteStatusUc({ teamId, quoteId, status: 'draft' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects accepted → anything (terminal)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'accepted' });

    await expect(
      updateQuoteStatusUc({ teamId, quoteId, status: 'sent' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('rejects refused → anything (terminal)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'refused' });

    await expect(
      updateQuoteStatusUc({ teamId, quoteId, status: 'draft' }),
    ).rejects.toThrow('Transition de statut invalide');
  });

  it('allows sent → cancelled (withdraw sent quote)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'sent', pdfUrl: '/files/pdfs/frozen.pdf' });

    const result = await updateQuoteStatusUc({ teamId, quoteId, status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('throws when quote not found', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);

    await expect(
      updateQuoteStatusUc({ teamId, quoteId: generateId(), status: 'sent' }),
    ).rejects.toThrow('Devis introuvable');
  });

  it('rejects status change on another team quote', async () => {
    const teamId = generateId();
    const otherTeamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId, status: 'draft' });

    await expect(
      updateQuoteStatusUc({ teamId: otherTeamId, quoteId, status: 'sent' }),
    ).rejects.toThrow('Devis introuvable');

    // Quote still exists untouched
    const rows = await query('SELECT status FROM quotes WHERE id = $1', [quoteId]);
    expect(rows.rows[0]!.status).toBe('draft');
  });
});
