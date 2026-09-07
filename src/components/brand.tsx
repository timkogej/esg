import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/config';

export function Brand({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <span className={cn('font-sans font-semibold tracking-[-0.02em] text-foreground', className)}>
      {collapsed ? APP_NAME.charAt(0) : APP_NAME}
    </span>
  );
}
