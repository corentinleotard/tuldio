import type { InvoiceView } from '@tuldio/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface RichCardInvoiceProps {
  data: InvoiceView;
}

const statusConfig: Record<
  InvoiceView['status'],
  { label: string; variant: 'secondary' | 'default' | 'success' | 'warning' }
> = {
  draft: { label: 'Brouillon', variant: 'secondary' },
  sent: { label: 'Envoyee', variant: 'default' },
  paid: { label: 'Payee', variant: 'success' },
  overdue: { label: 'En retard', variant: 'warning' },
};

export function RichCardInvoice({ data }: RichCardInvoiceProps) {
  const status = statusConfig[data.status];

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
                {formatCurrency(line.total)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm text-muted-foreground">Total TTC</span>
          <span className="text-lg font-bold">{formatCurrency(data.totalTtc)}</span>
        </div>

        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1">
            Envoyer
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            Modifier
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
