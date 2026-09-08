'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { PortalNotification } from '@/lib/supabase/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { NotificationList } from '@/components/notifications/notification-list';

// Full-page notifications view (the "More" sheet on mobile also links here).
export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(false);
    const { data, error: loadError } = await supabase
      .from('portal_notifications')
      .select('*')
      .eq('client_id', clientId)
      .order('read_at', { ascending: true, nullsFirst: true })
      .returns<PortalNotification[]>();
    setItems(loadError ? [] : (data ?? []));
    setError(Boolean(loadError));
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
    <div className="mx-auto max-w-[1040px]">
      <PageHeader title={t('title')} />
      {loading ? (
        <ListSkeleton label={t('loading')} />
      ) : error ? (
        <StatePanel
          icon={AlertCircle}
          tone="error"
          title={t('loadError')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {tCommon('retry')}
            </Button>
          }
        />
      ) : (
        <NotificationList items={items} onMarkRead={markRead} />
      )}
    </div>
  );
}
