import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Search } from 'lucide-react';
import type { QuoteView, InvoiceView } from '@tuldio/types';
import { SegmentControl } from '@/components/ui/segment-control';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchQuotes, fetchInvoices } from '../api/documents.api.js';
import { DocumentListItem } from '../components/document-list-item.js';
import { DocumentDetail } from '../components/document-detail.js';

type Segment = 'quotes' | 'invoices';

const segmentItems: { label: string; value: Segment }[] = [
  { label: 'Devis', value: 'quotes' },
  { label: 'Factures', value: 'invoices' },
];

export function DocumentsPage() {
  const [segment, setSegment] = useState<Segment>('quotes');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const documents = (query.data ?? []) as (QuoteView | InvoiceView)[];

  const selectedDocument = selectedId
    ? documents.find((d) => d.id === selectedId) ?? null
    : null;

  function handleSegmentChange(value: Segment) {
    setSegment(value);
    setSelectedId(null);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-b px-4 py-4 md:px-5 md:pb-4 md:pt-5">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold tracking-tight text-primary">Documents</h1>
          <button type="button" className="rounded-full p-2 transition-colors hover:bg-secondary">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-3">
          <SegmentControl items={segmentItems} value={segment} onChange={handleSegmentChange} />
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1">
        {/* List panel */}
        <div className="w-full overflow-y-auto border-r md:w-[380px]">
          {query.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {query.isSuccess && documents.length === 0 && (
            <EmptyState
              icon={FileText}
              message={
                isQuotes
                  ? 'Pas encore de devis. Cr\u00e9ez votre premier devis dans le chat !'
                  : 'Pas encore de factures. Cr\u00e9ez votre premi\u00e8re facture dans le chat !'
              }
            />
          )}

          {query.isSuccess &&
            documents.map((doc) => (
              <DocumentListItem
                key={doc.id}
                number={doc.number}
                clientName={doc.clientName ?? 'Client inconnu'}
                date={doc.createdAt}
                amount={doc.totalTtc}
                status={doc.status}
                isSelected={doc.id === selectedId}
                onClick={() => setSelectedId(doc.id)}
              />
            ))}
        </div>

        {/* Detail panel — desktop only */}
        <div className="hidden flex-1 overflow-y-auto md:block">
          {selectedDocument ? (
            <DocumentDetail
              document={selectedDocument}
              type={isQuotes ? 'quote' : 'invoice'}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Sélectionnez un document pour voir les détails
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
