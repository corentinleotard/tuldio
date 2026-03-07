import { cn } from '@/lib/utils';

interface QuickReplyBarProps {
  options: string[];
  onSelect: (text: string) => void;
}

export function QuickReplyBar({ options, onSelect }: QuickReplyBarProps) {
  const lastIndex = options.length - 1;

  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 py-2 animate-in slide-in-from-bottom-2 fade-in duration-150">
      {options.map((option, i) => {
        const isSecondary = i === lastIndex && options.length > 1;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              'rounded-full px-5 py-2.5 text-sm font-medium transition-colors active:scale-[0.97] active:opacity-70',
              isSecondary
                ? 'border border-border text-muted-foreground hover:border-destructive hover:text-destructive'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
