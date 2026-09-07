'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || '—'}</span>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { client } = useAuth();

  return (
    <div>
      <PageHeader title={t('title')} />

      <div className="space-y-6">
        {/* Appearance: language + theme. Language change also persists to
            contacts.language (handled inside LanguageSwitcher). */}
        <Card>
          <CardHeader>
            <CardTitle>{t('appearance')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{tCommon('language')}</p>
              <LanguageSwitcher variant="full" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{tCommon('theme')}</p>
              <ThemeToggle showLabel />
            </div>
          </CardContent>
        </Card>

        {/* Company info — read-only for now. */}
        <Card>
          <CardHeader>
            <CardTitle>{t('companyInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label={t('company')} value={client?.name} />
            <InfoRow label={t('vatNo')} value={client?.vat_no} />
            <InfoRow label={t('registrationNo')} value={client?.registration_no} />
            <InfoRow label={t('country')} value={client?.country} />
            <InfoRow label={t('address')} value={client?.address} />
            <InfoRow label={t('reportingPeriod')} value={client?.reporting_period} />
            <p className="mt-3 text-xs text-muted-foreground">{t('readOnlyNote')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
