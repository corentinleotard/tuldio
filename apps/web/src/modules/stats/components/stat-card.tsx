import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  accentClassName?: string;
}

export function StatCard({ icon: Icon, label, value, subValue, accentClassName }: StatCardProps) {
  return (
    <Card className={cn('border-l-[3px]', accentClassName ?? 'border-l-primary')}>
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary',
            accentClassName?.includes('success') && 'bg-success/10 text-success',
            accentClassName?.includes('destructive') && 'bg-destructive/10 text-destructive',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
          <span className="text-2xl font-bold">{value}</span>
          {subValue && <span className="text-sm text-muted-foreground">{subValue}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
