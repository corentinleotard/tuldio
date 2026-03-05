import type { UserRow } from '../domain/user.entity.js';
import { findUserByEmail } from '../repository/find-user-by-email.js';

export async function findUserByEmailUc(email: string): Promise<UserRow | null> {
  return findUserByEmail(email);
}
