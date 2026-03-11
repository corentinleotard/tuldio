import { useState, useRef, useEffect } from 'react';
import type { QuoteView, InvoiceView } from '@tuldio/types';
import { Download, ChevronDown } from 'lucide-react';
import { cn, formatCurrency, formatDate, formatShortDate, isSameDay } from '@/lib/utils';
import { viewDocument } from '@/lib/share-document';
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
}

export function DocumentDetail({ document: doc, type, onStatusChange }: DocumentDetailProps) {
  const badge = statusConfig[doc.status] ?? { ...defaultStatus, label: doc.status };
  const invoiceType = type === 'invoice' ? (doc as InvoiceView).invoiceType : undefined;
  const typeLabel = type === 'quote' ? 'Devis' : invoiceType === 'avoir' ? 'Avoir' : invoiceType === 'acompte' ? "Facture d'acompte" : invoiceType === 'solde' ? 'Facture de solde' : 'Facture';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const avoirTransitions: Record<string, string[]> = { draft: ['sent'], sent: [], paid: [], overdue: [], cancelled: [] };
  const transitions = type === 'quote' ? quoteTransitions : invoiceType === 'avoir' ? avoirTransitions : invoiceTransitions;
  const nextStatuses = transitions[doc.status as keyof typeof transitions] ?? [];
  const allStatuses = getOrderedStatuses(type);
  const hasTransitions = nextStatuses.length > 0;

  function handleStatusSelect(status: string) {
    setDropdownOpen(false);
    onStatusChange(status);
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
            <h2 className="text-2xl font-bold tracking-tight">{doc.number}</h2>
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
                        isClickable && 'cursor-pointer hover:bg-secondary',
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

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => viewDocument({ pdfUrl: doc.pdfUrl ?? `/api/${type === 'quote' ? 'quotes' : 'invoices'}/${doc.id}/pdf` })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Télécharger PDF
          </button>
        </div>
      </div>
    </div>
  );
}
