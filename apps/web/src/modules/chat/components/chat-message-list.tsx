import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  Message,
  ClientView,
  MessageMetadata,
  QuoteView,
  InvoiceView,
  MonthlyStatsView,
} from '@tuldio/types';
import { MessageBubble } from './message-bubble';
import { RichCardQuote } from './rich-card-quote';
import { RichCardInvoice } from './rich-card-invoice';
import { RichCardStats } from './rich-card-stats';
import { RichCardClientPicker } from './rich-card-client-picker';
import { TypingIndicator } from './typing-indicator';

interface ChatMessageListProps {
  messages: Message[];
  onSendMessage: (content: string, metadata?: MessageMetadata) => void;
  onLoadOlder: () => void;
  isLoadingOlder: boolean;
  isSending: boolean;
}

export function ChatMessageList({
  messages,
  onSendMessage,
  onLoadOlder,
  isLoadingOlder,
  isSending,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // column-reverse: scrollTop = 0 is the bottom
  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }

  // Scroll to bottom when a new message is appended (sent or received)
  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1]!.id;
    if (lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      scrollToBottom();
    }
  }, [messages]);

  // Scroll to bottom when sending starts (typing indicator appears)
  useEffect(() => {
    if (isSending) scrollToBottom();
  }, [isSending]);

  // IntersectionObserver on sentinel at visual top — triggers loading older messages
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadOlder();
        }
      },
      { root: container, rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadOlder]);

  function handleClientSelect(client: ClientView) {
    onSendMessage(`C'est ${client.firstName} ${client.lastName}`, {
      selectedClientId: client.id,
    });
  }

  // column-reverse: first DOM child = visual bottom, last DOM child = visual top
  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      {/* First in DOM = bottom visually — messages + typing indicator */}
      <div className="mx-auto w-full max-w-2xl">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`px-4 py-1.5 ${i === messages.length - 1 ? 'pb-4' : ''}`}
          >
            <MessageBubble message={msg} />
            {msg.richCard && renderRichCard(msg.richCard, handleClientSelect)}
          </div>
        ))}

        {isSending && (
          <div className="px-4 pb-4">
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Sentinel — second in DOM = above messages visually */}
      <div ref={sentinelRef} className="h-px shrink-0" />

      {/* Loading spinner — last in DOM = visual top */}
      {isLoadingOlder && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function renderRichCard(
  richCard: { type: string; data: unknown },
  onClientSelect: (client: ClientView) => void,
) {
  switch (richCard.type) {
    case 'quote':
      return <RichCardQuote data={richCard.data as QuoteView} />;
    case 'invoice':
      return <RichCardInvoice data={richCard.data as InvoiceView} />;
    case 'stats':
      return <RichCardStats data={richCard.data as MonthlyStatsView} />;
    case 'client_picker':
      return (
        <RichCardClientPicker
          data={richCard.data as ClientView[]}
          onSelect={onClientSelect}
        />
      );
    default:
      return null;
  }
}
