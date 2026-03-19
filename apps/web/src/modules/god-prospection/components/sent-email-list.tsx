import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { fetchRecentSends } from '../api/god-prospection.api';

type ChannelFilter = 'all' | 'email' | 'whatsapp';

export function SentEmailList() {
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sends, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sends', channel],
    queryFn: () => fetchRecentSends({
      channel: channel === 'all' ? undefined : channel,
      limit: 100,
    }),
  });

  return (
    <div>
      {/* Channel filter */}
      <div className="flex gap-1 border-b border-border px-4 py-2">
        {(['all', 'email', 'whatsapp'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setChannel(c)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              channel === c
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {c === 'email' && <Mail className="h-3 w-3" />}
            {c === 'whatsapp' && <MessageCircle className="h-3 w-3" />}
            {c === 'all' ? 'Tous' : c === 'email' ? 'Email' : 'WhatsApp'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !sends || sends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Send className="mb-2 h-8 w-8" />
          <p>Aucun envoi</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sends.map((send) => {
            const expanded = expandedId === send.id;
            const date = new Date(send.sentAt);
            const formattedDate = date.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div key={send.id}>
                <div
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/30"
                  onClick={() => setExpandedId(expanded ? null : send.id)}
                >
                  {send.channel === 'email' ? (
                    <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <MessageCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{send.prospectName}</span>
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                        Etape {send.stepOrder + 1}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{send.prospectEmail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formattedDate}</span>
                </div>

                {expanded && send.body && (
                  <div className="border-t border-border bg-secondary/20 px-5 py-4">
                    {send.subject && (
                      <div className="mb-2 text-sm">
                        <span className="text-muted-foreground">Objet : </span>
                        <span className="font-medium">{send.subject}</span>
                      </div>
                    )}
                    {send.channel === 'email' ? (
                      <div
                        className="rounded-md border border-border bg-background p-4 text-sm"
                        dangerouslySetInnerHTML={{ __html: send.body }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm">
                        {send.body}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
