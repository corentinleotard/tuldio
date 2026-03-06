import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ChatMessageList } from '../components/chat-message-list';
import { ChatInputBar } from '../components/chat-input-bar';
import { TypingIndicator } from '../components/typing-indicator';
import { DesktopContextPanel } from '../components/desktop-context-panel';
import { sendMessage, fetchMessages } from '../api/chat.api';
import type { Message, MessageMetadata } from '@tuldio/types';

export function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: history } = useQuery({
    queryKey: ['messages'],
    queryFn: () => fetchMessages(),
  });

  useEffect(() => {
    if (history && messages.length === 0) {
      setMessages(history);
    }
  }, [history, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  async function handleSend(content: string, metadata?: MessageMetadata) {
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      userId: user?.id ?? '',
      role: 'user',
      content,
      attachments: [],
      toolCalls: null,
      richCard: null,
      debugTrace: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const response = await sendMessage(content, metadata);
      setMessages((prev) => [...prev, response]);
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        userId: '',
        role: 'assistant',
        content: 'Desole, une erreur est survenue. Reessayez.',
        attachments: [],
        toolCalls: null,
        richCard: null,
        debugTrace: null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }

  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      {/* Mobile header */}
      <div className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <span className="text-2xl font-bold text-primary">Tuldio</span>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="rounded-full p-2 transition-colors hover:bg-secondary"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      {/* Desktop: headers + content + input in a row layout */}
      <div className="flex min-h-0 flex-1">
        {/* Chat column */}
        <div className="flex flex-1 flex-col">
          {/* Desktop header — same padding as sidebar header for border alignment */}
          <div className="hidden items-center border-b px-5 pb-4 pt-5 md:flex">
            <h1 className="text-[22px] font-bold tracking-tight text-primary">Conversation</h1>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl">
              <ChatMessageList messages={messages} onSendMessage={handleSend} />
              {isSending && (
                <div className="px-4 pb-4">
                  <TypingIndicator />
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar — border-t connects with context panel border-l */}
          <div className="border-t bg-background">
            <ChatInputBar onSend={handleSend} disabled={isSending} />
          </div>
        </div>

        {/* Context panel — border-l runs full height, grows on larger screens */}
        <div className="hidden w-80 shrink-0 flex-col border-l bg-background md:flex lg:w-96">
          <div className="flex items-center border-b px-5 pb-4 pt-5">
            <h2 className="text-[22px] font-bold tracking-tight text-primary">Contexte</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DesktopContextPanel showHeader={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
