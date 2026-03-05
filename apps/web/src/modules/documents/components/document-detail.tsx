import type { QuoteView, InvoiceView } from '@tuldio/types';
import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';
import { API_URL } from '@/lib/api-fetch';
import { statusConfig, defaultStatus } from './status-config.js';

interface DocumentDetailProps {
  document: QuoteView | InvoiceView;
  type: 'quote' | 'invoice';
}

export function DocumentDetail({ document: doc, type }: DocumentDetailProps) {
  const badge = statusConfig[doc.status] ?? { ...defaultStatus, label: doc.status };
  const typeLabel = type === 'quote' ? 'Devis' : 'Facture';
  const tvaAmount = doc.totalTtc - doc.totalHt;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">
              {typeLabel} {doc.number}
            </h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {doc.clientName ?? 'Client inconnu'} &middot; {formatDate(doc.createdAt)}
          </p>
        </div>

        {doc.pdfUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${API_URL}${doc.pdfUrl}`, '_blank')}
          >
            <Download className="mr-2 h-4 w-4" />
            T\u00e9l\u00e9charger PDF
          </Button>
        )}
      </div>

      {/* Lines table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lignes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Description</th>
                  <th className="pb-2 pr-4 text-right font-medium">Qt\u00e9</th>
                  <th className="pb-2 pr-4 text-right font-medium">Prix unit.</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((line, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{line.description}</td>
                    <td className="py-2 pr-4 text-right">{line.quantity}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(line.unitPrice)}</td>
                    <td className="py-2 text-right">{formatCurrency(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total HT</span>
              <span>{formatCurrency(doc.totalHt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA ({doc.tvaRate}%)</span>
              <span>{formatCurrency(tvaAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t pt-2">
              <span className="font-semibold">Total TTC</span>
              <span className="text-xl font-bold">{formatCurrency(doc.totalTtc)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
