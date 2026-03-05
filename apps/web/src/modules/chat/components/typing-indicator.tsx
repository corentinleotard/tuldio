export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-bubble-ai flex gap-1.5 border bg-card px-4 py-3">
        <span className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground [animation-delay:200ms]" />
        <span className="animate-typing-dot h-2 w-2 rounded-full bg-muted-foreground [animation-delay:400ms]" />
      </div>
    </div>
  );
}
