import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { DemandState } from '@tuldio/types';
import { logger } from '../infra/logger.js';
import type { AnyToolDefinition, ToolResult, StateUpdate } from './tools/define-tool.js';

import { resolveClientTool } from './tools/resolve-client.js';
import { createClientTool } from './tools/create-client.js';
import { updateClientTool } from './tools/update-client.js';
import { addClientNoteTool } from './tools/add-client-note.js';
import { searchPastPricingTool } from './tools/search-past-pricing.js';
import { addLinesTool } from './tools/add-lines.js';
import { updateLineTool } from './tools/update-line.js';
import { removeLineTool } from './tools/remove-line.js';
import { generateQuoteTool } from './tools/generate-quote.js';
import { updateQuoteTool } from './tools/update-quote.js';
import { generateInvoiceTool } from './tools/generate-invoice.js';
import { updateInvoiceTool } from './tools/update-invoice.js';
import { invoiceFromQuoteTool } from './tools/invoice-from-quote.js';
import { listQuotesTool } from './tools/list-quotes.js';
import { listInvoicesTool } from './tools/list-invoices.js';
import { getStatsTool } from './tools/get-stats.js';
import { markAsPaidTool } from './tools/mark-as-paid.js';

export type { ToolResult, StateUpdate };

const allTools: AnyToolDefinition[] = [
  resolveClientTool,
  createClientTool,
  updateClientTool,
  searchPastPricingTool,
  addLinesTool,
  updateLineTool,
  removeLineTool,
  generateQuoteTool,
  updateQuoteTool,
  listQuotesTool,
  generateInvoiceTool,
  updateInvoiceTool,
  invoiceFromQuoteTool,
  listInvoicesTool,
  getStatsTool,
  markAsPaidTool,
  addClientNoteTool,
];

const toolMap = new Map<string, AnyToolDefinition>(
  allTools.map((t) => [t.name, t]),
);

/** Claude API tool definitions — derived from zod schemas */
export const chatTools: Anthropic.Tool[] = allTools.map((t) => {
  const { $schema: _, ...jsonSchema } = zodToJsonSchema(t.schema, { target: 'jsonSchema7' });
  return {
    name: t.name,
    description: t.description,
    input_schema: jsonSchema as Anthropic.Tool['input_schema'],
  };
});

/** Execute a tool by name — validates input with zod, then runs handler */
export async function executeTool(input: {
  toolName: string;
  toolInput: Record<string, unknown>;
  teamId: string;
  userId: string;
  demandState: DemandState;
}): Promise<{ toolResult: ToolResult; stateUpdate: StateUpdate }> {
  const tool = toolMap.get(input.toolName);

  if (!tool) {
    return { toolResult: { result: { error: `Unknown tool: ${input.toolName}` } }, stateUpdate: null };
  }

  const args = tool.schema.parse(input.toolInput);
  const ctx = { teamId: input.teamId, userId: input.userId, demandState: input.demandState };

  const start = Date.now();
  logger.info(`tool.start ${input.toolName}`, { teamId: input.teamId, userId: input.userId, demandState: input.demandState });

  const toolResult = await tool.handler(args, ctx);
  const stateUpdate = tool.stateUpdate ? tool.stateUpdate(toolResult.result, ctx) : null;

  const duration = Date.now() - start;
  logger.info(`tool.end ${input.toolName} ${duration}ms`, { teamId: input.teamId });

  return { toolResult, stateUpdate };
}
