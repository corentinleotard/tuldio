import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchSentEmails, type SentEmailView } from '../api/god-prospection.api';

const PAGE_SIZE = 40;

export function SentEmailList() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sent', offset],
    queryFn: () => fetchSentEmails({ limit: PAGE_SIZE, offset }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Mail className="mb-2 h-8 w-8" />
        <p>Aucun email envoyé</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border">
        {emails.map((email, i) => (
          <SentEmailItem key={`${email.email}-${i}`} email={email} />
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-sm text-muted-foreground">
            {offset + 1}-{Math.min(offset + PAGE_SIZE, total)} sur {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-md p-1.5 hover:bg-secondary disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="rounded-md p-1.5 hover:bg-secondary disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SentEmailItem(props: { email: SentEmailView }) {
  const { email } = props;
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-secondary/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{email.nom}</span>
            <span className="text-xs text-muted-foreground">{email.profession}</span>
          </div>
          <p className="text-sm text-muted-foreground truncate">{email.email}</p>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">{email.sentAt}</span>
      </div>

      {expanded && (
        <div className="border-t border-border bg-secondary/20 px-5 py-4">
          {email.sentSubject || email.sentBodyHtml ? (
            <div className="space-y-3">
              {email.sentSubject && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Objet : </span>
                  <span className="font-medium">{email.sentSubject}</span>
                </div>
              )}
              {email.sentBodyHtml && (
                <div
                  className="rounded-md border border-border bg-background p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: email.sentBodyHtml }}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Contenu non disponible (envoyé avant le stockage)</p>
          )}
        </div>
      )}
    </div>
  );
}
