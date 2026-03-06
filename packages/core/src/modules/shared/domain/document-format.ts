const VALID_UNITS = ['u', 'm²', 'm', 'h', 'forfait', 'kg', 'L', 'lot'] as const;
export type DocumentUnit = (typeof VALID_UNITS)[number];

export function isValidUnit(unit: string): unit is DocumentUnit {
  return (VALID_UNITS as readonly string[]).includes(unit);
}

export function formatDocumentNumber(input: {
  type: 'quote' | 'invoice';
  number: number;
}): string {
  const prefix = input.type === 'quote' ? 'D' : 'F';
  return `${prefix}-${String(input.number).padStart(4, '0')}`;
}
