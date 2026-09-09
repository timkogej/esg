'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { status, accessDenied } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the context resolves an approved portal user, leave the login page.
  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
  }, [status, router]);

  // The auth context signs out + flags accessDenied when a session exists but the
  // contact is missing or is_portal_user = false.
  useEffect(() => {
    if (accessDenied) setError(t('notApproved'));
  }, [accessDenied, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(t('invalidCredentials'));
    }
    // On success, onAuthStateChange in the context resolves the portal user and
    // the effect above redirects (or shows notApproved).
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
              {t('loginTitle')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('loginSubtitle')}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" variant="accent" className="w-full" disabled={submitting}>
              {submitting ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/reset-password"
              className="rounded-md text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
            >
              {t('forgotPassword')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
