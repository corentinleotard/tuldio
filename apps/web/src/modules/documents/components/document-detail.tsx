import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { QuoteView, InvoiceView, DocumentLogView } from '@tuldio/common';
import { avoirTransitions } from '@tuldio/common/invoices';
import { Download, ChevronDown, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency, formatDate, formatShortDate, isSameDay, formatDocumentNumber } from '@/lib/utils';
import { viewDocument } from '@/lib/share-document';
import { sendDocumentEmail, fetchDocumentLogs } from '../api/documents.api.js';
import {
  statusConfig,
  defaultStatus,
  quoteTransitions,
  invoiceTransitions,
  getOrderedStatuses,
  getStatusDotClass,
  getStatusCssVar,
} from './status-config.js';

interface DocumentDetailProps {
  document: QuoteView | InvoiceView;
  type: 'quote' | 'invoice';
  onStatusChange: (status: string) => void;
  onDocumentUpdate?: () => void;
}

export function DocumentDetail({ document: doc, type, onStatusChange, onDocumentUpdate }: DocumentDetailProps) {
  const badge = statusConfig[doc.status] ?? { ...defaultStatus, label: doc.status };
  const invoiceType = type === 'invoice' ? (doc as InvoiceView).invoiceType : undefined;
  const typeLabel = type === 'quote' ? 'Devis' : invoiceType === 'avoir' ? 'Avoir' : invoiceType === 'acompte' ? "Facture d'acompte" : invoiceType === 'solde' ? 'Facture de solde' : 'Facture';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const logsQuery = useQuery({
    queryKey: [type === 'quote' ? 'quotes' : 'invoices', doc.id, 'logs'],
    queryFn: () => fetchDocumentLogs({ type, id: doc.id }),
    enabled: true,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const transitions = type === 'quote' ? quoteTransitions : invoiceType === 'avoir' ? avoirTransitions : invoiceTransitions;
  const nextStatuses = transitions[doc.status as keyof typeof transitions] ?? [];
  const allStatuses = getOrderedStatuses(type);
  const hasTransitions = nextStatuses.length > 0;

  function handleStatusSelect(status: string) {
    setDropdownOpen(false);
    onStatusChange(status);
  }

  async function handleSendEmail() {
    setSendingEmail(true);
    try {
      const updated = await sendDocumentEmail({ type, id: doc.id });
      const docLabel = type === 'quote' ? 'Devis' : 'Facture';
      toast.success(`${docLabel} ${formatDocumentNumber(updated.number)} envoyé à ${updated.clientEmail}`);
      onDocumentUpdate?.();
      logsQuery.refetch();
    } catch {
      // error toast already shown by apiFetch
    } finally {
      setSendingEmail(false);
    }
  }

  const pdfUrl = doc.pdfUrl ?? `/api/${type === 'quote' ? 'quotes' : 'invoices'}/${doc.id}/pdf`;

  function formatLogDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      + ' à '
      + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function getLogLabel(log: DocumentLogView): string {
    switch (log.event) {
      case 'email_sent':
        return `Email envoyé à ${log.recipientEmail}`;
      case 'downloaded':
        return 'Document téléchargé par le client';
      case 'status_changed': {
        const meta = log.metadata as { from?: string; to?: string };
        const toLabel = statusConfig[meta.to ?? '']?.label ?? meta.to;
        return `Statut passé à ${toLabel}`;
      }
      case 'created':
        return 'Document créé';
      default:
        return log.event;
    }
  }

  function getLogDotClass(event: string): string {
    switch (event) {
      case 'email_sent': return 'bg-info';
      case 'downloaded': return 'bg-success';
      case 'status_changed': return 'bg-primary';
      default: return 'bg-muted-foreground';
    }
  }

  return (
    <div className="flex flex-col items-center p-5 md:p-8">
      <div className="w-full max-w-[600px] rounded-xl bg-card p-6 shadow-sm md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {typeLabel}
            </p>
            <h2 className="text-2xl font-bold tracking-tight">{formatDocumentNumber(doc.number)}</h2>
          </div>

          {/* Status dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => hasTransitions && setDropdownOpen(!dropdownOpen)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white transition-opacity',
                hasTransitions && 'cursor-pointer hover:opacity-85',
                !hasTransitions && 'cursor-default',
              )}
              style={{
                backgroundColor: `hsl(var(${getStatusCssVar(badge.variant)}))`,
              }}
            >
              {badge.label}
              {hasTransitions && <ChevronDown className="h-3 w-3" />}
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-10 mt-1.5 min-w-[180px] overflow-hidden rounded-[10px] border border-border bg-card shadow-lg">
                <p className="px-3.5 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Changer le statut
                </p>
                {allStatuses.map((s) => {
                  const sc = statusConfig[s] ?? defaultStatus;
                  const isCurrent = s === doc.status;
                  const isClickable = nextStatuses.includes(s as never);

                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!isClickable && !isCurrent}
                      onClick={() => isClickable && handleStatusSelect(s)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                        isCurrent && 'bg-primary/5',
                        isClickable && sc.variant === 'destructive' && 'cursor-pointer hover:bg-destructive/10',
                        isClickable && sc.variant !== 'destructive' && 'cursor-pointer hover:bg-secondary',
                        !isClickable && !isCurrent && 'cursor-default opacity-40',
                      )}
                    >
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', getStatusDotClass(sc.variant))} />
                      <span
                        className={cn(
                          'font-medium',
                          isCurrent && 'font-semibold text-primary',
                        )}
                      >
                        {sc.label}
                      </span>
                      {isCurrent && (
                        <span className="ml-auto text-[11px] text-muted-foreground">actuel</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Source invoice reference for avoir */}
        {type === 'invoice' && (doc as InvoiceView).sourceInvoiceNumber && (
          <p className="mb-4 text-sm text-muted-foreground">
            Réf. facture {(doc as InvoiceView).sourceInvoiceNumber}
          </p>
        )}

        {/* Metadata row */}
        <div className="mb-6 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Client</p>
            <p className="text-[15px] font-semibold">{doc.clientName ?? 'Client inconnu'}</p>
            {doc.clientEmail && (
              <p className="text-[13px] text-muted-foreground">{doc.clientEmail}</p>
            )}
          </div>
          {type === 'quote' && doc.sentAt && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Envoyé le</p>
              <p className="text-[15px] font-semibold">{formatDate(doc.sentAt)}</p>
            </div>
          )}
          {type === 'invoice' && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Date</p>
              <p className="text-[15px] font-semibold">{formatDate(doc.createdAt)}</p>
              {doc.sentAt && !isSameDay(doc.sentAt, doc.createdAt) && (
                <p className="text-[13px] text-muted-foreground">
                  Envoyé le {formatShortDate(doc.sentAt)}
                </p>
              )}
            </div>
          )}
          {type === 'invoice' && (doc as InvoiceView).prestationDate && !isSameDay((doc as InvoiceView).prestationDate!, doc.createdAt) && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Prestation</p>
              <p className="text-[15px] font-semibold">{formatDate((doc as InvoiceView).prestationDate!)}</p>
            </div>
          )}
          {type === 'invoice' && (doc as InvoiceView).dueDate && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Échéance</p>
              <p className="text-[15px] font-semibold">{formatDate((doc as InvoiceView).dueDate!)}</p>
            </div>
          )}
          {type === 'quote' && (doc as QuoteView).validUntil && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Valide jusqu'au</p>
              <p className="text-[15px] font-semibold">{formatDate((doc as QuoteView).validUntil!)}</p>
            </div>
          )}
        </div>

        {/* Action bar — ghost buttons */}
        <div className="mb-5 flex gap-2 border-b border-border pb-5">
          <button
            type="button"
            onClick={() => viewDocument({ pdfUrl })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-lightest px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleSendEmail}
            disabled={sendingEmail}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-lightest px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
          >
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email
          </button>
        </div>

        {/* Lines table */}
        <div className="mb-6 overflow-hidden rounded-[10px] border border-border bg-card">
          {/* Header — full on desktop, compact on mobile */}
          <div className="hidden border-b border-border bg-secondary/50 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground md:grid md:grid-cols-[1fr_60px_80px_100px]">
            <div>Description</div>
            <div className="text-center">Qté</div>
            <div className="text-right">Prix unit.</div>
            <div className="text-right">Total</div>
          </div>
          <div className="border-b border-border bg-secondary/50 px-3.5 py-2.5 text-xs font-semibold text-muted-foreground md:hidden">
            <div className="flex justify-between">
              <span>Description</span>
              <span>Total</span>
            </div>
          </div>

          {/* Rows */}
          {doc.lines.map((line, i) => (
            <div key={i} className={cn(i < doc.lines.length - 1 && 'border-b border-border')}>
              {/* Desktop row */}
              <div className="hidden px-3.5 py-3 text-sm md:grid md:grid-cols-[1fr_60px_80px_100px]">
                <div>{line.description}</div>
                <div className="text-center">{line.quantity}</div>
                <div className="text-right">{formatCurrency(line.unitPrice)}</div>
                <div className="text-right font-semibold">{formatCurrency(line.totalHt)}</div>
              </div>
              {/* Mobile row */}
              <div className="flex items-start justify-between px-3.5 py-3 text-sm md:hidden">
                <div>
                  <p className="font-medium">{line.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {line.quantity} × {formatCurrency(line.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold">{formatCurrency(line.totalHt)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mb-6 flex justify-end">
          <div className="w-[220px]">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-semibold">{formatCurrency(doc.totalHt)}</span>
            </div>
            {doc.tvaGroups.map((g) => (
              <div key={g.tvaRate} className="mb-1.5 flex justify-between text-sm">
                <span className="text-muted-foreground">TVA {g.tvaRate / 100}%</span>
                <span>{formatCurrency(g.tvaMontant)}</span>
              </div>
            ))}
            <div className="my-2 h-px bg-border" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Total TTC</span>
              <span className="font-bold">{formatCurrency(doc.totalTtc)}</span>
            </div>
          </div>
        </div>

        {/* History timeline */}
        {logsQuery.data && logsQuery.data.length > 0 && (
          <div className="border-t border-border pt-5">
            <p className="mb-3 text-[13px] font-semibold text-muted-foreground">Historique</p>
            <div className="space-y-0">
              {logsQuery.data.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-t border-border py-2 first:border-t-0">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', getLogDotClass(log.event))} />
                  <div>
                    <p className="text-sm">{getLogLabel(log)}</p>
                    <p className="text-xs text-muted-foreground">{formatLogDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
