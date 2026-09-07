'use client';

import { LOCALES, LOCALE_COOKIE, type Locale } from '@/lib/config';

const STORAGE_KEY = 'esg.locale';

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(v) ? v : null;
}

// Persist the chosen locale to both the cookie (read by next-intl on the server)
// and localStorage, then reload so the new message catalog is applied.
export function applyLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  // 1 year cookie.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.location.reload();
}
