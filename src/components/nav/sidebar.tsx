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
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-secondary/50 transition-[width] duration-200 ease-out md:flex',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <div className={cn('flex h-[72px] items-center px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <Link href="/">
            <Brand className="text-lg" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={collapsed ? t('expand') : t('collapse')}
          aria-expanded={!collapsed}
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
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-secondary text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-brand-text')} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}

        <Link
          href="/settings"
          title={t('settings')}
          aria-current={isActive('/settings') ? 'page' : undefined}
          className={cn(
            'relative mt-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
            isActive('/settings')
              ? 'bg-secondary text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          <Settings className={cn('h-[18px] w-[18px] shrink-0', isActive('/settings') && 'text-brand-text')} />
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
