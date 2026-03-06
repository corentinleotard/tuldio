import { ChevronRight } from 'lucide-react';
import type { ClientView } from '@tuldio/types';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ClientListItemProps {
  client: ClientView;
  isSelected?: boolean;
  isEven?: boolean;
  onClick: () => void;
}

export function ClientListItem({ client, isSelected, isEven, onClick }: ClientListItemProps) {
  const fullName = `${client.lastName} ${client.firstName}`;
  const subtitle = client.email ?? client.phone ?? '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-5 py-3 text-left focus-visible:outline-none',
        isSelected ? 'bg-primary/10' : 'hover:bg-secondary',
        !isSelected && isEven && 'bg-secondary/50',
      )}
    >
      <Avatar
        name={fullName}
        size="sm"
        className={cn(
          'bg-primary/10 text-primary',
          isSelected && 'ring-2 ring-primary',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{fullName}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-border" />
    </button>
  );
}
