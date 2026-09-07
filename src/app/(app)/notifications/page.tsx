'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PortalNotification } from '@/lib/supabase/types';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationList } from '@/components/notifications/notification-list';

// Full-page notifications view (the "More" sheet on mobile also links here).
export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('portal_notifications')
      .select('*')
      .eq('client_id', clientId)
      .order('read_at', { ascending: true, nullsFirst: true })
      .returns<PortalNotification[]>();
    setItems(data ?? []);
    setLoading(false);
  }, [supabase, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <div>
      <PageHeader title={t('title')} />
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <NotificationList items={items} onMarkRead={markRead} />
      )}
    </div>
  );
}
