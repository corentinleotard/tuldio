import type { ClientRow } from './client.entity.js';
import { getClientDisplayName } from './get-client-display-name.js';

export interface ClientView {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  siret: string | null;
  tvaNumber: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: ClientRow['notes'];
  createdAt: string;
}

export function toClientView(row: ClientRow): ClientView {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    companyName: row.company_name,
    siret: row.siret,
    tvaNumber: row.tva_number,
    displayName: getClientDisplayName(row),
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}
