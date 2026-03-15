import { z } from 'zod';
import type { ActiveState } from '@tuldio/types';
import type { EntityType } from '../ref-map.js';

export type ToolResult = {
  result: unknown;
  richCard?: { type: string; data: unknown };
  quickReplies?: string[];
  activeStateUpdate?: Partial<ActiveState> | null;
};

export type ToolContext = {
  teamId: string;
  userId: string;
  resolveRef: (ref: string, expectedType?: EntityType) => string;
  registerRef: (type: EntityType, id: string) => string;
  /** Current active document ID, if any. Used for conditional state clearing. */
  activeDocumentId: string | null;
};

/** Type-erased tool definition used in the registry array/map */
export interface AnyToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

/** Typed tool definition — R is inferred from the handler's result field */
interface ToolDefinition<T extends z.ZodType, R> {
  name: string;
  description: string;
  schema: T;
  handler: (args: z.infer<T>, ctx: ToolContext) => Promise<{ result: R; richCard?: { type: string; data: unknown }; quickReplies?: string[]; activeStateUpdate?: Partial<ActiveState> | null }>;
}

export function defineTool<T extends z.ZodType, R>(def: ToolDefinition<T, R>): AnyToolDefinition {
  return def as AnyToolDefinition;
}

/** Shared line schema used by create_document, update_quote, and update_invoice */
export const lineSchema = z.object({
  description: z.string().min(1).max(500).describe('Line item description'),
  quantity: z.number().positive().max(100_000).describe('Quantity'),
  unit: z.string().max(50).default('u').describe('Unit of measure (e.g. u, m2, m, h, forfait, kg, L, lot, t, sac, palette, rouleau, etc.)'),
  unitPrice: z.number().int().min(0).max(100_000_000).describe('Unit price excl. tax in cents'),
  tvaRate: z.number().int().default(2000).describe('VAT rate in basis points'),
});
