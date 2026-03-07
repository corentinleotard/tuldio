import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, ChevronLeft } from 'lucide-react';
import type { QuoteView, InvoiceView } from '@tuldio/types';
import { SegmentControl } from '@/components/ui/segment-control';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  fetchQuotes,
  fetchInvoices,
  fetchQuoteById,
  fetchInvoiceById,
  updateQuoteStatus,
  updateInvoiceStatus,
} from '../api/documents.api.js';
import { DocumentListItem } from '../components/document-list-item.js';
import { DocumentDetail } from '../components/document-detail.js';

type Segment = 'quotes' | 'invoices';

const segmentItems: { label: string; value: Segment }[] = [
  { label: 'Devis', value: 'quotes' },
  { label: 'Factures', value: 'invoices' },
];

function matchesSearch(doc: QuoteView | InvoiceView, query: string): boolean {
  const q = query.toLowerCase();
  const name = (doc.clientName ?? '').toLowerCase();
  const email = (doc.clientEmail ?? '').toLowerCase();
  const number = doc.number.toLowerCase();

  return name.includes(q) || email.includes(q) || number.includes(q);
}

export function DocumentsPage() {
  const [segment, setSegment] = useState<Segment>('quotes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();

  const quotesQuery = useQuery({
    queryKey: ['quotes'],
    queryFn: fetchQuotes,
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
  });

  const isQuotes = segment === 'quotes';
  const query = isQuotes ? quotesQuery : invoicesQuery;

  const documents = useMemo(() => {
    const all = (query.data ?? []) as (QuoteView | InvoiceView)[];
    if (!search.trim()) return all;
    return all.filter((doc) => matchesSearch(doc, search.trim()));
  }, [query.data, search]);

  const selectedListItem = selectedId
    ? documents.find((d) => d.id === selectedId) ?? null
    : null;

  const detailQuery = useQuery<QuoteView | InvoiceView>({
    queryKey: [isQuotes ? 'quotes' : 'invoices', selectedId],
    queryFn: () =>
      isQuotes
        ? fetchQuoteById(selectedId!)
        : fetchInvoiceById(selectedId!),
    enabled: !!selectedId,
  });

  const selectedDocument = detailQuery.data ?? selectedListItem;

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: string }) => {
      if (isQuotes) {
        return updateQuoteStatus({ id: input.id, status: input.status as QuoteView['status'] });
      }
      return updateInvoiceStatus({ id: input.id, status: input.status as InvoiceView['status'] }) as Promise<QuoteView | InvoiceView>;
    },
    onSuccess: () => {
      const listKey = isQuotes ? 'quotes' : 'invoices';
      queryClient.invalidateQueries({ queryKey: [listKey] });
      queryClient.invalidateQueries({ queryKey: [listKey, selectedId] });
    },
  });

  function handleSegmentChange(value: Segment) {
    setSegment(value);
    setSelectedId(null);
    setSearch('');
  }

  function handleStatusChange(status: string) {
    if (!selectedId) return;
    statusMutation.mutate({ id: selectedId, status });
  }

  const searchPlaceholder = isQuotes ? 'Rechercher un devis...' : 'Rechercher une facture...';

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className={`flex w-full flex-shrink-0 flex-col border-r md:w-[380px] ${selectedId ? 'hidden md:flex' : ''}`}>
        {/* Header */}
        <div className="border-b px-5 pb-4 pt-5">
          <h1 className="text-[22px] font-bold tracking-tight text-primary">Documents</h1>
          <div className="mt-3">
            <SegmentControl items={segmentItems} value={segment} onChange={handleSegmentChange} />
          </div>
          <div className="mt-3">
            <SearchInput
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {query.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {query.isSuccess && documents.length === 0 && !search && (
            <EmptyState
              icon={FileText}
              message={
                isQuotes
                  ? 'Pas encore de devis. Créez votre premier devis dans le chat !'
                  : 'Pas encore de factures. Créez votre première facture dans le chat !'
              }
            />
          )}

          {query.isSuccess && documents.length === 0 && search && (
            <EmptyState icon={FileText} message="Aucun résultat pour cette recherche." />
          )}

          {query.isSuccess &&
            documents.map((doc, i) => (
              <DocumentListItem
                key={doc.id}
                number={doc.number}
                clientName={doc.clientName ?? 'Client inconnu'}
                date={doc.createdAt}
                amount={doc.totalTtc}
                status={doc.status}
                isSelected={doc.id === selectedId}
                isEven={i % 2 === 1}
                onClick={() => setSelectedId(doc.id)}
              />
            ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`flex-1 overflow-y-auto ${selectedId ? '' : 'hidden md:block'}`}>
        {selectedDocument ? (
          <div>
            {/* Mobile back header */}
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 md:hidden">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                <ChevronLeft className="h-5 w-5" />
                Documents
              </button>
            </div>
            <DocumentDetail
              document={selectedDocument}
              type={isQuotes ? 'quote' : 'invoice'}
              onStatusChange={handleStatusChange}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-12 text-center">
            <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-primary/10">
              <FileText className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="mb-2 text-[22px] font-bold tracking-tight">
              {isQuotes ? 'Vos devis, en un coup d\u2019oeil' : 'Vos factures, en un coup d\u2019oeil'}
            </h2>
            <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
              Sélectionnez un document à gauche pour voir ses détails, modifier son statut ou
              télécharger le PDF.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
