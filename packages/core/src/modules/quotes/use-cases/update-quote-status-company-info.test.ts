import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { updateQuoteStatusUc } from './update-quote-status-uc.js';

/** Seed a team WITHOUT required company fields (simulates new user before onboarding) */
async function seedTeamNoFields(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, '')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, address) VALUES ($1, $2, 'Jean', 'Martin', '2 rue du Moulin, 69001 Lyon')`,
    [clientId, teamId],
  );
}

/** Seed a team WITH company fields but client has NO address */
async function seedTeamWithFieldsNoClientAddress(teamId: string, clientId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name) VALUES ($1, $2, 'Jean', 'Martin')`,
    [clientId, teamId],
  );
  await query(
    `INSERT INTO team_fields (id, team_id, key, label, value, zone, scope, show_quote, show_invoice, sort_order, is_system)
     VALUES ($1, $2, 'siret', 'SIRET', '12345678901234', 'identity', 'both', true, true, 0, true),
            ($3, $2, 'address', 'Adresse', '1 rue de Paris', 'identity', 'both', true, true, 1, true),
            ($4, $2, 'tva_number', 'N TVA', 'FR32123456789', 'identity', 'both', true, true, 6, true),
            ($5, $2, 'payment_terms', 'Conditions', 'Paiement a reception', 'payment', 'quote', true, false, 0, true)`,
    [generateId(), teamId, generateId(), generateId(), generateId()],
  );
}

async function insertQuote(input: { teamId: string; clientId: string }) {
  const quoteId = generateId();
  const userId = generateId();

  await query(
    `INSERT INTO users (id, team_id, email, name) VALUES ($1, $2, $3, 'Test User')`,
    [userId, input.teamId, `test-${userId}@test.com`],
  );

  await query(
    `INSERT INTO quotes (id, team_id, created_by, client_id, number, total_ht, total_ttc, status)
     VALUES ($1, $2, $3, $4, $5, 10000, 12000, 'draft')`,
    [quoteId, input.teamId, userId, input.clientId, `D-${generateId().slice(0, 8)}`],
  );

  await query(
    `INSERT INTO quote_lines (id, quote_id, sort_order, description, quantity, unit, unit_price, tva_rate, total_ht)
     VALUES ($1, $2, 1, 'Prestation', 1, 'u', 10000, 2000, 10000)`,
    [generateId(), quoteId],
  );

  return quoteId;
}

describe('updateQuoteStatusUc — COMPANY_INFO_REQUIRED', () => {
  it('throws COMPANY_INFO_REQUIRED when team info is missing', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamNoFields(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId });

    try {
      await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { code: string; details: Array<{ code: string }> };
      expect(error.code).toBe('COMPANY_INFO_REQUIRED');
      expect(error.details).toBeDefined();

      const codes = error.details.map((d) => d.code);
      expect(codes).toContain('MISSING_TEAM_NAME');
      expect(codes).toContain('MISSING_TEAM_SIRET');
      expect(codes).toContain('MISSING_TEAM_ADDRESS');
    }
  });

  it('throws DOCUMENT_NOT_READY (not COMPANY_INFO_REQUIRED) when only client info is missing', async () => {
    const teamId = generateId();
    const clientId = generateId();
    await seedTeamWithFieldsNoClientAddress(teamId, clientId);
    const quoteId = await insertQuote({ teamId, clientId });

    try {
      await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { code: string; details: Array<{ code: string }> };
      expect(error.code).toBe('DOCUMENT_NOT_READY');

      const codes = error.details.map((d) => d.code);
      expect(codes).toContain('MISSING_CLIENT_ADDRESS');
      expect(codes).not.toContain('MISSING_TEAM_NAME');
    }
  });

  it('includes ALL errors in details even when throwing COMPANY_INFO_REQUIRED', async () => {
    const teamId = generateId();
    const clientId = generateId();
    // Team has no fields AND client has no address → both team + client errors
    await seedTeamNoFields(teamId, clientId);
    // Remove client address
    await query('UPDATE clients SET address = NULL WHERE id = $1', [clientId]);
    const quoteId = await insertQuote({ teamId, clientId });

    try {
      await updateQuoteStatusUc({ teamId, quoteId, status: 'sent' });
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { code: string; details: Array<{ code: string }> };
      expect(error.code).toBe('COMPANY_INFO_REQUIRED');

      const codes = error.details.map((d) => d.code);
      // Team errors present
      expect(codes).toContain('MISSING_TEAM_NAME');
      // Client error also present in details
      expect(codes).toContain('MISSING_CLIENT_ADDRESS');
    }
  });
});
