'use client';

import { useTranslations } from 'next-intl';
import { Building2, Lock, Palette } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Badge } from '@/components/ui/badge';

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-5 border-b border-border/70 px-4 py-2.5 last:border-0">
      <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-[0.8125rem] font-medium">{value || '—'}</span>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  id,
  title,
  description,
  badge,
}: {
  icon: typeof Palette;
  id: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div>
          <h2 id={id} className="text-base font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {badge && (
        <Badge variant="muted" className="mb-0.5 shrink-0 px-2 text-[0.6875rem]">
          {badge}
        </Badge>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { client } = useAuth();

  return (
    <div className="mx-auto max-w-[1040px]">
      <header className="mb-6">
        <h1 className="font-didot text-[1.625rem] font-normal leading-tight tracking-[-0.025em] md:text-[1.75rem]">
          {t('title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="space-y-7">
        {/* Appearance: language + theme. Language change also persists to
            contacts.language (handled inside LanguageSwitcher). */}
        <section aria-labelledby="appearance-title">
          <SectionHeading
            icon={Palette}
            id="appearance-title"
            title={t('appearance')}
            description={t('appearanceHint')}
          />
          <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
            <div className="flex min-h-14 flex-col gap-2 border-b border-border/70 px-4 py-3 transition-colors duration-150 hover:bg-secondary/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[0.8125rem] font-medium">
                  {tCommon('language')}
                </h3>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                  {t('languageHint')}
                </p>
              </div>
              <div className="w-full sm:w-56 [&_button]:h-9 [&_button]:text-[0.8125rem]">
                <LanguageSwitcher variant="full" />
              </div>
            </div>
            <div className="flex min-h-14 flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-secondary/20 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[0.8125rem] font-medium">{tCommon('theme')}</h3>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                  {t('themeHint')}
                </p>
              </div>
              <div className="w-full sm:w-56 [&_button]:h-9 [&_button]:text-[0.8125rem]">
                <ThemeToggle showLabel />
              </div>
            </div>
          </div>
        </section>

        {/* Company info — read-only for now. */}
        <section aria-labelledby="company-title">
          <SectionHeading
            icon={Building2}
            id="company-title"
            title={t('companyInfo')}
            description={t('companyHint')}
            badge={t('readOnlyBadge')}
          />
          <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
            <InfoRow label={t('company')} value={client?.name} />
            <InfoRow label={t('vatNo')} value={client?.vat_no} />
            <InfoRow label={t('registrationNo')} value={client?.registration_no} />
            <InfoRow label={t('country')} value={client?.country} />
            <InfoRow label={t('address')} value={client?.address} />
            <InfoRow label={t('reportingPeriod')} value={client?.reporting_period} />
            <div className="flex items-start gap-2 border-t border-border/70 bg-secondary/15 px-4 py-3 text-[0.6875rem] leading-4 text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
              <p>{t('readOnlyNote')}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
