import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ChatMessageList } from '../components/chat-message-list';
import { ChatInputBar } from '../components/chat-input-bar';
import { QuickReplyBar } from '../components/quick-reply-bar';
import { DesktopContextPanel } from '../components/desktop-context-panel';
import { sendMessage, fetchMessages } from '../api/chat.api';
import type { Message, MessageMetadata } from '@tuldio/types';

export function ChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages'],
    queryFn: ({ pageParam }) => fetchMessages(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.length === 0) return undefined;
      return lastPage[0]?.createdAt;
    },
  });

  const messages = data?.pages ? [...data.pages].reverse().flat() : [];

  // Quick replies from the latest assistant message only
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastQuickReplies = lastAssistantMsg?.quickReplies ?? null;

  const handleLoadOlder = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function handleSend(content: string, metadata?: MessageMetadata) {
    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      userId: user?.id ?? '',
      role: 'user',
      content,
      attachments: [],
      toolCalls: null,
      richCard: null,
      quickReplies: null,
      debugTrace: null,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData(
      ['messages'],
      (old: typeof data) => {
        if (!old) return { pages: [[tempUserMsg]], pageParams: [undefined] };
        return {
          ...old,
          pages: [[...(old.pages[0] ?? []), tempUserMsg], ...old.pages.slice(1)],
        };
      },
    );
    setIsSending(true);

    try {
      const response = await sendMessage(content, metadata);
      queryClient.setQueryData(
        ['messages'],
        (old: typeof data) => {
          if (!old) return { pages: [[response]], pageParams: [undefined] };
          return {
            ...old,
            pages: [[...(old.pages[0] ?? []), response], ...old.pages.slice(1)],
          };
        },
      );
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        userId: '',
        role: 'assistant',
        content: 'Desole, une erreur est survenue. Reessayez.',
        attachments: [],
        toolCalls: null,
        richCard: null,
        quickReplies: null,
        debugTrace: null,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData(
        ['messages'],
        (old: typeof data) => {
          if (!old) return { pages: [[errorMsg]], pageParams: [undefined] };
          return {
            ...old,
            pages: [[...(old.pages[0] ?? []), errorMsg], ...old.pages.slice(1)],
          };
        },
      );
    } finally {
      setIsSending(false);
    }
  }

  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
          {/* Desktop header */}
          <div className="hidden items-center border-b px-5 pb-4 pt-5 md:flex">
            <h1 className="text-[22px] font-bold tracking-tight text-primary">Chat</h1>
          </div>

          <ChatMessageList
            messages={messages}
            onSendMessage={handleSend}
            onLoadOlder={handleLoadOlder}
            isLoadingOlder={isFetchingNextPage}
            hasOlderMessages={!!hasNextPage}
            isSending={isSending}
          />

          {/* Quick reply pills */}
          {!isSending && !isTyping && lastQuickReplies && (
            <div className="border-t bg-background">
              <QuickReplyBar options={lastQuickReplies} onSelect={(text) => handleSend(text)} />
            </div>
          )}

          {/* Input bar */}
          <div className="border-t bg-background">
            <ChatInputBar onSend={handleSend} disabled={isSending} onTypingChange={setIsTyping} />
          </div>
        </div>

        {/* Context panel */}
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
