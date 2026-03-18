import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { createInvoiceFromQuote } from './create-invoice-from-quote.js';

async function seedTeamAndUser(teamId: string) {
  const userId = generateId();
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, teamId, `test-${userId}@test.com`],
  );
  // Seed required team fields for document readiness validation
  await query(
    `INSERT INTO team_fields (id, team_id, key, label, value, zone, scope, show_quote, show_invoice, sort_order, is_system)
     VALUES ($1, $2, 'siret', 'SIRET', '12345678901234', 'identity', 'both', true, true, 0, true),
            ($3, $2, 'address', 'Adresse', '1 rue de Paris, 75001 Paris', 'identity', 'both', true, true, 1, true),
            ($4, $2, 'tva_number', 'N TVA', 'FR32123456789', 'identity', 'both', true, true, 6, true),
            ($5, $2, 'payment_terms', 'Conditions de paiement', 'Paiement a reception de facture', 'payment', 'quote', true, false, 0, true)`,
    [generateId(), teamId, generateId(), generateId(), generateId()],
  );
  return userId;
}

async function seedClient(teamId: string) {
  const clientId = generateId();
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, address) VALUES ($1, $2, 'Jean', 'Martin', '2 rue du Moulin, 69001 Lyon')`,
    [clientId, teamId],
  );
  return clientId;
}

async function seedQuote(input: { teamId: string; userId: string; clientId: string; status: string }) {
  const quoteId = generateId();
  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, title, total_ht, total_ttc, status, pdf_url)
     VALUES ($1, $2, $3, $4, $5, 'Devis test', 10000, 12000, $6, '/files/pdfs/test.pdf')`,
    [quoteId, input.teamId, input.userId, input.clientId, `DEV-${generateId().slice(0, 8)}`, input.status],
  );
  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );
  return quoteId;
}

async function getQuoteStatus(quoteId: string): Promise<string> {
  const result = await query<{ status: string }>('SELECT status FROM quotes WHERE id = $1', [quoteId]);
  return result.rows[0]!.status;
}

describe('createInvoiceFromQuote', () => {
  it('creates invoice from accepted quote without changing status', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);
    const clientId = await seedClient(teamId);
    const quoteId = await seedQuote({ teamId, userId, clientId, status: 'accepted' });

    const invoice = await createInvoiceFromQuote({ teamId, userId, quoteId });

    expect(invoice.quoteId).toBe(quoteId);
    expect(invoice.totalHt).toBe(10000);
    expect(invoice.totalTtc).toBe(12000);
    expect(invoice.status).toBe('draft');
    expect(await getQuoteStatus(quoteId)).toBe('accepted');
  });

  it('auto-accepts a draft quote when invoiced', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);
    const clientId = await seedClient(teamId);
    const quoteId = await seedQuote({ teamId, userId, clientId, status: 'draft' });

    const invoice = await createInvoiceFromQuote({ teamId, userId, quoteId });

    expect(invoice.quoteId).toBe(quoteId);
    expect(await getQuoteStatus(quoteId)).toBe('accepted');
  });

  it('auto-accepts a sent quote when invoiced', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);
    const clientId = await seedClient(teamId);
    const quoteId = await seedQuote({ teamId, userId, clientId, status: 'sent' });

    const invoice = await createInvoiceFromQuote({ teamId, userId, quoteId });

    expect(invoice.quoteId).toBe(quoteId);
    expect(await getQuoteStatus(quoteId)).toBe('accepted');
  });

  it('rejects invoicing a refused quote', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);
    const clientId = await seedClient(teamId);
    const quoteId = await seedQuote({ teamId, userId, clientId, status: 'refused' });

    await expect(
      createInvoiceFromQuote({ teamId, userId, quoteId }),
    ).rejects.toThrow('Ce devis ne peut pas être facturé');

    expect(await getQuoteStatus(quoteId)).toBe('refused');
  });

  it('rejects invoicing a cancelled quote', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);
    const clientId = await seedClient(teamId);
    const quoteId = await seedQuote({ teamId, userId, clientId, status: 'cancelled' });

    await expect(
      createInvoiceFromQuote({ teamId, userId, quoteId }),
    ).rejects.toThrow('Ce devis ne peut pas être facturé');

    expect(await getQuoteStatus(quoteId)).toBe('cancelled');
  });

  it('throws when quote not found', async () => {
    const teamId = generateId();
    const userId = await seedTeamAndUser(teamId);

    await expect(
      createInvoiceFromQuote({ teamId, userId, quoteId: generateId() }),
    ).rejects.toThrow('Devis introuvable');
  });
});
