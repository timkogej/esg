'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

// Two modes:
//  - "request": enter email to receive a reset link (default entry point, since
//    there is no sign-up flow through which a user would otherwise get a password).
//  - "update": user arrived via the recovery link (Supabase emits PASSWORD_RECOVERY
//    and establishes a temporary session) → set a new password. Admin onboarding
//    reuses this page via generate_link({ type: 'invite' }); Supabase fires
//    SIGNED_IN (not PASSWORD_RECOVERY) for invite links, so that event only
//    triggers 'update' mode when the URL itself carries type=invite|recovery —
//    otherwise a normal login's SIGNED_IN would incorrectly flip the form.
export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const supabase = getSupabaseBrowserClient();

  // Capture at mount, before Supabase's own detectSessionInUrl strips the
  // hash from the URL as part of establishing the session — reading this
  // inside onAuthStateChange would be too late.
  const [hadRecoveryOrInviteType] = useState(() => {
    if (typeof window === 'undefined') return false;
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const fromQuery = new URLSearchParams(window.location.search);
    const type = fromHash.get('type') ?? fromQuery.get('type');
    return type === 'recovery' || type === 'invite';
  });

  const [mode, setMode] = useState<'request' | 'update'>('request');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
      else if (event === 'SIGNED_IN' && hadRecoveryOrInviteType) setMode('update');
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, hadRecoveryOrInviteType]);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setSubmitting(false);
    // Do not reveal whether the address exists.
    setMessage(t('resetSent'));
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (updateError) {
      setError(t('error'));
      return;
    }
    await supabase.auth.signOut();
    setMessage(t('passwordUpdated'));
    setMode('request');
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      <div className="mb-8 text-center">
        <Brand className="text-4xl" />
      </div>

      <Card className="w-full max-w-sm border-border/70 bg-card/80 backdrop-blur">
        <CardContent className="pt-6">
          <div className="mb-6 space-y-1">
            <h1 className="font-didot text-2xl font-normal">
              {mode === 'update' ? t('setNewPassword') : t('resetTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'update' ? t('newPassword') : t('resetSubtitle')}
            </p>
          </div>

          {message && (
            <p className="mb-4 rounded-md bg-accent/20 px-3 py-2 text-sm text-foreground">{message}</p>
          )}
          {error && (
            <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {mode === 'update' ? (
            <form onSubmit={updatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
                {t('setNewPassword')}
              </Button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('email')}</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
                {t('sendResetLink')}
              </Button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link
              href="/login"
              className="rounded-md text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
