import { searchLinePricing } from '../repository/search-line-pricing.js';
import type { PastPricingView } from '@tuldio/common';

export async function searchPastPricing(input: {
  teamId: string;
  search: string;
}): Promise<PastPricingView[]> {
  const rows = await searchLinePricing({
    teamId: input.teamId,
    search: input.search,
  });

  return rows.map((r) => ({
    description: r.description,
    quantity: Number(r.quantity),
    unit: r.unit,
    unitPrice: r.unit_price,
    tvaRate: r.tva_rate,
    totalHt: r.total_ht,
    documentType: r.document_type,
    documentNumber: r.document_number,
    clientName: r.client_name,
    createdAt: r.created_at,
    score: r.score,
  }));
}
