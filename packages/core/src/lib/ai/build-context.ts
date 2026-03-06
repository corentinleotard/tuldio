import type Anthropic from '@anthropic-ai/sdk';
import type { Message } from '@tuldio/types';

const RECENT_MESSAGES_COUNT = 8;
const MAX_SUMMARY_ACTIONS = 20;

type ToolInput = Record<string, unknown>;

function formatCents(cents: unknown): string {
  if (typeof cents !== 'number') return '?\u20AC';
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + '\u20AC';
}

function describeLines(lines: unknown): string {
  if (!Array.isArray(lines)) return '';
  return lines
    .map((l) => {
      const desc = l.description ?? '?';
      const qty = l.quantity ?? '?';
      const unit = l.unit ?? 'u';
      const price = formatCents(l.unitPrice);
      return `${desc} (${qty} ${unit} \u00D7 ${price})`;
    })
    .join(', ');
}

const toolDescribers: Record<string, (i: ToolInput) => string> = {
  resolve_client: (i) => {
    const parts = [`Recherche client "${i.search}"`];
    if (i.email) parts.push(`email: ${i.email}`);
    if (i.phone) parts.push(`t\u00E9l: ${i.phone}`);
    return parts.join(', ');
  },
  create_client: (i) => {
    const parts = [`Client cr\u00E9\u00E9: ${i.firstName} ${i.lastName}`];
    if (i.email) parts.push(`${i.email}`);
    if (i.phone) parts.push(`${i.phone}`);
    if (i.address) parts.push(`${i.address}`);
    return parts.join(' \u2014 ');
  },
  generate_quote: (i) => {
    const lines = describeLines(i.lines);
    return `Devis cr\u00E9\u00E9 (clientId: ${i.clientId}${i.title ? `, "${i.title}"` : ''}) \u2014 ${lines}`;
  },
  update_quote: (i) => {
    const lines = describeLines(i.lines);
    return `Devis modifi\u00E9 (quoteId: ${i.quoteId}) \u2014 ${lines}`;
  },
  generate_invoice: (i) => {
    const lines = describeLines(i.lines);
    return `Facture cr\u00E9\u00E9e (clientId: ${i.clientId}${i.title ? `, "${i.title}"` : ''}) \u2014 ${lines}`;
  },
  invoice_from_quote: (i) => `Facture cr\u00E9\u00E9e depuis devis ${i.quoteId}`,
  get_stats: (i) => `Stats consult\u00E9es: ${i.month}/${i.year}`,
  mark_as_paid: (i) => `Facture ${i.invoiceId} marqu\u00E9e pay\u00E9e`,
  update_client: (i) => {
    const parts = [`Client ${i.clientId} modifi\u00E9`];
    if (i.email) parts.push(`email: ${i.email}`);
    if (i.phone) parts.push(`t\u00E9l: ${i.phone}`);
    if (i.address) parts.push(`adresse: ${i.address}`);
    return parts.join(' \u2014 ');
  },
  list_quotes: (i) => `Devis list\u00E9s${i.clientId ? ` (client: ${i.clientId})` : ''}`,
  list_invoices: (i) => `Factures list\u00E9es${i.clientId ? ` (client: ${i.clientId})` : ''}`,
  add_client_note: (i) => `Note ajout\u00E9e au client ${i.clientId}: "${String(i.content).slice(0, 80)}"`,
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

  return `⚠️ HISTORIQUE (mémoire des échanges passés — NE PAS réutiliser les IDs ci-dessous, ils ne font pas partie du contexte actuel. Si tu as besoin d'un ID, appelle l'outil approprié pour l'obtenir à nouveau):\n${prefix}${recent.map((a) => `- ${a}`).join('\n')}`;
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
