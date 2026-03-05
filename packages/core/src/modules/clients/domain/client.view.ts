import type { ClientRow } from './client.entity.js';

export interface ClientView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: ClientRow['notes'];
  createdAt: string;
}

export function toClientView(row: ClientRow): ClientView {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
  };
}
