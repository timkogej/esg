'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Client, Contact } from '@/lib/supabase/types';

// The resolved portal session available throughout the authenticated app.
// client_id and contact are loaded once after login and drive every query.
interface AuthState {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  session: Session | null;
  contact: Contact | null;
  client: Client | null;
  clientId: string | null;
  // Set when a valid Supabase session exists but the contact is missing or not a
  // portal user — the login page shows this as a "not approved" message.
  accessDenied: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowserClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const loadingRef = useRef(false);

  const resolveSession = useCallback(
    async (nextSession: Session | null) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        setSession(nextSession);

        if (!nextSession) {
          setContact(null);
          setClient(null);
          setAccessDenied(false);
          setStatus('unauthenticated');
          return;
        }

        // Find the contact row for the signed-in auth user.
        const { data: contactRow } = await supabase
          .from('contacts')
          .select('*')
          .eq('auth_user_id', nextSession.user.id)
          .maybeSingle<Contact>();

        // No contact, or not a portal user → deny access and sign out.
        if (!contactRow || contactRow.is_portal_user !== true) {
          await supabase.auth.signOut();
          setContact(null);
          setClient(null);
          setSession(null);
          setAccessDenied(true);
          setStatus('unauthenticated');
          return;
        }

        const { data: clientRow } = await supabase
          .from('clients')
          .select('*')
          .eq('id', contactRow.client_id)
          .maybeSingle<Client>();

        setContact(contactRow);
        setClient(clientRow ?? null);
        setAccessDenied(false);
        setStatus('authenticated');
      } finally {
        loadingRef.current = false;
      }
    },
    [supabase],
  );

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await resolveSession(data.session);
  }, [supabase, resolveSession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setContact(null);
    setClient(null);
    setAccessDenied(false);
    setStatus('unauthenticated');
  }, [supabase]);

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveSession(nextSession);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      contact,
      client,
      clientId: contact?.client_id ?? null,
      accessDenied,
      refresh,
      signOut,
    }),
    [status, session, contact, client, accessDenied, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

// Convenience hook for pages that require an authenticated client. Callers should
// only render data once clientId is non-null (the guard layout ensures this).
export function useClientId(): string {
  const { clientId } = useAuth();
  if (!clientId) throw new Error('useClientId used outside an authenticated context');
  return clientId;
}
