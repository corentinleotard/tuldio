import type { QuoteView } from '../types.js';

export type QuoteStatus = QuoteView['status'];

export const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent', 'accepted', 'refused'],
  sent: ['accepted', 'refused', 'cancelled'],
  accepted: [],
  refused: [],
  cancelled: [],
};
