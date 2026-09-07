'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PRIMARY_NAV } from '@/components/nav/nav-items';
import { MoreSheet } from '@/components/nav/more-sheet';
import { cn } from '@/lib/utils';

// Mobile-only bottom navigation with exactly 5 slots: Home, Documents, Data,
// Downloads, More. Uses the "liquid glass" surface (.glass-bar) — mobile only.
export function BottomBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // "More" is considered active on Notifications/Settings sub-pages.
  const moreActive = pathname.startsWith('/settings') || pathname.startsWith('/notifications');

  return (
    <nav className="glass-bar fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch pb-[env(safe-area-inset-bottom)] md:hidden">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-accent' : 'text-muted-foreground',
            )}
          >
            <span className={cn('rounded-full p-1', active && 'bg-accent text-white dark:text-accent-foreground')}>
              <Icon className="h-5 w-5" />
            </span>
            {t(item.labelKey)}
          </Link>
        );
      })}
      <MoreSheet active={moreActive} />
    </nav>
  );
}
