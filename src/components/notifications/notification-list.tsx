'use client';

import { useTranslations } from 'next-intl';
import { BellOff } from 'lucide-react';
import type { PortalNotification } from '@/lib/supabase/types';
import { Badge } from '@/components/ui/badge';
import { StatePanel } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';

export function NotificationList({
  items,
  onMarkRead,
}: {
  items: PortalNotification[];
  onMarkRead: (id: string) => void | Promise<void>;
}) {
  const t = useTranslations('notifications');

  if (items.length === 0) {
    return (
      <StatePanel icon={BellOff} title={t('empty')} description={t('emptyHint')} />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((n) => {
        const unread = n.read_at === null;
        return (
          <li
            key={n.id}
            className={cn(
              'rounded-lg border p-3 transition-colors duration-150 ease-out motion-reduce:transition-none',
              unread ? 'border-accent/40 bg-accent/5' : 'bg-card',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
              </div>
              {unread && (
                <Badge variant="accent" className="shrink-0">
                  {t('unread')}
                </Badge>
              )}
            </div>
            {unread && (
              <button
                type="button"
                onClick={() => void onMarkRead(n.id)}
                className="mt-2 rounded-md text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
              >
                {t('markRead')}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
