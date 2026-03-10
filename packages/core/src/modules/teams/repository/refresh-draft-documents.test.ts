import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { refreshDraftDocuments } from './refresh-draft-documents.js';

async function seedTeam(teamId: string) {
  const userId = generateId();
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, teamId, `test-${userId}@test.com`],
  );
  return userId;
}

async function seedClient(teamId: string) {
  const clientId = generateId();
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
  return clientId;
}

async function seedQuote(input: {
  teamId: string;
  userId: string;
  clientId: string;
  status: string;
  totalHt: number;
  totalTtc: number;
  validUntil?: Date;
  lines: { unitPrice: number; tvaRate: number; totalHt: number }[];
}) {
  const quoteId = generateId();
  const validUntil = input.validUntil ?? new Date(Date.now() + 30 * 86400000);
  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, valid_until)
     VALUES ($1, $2, $3, $4, $5, 'Test', $6, $7, $8, $9)`,
    [quoteId, input.teamId, input.userId, input.clientId, `D-2026-${generateId().slice(0, 4)}`, input.totalHt, input.totalTtc, input.status, validUntil],
  );
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    await query(
      `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
       VALUES ($1, $2, $3, 'Line', 1, 'u', $4, $5, $6)`,
      [generateId(), quoteId, i + 1, line.unitPrice, line.tvaRate, line.totalHt],
    );
  }
  return quoteId;
}

async function seedInvoice(input: {
  teamId: string;
  userId: string;
  clientId: string;
  status: string;
  totalHt: number;
  totalTtc: number;
  dueDate?: Date;
  lines: { unitPrice: number; tvaRate: number; totalHt: number }[];
}) {
  const invoiceId = generateId();
  const dueDate = input.dueDate ?? new Date(Date.now() + 30 * 86400000);
  await query(
    `INSERT INTO invoices (id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, due_date)
     VALUES ($1, $2, $3, $4, $5, 'Test', $6, $7, $8, $9)`,
    [invoiceId, input.teamId, input.userId, input.clientId, `F-2026-${generateId().slice(0, 4)}`, input.totalHt, input.totalTtc, input.status, dueDate],
  );
  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i]!;
    await query(
      `INSERT INTO invoice_lines (id, invoice_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
       VALUES ($1, $2, $3, 'Line', 1, 'u', $4, $5, $6)`,
      [generateId(), invoiceId, i + 1, line.unitPrice, line.tvaRate, line.totalHt],
    );
  }
  return invoiceId;
}

async function getQuote(quoteId: string) {
  const result = await query<{ total_ht: number; total_ttc: number; valid_until: Date }>(
    'SELECT total_ht, total_ttc, valid_until FROM quotes WHERE id = $1',
    [quoteId],
  );
  return result.rows[0]!;
}

async function getInvoice(invoiceId: string) {
  const result = await query<{ total_ht: number; total_ttc: number; due_date: Date }>(
    'SELECT total_ht, total_ttc, due_date FROM invoices WHERE id = $1',
    [invoiceId],
  );
  return result.rows[0]!;
}

async function getQuoteLineRates(quoteId: string) {
  const result = await query<{ tva_rate: number }>(
    'SELECT tva_rate FROM quote_lines WHERE quote_id = $1 ORDER BY sort_order',
    [quoteId],
  );
  return result.rows.map((r) => r.tva_rate);
}

async function getInvoiceLineRates(invoiceId: string) {
  const result = await query<{ tva_rate: number }>(
    'SELECT tva_rate FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order',
    [invoiceId],
  );
  return result.rows.map((r) => r.tva_rate);
}

// --- TVA refresh ---

describe('refreshDraftDocuments — TVA', () => {
  it('sets all draft quote lines to 0% when tvaExempt=true', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'draft',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId, tvaExempt: true });

    const quote = await getQuote(quoteId);
    expect(quote.total_ttc).toBe(10000); // no TVA
    expect(await getQuoteLineRates(quoteId)).toEqual([0]);
  });

  it('sets all draft invoice lines to 0% when tvaExempt=true', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const invoiceId = await seedInvoice({
      teamId, userId, clientId, status: 'draft',
      totalHt: 5000, totalTtc: 6000,
      lines: [{ unitPrice: 5000, tvaRate: 2000, totalHt: 5000 }],
    });

    await refreshDraftDocuments({ teamId, tvaExempt: true });

    const invoice = await getInvoice(invoiceId);
    expect(invoice.total_ttc).toBe(5000);
    expect(await getInvoiceLineRates(invoiceId)).toEqual([0]);
  });

  it('restores 20% on draft lines when tvaExempt=false', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'draft',
      totalHt: 10000, totalTtc: 10000,
      lines: [{ unitPrice: 10000, tvaRate: 0, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId, tvaExempt: false });

    const quote = await getQuote(quoteId);
    expect(quote.total_ttc).toBe(12000); // 10000 + 20%
    expect(await getQuoteLineRates(quoteId)).toEqual([2000]);
  });

  it('does NOT touch sent quotes', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'sent',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId, tvaExempt: true });

    const quote = await getQuote(quoteId);
    expect(quote.total_ttc).toBe(12000); // unchanged
    expect(await getQuoteLineRates(quoteId)).toEqual([2000]); // unchanged
  });

  it('does NOT touch sent invoices', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const invoiceId = await seedInvoice({
      teamId, userId, clientId, status: 'sent',
      totalHt: 5000, totalTtc: 6000,
      lines: [{ unitPrice: 5000, tvaRate: 2000, totalHt: 5000 }],
    });

    await refreshDraftDocuments({ teamId, tvaExempt: true });

    const invoice = await getInvoice(invoiceId);
    expect(invoice.total_ttc).toBe(6000); // unchanged
    expect(await getInvoiceLineRates(invoiceId)).toEqual([2000]); // unchanged
  });

  it('does NOT touch drafts of another team', async () => {
    const teamId1 = generateId();
    const userId1 = await seedTeam(teamId1);
    const clientId1 = await seedClient(teamId1);

    const teamId2 = generateId();
    const userId2 = await seedTeam(teamId2);
    const clientId2 = await seedClient(teamId2);

    const quoteId1 = await seedQuote({
      teamId: teamId1, userId: userId1, clientId: clientId1, status: 'draft',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    const quoteId2 = await seedQuote({
      teamId: teamId2, userId: userId2, clientId: clientId2, status: 'draft',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId: teamId1, tvaExempt: true });

    expect((await getQuote(quoteId1)).total_ttc).toBe(10000); // updated
    expect((await getQuote(quoteId2)).total_ttc).toBe(12000); // untouched
  });
});

// --- Quote validity refresh ---

describe('refreshDraftDocuments — quoteValidityDays', () => {
  it('recomputes valid_until on draft quotes', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'draft',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId, quoteValidityDays: 15 });

    const quote = await getQuote(quoteId);
    // valid_until should be created_at + 15 days
    const createdResult = await query<{ created_at: Date }>('SELECT created_at FROM quotes WHERE id = $1', [quoteId]);
    const createdAt = createdResult.rows[0]!.created_at;
    const diffMs = quote.valid_until.getTime() - createdAt.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    expect(diffDays).toBe(15);
  });

  it('does NOT touch sent quotes', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const originalValidUntil = new Date('2026-06-15T12:00:00Z');
    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'sent',
      totalHt: 10000, totalTtc: 12000,
      validUntil: originalValidUntil,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    const beforeRefresh = (await getQuote(quoteId)).valid_until.getTime();
    await refreshDraftDocuments({ teamId, quoteValidityDays: 7 });

    const quote = await getQuote(quoteId);
    expect(quote.valid_until.getTime()).toBe(beforeRefresh); // unchanged
  });
});

// --- Invoice payment delay refresh ---

describe('refreshDraftDocuments — invoicePaymentDelayDays', () => {
  it('recomputes due_date on draft invoices', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const invoiceId = await seedInvoice({
      teamId, userId, clientId, status: 'draft',
      totalHt: 5000, totalTtc: 6000,
      lines: [{ unitPrice: 5000, tvaRate: 2000, totalHt: 5000 }],
    });

    await refreshDraftDocuments({ teamId, invoicePaymentDelayDays: 60 });

    const invoice = await getInvoice(invoiceId);
    const createdResult = await query<{ created_at: Date }>('SELECT created_at FROM invoices WHERE id = $1', [invoiceId]);
    const createdAt = createdResult.rows[0]!.created_at;
    const expectedDueDate = new Date(createdAt);
    expectedDueDate.setDate(expectedDueDate.getDate() + 60);

    expect(invoice.due_date.toISOString().slice(0, 10)).toBe(expectedDueDate.toISOString().slice(0, 10));
  });

  it('does NOT touch sent invoices', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const originalDueDate = new Date('2026-06-15T12:00:00Z');
    const invoiceId = await seedInvoice({
      teamId, userId, clientId, status: 'sent',
      totalHt: 5000, totalTtc: 6000,
      dueDate: originalDueDate,
      lines: [{ unitPrice: 5000, tvaRate: 2000, totalHt: 5000 }],
    });

    const beforeRefresh = (await getInvoice(invoiceId)).due_date.getTime();
    await refreshDraftDocuments({ teamId, invoicePaymentDelayDays: 7 });

    const invoice = await getInvoice(invoiceId);
    expect(invoice.due_date.getTime()).toBe(beforeRefresh); // unchanged
  });
});

// --- No-op when no relevant params ---

describe('refreshDraftDocuments — no-op', () => {
  it('does nothing when no params are provided', async () => {
    const teamId = generateId();
    const userId = await seedTeam(teamId);
    const clientId = await seedClient(teamId);

    const quoteId = await seedQuote({
      teamId, userId, clientId, status: 'draft',
      totalHt: 10000, totalTtc: 12000,
      lines: [{ unitPrice: 10000, tvaRate: 2000, totalHt: 10000 }],
    });

    await refreshDraftDocuments({ teamId });

    const quote = await getQuote(quoteId);
    expect(quote.total_ttc).toBe(12000); // unchanged
  });
});
