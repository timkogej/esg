import { AlertCircle, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const toneStyles = {
  error: 'bg-destructive/[0.08] text-destructive ring-destructive/[0.16]',
  warning: 'bg-warning/[0.08] text-warning ring-warning/[0.16]',
  success: 'bg-success/[0.08] text-success ring-success/[0.16]',
} as const;

interface StatusNoticeProps {
  children: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof toneStyles;
  className?: string;
}

export function StatusNotice({
  children,
  action,
  icon: Icon = AlertCircle,
  tone = 'error',
  className,
}: StatusNoticeProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl px-3.5 py-3 text-[0.8125rem] leading-5 ring-1',
        toneStyles[tone],
        className,
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
