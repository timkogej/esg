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
          'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium',
          active ? 'text-accent' : 'text-muted-foreground',
        )}
      >
        <MoreHorizontal className="h-5 w-5" />
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
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-secondary"
              >
                <Bell className="h-5 w-5" />
                {t('notifications')}
              </button>
            }
          />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium hover:bg-secondary"
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
            className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-destructive hover:bg-secondary"
          >
            <LogOut className="h-5 w-5" />
            {t('logout')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
