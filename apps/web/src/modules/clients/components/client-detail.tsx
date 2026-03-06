import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, MapPin, FileText } from 'lucide-react';
import type { ClientView, QuoteView, InvoiceView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatMonthYear, formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { fetchQuotes, fetchInvoices } from '@/modules/documents/api/documents.api.js';
import { statusConfig, defaultStatus } from '@/modules/documents/components/status-config.js';

interface ClientDetailProps {
  client: ClientView;
}

type Document = (QuoteView | InvoiceView) & { _type: 'quote' | 'invoice' };

export function ClientDetail({ client }: ClientDetailProps) {
  const fullName = `${client.firstName} ${client.lastName}`;
  const hasContact = client.email || client.phone || client.address;

  const quotesQuery = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes });
  const invoicesQuery = useQuery({ queryKey: ['invoices'], queryFn: fetchInvoices });

  const { revenue, quotesCount, invoicesCount, recentDocs } = useMemo(() => {
    const quotes = (quotesQuery.data ?? []).filter((q) => q.clientId === client.id);
    const invoices = (invoicesQuery.data ?? []).filter((i) => i.clientId === client.id);

    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const rev = paidInvoices.reduce((sum, i) => sum + i.totalTtc, 0);

    const all: Document[] = [
      ...quotes.map((q) => ({ ...q, _type: 'quote' as const })),
      ...invoices.map((i) => ({ ...i, _type: 'invoice' as const })),
    ];
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      revenue: rev,
      quotesCount: quotes.length,
      invoicesCount: invoices.length,
      recentDocs: all.slice(0, 3),
    };
  }, [quotesQuery.data, invoicesQuery.data, client.id]);

  const docCount = quotesCount + invoicesCount;
  const docSummary = [
    quotesCount > 0 ? `${quotesCount} devis` : null,
    invoicesCount > 0 ? `${invoicesCount} facture${invoicesCount > 1 ? 's' : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col items-center p-5 md:p-8">
      <div className="w-full max-w-[560px] rounded-xl bg-card p-6 shadow-sm md:p-8">
        {/* Profile header */}
        <div className="mb-6 flex flex-col items-center gap-2 border-b border-border pb-6">
          <Avatar
            name={fullName}
            size="lg"
            className="h-[72px] w-[72px] bg-primary/10 text-2xl font-bold text-primary"
          />
          <h2 className="text-[22px] font-bold tracking-tight">{fullName}</h2>
          <p className="text-[13px] text-muted-foreground">
            Client depuis {formatMonthYear(client.createdAt)}
          </p>
        </div>

        {/* Contact info */}
        {hasContact && (
          <div className="mb-6 flex flex-col gap-3 border-b border-border pb-6">
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm">{client.address}</span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {client.notes.length > 0 && (
          <div className="mb-6 border-b border-border pb-6">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
              <FileText className="h-3.5 w-3.5" />
              Notes
            </h3>
            <div className="flex flex-col gap-2">
              {client.notes.map((note, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-lg px-3.5 py-2.5 text-[13px]',
                    note.type === 'warning'
                      ? 'border-l-[3px] border-l-warning bg-warning/10'
                      : 'border border-border bg-secondary/30',
                  )}
                >
                  {note.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 border-b border-border pb-6">
          <div className="rounded-[10px] border border-border bg-secondary/30 p-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Chiffre d&rsquo;affaires
            </p>
            <p className="text-[22px] font-bold">{formatCurrency(revenue)}</p>
          </div>
          <div className="rounded-[10px] border border-border bg-secondary/30 p-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Documents
            </p>
            <p className="text-[22px] font-bold">{docCount}</p>
            {docSummary && (
              <p className="mt-0.5 text-xs text-muted-foreground">{docSummary}</p>
            )}
          </div>
        </div>

        {/* Recent documents */}
        {recentDocs.length > 0 && (
          <div>
            <h3 className="mb-3 text-[13px] font-semibold">Derniers documents</h3>
            <div className="flex flex-col gap-2">
              {recentDocs.map((doc) => {
                const badge = statusConfig[doc.status] ?? { ...defaultStatus, label: doc.status };
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/30 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-semibold">{doc.number}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatCurrency(doc.totalTtc)}</p>
                      <Badge variant={badge.variant} className="mt-0.5">
                        {badge.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
