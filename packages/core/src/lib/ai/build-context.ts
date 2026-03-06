import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@tuldio/types';

const RECENT_MESSAGES_COUNT = 8;
const MAX_SUMMARY_ACTIONS = 20;

type ToolInput = Record<string, unknown>;

function formatCents(cents: unknown): string {
  if (typeof cents !== 'number') return '?€';
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '€';
}

function describeLines(lines: unknown): string {
  if (!Array.isArray(lines)) return '';
  return lines
    .map((l) => {
      const desc = l.description ?? '?';
      const qty = l.quantity ?? '?';
      const price = formatCents(l.unitPrice);
      return `${desc} (${qty} × ${price})`;
    })
    .join(', ');
}

const toolDescribers: Record<string, (i: ToolInput) => string> = {
  resolve_client: (i) => {
    const parts = [`Recherche client "${i.search}"`];
    if (i.email) parts.push(`email: ${i.email}`);
    if (i.phone) parts.push(`tél: ${i.phone}`);
    return parts.join(', ');
  },
  create_client: (i) => {
    const parts = [`Client créé: ${i.firstName} ${i.lastName}`];
    if (i.email) parts.push(`${i.email}`);
    if (i.phone) parts.push(`${i.phone}`);
    if (i.address) parts.push(`${i.address}`);
    return parts.join(' — ');
  },
  generate_quote: (i) => {
    const lines = describeLines(i.lines);
    return `Devis créé (clientId: ${i.clientId}, TVA: ${i.tvaRate}%) — ${lines}`;
  },
  generate_invoice: (i) => {
    const lines = describeLines(i.lines);
    return `Facture créée (clientId: ${i.clientId}, TVA: ${i.tvaRate}%) — ${lines}`;
  },
  record_expense: (i) => {
    return `Dépense: ${formatCents(i.amount)} chez ${i.vendor} le ${i.date}${i.category ? ` (${i.category})` : ''}`;
  },
  get_stats: (i) => `Stats consultées: ${i.month}/${i.year}`,
  mark_as_paid: (i) => `Facture ${i.invoiceId} marquée payée`,
  add_client_note: (i) => `Note ajoutée au client ${i.clientId}: "${String(i.content).slice(0, 80)}"`,
};

function describeToolCall(tc: { name: string; input: unknown }): string {
  const describer = toolDescribers[tc.name];
  if (!describer) return tc.name;
  return describer((tc.input ?? {}) as ToolInput);
}

function buildSummary(olderMessages: Message[]): string | null {
  const actions: string[] = [];

  for (const msg of olderMessages) {
    if (!msg.toolCalls || !Array.isArray(msg.toolCalls)) continue;
    for (const tc of msg.toolCalls as { name: string; input: unknown }[]) {
      actions.push(describeToolCall(tc));
    }
  }

  if (actions.length === 0) return null;

  const recent = actions.slice(-MAX_SUMMARY_ACTIONS);
  const skipped = actions.length - recent.length;
  const prefix = skipped > 0 ? `(${skipped} actions plus anciennes omises)\n` : '';

  return `Actions précédentes dans cette conversation:\n${prefix}${recent.map((a) => `- ${a}`).join('\n')}`;
}

/** Build the context summary to append to the system prompt */
export function buildContextSummary(allMessages: Message[]): string | null {
  if (allMessages.length <= RECENT_MESSAGES_COUNT) return null;

  const older = allMessages.slice(0, -RECENT_MESSAGES_COUNT);
  return buildSummary(older);
}

/** Build the Claude message array from recent messages only */
export function buildClaudeMessages(allMessages: Message[]): Anthropic.MessageParam[] {
  const recent =
    allMessages.length <= RECENT_MESSAGES_COUNT
      ? allMessages
      : allMessages.slice(-RECENT_MESSAGES_COUNT);

  return recent.map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));
}
