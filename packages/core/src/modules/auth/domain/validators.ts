import { randomBytes } from 'node:crypto';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOtpCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const value = array[0] ?? 0;
  return String(value % 1000000).padStart(6, '0');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}
