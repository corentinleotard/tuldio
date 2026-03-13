import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from './define-tool.js';
import type { ClientView, QuoteView, InvoiceView } from '@tuldio/types';
import type { EntityType } from '../ref-map.js';

// --- Mocks ---

vi.mock('../../../modules/clients/index.js', () => ({
  resolveClient: vi.fn(),
  createClient: vi.fn(),
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

vi.mock('../../../modules/invoices/index.js', () => ({
  createInvoice: vi.fn(),
  createInvoiceFromQuote: vi.fn(),
  getInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  updateInvoiceStatusUc: vi.fn(),
  deleteInvoiceUc: vi.fn(),
}));

vi.mock('../../../modules/units/index.js', () => ({
  resolveUnit: vi.fn().mockResolvedValue({ label: 'm2' }),
}));

import { createClient } from '../../../modules/clients/index.js';
import { createQuote, getQuote, updateQuote, updateQuoteStatusUc, deleteQuoteUc } from '../../../modules/quotes/index.js';
import { createInvoice, createInvoiceFromQuote, getInvoice, updateInvoice, updateInvoiceStatusUc, deleteInvoiceUc } from '../../../modules/invoices/index.js';

import { createClientTool } from './create-client.js';
import { createDocumentTool } from './create-document.js';
import { getDocumentTool } from './get-document.js';
import { updateQuoteTool } from './update-quote.js';
import { updateInvoiceTool } from './update-invoice.js';
import { deleteDocumentTool } from './delete-document.js';

// --- Fixtures ---

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const CLIENT_A_ID = '00000000-0000-0000-0000-0000000000a1';
const QUOTE_ID = '00000000-0000-0000-0000-0000000000q1';
const INVOICE_ID = '00000000-0000-0000-0000-0000000000i1';

const registeredRefs = new Map<string, { type: EntityType; id: string }>();
let refCounter = 0;

function makeCtx(): ToolContext {
  registeredRefs.clear();
  refCounter = 0;
  return {
    teamId: TEAM_ID,
    userId: USER_ID,
    resolveRef: (ref: string) => {
      const entry = registeredRefs.get(ref);
      if (!entry) throw new Error(`Unknown ref: ${ref}`);
      return entry.id;
    },
    registerRef: (type: EntityType, id: string) => {
      const prefix = type === 'client' ? 'c' : 'd';
      const ref = `${prefix}${refCounter++}`;
      registeredRefs.set(ref, { type, id });
      return ref;
    },
  };
}

function makeClientView(overrides?: Partial<ClientView>): ClientView {
  return {
    id: CLIENT_A_ID,
    firstName: 'Jean',
    lastName: 'Martin',
    companyName: null,
    siret: null,
    tvaNumber: null,
    displayName: 'Jean Martin',
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
    invoiceType: 'standard',
    sourceInvoiceId: null,
    sourceInvoiceNumber: null,
    situationNumber: null,
    avoirId: null,
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

// ─── create_client ───────────────────────────────────────────────

describe('create_client → state management', () => {
  it('sets new client and clears document', async () => {
    const client = makeClientView();
    vi.mocked(createClient).mockResolvedValue(client);

    const ctx = makeCtx();
    const result = await createClientTool.handler(
      { firstName: 'Jean', lastName: 'Martin' },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: null,
    });
    expect(result.result).toHaveProperty('ref');
    expect(result.result).toHaveProperty('name', 'Jean Martin');
  });
});

// ─── create_document ─────────────────────────────────────────────

describe('create_document → state management', () => {
  it('quote: sets document with number', async () => {
    const quote = makeQuoteView();
    vi.mocked(createQuote).mockResolvedValue(quote);

    const ctx = makeCtx();
    registeredRefs.set('c0', { type: 'client', id: CLIENT_A_ID });

    const result = await createDocumentTool.handler(
      { type: 'quote', clientRef: 'c0', lines: [{ description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: QUOTE_ID, type: 'quote', number: 'DEVIS-2026-0001' },
    });
    expect(result.result).toHaveProperty('ref');
    expect(result.result).toHaveProperty('number', 'DEVIS-2026-0001');
  });

  it('invoice: sets document with number', async () => {
    const invoice = makeInvoiceView();
    vi.mocked(createInvoice).mockResolvedValue(invoice);

    const ctx = makeCtx();
    registeredRefs.set('c0', { type: 'client', id: CLIENT_A_ID });

    const result = await createDocumentTool.handler(
      { type: 'invoice', clientRef: 'c0', lines: [{ description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: INVOICE_ID, type: 'invoice', number: 'FA-2026-0001' },
    });
  });

  it('invoice from source quote: sets document from invoice', async () => {
    const invoice = makeInvoiceView({ clientId: CLIENT_A_ID, clientName: 'Jean Martin' });
    vi.mocked(createInvoiceFromQuote).mockResolvedValue(invoice);

    const ctx = makeCtx();
    registeredRefs.set('c0', { type: 'client', id: CLIENT_A_ID });
    registeredRefs.set('d0', { type: 'quote', id: QUOTE_ID });

    const result = await createDocumentTool.handler(
      { type: 'invoice', clientRef: 'c0', sourceQuoteRef: 'd0' },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: INVOICE_ID, type: 'invoice', number: 'FA-2026-0001' },
    });
  });
});

// ─── get_document ────────────────────────────────────────────────

describe('get_document → state management', () => {
  it('quote: sets both client and document', async () => {
    const quote = makeQuoteView();
    vi.mocked(getQuote).mockResolvedValue(quote);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'quote', id: QUOTE_ID });

    const result = await getDocumentTool.handler({ ref: 'd0' }, ctx);

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: QUOTE_ID, type: 'quote', number: 'DEVIS-2026-0001' },
    });
  });

  it('invoice: sets both client and document', async () => {
    const invoice = makeInvoiceView();
    vi.mocked(getQuote).mockRejectedValue(new Error('not found'));
    vi.mocked(getInvoice).mockResolvedValue(invoice);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'invoice', id: INVOICE_ID });

    const result = await getDocumentTool.handler({ ref: 'd0' }, ctx);

    expect(result.activeStateUpdate).toEqual({
      client: { id: CLIENT_A_ID, name: 'Jean Martin' },
      document: { id: INVOICE_ID, type: 'invoice', number: 'FA-2026-0001' },
    });
  });
});

// ─── update_quote (status) ───────────────────────────────────────

describe('update_quote (status) → state management', () => {
  it('quote status change: document stays active', async () => {
    const quote = makeQuoteView({ status: 'sent' });
    vi.mocked(getQuote).mockResolvedValue(quote);
    vi.mocked(updateQuoteStatusUc).mockResolvedValue(quote);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'quote', id: QUOTE_ID });

    const result = await updateQuoteTool.handler({ ref: 'd0', status: 'sent' }, ctx);

    expect(result.activeStateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote', number: 'DEVIS-2026-0001' },
    });
  });
});

// ─── update_invoice (status) ─────────────────────────────────────

describe('update_invoice (status) → state management', () => {
  it('invoice status change: document stays active', async () => {
    const invoice = makeInvoiceView({ status: 'paid' });
    vi.mocked(updateInvoiceStatusUc).mockResolvedValue(invoice);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'invoice', id: INVOICE_ID });

    const result = await updateInvoiceTool.handler({ ref: 'd0', status: 'paid' }, ctx);

    expect(result.activeStateUpdate).toEqual({
      document: { id: INVOICE_ID, type: 'invoice', number: 'FA-2026-0001' },
    });
  });
});

// ─── update_quote (lines/title) ─────────────────────────────────

describe('update_quote (lines/title) → state management', () => {
  it('quote line update: document stays active', async () => {
    const quote = makeQuoteView({
      lines: [{ id: 'line-1', description: 'Test', quantity: 1, unit: 'm2', unitPrice: 5000, tvaRate: 2000, totalHt: 5000, prestationId: null }],
    });
    vi.mocked(getQuote).mockResolvedValue(quote);
    vi.mocked(updateQuote).mockResolvedValue(quote);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'quote', id: QUOTE_ID });

    const result = await updateQuoteTool.handler(
      { ref: 'd0', updatedLines: [{ lineId: 'line-1', unitPrice: 6000 }] },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      document: { id: QUOTE_ID, type: 'quote', number: 'DEVIS-2026-0001' },
    });
  });
});

// ─── update_invoice (lines/title) ───────────────────────────────

describe('update_invoice (lines/title) → state management', () => {
  it('invoice title update: document stays active', async () => {
    const invoice = makeInvoiceView({ lines: [] });
    vi.mocked(getInvoice).mockResolvedValue(invoice);
    vi.mocked(updateInvoice).mockResolvedValue(invoice);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'invoice', id: INVOICE_ID });

    const result = await updateInvoiceTool.handler(
      { ref: 'd0', title: 'Nouveau titre', addedLines: [{ description: 'X', quantity: 1, unit: 'm2', unitPrice: 1000, tvaRate: 2000 }] },
      ctx,
    );

    expect(result.activeStateUpdate).toEqual({
      document: { id: INVOICE_ID, type: 'invoice', number: 'FA-2026-0001' },
    });
  });
});

// ─── delete_document ─────────────────────────────────────────────

describe('delete_document → state management', () => {
  it('deleting quote: clears document', async () => {
    vi.mocked(getQuote).mockResolvedValue(makeQuoteView());
    vi.mocked(deleteQuoteUc).mockResolvedValue(undefined as never);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'quote', id: QUOTE_ID });

    const result = await deleteDocumentTool.handler({ ref: 'd0' }, ctx);

    expect(result.activeStateUpdate).toEqual({ document: null });
  });

  it('deleting invoice: clears document', async () => {
    vi.mocked(getQuote).mockRejectedValue(new Error('not found'));
    vi.mocked(deleteInvoiceUc).mockResolvedValue(undefined as never);

    const ctx = makeCtx();
    registeredRefs.set('d0', { type: 'invoice', id: INVOICE_ID });

    const result = await deleteDocumentTool.handler({ ref: 'd0' }, ctx);

    expect(result.activeStateUpdate).toEqual({ document: null });
  });
});
