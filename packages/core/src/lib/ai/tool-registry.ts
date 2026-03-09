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
import { createDocumentTool } from './tools/create-document.js';
import { updateDocumentTool } from './tools/update-document.js';
import { listDocumentsTool } from './tools/list-documents.js';
import { deleteDocumentTool } from './tools/delete-document.js';
import { openDocumentTool } from './tools/open-document.js';
import { getStatsTool } from './tools/get-stats.js';
import { detectClientTool } from './tools/detect-client.js';

export type { ToolResult, StateUpdate };

const allTools: AnyToolDefinition[] = [
  resolveClientTool,
  createClientTool,
  updateClientTool,
  addClientNoteTool,
  searchPastPricingTool,
  createDocumentTool,
  updateDocumentTool,
  deleteDocumentTool,
  listDocumentsTool,
  openDocumentTool,
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

/** detect_client tool definition — used only in the pre-processing round, not in chatTools */
export const detectClientTools: Anthropic.Tool[] = (() => {
  const { $schema: _, ...jsonSchema } = zodToJsonSchema(detectClientTool.schema, { target: 'jsonSchema7' });
  return [{
    name: detectClientTool.name,
    description: detectClientTool.description,
    input_schema: jsonSchema as Anthropic.Tool['input_schema'],
  }];
})();

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
  logger.info(`tool.start ${input.toolName}`, { teamId: input.teamId, userId: input.userId });

  const toolResult = await tool.handler(args, ctx);

  // Handler-returned stateUpdate takes precedence over the callback
  const stateUpdate = toolResult.stateUpdate !== undefined
    ? toolResult.stateUpdate
    : (tool.stateUpdate ? tool.stateUpdate(toolResult.result, ctx) : null);

  const duration = Date.now() - start;
  logger.info(`tool.end ${input.toolName} ${duration}ms`, { teamId: input.teamId });

  return { toolResult, stateUpdate };
}
