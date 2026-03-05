import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatShortDate } from '@/lib/utils';
import { statusConfig, defaultStatus } from './status-config.js';

interface DocumentListItemProps {
  number: string;
  clientName: string;
  date: string;
  amount: number;
  status: string;
  isSelected?: boolean;
  onClick: () => void;
}

export function DocumentListItem({
  number,
  clientName,
  date,
  amount,
  status,
  isSelected,
  onClick,
}: DocumentListItemProps) {
  const badge = statusConfig[status] ?? { ...defaultStatus, label: status };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50',
        isSelected && 'bg-secondary',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
        <FileText className="h-5 w-5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{clientName}</p>
        <p className="text-xs text-muted-foreground">
          {number} &middot; {formatShortDate(date)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-lg font-bold">{formatCurrency(amount)}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
    </button>
  );
}
