export function formatDocumentNumber(input: {
  type: 'quote' | 'invoice';
  number: number;
}): string {
  const prefix = input.type === 'quote' ? 'D' : 'F';
  return `${prefix}-${String(input.number).padStart(4, '0')}`;
}
