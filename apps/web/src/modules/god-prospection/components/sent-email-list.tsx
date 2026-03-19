import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { fetchSentEmails, fetchRecentSends } from '../api/god-prospection.api';

interface UnifiedSend {
  id: string;
  name: string;
  email: string;
  profession: string | null;
  channel: 'email' | 'whatsapp';
  step: number | null;
  sentAt: string;
  subject: string | null;
  bodyHtml: string | null;
}

export function SentEmailList() {
  const { data: batchData, isLoading: batchLoading } = useQuery({
    queryKey: ['god-prospection', 'sent', 0],
    queryFn: () => fetchSentEmails({ limit: 100, offset: 0 }),
  });

  const { data: sequenceSends, isLoading: seqLoading } = useQuery({
    queryKey: ['god-prospection', 'sends'],
    queryFn: () => fetchRecentSends({ limit: 100 }),
  });

  const isLoading = batchLoading || seqLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Merge both sources
  const sends: UnifiedSend[] = [];

  for (const e of batchData?.emails ?? []) {
    sends.push({
      id: `batch-${e.email}-${e.sentAt}`,
      name: e.nom,
      email: e.email,
      profession: e.profession,
      channel: 'email',
      step: null,
      sentAt: e.sentAt,
      subject: e.sentSubject,
      bodyHtml: e.sentBodyHtml,
    });
  }

  for (const s of sequenceSends ?? []) {
    sends.push({
      id: s.id,
      name: s.prospectName,
      email: s.prospectEmail,
      profession: null,
      channel: s.channel as 'email' | 'whatsapp',
      step: s.stepOrder,
      sentAt: s.sentAt,
      subject: null,
      bodyHtml: null,
    });
  }

  // Sort by date DESC, deduplicate by email+date (batch and sequence might overlap for migrated prospects)
  sends.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  if (sends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Send className="mb-2 h-8 w-8" />
        <p>Aucun envoi</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sends.map((send) => (
        <SentItem key={send.id} send={send} />
      ))}
    </div>
  );
}

function SentItem(props: { send: UnifiedSend }) {
  const { send } = props;
  const [expanded, setExpanded] = useState(false);

  const date = new Date(send.sentAt);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/30"
        onClick={() => setExpanded(!expanded)}
      >
        {send.channel === 'email' ? (
          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-success" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{send.name}</span>
            {send.profession && (
              <span className="text-xs text-muted-foreground">{send.profession}</span>
            )}
            {send.step !== null && (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                Etape {send.step + 1}
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">{send.email}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formattedDate}</span>
      </div>

      {expanded && send.bodyHtml && (
        <div className="border-t border-border bg-secondary/20 px-5 py-4">
          {send.subject && (
            <div className="mb-2 text-sm">
              <span className="text-muted-foreground">Objet : </span>
              <span className="font-medium">{send.subject}</span>
            </div>
          )}
          <div
            className="rounded-md border border-border bg-background p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: send.bodyHtml }}
          />
        </div>
      )}
    </div>
  );
}
