import { describe, it, expect } from 'vitest';
import { query } from '../../../lib/database/db.js';
import { generateId } from '../../../lib/infra/id.js';
import { resolveClient } from './resolve-client.js';

async function seedTeam(teamId: string) {
  await query(`INSERT INTO teams (id, name) VALUES ($1, 'Test SARL')`, [teamId]);
}

async function insertClient(input: {
  teamId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}) {
  const id = generateId();
  await query(
    `INSERT INTO clients (id, team_id, first_name, last_name, email, phone)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, input.teamId, input.firstName, input.lastName, input.email ?? null, input.phone ?? null],
  );
  return id;
}

describe('resolveClient', () => {
  it('returns exact_match when full name matches closely (typo/accent)', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Corentin', lastName: 'Léotard' });

    const result = await resolveClient({ teamId, search: 'Corentin Leotard' });

    expect(result.status).toBe('exact_match');
  });

  it('returns ambiguous when only last name matches (different first name)', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Corentin', lastName: 'Léotard' });

    const result = await resolveClient({ teamId, search: 'Maurice Léotard' });

    expect(result.status).toBe('ambiguous');
  });

  it('returns exact_match on email hard match', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Jean', lastName: 'Martin', email: 'jean@test.com' });

    const result = await resolveClient({ teamId, search: 'Jean Martin', email: 'jean@test.com' });

    expect(result.status).toBe('exact_match');
  });

  it('returns exact_match on phone hard match', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Jean', lastName: 'Martin', phone: '0612345678' });

    const result = await resolveClient({ teamId, search: 'Jean Martin', phone: '0612345678' });

    expect(result.status).toBe('exact_match');
  });

  it('returns no_match when no client exists', async () => {
    const teamId = generateId();
    await seedTeam(teamId);

    const result = await resolveClient({ teamId, search: 'Inconnu Total' });

    expect(result.status).toBe('no_match');
  });

  it('returns ambiguous when multiple clients match', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Jean', lastName: 'Martin' });
    await insertClient({ teamId, firstName: 'Jean', lastName: 'Martinez' });

    const result = await resolveClient({ teamId, search: 'Jean Martin' });

    expect(result.status).toBe('ambiguous');
    expect(result.status === 'ambiguous' && result.candidates.length).toBe(2);
  });

  it('returns exact_match for reversed name order', async () => {
    const teamId = generateId();
    await seedTeam(teamId);
    await insertClient({ teamId, firstName: 'Jean', lastName: 'Martin' });

    const result = await resolveClient({ teamId, search: 'Martin Jean' });

    expect(result.status).toBe('exact_match');
  });
});
