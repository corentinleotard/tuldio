import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  Message,
  ClientView,
  MessageMetadata,
  QuoteView,
  InvoiceView,
  MonthlyStatsView,
} from '@tuldio/common';
import { MessageBubble } from './message-bubble';
import { RichCardQuote } from './rich-card-quote';
import { RichCardInvoice } from './rich-card-invoice';
import { RichCardStats } from './rich-card-stats';
import { RichCardClientPicker } from './rich-card-client-picker';
import { DraftInfoBubble } from './draft-info-bubble';
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
    onSendMessage(`C'est ${client.displayName}`, {
      selectedClientId: client.id,
    });
  }

  function handleCreateNewClient() {
    onSendMessage('Aucun de ceux-là, crée un nouveau client');
  }

  // column-reverse: first DOM child = visual bottom, last DOM child = visual top
  return (
    <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto">
      {/* Spacer: first in DOM = visual bottom. Pushes messages to top when few */}
      <div className="flex-grow" />

      {/* Messages + typing indicator */}
      <div className="mx-auto w-full max-w-2xl">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={`px-4 py-1.5 ${i === messages.length - 1 ? 'pb-4' : ''}`}
          >
            {(!msg.richCard || !isDocumentCard(msg.richCard.type)) && msg.content.trim() !== '' && (
              <MessageBubble message={msg} />
            )}
            {msg.richCard && renderRichCard(msg.richCard, handleClientSelect, handleCreateNewClient)}
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

interface ReadinessError {
  code: string;
  message: string;
}

interface DocumentReadiness {
  errors: ReadinessError[];
  warnings: ReadinessError[];
  tvaExempt: boolean;
}

interface RichCardDocumentData {
  status?: string;
  _readiness?: DocumentReadiness;
  _showTutorial?: boolean;
}

function isDocumentCard(type: string): boolean {
  return type === 'quote' || type === 'invoice';
}

function DocumentCardWithBubble({ type, data }: { type: 'quote' | 'invoice'; data: (QuoteView | InvoiceView) & RichCardDocumentData }) {
  const [liveStatus, setLiveStatus] = useState(data.status);
  const [hidden, setHidden] = useState(false);
  const readiness = data._readiness;
  const showTutorial = data._showTutorial ?? false;

  function handleLiveData(fresh: QuoteView | InvoiceView) {
    setLiveStatus(fresh.status);
  }

  function handleDeleted() {
    setHidden(true);
  }

  const showBubble = !hidden && liveStatus === 'draft' && readiness;

  return (
    <>
      {type === 'quote' ? (
        <RichCardQuote data={data as QuoteView & RichCardDocumentData} onLiveData={handleLiveData} onDeleted={handleDeleted} />
      ) : (
        <RichCardInvoice data={data as InvoiceView & RichCardDocumentData} onLiveData={handleLiveData} onDeleted={handleDeleted} />
      )}
      {showBubble && (
        <DraftInfoBubble
          documentType={type}
          errors={readiness.errors}
          showTutorial={showTutorial}
        />
      )}
    </>
  );
}

function renderRichCard(
  richCard: { type: string; data: unknown },
  onClientSelect: (client: ClientView) => void,
  onCreateNewClient: () => void,
) {
  switch (richCard.type) {
    case 'quote': {
      const data = richCard.data as QuoteView & RichCardDocumentData;
      return <DocumentCardWithBubble type="quote" data={data} />;
    }
    case 'invoice': {
      const data = richCard.data as InvoiceView & RichCardDocumentData;
      return <DocumentCardWithBubble type="invoice" data={data} />;
    }
    case 'stats':
      return <RichCardStats data={richCard.data as MonthlyStatsView} />;
    case 'client_picker':
      return (
        <RichCardClientPicker
          data={richCard.data as ClientView[]}
          onSelect={onClientSelect}
          onCreateNew={onCreateNewClient}
        />
      );
    default:
      return null;
  }
}
