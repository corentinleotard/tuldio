import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from './define-tool.js';
import type { ClientView, QuoteView, InvoiceView } from '@tuldio/types';
import type { ClientResolution } from '../../../modules/clients/use-cases/resolve-client.js';

// --- Mocks ---

vi.mock('../../../modules/clients/index.js', () => ({
  resolveClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('../../../modules/quotes/index.js', () => ({
  createQuote: vi.fn(),
  getQuote: vi.fn(),
  updateQuote: vi.fn(),
  updateQuoteStatusUc: vi.fn(),
}));

vi.mock('../../../modules/invoices/index.js', () => ({
  createInvoice: vi.fn(),
  createInvoiceFromQuote: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  updateInvoiceStatusUc: vi.fn(),
  deleteInvoiceUc: vi.fn(),
}));

vi.mock('../../../modules/quotes/index.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createQuote: vi.fn(),
    getQuote: vi.fn(),
    updateQuote: vi.fn(),
    updateQuoteStatusUc: vi.fn(),
    deleteQuoteUc: vi.fn(),
  };
});

vi.mock('../../../modules/units/index.js', () => ({
  resolveUnit: vi.fn().mockResolvedValue({ label: 'm2' }),
}));

import { resolveClient } from '../../../modules/clients/index.js';
import { createClient } from '../../../modules/clients/index.js';
import { createQuote, getQuote, updateQuote, updateQuoteStatusUc, deleteQuoteUc } from '../../../modules/quotes/index.js';
import { createInvoice, createInvoiceFromQuote, getInvoice, updateInvoice, updateInvoiceStatusUc, deleteInvoiceUc } from '../../../modules/invoices/index.js';

import { resolveClientTool } from './resolve-client.js';
import { createClientTool } from './create-client.js';
import { createDocumentTool } from './create-document.js';
import { openDocumentTool } from './open-document.js';
import { updateDocumentTool } from './update-document.js';
import { deleteDocumentTool } from './delete-document.js';

// --- Fixtures ---

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const CLIENT_A_ID = '00000000-0000-0000-0000-0000000000a1';
const CLIENT_B_ID = '00000000-0000-0000-0000-0000000000a2';
const QUOTE_ID = '00000000-0000-0000-0000-0000000000q1';
const INVOICE_ID = '00000000-0000-0000-0000-0000000000i1';

function makeCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    teamId: TEAM_ID,
    userId: USER_ID,
    demandState: { client: null, document: null },
    ...overrides,
  };
}

function makeClientView(overrides?: Partial<ClientView>): ClientView {
  return {
    id: CLIENT_A_ID,
    firstName: 'Jean',
    lastName: 'Martin',
    email: 'jean@example.com',
    phone: null,
    address: null,
    notes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeQuoteView(overrides?: Partial<QuoteView>): QuoteView {
  return {
    id: QUOTE_ID,
    number: 'DEVIS-2026-0001',
    clientId: CLIENT_A_ID,
    clientName: 'Jean Martin',
    title: 'Terrassement',
    lines: [],
    totalHt: 10000,
    totalTtc: 12000,
    tvaGroups: [],
    status: 'draft',
    pdfUrl: null,
    validUntil: null,
    sentAt: null,
    acceptedAt: null,
    refusedAt: null,
    cancelledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeInvoiceView(overrides?: Partial<InvoiceView>): InvoiceView {
  return {
    id: INVOICE_ID,
    number: 'FA-2026-0001',
    clientId: CLIENT_A_ID,
    clientName: 'Jean Martin',
    quoteId: null,
    title: 'Terrassement',
    lines: [],
    totalHt: 10000,
    totalTtc: 12000,
    tvaGroups: [],
    status: 'draft',
    pdfUrl: null,
    sentAt: null,
    paidAt: null,
    dueDate: null,
    prestationDate: null,
    cancelledAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── resolve_client ──────────────────────────────────────────────

describe('resolve_client → state management', () => {
  it('exact_match: sets client, keeps document when same client', async () => {
    const client = makeClientView();
    vi.mocked(resolveClient).mockResolvedValue({ status: 'exact_match', client } as ClientResolution);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await resolveClientTool.handler({ search: 'Jean Martin' }, ctx);

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
    });
    // document is NOT in stateUpdate → unchanged by applyStateUpdate
    expect(result.stateUpdate).not.toHaveProperty('document');
  });

  it('exact_match: sets client, clears document when client changed', async () => {
    const client = makeClientView({ id: CLIENT_B_ID, firstName: 'Pierre', lastName: 'Dupont' });
    vi.mocked(resolveClient).mockResolvedValue({ status: 'exact_match', client } as ClientResolution);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await resolveClientTool.handler({ search: 'Pierre Dupont' }, ctx);

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_B_ID, name: 'Pierre Dupont' },
      document: null,
    });
  });

  it('exact_match: sets client, clears document when switching from no client', async () => {
    const client = makeClientView();
    vi.mocked(resolveClient).mockResolvedValue({ status: 'exact_match', client } as ClientResolution);

    const ctx = makeCtx({
      demandState: { client: null, document: null },
    });

    const result = await resolveClientTool.handler({ search: 'Jean Martin' }, ctx);

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: null,
    });
  });

  it('ambiguous: no state change', async () => {
    const candidates = [makeClientView(), makeClientView({ id: CLIENT_B_ID })];
    vi.mocked(resolveClient).mockResolvedValue({ status: 'ambiguous', candidates } as ClientResolution);

    const result = await resolveClientTool.handler({ search: 'Martin' }, makeCtx());

    expect(result.stateUpdate).toBeUndefined();
  });

  it('no_match: no state change', async () => {
    vi.mocked(resolveClient).mockResolvedValue({ status: 'no_match' } as ClientResolution);

    const result = await resolveClientTool.handler({ search: 'Inconnu' }, makeCtx());

    expect(result.stateUpdate).toBeUndefined();
  });
});

// ─── create_client ───────────────────────────────────────────────

describe('create_client → state management', () => {
  it('sets new client and clears document', async () => {
    const client = makeClientView();
    vi.mocked(createClient).mockResolvedValue(client);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_B_ID, name: 'Old Client' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await createClientTool.handler(
      { firstName: 'Jean', lastName: 'Martin' },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: null,
    });
  });
});

// ─── create_document ─────────────────────────────────────────────

describe('create_document → state management', () => {
  it('quote: sets document, keeps client', async () => {
    const quote = makeQuoteView();
    vi.mocked(createQuote).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: null,
      },
    });

    const result = await createDocumentTool.handler(
      { type: 'quote', lines: [{ description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
    expect(result.stateUpdate).not.toHaveProperty('client');
  });

  it('invoice: sets document, keeps client', async () => {
    const invoice = makeInvoiceView();
    vi.mocked(createInvoice).mockResolvedValue(invoice);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: null,
      },
    });

    const result = await createDocumentTool.handler(
      { type: 'invoice', lines: [{ description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      document: { id: INVOICE_ID, type: 'invoice' },
    });
    expect(result.stateUpdate).not.toHaveProperty('client');
  });

  it('invoice from active quote: sets document and client from invoice', async () => {
    const invoice = makeInvoiceView({ clientId: CLIENT_A_ID, clientName: 'Jean Martin' });
    vi.mocked(createInvoiceFromQuote).mockResolvedValue(invoice);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await createDocumentTool.handler(
      { type: 'invoice', fromActiveQuote: true },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: INVOICE_ID, type: 'invoice' },
    });
  });
});

// ─── open_document ───────────────────────────────────────────────

describe('open_document → state management', () => {
  it('quote: sets both client and document', async () => {
    const quote = makeQuoteView();
    vi.mocked(getQuote).mockResolvedValue(quote);

    const result = await openDocumentTool.handler(
      { documentId: QUOTE_ID, documentType: 'quote' },
      makeCtx(),
    );

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('invoice: sets both client and document', async () => {
    const invoice = makeInvoiceView();
    vi.mocked(getInvoice).mockResolvedValue(invoice);

    const result = await openDocumentTool.handler(
      { documentId: INVOICE_ID, documentType: 'invoice' },
      makeCtx(),
    );

    expect(result.stateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: INVOICE_ID, type: 'invoice' },
    });
  });
});

// ─── update_document (status) ────────────────────────────────────

describe('update_document (status) → state management', () => {
  it('quote status change: document stays active', async () => {
    const quote = makeQuoteView({ status: 'sent' });
    vi.mocked(updateQuoteStatusUc).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await updateDocumentTool.handler({ status: 'sent' }, ctx);

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('quote accepted: document stays active', async () => {
    const quote = makeQuoteView({ status: 'accepted' });
    vi.mocked(updateQuoteStatusUc).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await updateDocumentTool.handler({ status: 'accepted' }, ctx);

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('quote refused: document stays active', async () => {
    const quote = makeQuoteView({ status: 'refused' });
    vi.mocked(updateQuoteStatusUc).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await updateDocumentTool.handler({ status: 'refused' }, ctx);

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('quote cancelled: document stays active', async () => {
    const quote = makeQuoteView({ status: 'cancelled' });
    vi.mocked(updateQuoteStatusUc).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await updateDocumentTool.handler({ status: 'cancelled' }, ctx);

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('invoice status change: document stays active', async () => {
    const invoice = makeInvoiceView({ status: 'paid' });
    vi.mocked(updateInvoiceStatusUc).mockResolvedValue(invoice);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: INVOICE_ID, type: 'invoice' },
      },
    });

    const result = await updateDocumentTool.handler({ status: 'paid' }, ctx);

    expect(result.stateUpdate).toEqual({
      document: { id: INVOICE_ID, type: 'invoice' },
    });
  });
});

// ─── update_document (lines/title) ──────────────────────────────

describe('update_document (lines/title) → state management', () => {
  it('quote line update: document stays active', async () => {
    const quote = makeQuoteView({
      lines: [{ id: 'line-1', description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000, totalHt: 5000, prestationId: null }],
    });
    vi.mocked(getQuote).mockResolvedValue(quote);
    vi.mocked(updateQuote).mockResolvedValue(quote);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await updateDocumentTool.handler(
      { updatedLines: [{ lineId: 'line-1', unitPrice: 6000 }] },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote' },
    });
  });

  it('invoice title update: document stays active', async () => {
    const invoice = makeInvoiceView({ lines: [] });
    vi.mocked(getInvoice).mockResolvedValue(invoice);
    vi.mocked(updateInvoice).mockResolvedValue(invoice);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: INVOICE_ID, type: 'invoice' },
      },
    });

    const result = await updateDocumentTool.handler(
      { title: 'Nouveau titre', addedLines: [{ description: 'X', quantity: 1, unit: 'm2', unitPrice: 1000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.stateUpdate).toEqual({
      document: { id: INVOICE_ID, type: 'invoice' },
    });
  });
});

// ─── delete_document ─────────────────────────────────────────────

describe('delete_document → state management', () => {
  it('deleting quote: clears document, keeps client', async () => {
    vi.mocked(deleteQuoteUc).mockResolvedValue(undefined as never);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: QUOTE_ID, type: 'quote' },
      },
    });

    const result = await deleteDocumentTool.handler({}, ctx);

    expect(result.stateUpdate).toEqual({ document: null });
    expect(result.stateUpdate).not.toHaveProperty('client');
  });

  it('deleting invoice: clears document, keeps client', async () => {
    vi.mocked(deleteInvoiceUc).mockResolvedValue(undefined as never);

    const ctx = makeCtx({
      demandState: {
        client: { id: CLIENT_A_ID, name: 'Jean Martin' },
        document: { id: INVOICE_ID, type: 'invoice' },
      },
    });

    const result = await deleteDocumentTool.handler({}, ctx);

    expect(result.stateUpdate).toEqual({ document: null });
    expect(result.stateUpdate).not.toHaveProperty('client');
  });
});
