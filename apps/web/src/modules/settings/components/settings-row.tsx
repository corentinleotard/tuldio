import { ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  subLabel?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  iconClassName?: string;
  className?: string;
}

export function SettingsRow({
  icon: Icon,
  label,
  subLabel,
  onClick,
  trailing,
  iconClassName,
  className,
}: SettingsRowProps) {
  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
        onClick && 'hover:bg-secondary active:opacity-70',
        className,
      )}
    >
      <div className={cn('flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg', iconClassName ?? 'bg-secondary text-muted-foreground')}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{label}</p>
        {subLabel && (
          <p className="truncate text-xs text-muted-foreground">{subLabel}</p>
        )}
      </div>
      {trailing ?? (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </Comp>
  );
}
