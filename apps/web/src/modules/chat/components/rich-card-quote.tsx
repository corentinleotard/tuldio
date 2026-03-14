import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X } from 'lucide-react';
import type { QuoteView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDocumentNumber } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { viewDocument } from '@/lib/share-document';
import { statusConfig, defaultStatus } from '@/modules/documents/components/status-config';


interface RichCardQuoteProps {
  data: QuoteView;
}

export function RichCardQuote({ data }: RichCardQuoteProps) {
  const queryClient = useQueryClient();
  const [liveData, setLiveData] = useState<QuoteView>(data);
  const [loading, setLoading] = useState(true);
  const [markingStatus, setMarkingStatus] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<QuoteView>(`/api/quotes/${data.id}`)
      .then(setLiveData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [data.id]);

  const currentStatus = liveData.status;
  const status = statusConfig[currentStatus] ?? defaultStatus;
  const pdfUrl = `/api/quotes/${liveData.id}/pdf`;

  async function handleView() {
    await viewDocument({ pdfUrl });
  }

  async function handleStatusUpdate(newStatus: 'sent' | 'accepted' | 'refused') {
    setMarkingStatus(newStatus);
    try {
      await apiFetch(`/api/quotes/${data.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setLiveData((d) => d ? { ...d, status: newStatus } : d);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
            onClick={() => handleStatusUpdate('sent')}
          >
            {markingStatus === 'sent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Marquer envoyé
          </Button>
        </div>
      );
    }

    if (currentStatus === 'sent') {
      return (
        <div className="mt-3 flex flex-col gap-2">
          <Button size="sm" variant="outline" className="w-full" onClick={handleView}>
            Consulter
          </Button>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 gap-1"
              disabled={markingStatus === 'accepted'}
              onClick={() => handleStatusUpdate('accepted')}
            >
              {markingStatus === 'accepted' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accepté
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1"
              disabled={markingStatus === 'refused'}
              onClick={() => handleStatusUpdate('refused')}
            >
              {markingStatus === 'refused' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Refusé
            </Button>
          </div>
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
          <span className="text-sm font-medium">Devis {formatDocumentNumber(liveData.number)}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {liveData.clientName && (
          <p className="mt-1 text-sm text-muted-foreground">{liveData.clientName}</p>
        )}

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
