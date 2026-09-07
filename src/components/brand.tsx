import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/config';

// App wordmark — rendered in GFS Didot (display font), bold.
export function Brand({ className, collapsed = false }: { className?: string; collapsed?: boolean }) {
  return (
    <span
      className={cn('font-display font-bold tracking-tight text-foreground', className)}
      style={{ fontWeight: 700 }}
    >
      {collapsed ? APP_NAME.charAt(0) : APP_NAME}
    </span>
  );
}
