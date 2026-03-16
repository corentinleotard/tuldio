import type { QuoteView, InvoiceView, DocumentLogView } from '@tuldio/common';
import { apiFetch } from '@/lib/api-fetch';

export async function fetchQuotes(): Promise<QuoteView[]> {
  return apiFetch<QuoteView[]>('/api/quotes');
}

export async function fetchInvoices(): Promise<InvoiceView[]> {
  return apiFetch<InvoiceView[]>('/api/invoices');
}

export async function fetchQuoteById(id: string): Promise<QuoteView> {
  return apiFetch<QuoteView>(`/api/quotes/${id}`);
}

export async function fetchInvoiceById(id: string): Promise<InvoiceView> {
  return apiFetch<InvoiceView>(`/api/invoices/${id}`);
}

export async function updateQuoteStatus(input: {
  id: string;
  status: QuoteView['status'];
}): Promise<QuoteView> {
  return apiFetch<QuoteView>(`/api/quotes/${input.id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: input.status }),
  });
}

export async function updateInvoiceStatus(input: {
  id: string;
  status: InvoiceView['status'];
}): Promise<InvoiceView> {
  return apiFetch<InvoiceView>(`/api/invoices/${input.id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: input.status }),
  });
}

export async function sendDocumentEmail(input: {
  type: 'quote' | 'invoice';
  id: string;
}): Promise<QuoteView | InvoiceView> {
  const endpoint = input.type === 'quote' ? 'quotes' : 'invoices';
  return apiFetch<QuoteView | InvoiceView>(`/api/${endpoint}/${input.id}/send-email`, {
    method: 'POST',
  });
}

export async function deleteDocument(input: {
  type: 'quote' | 'invoice';
  id: string;
}): Promise<void> {
  const endpoint = input.type === 'quote' ? 'quotes' : 'invoices';
  await apiFetch(`/api/${endpoint}/${input.id}`, { method: 'DELETE' });
}

export async function fetchDocumentLogs(input: {
  type: 'quote' | 'invoice';
  id: string;
}): Promise<DocumentLogView[]> {
  const endpoint = input.type === 'quote' ? 'quotes' : 'invoices';
  return apiFetch<DocumentLogView[]>(`/api/${endpoint}/${input.id}/logs`);
}
