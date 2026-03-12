import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { logger } from '../infra/logger.js';
import type { AnyToolDefinition, ToolResult, ToolContext } from './tools/define-tool.js';
import type { StoredRef, RefMap } from './ref-map.js';
import { getRefEntry } from './ref-map.js';

import { findClientsTool } from './tools/find-clients.js';
import { createClientTool } from './tools/create-client.js';
import { updateClientTool } from './tools/update-client.js';
import { addClientNoteTool } from './tools/add-client-note.js';
import { searchPastPricingTool } from './tools/search-past-pricing.js';
import { createDocumentTool } from './tools/create-document.js';
import { updateQuoteTool } from './tools/update-quote.js';
import { updateInvoiceTool } from './tools/update-invoice.js';
import { findDocumentsTool } from './tools/list-documents.js';
import { deleteDocumentTool } from './tools/delete-document.js';
import { getDocumentTool } from './tools/get-document.js';
import { getStatsTool } from './tools/get-stats.js';

export type { ToolResult };

const allTools: AnyToolDefinition[] = [
  findClientsTool,
  createClientTool,
  updateClientTool,
  addClientNoteTool,
  searchPastPricingTool,
  createDocumentTool,
  updateQuoteTool,
  updateInvoiceTool,
  deleteDocumentTool,
  findDocumentsTool,
  getDocumentTool,
  getStatsTool,
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
  ctx: ToolContext;
  refMap: RefMap;
}): Promise<{
  toolResult: ToolResult;
  refs: StoredRef[];
}> {
  const tool = toolMap.get(input.toolName);

  if (!tool) {
    return { toolResult: { result: { error: `Unknown tool: ${input.toolName}` } }, refs: [] };
  }

  const args = tool.schema.parse(input.toolInput);

  const start = Date.now();
  logger.info(`tool.start ${input.toolName}`, { teamId: input.ctx.teamId, userId: input.ctx.userId });

  // Track all refs used during this tool execution (both resolved and registered)
  const collectedRefs: StoredRef[] = [];
  const seenIds = new Set<string>();
  const wrappedCtx: ToolContext = {
    ...input.ctx,
    resolveRef: (ref, expectedType) => {
      const id = input.ctx.resolveRef(ref, expectedType);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const entry = getRefEntry({ refMap: input.refMap, ref });
        const type = entry?.type ?? expectedType ?? 'client';
        collectedRefs.push({ ref, type, id });
      }
      return id;
    },
    registerRef: (type, id) => {
      const ref = input.ctx.registerRef(type, id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        collectedRefs.push({ ref, type, id });
      }
      return ref;
    },
  };

  const toolResult = await tool.handler(args, wrappedCtx);

  const duration = Date.now() - start;
  logger.info(`tool.end ${input.toolName} ${duration}ms`, { teamId: input.ctx.teamId });

  return { toolResult, refs: collectedRefs };
}
