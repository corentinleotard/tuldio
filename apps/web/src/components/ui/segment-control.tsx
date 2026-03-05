import { cn } from '@/lib/utils';

interface SegmentControlProps<T extends string> {
  items: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentControl<T extends string>({
  items,
  value,
  onChange,
}: SegmentControlProps<T>) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-1">
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-full px-6 py-2 text-sm font-medium transition-colors',
            value === item.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
