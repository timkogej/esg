'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { applyLocale, isLocale, readStoredLocale } from '@/lib/locale';
import type { Locale } from '@/lib/config';

// On first login, adopt the user's stored preference from contacts.language —
// but only if the user hasn't already made an explicit local choice (no stored
// locale yet). Manual switches thereafter are handled by LanguageSwitcher.
export function LocaleSync() {
  const active = useLocale() as Locale;
  const { contact } = useAuth();

  useEffect(() => {
    if (!contact) return;
    if (readStoredLocale()) return; // user already chose explicitly
    const pref = contact.language?.toLowerCase();
    if (isLocale(pref) && pref !== active) {
      applyLocale(pref); // sets storage + cookie, then reloads once
    }
  }, [contact, active]);

  return null;
}
