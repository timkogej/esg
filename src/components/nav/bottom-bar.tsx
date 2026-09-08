'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PRIMARY_NAV } from '@/components/nav/nav-items';
import { MoreSheet } from '@/components/nav/more-sheet';
import { cn } from '@/lib/utils';

// Mobile-only floating dock with exactly 5 slots: Home, Documents, Data,
// Downloads and More.
export function BottomBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // "More" is considered active on Notifications/Settings sub-pages.
  const moreActive = pathname.startsWith('/settings') || pathname.startsWith('/notifications');

  return (
    <nav
      className="glass-bar fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex h-[4.25rem] max-w-[35rem] items-stretch gap-1 rounded-[1.375rem] p-1.5 md:hidden"
      aria-label={t('mobileNavigation')}
    >
      {PRIMARY_NAV.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[0.625rem] font-medium transition-[color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              active
                ? '-translate-y-px bg-brand text-white shadow-sm'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" strokeWidth={active ? 2.2 : 1.8} />
            <span className="max-w-full truncate">{t(item.labelKey)}</span>
          </Link>
        );
      })}
      <MoreSheet active={moreActive} />
    </nav>
  );
}
