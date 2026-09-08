import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const toneStyles = {
  neutral: 'bg-secondary/60 text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
} as const;

interface StatePanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: keyof typeof toneStyles;
  compact?: boolean;
  className?: string;
}

export function StatePanel({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
  compact = false,
  className,
}: StatePanelProps) {
  return (
    <div
      className={cn(
        'rounded-[0.875rem] bg-card px-6 text-center ring-1 ring-border/70',
        compact ? 'py-7' : 'py-12',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-xl',
          compact ? 'mb-2.5 h-9 w-9' : 'mb-3 h-10 w-10',
          toneStyles[tone],
        )}
      >
        <Icon aria-hidden="true" className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
      <h2 className="text-sm font-semibold tracking-[-0.01em]">{title}</h2>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-[0.8125rem] leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
