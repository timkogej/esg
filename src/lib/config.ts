// Central place for product-level configuration.
// The product name is NOT final — change it here only and it updates everywhere.
export const APP_NAME = 'ESG Portal';

// Accent color used as the single highlight across the app.
export const ACCENT_HEX = '#D4643F';

// Cookie that carries the active locale (read by next-intl on the server).
export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Supported locales (SL is the default).
export const LOCALES = ['sl', 'de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'sl';

// How often (ms) to poll document processing status.
export const DOC_STATUS_POLL_MS = 10_000;

// Signed URL validity for document downloads (seconds).
export const SIGNED_URL_TTL = 60 * 5;
