import type {
  Message,
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

interface ChatMessageListProps {
  messages: Message[];
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg) => (
        <div key={msg.id}>
          <MessageBubble message={msg} />
          {msg.richCard && renderRichCard(msg.richCard)}
        </div>
      ))}
    </div>
  );
}

function renderRichCard(richCard: { type: string; data: unknown }) {
  switch (richCard.type) {
    case 'quote':
      return <RichCardQuote data={richCard.data as QuoteView} />;
    case 'invoice':
      return <RichCardInvoice data={richCard.data as InvoiceView} />;
    case 'stats':
      return <RichCardStats data={richCard.data as MonthlyStatsView} />;
    case 'expense':
      return <RichCardExpense data={richCard.data as ExpenseView} />;
    default:
      return null;
  }
}
