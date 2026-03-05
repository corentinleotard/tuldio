import type { MonthlyStatsView } from '@tuldio/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface RichCardStatsProps {
  data: MonthlyStatsView;
}

export function RichCardStats({ data }: RichCardStatsProps) {
  const result = data.revenue.totalTtc - data.expenses.total;

  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Recettes</p>
            <p className="text-sm font-bold text-success">
              {formatCurrency(data.revenue.totalTtc)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Depenses</p>
            <p className="text-sm font-bold text-destructive">
              {formatCurrency(data.expenses.total)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Resultat</p>
            <p className="text-sm font-bold">{formatCurrency(result)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
