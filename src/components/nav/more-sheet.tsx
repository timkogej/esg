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
          'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span className="relative p-1">
          <MoreHorizontal className={cn('h-5 w-5', active && 'text-brand-text')} />
          {active && <span aria-hidden className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-brand" />}
        </span>
        {t('more')}
      </SheetTrigger>
      <SheetContent side="bottom" className="p-0">
        <SheetHeader className="border-b">
          <SheetTitle>{t('more')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-1 p-4 pb-8">
          <NotificationBell
            trigger={
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Bell className="h-5 w-5" />
                {t('notifications')}
              </button>
            }
          />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
