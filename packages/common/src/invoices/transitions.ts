import type { InvoiceView } from '../types.js';

export type InvoiceStatus = InvoiceView['status'];

/** All transitions including cron-driven ones (used by backend validator) */
export const invoiceTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'overdue', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: ['cancelled'],
  cancelled: [],
};

/** Manual user transitions only — no overdue (set by cron, not user) */
export const invoiceUserTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'paid', 'cancelled'],
  sent: ['paid', 'cancelled'],
  overdue: ['paid', 'cancelled'],
  paid: ['cancelled'],
  cancelled: [],
};

export const avoirTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent'],
  sent: [],
  paid: [],
  overdue: [],
  cancelled: [],
};
