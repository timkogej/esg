'use client';

import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { LOCALES, type Locale } from '@/lib/config';
import { applyLocale } from '@/lib/locale';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const LABELS: Record<Locale, string> = {
  sl: 'Slovenščina',
  de: 'Deutsch',
  en: 'English',
};

export function LanguageSwitcher({ variant = 'icon' }: { variant?: 'icon' | 'full' }) {
  const active = useLocale() as Locale;
  const { contact } = useAuth();
  const supabase = getSupabaseBrowserClient();

  async function change(locale: Locale) {
    if (locale === active) return;
    // When a logged-in user manually changes language, persist it on the user
    // in Supabase so it follows them across devices — not just a browser setting.
    if (contact?.id) {
      await supabase.from('contacts').update({ language: locale }).eq('id', contact.id);
    }
    applyLocale(locale); // writes cookie + localStorage, then reloads
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'full' ? (
          <Button variant="outline" className="w-full justify-start gap-2">
            <Languages className="h-4 w-4" />
            {LABELS[active]}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Language">
            <Languages className="h-5 w-5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => (
          <DropdownMenuCheckboxItem
            key={locale}
            checked={locale === active}
            onSelect={() => void change(locale)}
          >
            {LABELS[locale]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
