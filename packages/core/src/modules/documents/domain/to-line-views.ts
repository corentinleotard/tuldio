import type { DocumentLineView, TvaGroupView } from '@tuldio/common';
import { groupByTva } from './document-math.js';

interface LineRow {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  total_ht: number;
  prestation_id: string | null;
}

export function toLineViews(rows: LineRow[]): DocumentLineView[] {
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    quantity: Number(r.quantity),
    unit: r.unit,
    unitPrice: r.unit_price,
    tvaRate: r.tva_rate,
    totalHt: r.total_ht,
    prestationId: r.prestation_id,
  }));
}

export function toTvaGroups(rows: LineRow[]): TvaGroupView[] {
  return groupByTva(
    rows.map((r) => ({
      quantity: Number(r.quantity),
      unitPrice: r.unit_price,
      tvaRate: r.tva_rate,
    })),
  );
}
