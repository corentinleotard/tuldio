import { useRef, useEffect, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  hasOlderMessages: boolean;
  isSending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({
  messages,
  onSendMessage,
  onLoadOlder,
  isLoadingOlder,
  hasOlderMessages,
  isSending,
  bottomRef,
}: ChatMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const hasScrolledInitially = useRef(false);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  // Scroll to bottom on initial load and when new messages are appended
  useEffect(() => {
    if (messages.length === 0) return;

    const wasAppend = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (!hasScrolledInitially.current || wasAppend) {
      hasScrolledInitially.current = true;
      // Use requestAnimationFrame to ensure virtualizer has measured
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
    }
  }, [messages.length, virtualizer]);

  // Scroll to bottom after sending
  useEffect(() => {
    if (!isSending) return;
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
    });
  }, [isSending, messages.length, virtualizer]);

  // Detect scroll to top to load older messages
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    function handleScroll() {
      if (!el || !hasOlderMessages || isLoadingOlder) return;
      if (el.scrollTop < 200) {
        onLoadOlder();
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasOlderMessages, isLoadingOlder, onLoadOlder]);

  function handleClientSelect(client: ClientView) {
    onSendMessage(`C'est ${client.firstName} ${client.lastName}`, {
      selectedClientId: client.id,
    });
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl">
        {isLoadingOlder && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          <div
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${virtualItems[0]?.start ?? 0}px)` }}
          >
            {virtualItems.map((virtualRow) => {
              const msg = messages[virtualRow.index]!;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="px-4 py-1.5"
                >
                  <MessageBubble message={msg} />
                  {msg.richCard && renderRichCard(msg.richCard, handleClientSelect, (text) => onSendMessage(text))}
                </div>
              );
            })}
          </div>
        </div>

        {isSending && (
          <div className="px-4 pb-4">
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef as RefObject<HTMLDivElement>} className="h-4" />
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
