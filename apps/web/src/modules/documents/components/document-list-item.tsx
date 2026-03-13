import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatShortDate, formatDocumentNumber } from '@/lib/utils';
import { statusConfig, defaultStatus } from './status-config.js';

interface DocumentListItemProps {
  number: string;
  clientName: string;
  date: string;
  amount: number;
  status: string;
  isSelected?: boolean;
  isEven?: boolean;
  onClick: () => void;
}

export function DocumentListItem({
  number,
  clientName,
  date,
  amount,
  status,
  isSelected,
  isEven,
  onClick,
}: DocumentListItemProps) {
  const badge = statusConfig[status] ?? { ...defaultStatus, label: status };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-5 py-3.5 text-left focus-visible:outline-none',
        isSelected ? 'bg-primary/10' : 'hover:bg-secondary',
        !isSelected && isEven && 'bg-secondary/50',
      )}
    >
      {/* Icon — mobile only */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 md:hidden">
        <FileText className="h-[18px] w-[18px] text-primary" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">{clientName}</p>
          <span className="shrink-0 text-base font-bold">{formatCurrency(amount)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {formatDocumentNumber(number)} · {formatShortDate(date)}
          </p>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>
    </button>
  );
}
