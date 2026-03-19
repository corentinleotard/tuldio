/** Strip leading 0, add +33 prefix for French numbers */
export function normalizePhoneToInternational(input: { phone: string }): string {
  const cleaned = input.phone.replace(/[\s.\-()]/g, '');

  // Already international
  if (cleaned.startsWith('+')) return cleaned;

  // French local: 06... or 07...
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '+33' + cleaned.slice(1);
  }

  // Assume French without leading 0
  if (cleaned.length === 9) {
    return '+33' + cleaned;
  }

  return cleaned;
}

/** Validate that a phone number looks like a valid WhatsApp number (French mobile) */
export function isValidWhatsAppPhone(input: { phone: string }): boolean {
  const normalized = normalizePhoneToInternational({ phone: input.phone });
  // French mobile: +336... or +337...
  return /^\+33[67]\d{8}$/.test(normalized);
}
