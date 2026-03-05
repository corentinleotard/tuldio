export const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'success' | 'destructive' | 'warning'; label: string }> = {
  draft: { variant: 'secondary', label: 'Brouillon' },
  sent: { variant: 'default', label: 'Envoy\u00e9' },
  accepted: { variant: 'success', label: 'Accept\u00e9' },
  refused: { variant: 'destructive', label: 'Refus\u00e9' },
  paid: { variant: 'success', label: 'Pay\u00e9' },
  overdue: { variant: 'warning', label: 'En retard' },
};

export const defaultStatus = { variant: 'secondary' as const, label: '' };
