import { useRef, useEffect, useLayoutEffect } from 'react';
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
  const prevScrollHeightRef = useRef<number>(0);
  const isRestoringScrollRef = useRef(false);

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    // Defer to next frame so the browser has finished layout —
    // on mobile, scrollHeight isn't final until after paint.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }

  // Snapshot scrollHeight before DOM updates so we can restore position after prepend
  const firstMessageId = messages.length > 0 ? messages[0]!.id : null;
  const prevFirstMessageIdRef = useRef<string | null>(null);

  // Detect when older messages were prepended (first message ID changed but last didn't)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1]!;
    const lastIdChanged = lastMessage.id !== lastMessageIdRef.current;
    const firstIdChanged = firstMessageId !== prevFirstMessageIdRef.current;

    prevFirstMessageIdRef.current = firstMessageId;
    lastMessageIdRef.current = lastMessage.id;

    if (!hasScrolledInitially.current || lastIdChanged) {
      // New messages at the bottom or initial load → scroll to bottom
      hasScrolledInitially.current = true;
      scrollToBottom();
    } else if (firstIdChanged && prevScrollHeightRef.current > 0) {
      // Older messages prepended → restore scroll position
      const addedHeight = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += addedHeight;
      isRestoringScrollRef.current = true;
      requestAnimationFrame(() => {
        isRestoringScrollRef.current = false;
      });
    }
  }, [messages, firstMessageId]);

  // Re-scroll when content size changes (e.g. images loading)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (isRestoringScrollRef.current) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // Generous threshold for mobile viewports where small content
      // changes can easily push past a tight threshold
      if (distanceFromBottom < 300) {
        el.scrollTop = el.scrollHeight;
      }
    });

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
  useEffect(() => {
    onLoadOlderRef.current = onLoadOlder;
  }, [onLoadOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let ticking = false;

    function handleScroll() {
      if (ticking || isRestoringScrollRef.current) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (el && el.scrollTop < 200 && !isRestoringScrollRef.current) {
          prevScrollHeightRef.current = el.scrollHeight;
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
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl min-h-full flex-col justify-end">
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
            {msg.richCard && renderRichCard(msg.richCard, handleClientSelect)}
          </div>
        ))}

        {isSending && (
          <div className="px-4 pb-4">
            <TypingIndicator />
          </div>
        )}

      </div>
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
