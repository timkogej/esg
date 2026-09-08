'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

// Client-side guard wrapping the whole authenticated app. Redirects unauthenticated
// users to /login and shows a loading state while the session resolves.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div
          className="flex items-center gap-2.5 rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/70"
          role="status"
          aria-live="polite"
        >
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-brand-text" />
          {t('loading')}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
