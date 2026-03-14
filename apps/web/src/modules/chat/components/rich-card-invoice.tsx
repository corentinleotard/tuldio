import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check } from 'lucide-react';
import type { InvoiceView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDocumentNumber } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { viewDocument } from '@/lib/share-document';
import { statusConfig, defaultStatus } from '@/modules/documents/components/status-config';


interface RichCardInvoiceProps {
  data: InvoiceView;
}

export function RichCardInvoice({ data }: RichCardInvoiceProps) {
  const queryClient = useQueryClient();
  const [liveData, setLiveData] = useState<InvoiceView>(data);
  const [loading, setLoading] = useState(true);
  const [markingStatus, setMarkingStatus] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<InvoiceView>(`/api/invoices/${data.id}`)
      .then(setLiveData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [data.id]);

  const currentStatus = liveData.status;
  const status = statusConfig[currentStatus] ?? defaultStatus;
  const isAvoir = liveData.invoiceType === 'avoir';
  const pdfUrl = `/api/invoices/${liveData.id}/pdf`;

  async function handleView() {
    await viewDocument({ pdfUrl });
  }

  async function handleMarkSent() {
    setMarkingStatus('sent');
    try {
      await apiFetch(`/api/invoices/${data.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'sent' }),
      });
      setLiveData((d) => d ? { ...d, status: 'sent' as const } : d);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch {
      // toast already shown by apiFetch
    } finally {
      setMarkingStatus(null);
    }
  }

  async function handleMarkPaid() {
    setMarkingStatus('paid');
    try {
      await apiFetch(`/api/invoices/${data.id}/paid`, {
        method: 'PUT',
      });
      setLiveData((d) => d ? { ...d, status: 'paid' as const } : d);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch {
      // toast already shown by apiFetch
    } finally {
      setMarkingStatus(null);
    }
  }

  function renderActions() {
    if (currentStatus === 'draft') {
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
            Consulter
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            disabled={markingStatus === 'sent'}
            onClick={handleMarkSent}
          >
            {markingStatus === 'sent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Marquer envoyée
          </Button>
        </div>
      );
    }

    if (currentStatus === 'sent' || currentStatus === 'overdue') {
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
            Consulter
          </Button>
          {!isAvoir && (
            <Button
              size="sm"
              className="flex-1 gap-1"
              disabled={markingStatus === 'paid'}
              onClick={handleMarkPaid}
            >
              {markingStatus === 'paid' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Payée
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={handleView}>
          Consulter
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {liveData.invoiceType === 'avoir' ? 'Avoir' : liveData.invoiceType === 'acompte' ? "Facture d'acompte" : liveData.invoiceType === 'solde' ? 'Facture de solde' : 'Facture'} {formatDocumentNumber(liveData.number)}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {liveData.clientName && (
          <p className="mt-1 text-sm text-muted-foreground">{liveData.clientName}</p>
        )}
        {liveData.sourceInvoiceNumber && (
          <p className="mt-0.5 text-xs text-muted-foreground">Réf. facture {liveData.sourceInvoiceNumber}</p>
        )}

        {liveData.invoiceType !== 'acompte' && (
          <div className="mt-3 space-y-1">
            {liveData.lines.map((line, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="min-w-0 truncate pr-2">{line.description}</span>
                <span className="shrink-0 font-medium">
                  {formatCurrency(line.totalHt)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total TTC</span>
          <span className="text-lg font-bold">{formatCurrency(liveData.totalTtc)}</span>
        </div>

        {loading ? (
          <div className="mt-3 flex gap-2 animate-pulse">
            <div className="h-8 flex-1 rounded bg-muted" />
            <div className="h-8 flex-1 rounded bg-muted" />
          </div>
        ) : renderActions()}
      </CardContent>
    </Card>
  );
}
