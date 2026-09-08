'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, X, Loader2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

type PageState = 'checking' | 'ready' | 'invalid' | 'done';

function checkPasswordRules(pw: string) {
  return {
    minLength: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
}

export default function AcceptInvitePage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [state, setState] = useState<PageState>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This page is reachable only via an invite/recovery link. Admin-generated
  // links (invite/recovery) can't use the PKCE flow, so we don't rely on
  // Supabase's automatic detectSessionInUrl handling — instead we parse the
  // token out of the URL ourselves and establish the session explicitly.
  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = queryParams.get('code');
      const errorCode = hashParams.get('error_code') ?? queryParams.get('error_code');

      console.log('[accept-invite] hash tokens:', !!accessToken, 'code:', !!code, 'error:', errorCode);

      if (errorCode) {
        if (!cancelled) setState('invalid');
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled) setState(error ? 'invalid' : 'ready');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled) setState(error ? 'invalid' : 'ready');
        return;
      }

      // Ni ne hash tokenov ne code parametra - preveri, ce morda ze obstaja seja
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setState(data.session ? 'ready' : 'invalid');
    }

    void establishSession();
    return () => { cancelled = true; };
  }, [supabase]);

  const rules = checkPasswordRules(password);
  const allRulesMet = Object.values(rules).every(Boolean);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!allRulesMet) {
      setError(t('passwordRequirementsNotMet'));
      return;
    }
    if (!passwordsMatch) {
      setError(t('passwordMismatch'));
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(t('error'));
      return;
    }
    await supabase.auth.signOut();
    setState('done');
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
          {state === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="space-y-3 text-center">
              <h1 className="font-didot text-xl font-normal">
                {t('linkInvalidTitle')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('linkInvalidBody')}</p>
            </div>
          )}

          {state === 'done' && (
            <div className="space-y-4 text-center">
              <h1 className="font-didot text-xl font-normal">
                {t('passwordSetSuccess')}
              </h1>
              <Button variant="accent" className="w-full" onClick={() => router.push('/login')}>
                {t('goToLogin')}
              </Button>
            </div>
          )}

          {state === 'ready' && (
            <>
              <div className="mb-6 space-y-1">
                <h1 className="font-didot text-2xl font-normal">
                  {t('acceptInviteTitle')}
                </h1>
                <p className="text-sm text-muted-foreground">{t('acceptInviteSubtitle')}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('newPassword')}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-destructive">{t('passwordMismatch')}</p>
                  )}
                </div>

                <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t('passwordRequirements')}
                  </p>
                  <PasswordRule met={rules.minLength} label={t('reqMinLength')} />
                  <PasswordRule met={rules.uppercase} label={t('reqUppercase')} />
                  <PasswordRule met={rules.lowercase} label={t('reqLowercase')} />
                  <PasswordRule met={rules.digit} label={t('reqDigit')} />
                  <PasswordRule met={rules.special} label={t('reqSpecial')} />
                </div>

                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="accent"
                  className="w-full"
                  disabled={submitting || !allRulesMet || !passwordsMatch}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('setNewPassword')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function PasswordRule({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? (
        <Check className="h-3.5 w-3.5 text-[hsl(var(--status-success))]" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={met ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}
