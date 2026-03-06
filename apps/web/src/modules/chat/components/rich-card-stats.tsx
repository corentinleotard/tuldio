import type { MonthlyStatsView } from '@tuldio/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface RichCardStatsProps {
  data: MonthlyStatsView;
}

export function RichCardStats({ data }: RichCardStatsProps) {
  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">CA encaisse</p>
            <p className="text-sm font-bold text-success">
              {formatCurrency(data.revenue.totalTtc)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Impaye</p>
            <p className="text-sm font-bold text-warning">
              {formatCurrency(data.unpaid.total)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Conversion devis</p>
            <p className="text-sm font-bold">{Math.round(data.quoteConversion.rate)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
