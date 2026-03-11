import type { QuoteView, InvoiceView } from '@tuldio/types';

export type StatusVariant = 'default' | 'secondary' | 'info' | 'success' | 'destructive' | 'warning';

export interface StatusDef {
  variant: StatusVariant;
  label: string;
}

export const statusConfig: Record<string, StatusDef> = {
  draft: { variant: 'secondary', label: 'Brouillon' },
  sent: { variant: 'info', label: 'Envoyé' },
  accepted: { variant: 'success', label: 'Accepté' },
  refused: { variant: 'destructive', label: 'Refusé' },
  paid: { variant: 'success', label: 'Payé' },
  overdue: { variant: 'warning', label: 'En retard' },
  cancelled: { variant: 'destructive', label: 'Annulé' },
};

export const defaultStatus: StatusDef = { variant: 'secondary', label: '' };

/** Maps badge variant → Tailwind bg class for dots/pills that need the raw color */
const variantToBg: Record<StatusVariant, string> = {
  default: 'bg-primary',
  secondary: 'bg-muted-foreground',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

/** Maps badge variant → CSS custom property for inline styles */
const variantToCssVar: Record<StatusVariant, string> = {
  default: '--primary',
  secondary: '--muted-foreground',
  info: '--info',
  success: '--success',
  warning: '--warning',
  destructive: '--destructive',
};

export function getStatusDotClass(variant: StatusVariant): string {
  return variantToBg[variant];
}

export function getStatusCssVar(variant: StatusVariant): string {
  return variantToCssVar[variant];
}

export const quoteTransitions: Record<QuoteView['status'], QuoteView['status'][]> = {
  draft: ['sent', 'accepted', 'refused', 'cancelled'],
  sent: ['accepted', 'refused', 'cancelled'],
  accepted: [],
  refused: [],
  cancelled: [],
};

export const invoiceTransitions: Record<InvoiceView['status'], InvoiceView['status'][]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  paid: ['cancelled'],
  overdue: ['paid', 'cancelled'],
  cancelled: [],
};

const allQuoteStatuses: QuoteView['status'][] = ['draft', 'sent', 'accepted', 'refused', 'cancelled'];
const allInvoiceStatuses: InvoiceView['status'][] = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export function getOrderedStatuses(type: 'quote' | 'invoice'): string[] {
  return type === 'quote' ? allQuoteStatuses : allInvoiceStatuses;
}
