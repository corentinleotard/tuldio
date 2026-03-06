import type { QuoteView, InvoiceView } from '@tuldio/types';
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
