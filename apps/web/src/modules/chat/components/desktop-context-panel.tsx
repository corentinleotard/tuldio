import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import type { QuoteView, InvoiceView, MonthlyStatsView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { fetchQuotes, fetchInvoices } from '@/modules/documents/api/documents.api.js';
import { fetchMonthlyStats } from '@/modules/stats/api/stats.api.js';

type AnyDocument = (QuoteView | InvoiceView) & { _type: 'quote' | 'invoice' };

function getLatestDocument(
  quotes: QuoteView[],
  invoices: InvoiceView[],
): AnyDocument | null {
  const all: AnyDocument[] = [
    ...quotes.map((q) => ({ ...q, _type: 'quote' as const })),
    ...invoices.map((i) => ({ ...i, _type: 'invoice' as const })),
  ];
  if (all.length === 0) return null;
  all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return all[0] ?? null;
}

const docStatusConfig: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  sent: { label: 'Envoye', variant: 'default' },
  accepted: { label: 'Accepte', variant: 'success' },
  refused: { label: 'Refuse', variant: 'destructive' },
  paid: { label: 'Paye', variant: 'success' },
  overdue: { label: 'En retard', variant: 'warning' },
};

export function DesktopContextPanel({ showHeader = true }: { showHeader?: boolean }) {
  const now = new Date();

  const { data: quotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: fetchQuotes,
  });

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: fetchInvoices,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => fetchMonthlyStats({ month: now.getMonth() + 1, year: now.getFullYear() }),
  });

  const latestDoc = getLatestDocument(quotes ?? [], invoices ?? []);
  const hasContent = latestDoc || stats;

  return (
    <div className="flex h-full flex-col p-4">
      {showHeader && <h2 className="text-sm font-semibold">Contexte</h2>}

      {!hasContent && (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Pas encore de documents. Les devis, factures et depenses apparaitront ici.
          </p>
        </div>
      )}

      {hasContent && (
        <div className="mt-4 flex flex-col gap-4">
          {latestDoc && <LatestDocumentCard doc={latestDoc} />}
          {stats && <MonthSummaryCard stats={stats} />}
        </div>
      )}
    </div>
  );
}

function LatestDocumentCard({ doc }: { doc: AnyDocument }) {
  const badge = docStatusConfig[doc.status] ?? { label: doc.status, variant: 'secondary' as const };
  const typeLabel = doc._type === 'quote' ? 'Devis' : 'Facture';

  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Dernier document</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold">{doc.number}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {typeLabel} &middot; {doc.clientName ?? 'Client'}
        </p>
        <p className="mt-1 text-base font-bold">{formatCurrency(doc.totalTtc)}</p>
      </CardContent>
    </Card>
  );
}

function MonthSummaryCard({ stats }: { stats: MonthlyStatsView }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Resume du mois</p>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">CA encaisse</span>
            <span className="font-bold text-success">
              {formatCurrency(stats.revenue.totalTtc)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Impaye</span>
            <span className="font-bold text-warning">
              {formatCurrency(stats.unpaid.total)}
            </span>
          </div>
          <div className="border-t pt-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Conversion devis</span>
              <span className="font-bold">{Math.round(stats.quoteConversion.rate)}%</span>
            </div>
          </div>
        </div>
        {stats.unpaid.count > 0 && (
          <p className="mt-2 text-xs italic text-warning">
            {stats.unpaid.count} facture{stats.unpaid.count > 1 ? 's' : ''} impayee
            {stats.unpaid.count > 1 ? 's' : ''} ({formatCurrency(stats.unpaid.total)})
          </p>
        )}
      </CardContent>
    </Card>
  );
}
