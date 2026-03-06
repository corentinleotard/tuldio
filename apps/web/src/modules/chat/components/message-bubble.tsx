import Markdown from 'react-markdown';
import type { Message } from '@tuldio/types';
import { cn } from '@/lib/utils';

const ALLOWED_ELEMENTS = ['p', 'strong', 'em', 'br', 'ul', 'ol', 'li'];

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] px-4 py-2.5 text-sm',
          isUser
            ? 'rounded-bubble-user bg-primary text-primary-foreground'
            : 'rounded-bubble-ai border bg-card text-card-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="[&>p]:mb-2 last:[&>p]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5">
            <Markdown allowedElements={ALLOWED_ELEMENTS} unwrapDisallowed>
              {message.content}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
