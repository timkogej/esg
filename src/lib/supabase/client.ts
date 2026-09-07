'use client';

import { createBrowserClient } from '@supabase/ssr';

// Single browser Supabase client. RLS on the DB scopes every query to the
// authenticated contact's client, so direct client-side calls are sufficient —
// there is no separate backend API layer.
let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example.',
    );
  }

  cached = createBrowserClient(url, anonKey);
  return cached;
}
