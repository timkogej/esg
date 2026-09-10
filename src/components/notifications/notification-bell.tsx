'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PortalNotification } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NotificationList } from '@/components/notifications/notification-list';

// Bell with an unread-count badge, opening a sheet with the notification list.
// Used from the sidebar (desktop) and the "More" sheet (mobile).
export function NotificationBell({ trigger }: { trigger?: React.ReactNode }) {
  const t = useTranslations('notifications');
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    // RLS scopes to the client; also constrain to this contact or client-wide rows.
    const { data } = await supabase
      .from('portal_notifications')
      .select('*')
      .eq('client_id', clientId)
      .order('read_at', { ascending: true, nullsFirst: true })
      .limit(50)
      .returns<PortalNotification[]>();
    setItems(data ?? []);
  }, [supabase, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => n.read_at === null).length;

  async function markRead(id: string) {
    await supabase
      .from('portal_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) void load(); }}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="relative" aria-label={t('title')}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
                {unread}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <NotificationList items={items} onMarkRead={markRead} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
