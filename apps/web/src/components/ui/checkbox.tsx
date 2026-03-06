import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked, onChange, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors',
        checked ? 'border-primary bg-primary' : 'border-input',
        className,
      )}
    >
      {checked && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
    </button>
  );
}
