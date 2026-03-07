import { query } from '../../../lib/database/db.js';

export interface PastPricingRow {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  total_ht: number;
  document_type: 'quote' | 'invoice';
  document_number: string;
  client_name: string;
  created_at: string;
}

export async function searchLinePricing(input: {
  teamId: string;
  search: string;
  limit?: number;
}): Promise<PastPricingRow[]> {
  const result = await query<PastPricingRow>(
    `(
      SELECT
        ql.description,
        ql.quantity::numeric AS quantity,
        ql.unit,
        ql.unit_price,
        ql.tva_rate,
        ql.total_ht,
        'quote' AS document_type,
        q.number AS document_number,
        c.first_name || ' ' || c.last_name AS client_name,
        q.created_at::text AS created_at,
        similarity(ql.description, $2) AS score
      FROM quote_lines ql
      JOIN quotes q ON q.id = ql.quote_id
      JOIN clients c ON c.id = q.client_id
      WHERE q.team_id = $1
        AND (ql.description ILIKE '%' || $2 || '%' OR similarity(ql.description, $2) > 0.3)
    )
    UNION ALL
    (
      SELECT
        il.description,
        il.quantity::numeric AS quantity,
        il.unit,
        il.unit_price,
        il.tva_rate,
        il.total_ht,
        'invoice' AS document_type,
        i.number AS document_number,
        c.first_name || ' ' || c.last_name AS client_name,
        i.created_at::text AS created_at,
        similarity(il.description, $2) AS score
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      JOIN clients c ON c.id = i.client_id
      WHERE i.team_id = $1
        AND (il.description ILIKE '%' || $2 || '%' OR similarity(il.description, $2) > 0.3)
    )
    ORDER BY score DESC, created_at DESC
    LIMIT $3`,
    [input.teamId, input.search, input.limit ?? 1000],
  );

  return result.rows;
}
