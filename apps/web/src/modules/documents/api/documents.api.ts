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
