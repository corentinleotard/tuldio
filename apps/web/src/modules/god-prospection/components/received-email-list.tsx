import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useCallback } from 'react';
import { Inbox, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchReceivedEmails, replyToEmail, type ReceivedEmail } from '../api/god-prospection.api';

const PAGE_SIZE = 50;

export function ReceivedEmailList() {
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['god-prospection', 'received'],
    queryFn: ({ pageParam }) =>
      fetchReceivedEmails({ limit: PAGE_SIZE, olderThan: pageParam ?? undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.date;
    },
  });

  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observer.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const emails = data?.pages.flat() ?? [];

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Inbox className="mb-2 h-8 w-8" />
        <p>Aucun email reçu</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {emails.map((email) => (
        <ReceivedEmailItem key={email.id} email={email} />
      ))}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function ReceivedEmailItem(props: { email: ReceivedEmail }) {
  const { email } = props;
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: replyToEmail,
    onSuccess: () => {
      toast.success('Réponse envoyée');
      setShowReply(false);
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'received'] });
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const handleReply = () => {
    if (!replyBody.trim()) return;
    mutation.mutate({
      to: email.from,
      subject: email.subject,
      body: replyBody,
      inReplyTo: email.messageId,
    });
  };

  const date = new Date(email.date);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{email.fromName}</span>
            <span className="text-xs text-muted-foreground">{email.from}</span>
          </div>
          <p className="mt-0.5 text-sm font-medium">{email.subject}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formattedDate}</span>
      </div>

      <div className="mt-2">
        <p
          className={`text-sm text-muted-foreground whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}
          onClick={() => setExpanded(!expanded)}
        >
          {email.textBody}
        </p>
        {!expanded && email.textBody.length > 200 && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Voir plus
          </button>
        )}
      </div>

      <div className="mt-3">
        {!showReply ? (
          <button
            onClick={() => setShowReply(true)}
            className="text-sm text-primary hover:underline"
          >
            Répondre
          </button>
        ) : (
          <div className="space-y-2">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              placeholder="Votre réponse..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReply} disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Envoyer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowReply(false);
                  setReplyBody('');
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
