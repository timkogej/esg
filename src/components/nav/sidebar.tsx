'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen, Settings, LogOut } from 'lucide-react';
import { PRIMARY_NAV } from '@/components/nav/nav-items';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'esg.sidebar.collapsed';

// Desktop-only sidebar. Solid surface (no glass). Collapsible; state persisted
// to localStorage.
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-background transition-[width] duration-200 md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <Link href="/">
            <Brand className="text-xl" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {mounted && collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={t(item.labelKey)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-white dark:text-accent-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}

        <Link
          href="/settings"
          title={t('settings')}
          className={cn(
            'mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive('/settings')
              ? 'bg-accent text-white dark:text-accent-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{t('settings')}</span>}
        </Link>
      </nav>

      <div
        className={cn(
          'flex items-center gap-1 border-t p-3',
          collapsed ? 'flex-col' : 'justify-between',
        )}
      >
        <div className={cn('flex items-center gap-1', collapsed && 'flex-col')}>
          <NotificationBell />
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void signOut()}
          aria-label={t('logout')}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </aside>
  );
}
