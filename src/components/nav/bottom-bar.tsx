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
    <nav className="glass-bar fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch pb-[env(safe-area-inset-bottom)] md:hidden">
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative p-1">
              <Icon className={cn('h-5 w-5', active && 'text-brand-text')} />
              {active && <span aria-hidden className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-brand" />}
            </span>
            {t(item.labelKey)}
          </Link>
        );
      })}
      <MoreSheet active={moreActive} />
    </nav>
  );
}
