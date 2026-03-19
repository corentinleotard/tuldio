import { query } from '../../../lib/database/db.js';

export async function updateProspectFields(input: {
  id: string;
  firstName?: string;
  fullName?: string;
  email?: string;
  phone?: string | null;
  whatsappPhone?: string | null;
  profession?: string;
  website?: string | null;
}): Promise<void> {
  const sets: string[] = ['updated_at = now()'];
  const params: Array<string | null> = [];

  if (input.firstName !== undefined) {
    params.push(input.firstName);
    sets.push(`first_name = $${params.length}`);
  }
  if (input.fullName !== undefined) {
    params.push(input.fullName);
    sets.push(`full_name = $${params.length}`);
  }
  if (input.email !== undefined) {
    params.push(input.email);
    sets.push(`email = $${params.length}`);
  }
  if (input.phone !== undefined) {
    params.push(input.phone);
    sets.push(`phone = $${params.length}`);
  }
  if (input.whatsappPhone !== undefined) {
    params.push(input.whatsappPhone);
    sets.push(`whatsapp_phone = $${params.length}`);
  }
  if (input.profession !== undefined) {
    params.push(input.profession);
    sets.push(`profession = $${params.length}`);
  }
  if (input.website !== undefined) {
    params.push(input.website);
    sets.push(`website = $${params.length}`);
  }

  if (params.length === 0) return;

  params.push(input.id);
  await query(
    `UPDATE god_prospects SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params,
  );
}
