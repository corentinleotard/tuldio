import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Check, X } from 'lucide-react';
import type { InvoiceView, ClientView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { shareDocument, viewDocument } from '@/lib/share-document';
import { statusConfig, defaultStatus } from '@/modules/documents/components/status-config';
import { RichCardSkeleton } from './rich-card-skeleton';

interface RichCardInvoiceProps {
  data: InvoiceView;
  onSendMessage?: (text: string) => void;
}

export function RichCardInvoice({ data, onSendMessage }: RichCardInvoiceProps) {
  const queryClient = useQueryClient();
  const [currentStatus, setCurrentStatus] = useState(data.status);
  const [loading, setLoading] = useState(true);
  const status = statusConfig[currentStatus] ?? defaultStatus;
  const [sending, setSending] = useState(false);

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    apiFetch<InvoiceView>(`/api/invoices/${data.id}`)
      .then((inv) => setCurrentStatus(inv.status))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [data.id]);

  const fileName = `facture-${data.number}.pdf`;
  const pdfUrl = `/api/invoices/${data.id}/pdf`;

  async function handleSend() {
    setSending(true);
    try {
      const client = await apiFetch<ClientView>(`/api/clients/${data.clientId}`);
      if (!client.email) {
        onSendMessage?.(`Je veux envoyer la facture ${data.number} par email mais il manque l'email du client`);
        return;
      }
      await shareDocument({
        pdfUrl,
        fileName,
        clientEmail: client.email,
        subject: `Facture ${data.number}`,
        body: `Bonjour,\n\nVeuillez trouver ci-joint la facture ${data.number}.\n\nCordialement`,
      });
      setConfirming(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  async function handleConfirmSent() {
    try {
      await apiFetch(`/api/invoices/${data.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'sent' }),
      });
      setCurrentStatus('sent');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch {
      // ignore
    }
    setConfirming(false);
  }

  async function handleView() {
    await viewDocument({ pdfUrl });
  }

  async function handleMarkPaid() {
    try {
      await apiFetch(`/api/invoices/${data.id}/paid`, {
        method: 'PUT',
      });
      setCurrentStatus('paid');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch {
      // ignore
    }
  }

  function renderActions() {
    if (confirming) {
      return (
        <div className="mt-3 flex gap-2">
          <span className="flex items-center text-sm text-muted-foreground">Email envoyé ?</span>
          <Button size="sm" className="gap-1" onClick={handleConfirmSent}>
            <Check className="h-3.5 w-3.5" /> Oui
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
            <X className="h-3.5 w-3.5" /> Non
          </Button>
        </div>
      );
    }

    if (currentStatus === 'draft') {
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5" disabled={sending} onClick={handleSend}>
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Envoyer par email
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
            Consulter
          </Button>
        </div>
      );
    }

    if (currentStatus === 'sent' || currentStatus === 'overdue') {
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1 gap-1" onClick={handleMarkPaid}>
            <Check className="h-3.5 w-3.5" /> Payée
          </Button>
        </div>
      );
    }

    return null;
  }

  if (loading) return <RichCardSkeleton />;

  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Facture {data.number}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {data.clientName && (
          <p className="mt-1 text-sm text-muted-foreground">{data.clientName}</p>
        )}

        <div className="mt-3 space-y-1">
          {data.lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="truncate pr-2">{line.description}</span>
              <span className="shrink-0 font-medium">
                {formatCurrency(line.totalHt)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total TTC</span>
          <span className="text-lg font-bold">{formatCurrency(data.totalTtc)}</span>
        </div>

        {renderActions()}
      </CardContent>
    </Card>
  );
}
