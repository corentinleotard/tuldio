import type { TemplateRow } from './template.entity.js';

export interface TemplateView {
  id: string;
  type: string;
  layoutData: unknown;
  originalUrl: string | null;
  createdAt: string;
}

export function toTemplateView(row: TemplateRow): TemplateView {
  return {
    id: row.id,
    type: row.type,
    layoutData: row.layout_data,
    originalUrl: row.original_url,
    createdAt: row.created_at.toISOString(),
  };
}
