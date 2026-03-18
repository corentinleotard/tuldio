import { useQuery } from '@tanstack/react-query';
import { Mail, Globe, Phone, Star } from 'lucide-react';
import { fetchSendQueue, type SendQueueProspect } from '../api/god-prospection.api';

export function SendQueue(props: {
  profession: string | null;
  count: number;
}) {
  const { profession, count } = props;

  const { data, isLoading } = useQuery({
    queryKey: ['god-prospection', 'send-queue', profession],
    queryFn: () => fetchSendQueue({ profession, limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const prospects = data ?? [];

  if (prospects.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Aucun prospect dans la file d'attente
        {profession ? ` pour "${profession}"` : ''}.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {prospects.map((p, i) => (
        <QueueRow key={p.id} prospect={p} inBatch={i < count} rank={i + 1} />
      ))}
    </div>
  );
}

function QueueRow(props: {
  prospect: SendQueueProspect;
  inBatch: boolean;
  rank: number;
}) {
  const { prospect: p, inBatch, rank } = props;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
        inBatch ? 'bg-primary/5' : ''
      }`}
    >
      {/* Rank badge */}
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          inBatch
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground'
        }`}
      >
        {rank}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{p.fullName}</span>
          {p.icpScore != null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                p.icpScore >= 9
                  ? 'bg-success/10 text-success'
                  : p.icpScore >= 7
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Star className="h-2.5 w-2.5" />
              {p.icpScore}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {p.profession}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {p.email}
          </span>
          {p.website && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {p.website}
            </span>
          )}
          {p.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {p.phone}
            </span>
          )}
        </div>

        {p.icpReason && (
          <p className="mt-1 text-xs text-muted-foreground/70">{p.icpReason}</p>
        )}
      </div>
    </div>
  );
}
