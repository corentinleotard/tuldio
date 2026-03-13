import { User, Mail, Phone, MapPin } from 'lucide-react';
import type { ClientView } from '@tuldio/types';

interface RichCardClientPickerProps {
  data: ClientView[];
  onSelect: (client: ClientView) => void;
}

export function RichCardClientPicker({ data, onSelect }: RichCardClientPickerProps) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {data.map((client) => (
        <button
          key={client.id}
          type="button"
          onClick={() => onSelect(client)}
          className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 active:opacity-70"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {client.displayName}
            </p>
            <div className="mt-1 flex flex-col gap-0.5">
              {client.phone && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </p>
              )}
              {client.email && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </p>
              )}
              {client.address && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {client.address}
                </p>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
