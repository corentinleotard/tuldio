import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, Check, X, Mail } from 'lucide-react';
import type { QuoteView, ClientView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api-fetch';
import { shareDocument, viewDocument } from '@/lib/share-document';
import { statusConfig, defaultStatus } from '@/modules/documents/components/status-config';


interface RichCardQuoteProps {
  data: QuoteView;
}

export function RichCardQuote({ data }: RichCardQuoteProps) {
  const queryClient = useQueryClient();
  const [liveData, setLiveData] = useState<QuoteView>(data);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<QuoteView>(`/api/quotes/${data.id}`)
      .then(setLiveData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [data.id]);

  const currentStatus = liveData.status;
  const clientEmail = liveData.clientEmail ?? null;
  const status = statusConfig[currentStatus] ?? defaultStatus;
  const fileName = `devis-${liveData.number}.pdf`;
  const pdfUrl = `/api/quotes/${liveData.id}/pdf`;

  async function handleSaveEmail() {
    if (!emailInput.trim()) return;
    setSavingEmail(true);
    setEmailError(null);
    try {
      await apiFetch(`/api/clients/${data.clientId}`, {
        method: 'PUT',
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      setLiveData((d) => d ? { ...d, clientEmail: emailInput.trim() } : d);
      setAddingEmail(false);
      setEmailInput('');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      if (err instanceof ApiError) {
        setEmailError(err.message);
      }
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      const client = await apiFetch<ClientView>(`/api/clients/${data.clientId}`);
      if (!client.email) {
        setLiveData((d) => d ? { ...d, clientEmail: undefined } : d);
        setAddingEmail(true);
        return;
      }
      await shareDocument({
        pdfUrl,
        fileName,
        clientEmail: client.email,
        subject: `Devis ${data.number}`,
        body: `Bonjour,\n\nVeuillez trouver ci-joint le devis ${data.number}.\n\nCordialement`,
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
      await apiFetch(`/api/quotes/${data.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'sent' }),
      });
      setLiveData((d) => d ? { ...d, status: 'sent' as const } : d);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    } catch {
      // ignore
    }
    setConfirming(false);
  }

  async function handleView() {
    await viewDocument({ pdfUrl });
  }

  async function handleStatusUpdate(newStatus: 'accepted' | 'refused') {
    try {
      await apiFetch(`/api/quotes/${data.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setLiveData((d) => d ? { ...d, status: newStatus } : d);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
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
        <div className="mt-3 flex flex-col gap-2">
          {addingEmail && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); setEmailError(null); }}
                  placeholder="Email du client"
                  className={`h-8 rounded-lg text-sm ${emailError ? 'border-destructive' : ''}`}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
                />
                <Button size="sm" className="gap-1 shrink-0" onClick={handleSaveEmail} disabled={savingEmail || !emailInput.trim()}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => { setAddingEmail(false); setEmailError(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            {clientEmail ? (
              <Button size="sm" className="flex-1 gap-1.5" disabled={sending} onClick={handleSend}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Envoyer par email
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setAddingEmail(true)}>
                <Mail className="h-3.5 w-3.5" />
                Ajouter un email
              </Button>
            )}
            <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
              Consulter
            </Button>
          </div>
        </div>
      );
    }

    if (currentStatus === 'sent') {
      return (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1 gap-1" onClick={() => handleStatusUpdate('accepted')}>
            <Check className="h-3.5 w-3.5" /> Accepté
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleStatusUpdate('refused')}>
            <X className="h-3.5 w-3.5" /> Refusé
          </Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={handleView}>
            Consulter
          </Button>
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
          <span className="text-sm font-medium">Devis {liveData.number}</span>
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
