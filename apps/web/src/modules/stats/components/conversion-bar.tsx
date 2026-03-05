import { Card, CardContent } from '@/components/ui/card';

interface ConversionBarProps {
  total: number;
  accepted: number;
  rate: number;
}

export function ConversionBar({ total, accepted, rate }: ConversionBarProps) {
  const percentage = Math.round(rate * 100);

  return (
    <Card className="border-l-[3px] border-l-primary">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Taux de conversion</span>
          <span className="text-sm font-bold">{percentage} %</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {accepted} devis acceptes sur {total}
        </span>
      </CardContent>
    </Card>
  );
}
