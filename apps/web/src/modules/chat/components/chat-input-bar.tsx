import { useState } from 'react';
import { Camera, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
}

export function ChatInputBar({ onSend, disabled, onTypingChange }: ChatInputBarProps) {
  const [value, setValue] = useState(() => sessionStorage.getItem('chat-draft') ?? '');

  function updateValue(v: string) {
    setValue(v);
    sessionStorage.setItem('chat-draft', v);
    onTypingChange?.(v.trim().length > 0);
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    updateValue('');
    onTypingChange?.(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="mx-auto flex w-full items-center gap-2 px-3 pb-1 md:pb-4 md:max-w-4xl">
      <Button variant="ghost" size="icon" className="shrink-0 rounded-full" type="button">
        <Camera className="h-5 w-5" />
      </Button>
      <textarea
        value={value}
        onChange={(e) => updateValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ecrivez un message..."
        rows={1}
        className="flex-1 resize-none rounded-3xl border border-border bg-card px-4 py-2.5 text-[15px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={disabled}
      />
      <Button
        size="icon"
        className="shrink-0 rounded-full"
        onClick={handleSend}
        disabled={disabled}
        type="button"
      >
        <Send className="h-5 w-5" />
      </Button>
    </div>
  );
}
