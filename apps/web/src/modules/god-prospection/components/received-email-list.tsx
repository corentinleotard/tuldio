import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useCallback } from 'react';
import { Inbox, Send, Loader2, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchReceivedMessages, replyToEmail, type ReceivedMessageView } from '../api/god-prospection.api';

const PAGE_SIZE = 50;

type ChannelFilter = 'all' | 'email' | 'whatsapp';

export function ReceivedEmailList() {
  const [channel, setChannel] = useState<ChannelFilter>('all');

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['god-prospection', 'received-messages', channel],
    queryFn: ({ pageParam }) =>
      fetchReceivedMessages({ channel, limit: PAGE_SIZE, olderThan: pageParam ?? undefined }),
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

  const messages = data?.pages.flat() ?? [];

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
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Inbox className="mb-2 h-8 w-8" />
          <p>Aucun message recu</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {messages.map((msg) => (
            <ReceivedMessageItem key={msg.id} message={msg} />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReceivedMessageItem(props: { message: ReceivedMessageView }) {
  const { message: msg } = props;
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: replyToEmail,
    onSuccess: () => {
      toast.success('Reponse envoyee');
      setShowReply(false);
      setReplyBody('');
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'received-messages'] });
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const handleReply = () => {
    if (!replyBody.trim() || !msg.messageId) return;
    mutation.mutate({
      to: msg.from,
      subject: msg.subject || '',
      body: replyBody,
      inReplyTo: msg.messageId,
    });
  };

  const date = new Date(msg.date);
  const formattedDate = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {msg.channel === 'email' ? (
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-success" />
            )}
            <span className="font-medium">{msg.fromName}</span>
            <span className="text-xs text-muted-foreground">{msg.from}</span>
          </div>
          {msg.subject && (
            <p className="mt-0.5 text-sm font-medium">{msg.subject}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formattedDate}</span>
      </div>

      <div className="mt-2">
        <p
          className={`whitespace-pre-wrap text-sm text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}
          onClick={() => setExpanded(!expanded)}
        >
          {msg.body}
        </p>
        {!expanded && msg.body.length > 200 && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1 text-xs text-primary hover:underline"
          >
            Voir plus
          </button>
        )}
      </div>

      {/* Reply only for emails (WhatsApp replies go through the phone) */}
      {msg.channel === 'email' && msg.messageId && (
        <div className="mt-3">
          {!showReply ? (
            <button
              onClick={() => setShowReply(true)}
              className="text-sm text-primary hover:underline"
            >
              Repondre
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={3}
                placeholder="Votre reponse..."
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
      )}
    </div>
  );
}
