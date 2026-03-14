import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatInputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
}

/** Force-reset iOS Safari zoom after keyboard dismiss (belt-and-suspenders with 16px font) */
function resetIOSZoom() {
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  const original = viewport.getAttribute('content') ?? '';
  viewport.setAttribute('content', original + ', maximum-scale=1');
  requestAnimationFrame(() => viewport.setAttribute('content', original));
}

const isTouchDevice = () =>
  matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

const MAX_ROWS_DESKTOP = 6;
const MAX_ROWS_MOBILE = 4;
const LINE_HEIGHT = 24; // matches text-base leading-6
const PADDING_Y = 20; // py-2.5 = 10px top + 10px bottom
const MAX_LENGTH = 2000;

export function ChatInputBar({ onSend, disabled, onTypingChange }: ChatInputBarProps) {
  const [value, setValue] = useState(() => sessionStorage.getItem('chat-draft') ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // On touch devices, Enter always inserts a newline — send via button only
    if (isTouchDevice()) return;

    // On desktop: Enter sends, Shift+Enter inserts newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxRows = isTouchDevice() ? MAX_ROWS_MOBILE : MAX_ROWS_DESKTOP;
    const maxHeight = maxRows * LINE_HEIGHT + PADDING_Y;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [value, autoGrow]);

  const hasContent = value.trim().length > 0;

  return (
    <div className="mx-auto w-full px-3 md:max-w-4xl md:px-4">
      <div className="relative flex items-end rounded-2xl border border-border bg-card focus-within:ring-2 focus-within:ring-ring">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => updateValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={resetIOSZoom}
          placeholder="Ecrivez un message..."
          rows={1}
          maxLength={MAX_LENGTH}
          enterKeyHint="enter"
          // text-base (16px) prevents iOS auto-zoom on input focus (triggers at <16px)
          className="flex-1 resize-none bg-transparent px-4 py-2.5 pr-12 text-base leading-6 placeholder:text-muted-foreground focus-visible:outline-none"
          disabled={disabled}
        />
        <Button
          size="icon"
          className={`absolute bottom-1.5 right-1.5 h-8 w-8 shrink-0 rounded-full transition-opacity ${hasContent ? 'opacity-100' : 'pointer-events-none opacity-30'}`}
          onClick={handleSend}
          disabled={disabled || !hasContent}
          type="button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
