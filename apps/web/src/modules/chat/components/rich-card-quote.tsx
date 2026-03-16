import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, Mail, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { QuoteView } from '@tuldio/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency, formatDocumentNumber } from '@/lib/utils';
import { apiFetch } from '@/lib/api-fetch';
import { viewDocument } from '@/lib/share-document';
import { updateClient } from '@/modules/clients/api/clients.api';
import {
  statusConfig,
  defaultStatus,
  quoteTransitions,
  getStatusDotClass,
} from '@/modules/documents/components/status-config';
import { ClientInfoPrompt, getMissingClientFields } from './client-info-prompt';

interface DocumentReadiness {
  errors: { code: string; message: string }[];
}

interface RichCardQuoteProps {
  data: QuoteView & { _readiness?: DocumentReadiness; _showTutorial?: boolean };
  onLiveData?: (data: QuoteView) => void;
  onDeleted?: () => void;
}

export function RichCardQuote({ data, onLiveData, onDeleted }: RichCardQuoteProps) {
  const queryClient = useQueryClient();
  const [liveData, setLiveData] = useState<QuoteView>(data);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const onLiveDataRef = useRef(onLiveData);
  const onDeletedRef = useRef(onDeleted);
  onLiveDataRef.current = onLiveData;
  onDeletedRef.current = onDeleted;

  useEffect(() => {
    apiFetch<QuoteView>(`/api/quotes/${data.id}`, undefined, ['QUOTE_NOT_FOUND'])
      .then((fresh) => {
        setLiveData(fresh);
        onLiveDataRef.current?.(fresh);
      })
      .catch((err: { code?: string }) => {
        if (err.code === 'QUOTE_NOT_FOUND') { setDeleted(true); onDeletedRef.current?.(); }
      })
      .finally(() => setLoading(false));
  }, [data.id]);

  const currentStatus = liveData.status;
  const status = statusConfig[currentStatus] ?? defaultStatus;
  const pdfUrl = `/api/quotes/${liveData.id}/pdf`;
  const readinessErrors = data._readiness?.errors ?? [];
  const transitions = quoteTransitions[currentStatus] ?? [];

  const promoted = transitions[0] ?? null;
  const pills = transitions.slice(1);

  function getMissingFieldsForAction(action: string) {
    return getMissingClientFields({
      needsEmail: action === 'sent',
      clientEmail: liveData.clientEmail,
      readinessErrors,
    });
  }

  async function handleView() {
    await viewDocument({ pdfUrl });
  }

  const [confirmingCancel, setConfirmingCancel] = useState(false);

  async function handleAction(action: string) {
    // Confirm destructive actions
    if (action === 'cancelled') {
      setConfirmingCancel(true);
      return;
    }
    // If leaving draft and client info is missing, show prompt first
    const missing = currentStatus === 'draft' ? getMissingFieldsForAction(action) : [];
    if (missing.length > 0) {
      setPendingAction(action);
      return;
    }
    await executeAction(action);
  }

  async function executeAction(action: string) {
    setBusy(action);
    try {
      if (action === 'sent') {
        const updated = await apiFetch<QuoteView>(`/api/quotes/${data.id}/send-email`, {
          method: 'POST',
        });
        setLiveData(updated);
        onLiveData?.(updated);
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        toast.success(`Devis ${formatDocumentNumber(updated.number)} envoyé à ${updated.clientEmail}`);
      } else {
        await apiFetch(`/api/quotes/${data.id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: action }),
        });
        setLiveData((d) => ({ ...d, status: action as QuoteView['status'] }));
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }
      setPendingAction(null);
    } catch {
      // error toast already shown by apiFetch
    } finally {
      setBusy(null);
    }
  }

  async function handlePromptSubmit(values: Record<string, string>) {
    const action = pendingAction ?? 'sent';
    setBusy(action);
    try {
      await updateClient({ id: liveData.clientId, ...values });
      if (values.email) {
        setLiveData((d) => ({ ...d, clientEmail: values.email }));
      }
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      await executeAction(action);
    } catch {
      // error toast already shown by apiFetch
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy('delete');
    try {
      await apiFetch(`/api/quotes/${data.id}`, { method: 'DELETE' });
      setDeleted(true);
      onDeleted?.();
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    } catch {
      // error toast already shown by apiFetch
    } finally {
      setBusy(null);
    }
  }

  function getPromotedIcon() {
    if (!promoted) return null;
    if (promoted === 'sent') return <Mail className="h-3.5 w-3.5" />;
    if (promoted === 'cancelled') return <X className="h-3.5 w-3.5" />;
    return <Check className="h-3.5 w-3.5" />;
  }

  function getPromotedLabel(): string {
    if (!promoted) return '';
    if (promoted === 'sent') return 'Envoyer';
    if (promoted === 'cancelled') return 'Annuler';
    return statusConfig[promoted]?.label ?? promoted;
  }

  function getPromotedVariant(): 'default' | 'destructive' {
    return promoted === 'cancelled' ? 'destructive' : 'default';
  }

  function renderActions() {
    if (transitions.length === 0) {
      return (
        <div className="mt-3">
          <Button size="sm" variant="outline" className="w-full" onClick={handleView}>
            Consulter
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
            Consulter
          </Button>
          <Button
            size="sm"
            variant={getPromotedVariant()}
            className="flex-1 gap-1.5"
            disabled={busy !== null}
            onClick={() => handleAction(promoted!)}
          >
            {busy === promoted ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : getPromotedIcon()}
            {getPromotedLabel()}
          </Button>
        </div>

        {(pills.length > 0 || currentStatus === 'draft') && (
          <div className="flex flex-wrap gap-1.5">
            {pills.map((s) => {
              const sc = statusConfig[s] ?? defaultStatus;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => handleAction(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  {busy === s ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : (
                    <span className={cn('h-1.5 w-1.5 rounded-full', getStatusDotClass(sc.variant))} />
                  )}
                  {sc.label}
                </button>
              );
            })}
            {currentStatus === 'draft' && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                {busy === 'delete' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <Trash2 className="h-2.5 w-2.5" />
                )}
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (deleted) {
    return (
      <Card className="mt-2 max-w-[88%] rounded-2xl">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Devis supprimé</p>
        </CardContent>
      </Card>
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
          {liveData.lines.map((line) => (
            <div key={line.id} className="flex items-center justify-between text-sm">
              <span className="min-w-0 truncate pr-2">{line.description}</span>
              <span className="shrink-0 font-medium">{formatCurrency(line.totalHt)}</span>
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

        {pendingAction && (
          <ClientInfoPrompt
            key={pendingAction}
            clientName={liveData.clientName ?? null}
            missingFields={getMissingFieldsForAction(pendingAction)}
            actionLabel={pendingAction === 'sent' ? 'Envoyer' : (statusConfig[pendingAction]?.label ?? pendingAction)}
            onSubmit={handlePromptSubmit}
            loading={busy !== null}
          />
        )}

        {confirmingCancel && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">Annuler ce devis ?</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setConfirmingCancel(false)}>
                Non
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-3 text-xs"
                disabled={busy !== null}
                onClick={() => { setConfirmingCancel(false); executeAction('cancelled'); }}
              >
                {busy === 'cancelled' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Oui, annuler'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
