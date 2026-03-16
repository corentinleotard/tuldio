import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Mic, X, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '../hooks/use-voice-recorder';

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
  const voice = useVoiceRecorder();

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isTouchDevice()) return;
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

  // Show voice errors as toasts and clear after display
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (voice.error && voice.error !== lastErrorRef.current) {
      lastErrorRef.current = voice.error;
      toast.error(voice.error);
    }
  }, [voice.error]);

  async function handleMicClick() {
    if (voice.state !== 'idle') return;
    await voice.startRecording();
  }

  async function handleStopRecording() {
    const text = await voice.stopAndTranscribe();
    if (text) {
      updateValue(text);
      // Focus textarea for review/edit
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        autoGrow();
      });
    }
  }

  const hasContent = value.trim().length > 0;
  const isRecording = voice.state === 'recording';
  const isTranscribing = voice.state === 'transcribing';
  const isVoiceActive = isRecording || isTranscribing;

  return (
    <div className="mx-auto w-full px-3 md:max-w-4xl md:px-4">
      <div className={`relative flex items-end rounded-2xl border bg-card transition-colors ${isRecording ? 'border-ring ring-2 ring-ring' : 'border-border focus-within:ring-2 focus-within:ring-ring'}`}>

        {/* ── Recording state ── */}
        {isRecording && (
          <div className="flex w-full items-center gap-3 px-4 py-[10px]">
            {/* Pulsing red dot */}
            <div className="h-2 w-2 shrink-0 rounded-full bg-destructive animate-pulse" />

            {/* Timer */}
            <span className="text-sm font-medium tabular-nums">
              {voice.formattedTime}
            </span>

            {/* Waveform */}
            <Waveform data={voice.analyserData} />

            {/* Cancel */}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={voice.cancelRecording}
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Stop & transcribe */}
            <Button
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={handleStopRecording}
              type="button"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ── Transcribing state ── */}
        {isTranscribing && (
          <div className="flex w-full items-center gap-3 px-4 py-[10px]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Transcription en cours...</span>
          </div>
        )}

        {/* ── Idle / Review state ── */}
        {!isVoiceActive && (
          <>
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
              className="flex-1 resize-none bg-transparent px-4 py-2.5 pr-[5.5rem] text-base leading-6 placeholder:text-muted-foreground focus-visible:outline-none"
              disabled={disabled}
            />

            {/* Mic button — always visible, allows recording/re-recording */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-1.5 right-11 h-8 w-8 shrink-0 rounded-full text-muted-foreground opacity-60 transition-opacity hover:text-foreground hover:opacity-100"
              onClick={handleMicClick}
              disabled={disabled}
              type="button"
            >
              <Mic className="h-4 w-4" />
            </Button>

            {/* Send button */}
            <Button
              size="icon"
              className={`absolute bottom-1.5 right-1.5 h-8 w-8 shrink-0 rounded-full transition-opacity ${hasContent ? 'opacity-100' : 'pointer-events-none opacity-30'}`}
              onClick={handleSend}
              disabled={disabled || !hasContent}
              type="button"
            >
              <Send className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Live waveform visualization from analyser frequency data */
function Waveform({ data }: { data: number[] }) {
  // Take every other bar for a cleaner look, pad to minimum display count
  const bars = data.length > 0 ? data : new Array(16).fill(0);
  const displayBars = bars.slice(0, 24);

  return (
    <div className="flex flex-1 items-center justify-center gap-[2px] overflow-hidden" style={{ height: 24 }}>
      {displayBars.map((value, i) => {
        const minH = 3;
        const maxH = 22;
        const h = Math.max(minH, Math.round(value * maxH));
        return (
          <div
            key={i}
            className="w-[3px] shrink-0 rounded-sm bg-primary transition-[height] duration-75"
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}
