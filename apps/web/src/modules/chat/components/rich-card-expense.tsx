import type { ExpenseView } from '@tuldio/types';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/utils';

interface RichCardExpenseProps {
  data: ExpenseView;
}

export function RichCardExpense({ data }: RichCardExpenseProps) {
  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">Depense confirmee</p>
        <p className="mt-1 text-lg font-bold">{formatCurrency(data.amount)}</p>

        <div className="mt-2 space-y-1 text-sm">
          {data.vendor && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fournisseur</span>
              <span>{data.vendor}</span>
            </div>
          )}
          {data.category && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Categorie</span>
              <span>{data.category}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span>{formatDate(data.date)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
