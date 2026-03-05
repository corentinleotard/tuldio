import { ChevronRight } from 'lucide-react';
import type { ClientView } from '@tuldio/types';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ClientListItemProps {
  client: ClientView;
  isSelected?: boolean;
  onClick: () => void;
}

export function ClientListItem({ client, isSelected, onClick }: ClientListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors active:opacity-70',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
    >
      <Avatar name={client.name} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{client.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {client.email ?? client.phone ?? ''}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
