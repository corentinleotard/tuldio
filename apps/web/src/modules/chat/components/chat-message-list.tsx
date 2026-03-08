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
  const lastMessageIdRef = useRef<string | null>(null);
  const hasScrolledInitially = useRef(false);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Scroll to bottom on initial load and when new messages are appended
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1]!;
    const lastIdChanged = lastMessage.id !== lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessage.id;

    if (!hasScrolledInitially.current || lastIdChanged) {
      hasScrolledInitially.current = true;
      scrollToBottom();
    }
  }, [messages]);

  // Re-scroll when content size changes (rich cards rendering after initial scroll)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      // Only auto-scroll if user is near the bottom (within 100px)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    });

    // Observe the content inside the scroll container
    for (const child of el.children) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [messages]);

  // Scroll to bottom when sending starts
  useEffect(() => {
    if (!isSending) return;
    scrollToBottom();
  }, [isSending]);

  // Detect scroll to top to load older messages
  const onLoadOlderRef = useRef(onLoadOlder);
  onLoadOlderRef.current = onLoadOlder;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;

    function handleScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (el && el.scrollTop < 200) {
          onLoadOlderRef.current();
        }
      });
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  function handleClientSelect(client: ClientView) {
    onSendMessage(`C'est ${client.firstName} ${client.lastName}`, {
      selectedClientId: client.id,
    });
  }

  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Spacer pushes messages to bottom when content is shorter than viewport */}
      <div className="flex-1" />

      <div className="mx-auto w-full max-w-2xl">
        {isLoadingOlder && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`px-4 py-1.5 ${i === messages.length - 1 ? 'pb-4' : ''}`}
          >
            <MessageBubble message={msg} />
            {msg.richCard && renderRichCard(msg.richCard, handleClientSelect, (text) => onSendMessage(text))}
          </div>
        ))}

        {isSending && (
          <div className="px-4 pb-4">
            <TypingIndicator />
          </div>
        )}

        <div />
      </div>
    </div>
  );
}

function renderRichCard(
  richCard: { type: string; data: unknown },
  onClientSelect: (client: ClientView) => void,
  onSendMessage?: (text: string) => void,
) {
  switch (richCard.type) {
    case 'quote':
      return <RichCardQuote data={richCard.data as QuoteView} onSendMessage={onSendMessage} />;
    case 'invoice':
      return <RichCardInvoice data={richCard.data as InvoiceView} onSendMessage={onSendMessage} />;
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
