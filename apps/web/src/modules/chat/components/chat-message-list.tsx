import type {
  Message,
  ClientView,
  MessageMetadata,
  QuoteView,
  InvoiceView,
  ExpenseView,
  MonthlyStatsView,
} from '@tuldio/types';
import { MessageBubble } from './message-bubble';
import { RichCardQuote } from './rich-card-quote';
import { RichCardInvoice } from './rich-card-invoice';
import { RichCardStats } from './rich-card-stats';
import { RichCardExpense } from './rich-card-expense';
import { RichCardClientPicker } from './rich-card-client-picker';

interface ChatMessageListProps {
  messages: Message[];
  onSendMessage: (content: string, metadata?: MessageMetadata) => void;
}

export function ChatMessageList({ messages, onSendMessage }: ChatMessageListProps) {
  function handleClientSelect(client: ClientView) {
    onSendMessage(`C'est ${client.firstName} ${client.lastName}`, {
      selectedClientId: client.id,
    });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          <MessageBubble message={msg} />
          {msg.richCard && renderRichCard(msg.richCard, handleClientSelect)}
        </div>
      ))}
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
    case 'expense':
      return <RichCardExpense data={richCard.data as ExpenseView} />;
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
