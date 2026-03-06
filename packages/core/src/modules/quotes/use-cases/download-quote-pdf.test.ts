import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { downloadQuotePdf } from './download-quote-pdf.js';

async function seedTeamAndClient(teamId: string, clientId: string) {
  await query(
    `INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`,
    [teamId],
  );
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
}

async function insertDraftQuote(input: { teamId: string; clientId: string }) {
  const quoteId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
     VALUES ($1, $2, $3, $4, 'DEVIS-2026-0001', 10000, 12000, 'draft')`,
    [quoteId, input.teamId, userId, input.clientId],
  );

  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation test', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('downloadQuotePdf', () => {
  it('returns buffer for draft quote (on-the-fly generation)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertDraftQuote({ teamId, clientId });

    const result = await downloadQuotePdf({ teamId, quoteId });

    expect(result.type).toBe('buffer');
    expect(result.fileName).toContain('devis-');
    if (result.type === 'buffer') {
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
    }
  });

  it('returns file path for sent quote (frozen PDF)', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamAndClient(teamId, clientId);
    const quoteId = await insertDraftQuote({ teamId, clientId });

    // Simulate frozen PDF by setting pdf_url directly
    await query(
      `UPDATE quotes SET status = 'sent', sent_at = NOW(), pdf_url = '/files/pdfs/devis-test.pdf' WHERE id = $1`,
      [quoteId],
    );

    const result = await downloadQuotePdf({ teamId, quoteId });

    expect(result.type).toBe('file');
    if (result.type === 'file') {
      expect(result.filePath).toContain('devis-test.pdf');
    }
  });

  it('throws for non-existent quote', async () => {
    const teamId = generateId();
    const fakeQuoteId = generateId();

    await expect(
      downloadQuotePdf({ teamId, quoteId: fakeQuoteId }),
    ).rejects.toThrow();
  });
});
