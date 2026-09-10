'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MoreHorizontal, Bell, Settings, LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// The mobile "More" slot — opens a bottom sheet giving access to Notifications,
// Settings, theme, language and sign-out.
export function MoreSheet({ active }: { active: boolean }) {
  const t = useTranslations('nav');
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[0.625rem] font-medium transition-[color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none',
          active || open
            ? '-translate-y-px bg-brand text-white shadow-sm'
            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
        )}
        aria-label={t('more')}
      >
        <MoreHorizontal aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" strokeWidth={active || open ? 2.2 : 1.8} />
        <span className="max-w-full truncate">{t('more')}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-2xl overflow-hidden rounded-t-[1.75rem] border-x p-0">
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="text-base">{t('more')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <NotificationBell
            trigger={
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-secondary active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none"
              >
                <Bell className="h-5 w-5" />
                {t('notifications')}
              </button>
            }
          />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-secondary active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none"
          >
            <Settings className="h-5 w-5" />
            {t('settings')}
          </Link>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <ThemeToggle showLabel />
            <LanguageSwitcher variant="full" />
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-destructive transition-[background-color,transform] duration-150 ease-out hover:bg-secondary active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transform-none motion-reduce:transition-none"
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
