import { Mail, Phone, MapPin, StickyNote } from 'lucide-react';
import type { ClientView } from '@tuldio/types';
import { Avatar } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';

interface ClientDetailProps {
  client: ClientView;
}

export function ClientDetail({ client }: ClientDetailProps) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Avatar name={client.name} size="lg" />
        <h2 className="text-xl font-semibold">{client.name}</h2>
      </div>

      <div className="flex flex-col gap-3">
        {client.email && (
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{client.email}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{client.phone}</span>
          </div>
        )}
        {client.address && (
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm">{client.address}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="h-4 w-4" />
          Notes
        </h3>
        {client.notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune note</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {client.notes.map((note, i) => (
              <li
                key={i}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <p className="text-sm">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
