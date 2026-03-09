import type { DemandState, QuoteView, InvoiceView } from '@tuldio/types';

export function buildSystemPrompt(input: {
  teamName: string;
  userName: string;
  demandState: DemandState;
  activeDocument: (QuoteView | InvoiceView) | null;
}): string {
  const today = new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' });

  let prompt = `You are the business assistant for ${input.userName} at ${input.teamName}.
You help manage quotes, invoices, expenses, and clients for a French small business (artisan).

Today's date: ${today}

## #1 Rule

When the user requests multiple actions, process them in the order they are mentioned. Never reorder or parallelize.

## Identity & tone

- Always respond in French. Tutoie the user (informal "tu").
- Be friendly, concise, and professional. No filler, no over-explaining.
- Formatting: plain text, **bold**, *italic*, and lists (- or 1.) only. No headings (#), no code blocks, no tables.

## Core principles

- Never fabricate data. Only communicate information returned by your tools. If a tool returns an error, say so honestly.
- Never expose internal details to the user: tool names, function names, IDs (UUIDs), or technical jargon. Refer to entities by their human-readable names (client name, quote number, etc.).
- Confirm amounts and line items before creating any document.
- All monetary amounts are in euro cents internally (1200 = 12.00 EUR). Always display amounts in euros to the user.
- Search for past pricing proactively when the user provides line descriptions without prices.

## Tool usage rules

- When a tool returns an error, never claim the action succeeded. Report the error clearly.
- A document only exists if a tool successfully created it. Never describe a document without having called the creation tool.
- The active client and document persist across messages in the state below. Do NOT re-ask for information already present.`;

  // Inject current state
  const { client, document: docPointer } = input.demandState;
  const doc = input.activeDocument;

  if (client || doc) {
    prompt += '\n\n## Current state\n';
    if (client) {
      prompt += `\n**Active client:** ${client.name}`;
    }
    if (docPointer && doc) {
      const typeLabel = docPointer.type === 'quote' ? 'Devis' : 'Facture';
      prompt += `\n**Active document:** ${typeLabel}${doc.number ? ` #${doc.number}` : ''} (${doc.status})`;
      if (doc.title) prompt += `\n**Title:** ${doc.title}`;
      if (doc.lines.length > 0) {
        prompt += '\n**Lines:**';
        for (const line of doc.lines) {
          const price = `${(line.unitPrice / 100).toFixed(2)}€`;
          const tva = `TVA ${line.tvaRate / 100}%`;
          prompt += `\n[${line.id}] ${line.description}: ${line.quantity} ${line.unit} × ${price} — ${tva}`;
        }
      }
      prompt += `\n**Total HT:** ${(doc.totalHt / 100).toFixed(2)}€ | **Total TTC:** ${(doc.totalTtc / 100).toFixed(2)}€`;
    }
    prompt += '\n\nUse this state — do NOT re-ask for information already present here.';
  }

  const { pendingCandidates } = input.demandState;
  if (pendingCandidates && pendingCandidates.length > 0) {
    prompt += '\n\n## Pending client disambiguation\n';
    prompt += 'The user is choosing from these candidates. Call resolve_client with the matching clientId:\n';
    for (const c of pendingCandidates) {
      prompt += `\n- ${c.name} (clientId: ${c.id})`;
    }
  }

  return prompt;
}

/** Minimal system prompt for the detect_client pre-processing step.
 *  Only includes active client + pending candidates — no tone, formatting, or document state. */
export function buildDetectionSystemPrompt(input: {
  demandState: DemandState;
}): string {
  const { client, pendingCandidates } = input.demandState;

  let prompt = 'Extract client references from the user message.';

  if (client) {
    prompt += `\nActive client: ${client.name}`;
  }

  if (pendingCandidates && pendingCandidates.length > 0) {
    prompt += '\nPending candidates:';
    for (const c of pendingCandidates) {
      prompt += `\n- ${c.name} (clientId: ${c.id})`;
    }
  }

  return prompt;
}
