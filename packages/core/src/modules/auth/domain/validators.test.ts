import { describe, it, expect } from 'vitest';
import { isValidEmail, normalizeEmail, generateOtpCode } from './validators.js';

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('jean@example.com')).toBe(true);
    expect(isValidEmail('jean.martin@entreprise.fr')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('jean')).toBe(false);
    expect(isValidEmail('jean@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('jean @example.com')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Jean@EXAMPLE.com  ')).toBe('jean@example.com');
  });
});

describe('generateOtpCode', () => {
  it('returns a 6-digit string', () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('pads with leading zeros', () => {
    // Run multiple times to increase chance of hitting a small number
    for (let i = 0; i < 100; i++) {
      expect(generateOtpCode()).toHaveLength(6);
    }
  });
});
