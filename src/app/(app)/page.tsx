'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  Download,
  FileText,
  Upload,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  ClientDatapointValue,
  DataGap,
  DataGapReason,
  DocumentRow,
  FrameworkDatapoint,
  QuestionnaireQuestion,
} from '@/lib/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { StatusNotice } from '@/components/ui/status-notice';
import { GapResolveDialog } from '@/components/dashboard/gap-resolve-dialog';
import { formatDatapointValue } from '@/lib/datapoint';

interface EnrichedGap extends DataGap {
  label: string;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tReason = useTranslations('gapReason');
  const tDocStatus = useTranslations('docStatus');
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const { clientId, client } = useAuth();

  const [loading, setLoading] = useState(true);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({}); // datapoint_id/question_id -> label
  const [recent, setRecent] = useState<ClientDatapointValue[]>([]);
  const [recentDocuments, setRecentDocuments] = useState<DocumentRow[]>([]);
  const [approvedTotal, setApprovedTotal] = useState(0);
  const [documentTotal, setDocumentTotal] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [activeGap, setActiveGap] = useState<EnrichedGap | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    if (!client?.reporting_period) {
      setGaps([]);
      setLabels({});
      setRecent([]);
      setRecentDocuments([]);
      setApprovedTotal(0);
      setDocumentTotal(0);
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(false);

      // Gaps for the client's current reporting period only.
      // "closed" = status in ('filled','waived'); denominator = gaps in this period.
      const [gapResult, approvedResult, approvedCountResult, documentResult, documentCountResult] =
        await Promise.all([
          supabase
            .from('data_gaps')
            .select('*')
            .eq('client_id', clientId)
            .eq('reporting_period', client.reporting_period)
            .returns<DataGap[]>(),
          supabase
            .from('client_datapoint_values')
            .select('*')
            .eq('client_id', clientId)
            .eq('status', 'qa_approved')
            .limit(5)
            .returns<ClientDatapointValue[]>(),
          supabase
            .from('client_datapoint_values')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('status', 'qa_approved'),
          supabase
            .from('documents')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(3)
            .returns<DocumentRow[]>(),
          supabase
            .from('documents')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId),
        ]);

      const gapRows = gapResult.data;

      const allGaps = gapRows ?? [];
      const approvedRows = approvedResult.data ?? [];

      // Resolve human-readable labels: framework_datapoints.label for datapoint
      // gaps, questionnaire_questions.question_text when question_id is set.
      const dpIds = [
        ...new Set([
          ...allGaps.map((g) => g.datapoint_id).filter(Boolean),
          ...approvedRows.map((value) => value.datapoint_id),
        ]),
      ] as string[];
      const qIds = [...new Set(allGaps.map((g) => g.question_id).filter(Boolean))] as string[];

      const labelMap: Record<string, string> = {};
      let metadataError = false;

      if (dpIds.length) {
        const { data: dps, error: datapointError } = await supabase
          .from('framework_datapoints')
          .select('id, label')
          .in('id', dpIds)
          .returns<Pick<FrameworkDatapoint, 'id' | 'label'>[]>();
        metadataError = metadataError || Boolean(datapointError);
        dps?.forEach((d) => {
          if (d.label) labelMap[d.id] = d.label;
        });
      }
      if (qIds.length) {
        const { data: qs, error: questionError } = await supabase
          .from('questionnaire_questions')
          .select('id, question_text, question_text_translations')
          .in('id', qIds)
          .returns<
            (Pick<QuestionnaireQuestion, 'id' | 'question_text'> & {
              question_text_translations: Record<string, string> | null;
            })[]
          >();
        metadataError = metadataError || Boolean(questionError);
        qs?.forEach((q) => {
          const translated = q.question_text_translations?.[locale];
          const text = translated || q.question_text;
          if (text) labelMap[q.id] = text;
        });
      }

      if (cancelled) return;
      setGaps(allGaps);
      setLabels(labelMap);
      setRecent(approvedRows);
      setRecentDocuments(documentResult.data ?? []);
      setApprovedTotal(approvedCountResult.count ?? approvedResult.data?.length ?? 0);
      setDocumentTotal(documentCountResult.count ?? documentResult.data?.length ?? 0);
      setLoadError(
        Boolean(
          gapResult.error ||
            metadataError ||
            approvedResult.error ||
            approvedCountResult.error ||
            documentResult.error ||
            documentCountResult.error,
        ),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, clientId, client?.reporting_period, reloadKey, locale]);

  const openGaps = useMemo(() => gaps.filter((g) => g.status === 'open'), [gaps]);
  const closedCount = useMemo(
    () => gaps.filter((g) => g.status === 'filled' || g.status === 'waived').length,
    [gaps],
  );
  const total = gaps.length;
  const completionPercent = total ? Math.round((closedCount / total) * 100) : 0;

  function reasonLabel(reason: DataGapReason | null): string {
    return reason ? tReason(reason) : tReason('unknown');
  }

  function gapLabel(g: DataGap): string {
    const key = g.question_id ?? g.datapoint_id ?? '';
    return labels[key] ?? reasonLabel(g.reason);
  }

  const visibleGaps = openGaps.slice(0, 4);
  const remainingGapCount = Math.max(openGaps.length - visibleGaps.length, 0);
  const shortDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

  return (
    <div className="mx-auto max-w-[1120px]">
      <header className="mb-7 md:mb-9">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.8125rem] text-muted-foreground">{t('welcome')}</p>
          {client?.reporting_period && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.6875rem] font-medium tabular-nums text-muted-foreground">
              {t('reportingPeriod')} {client.reporting_period}
            </span>
          )}
        </div>
        <h1 className="mt-1.5 max-w-4xl font-didot text-[2rem] font-normal leading-[1.08] tracking-[-0.025em] md:text-[2.75rem]">
          {client?.name ?? '—'}
        </h1>
      </header>

      {loadError && !loading && (
        <StatusNotice
          className="mb-5"
          action={
            <Button variant="ghost" size="xs" onClick={() => setReloadKey((key) => key + 1)}>
              {t('retry')}
            </Button>
          }
        >
          {t('loadError')}
        </StatusNotice>
      )}

      <section
        className="mb-8 overflow-hidden rounded-[1.25rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025),0_12px_36px_rgb(0_0_0/0.035)] ring-1 ring-border/70 dark:shadow-none"
        aria-labelledby="reporting-overview-title"
      >
        <div className="p-5 sm:p-6 md:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p id="reporting-overview-title" className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('reportingOverview')}
              </p>
              <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted-foreground">
                {loading ? t('loadingOverview') : total === 0 ? t('noRequirements') : t('progressSummary', { count: openGaps.length })}
              </p>
            </div>
            {!loading && (
              <span
                className={openGaps.length > 0
                  ? 'shrink-0 rounded-full bg-brand px-2.5 py-1 text-[0.6875rem] font-semibold text-white'
                  : 'shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[0.6875rem] font-semibold text-muted-foreground'}
              >
                {openGaps.length > 0 ? t('needsAttention') : t('upToDate')}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-5">
              <Skeleton className="h-16 w-52" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : total === 0 ? (
            <div className="flex min-h-24 items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <p className="text-sm font-semibold">{t('allDone')}</p>
                <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t('nothingPending')}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-didot text-[4rem] font-normal leading-[0.85] tracking-[-0.035em] tabular-nums md:text-[5rem]">
                    {closedCount}/{total}
                  </span>
                  <span className="pb-1 text-[0.8125rem] font-medium text-muted-foreground">{t('progressLabel')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums">{completionPercent}%</span>
                  {openGaps[0] && (
                    <Button
                      variant="accent"
                      size="sm"
                      onClick={() => setActiveGap({ ...openGaps[0], label: gapLabel(openGaps[0]) })}
                    >
                      {t('continue')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Progress className="mt-6 h-2" value={closedCount} max={total} label={t('progressLabel')} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 border-t border-border/70 bg-secondary/10 lg:grid-cols-4">
          {[
            { icon: CircleAlert, label: t('openRequirements'), value: loading ? null : openGaps.length },
            { icon: CheckCircle2, label: t('approvedValues'), value: loading ? null : approvedTotal },
            { icon: FileText, label: t('uploadedDocuments'), value: loading ? null : documentTotal },
            { icon: CalendarDays, label: t('reportingPeriod'), value: loading ? null : client?.reporting_period ?? '—' },
          ].map(({ icon: Icon, label, value }, index) => (
            <div
              key={label}
              className={`flex min-h-20 items-center gap-3 px-4 py-4 sm:px-5 ${index === 1 ? 'border-l border-border/60' : ''} ${index === 2 ? 'border-t border-border/60 lg:border-l lg:border-t-0' : ''} ${index === 3 ? 'border-l border-t border-border/60 lg:border-t-0' : ''}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/80 text-muted-foreground ring-1 ring-border/60">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                {value === null ? <Skeleton className="mb-1 h-4 w-9" /> : <p className="text-base font-semibold tabular-nums">{value}</p>}
                <p className="text-[0.6875rem] leading-4 text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(17rem,0.8fr)]">
        <section aria-labelledby="open-gaps-title">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="open-gaps-title" className="text-base font-semibold tracking-[-0.015em]">
                {t('attentionTitle')}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('openGapsSubtitle')}</p>
            </div>
            {!loading && openGaps.length > 0 && (
              <span className="rounded-full bg-secondary px-2 py-1 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                {openGaps.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="overflow-hidden rounded-[0.875rem] bg-card ring-1 ring-border/70">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex min-h-[4.5rem] items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>
          ) : openGaps.length === 0 ? (
            <div className="flex min-h-28 items-center gap-3 rounded-[0.875rem] bg-card px-4 py-5 ring-1 ring-border/70">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Check className="h-4 w-4 text-muted-foreground" />
              </span>
              <div>
                <p className="text-[0.8125rem] font-medium">{t('allDone')}</p>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{t('nothingPending')}</p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[0.875rem] bg-card ring-1 ring-border/70">
              {visibleGaps.map((gap) => (
                <div key={gap.id} className="group flex min-h-[4.5rem] items-center gap-3 border-b border-border/70 px-4 py-3 transition-colors duration-150 last:border-0 hover:bg-secondary/20">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text">
                    <CircleAlert aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{gapLabel(gap)}</p>
                    <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
                      {reasonLabel(gap.reason)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="shrink-0 text-muted-foreground group-hover:text-foreground"
                    onClick={() => setActiveGap({ ...gap, label: gapLabel(gap) })}
                  >
                    {t('resolve')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {remainingGapCount > 0 && (
                <div className="border-t border-border/70 bg-secondary/10 px-4 py-2.5 text-center text-[0.6875rem] text-muted-foreground">
                  {t('moreRequirements', { count: remainingGapCount })}
                </div>
              )}
            </div>
          )}
        </section>

        <aside aria-labelledby="quick-actions-title">
          <div className="mb-3">
            <h2 id="quick-actions-title" className="text-base font-semibold tracking-[-0.015em]">{t('quickActions')}</h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('quickActionsHint')}</p>
          </div>
          <div className="overflow-hidden rounded-[0.875rem] bg-card p-2 ring-1 ring-border/70">
            <Button asChild variant="accent" className="h-10 w-full justify-between px-3">
              <Link href="/documents">
                <span className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {t('uploadDocument')}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Link href="/data" className="mt-1.5 flex h-10 items-center justify-between rounded-lg px-3 text-[0.8125rem] font-medium transition-colors hover:bg-secondary">
              <span className="flex items-center gap-2"><Database className="h-4 w-4 text-muted-foreground" />{t('reviewData')}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link href="/downloads" className="flex h-10 items-center justify-between rounded-lg px-3 text-[0.8125rem] font-medium transition-colors hover:bg-secondary">
              <span className="flex items-center gap-2"><Download className="h-4 w-4 text-muted-foreground" />{t('openDownloads')}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </aside>
      </div>

      <section className="mt-9" aria-labelledby="recent-activity-title">
        <div className="mb-3">
          <h2 id="recent-activity-title" className="text-base font-semibold tracking-[-0.015em]">{t('recentActivity')}</h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('recentActivityHint')}</p>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => <Skeleton key={item} className="h-36 rounded-[0.875rem]" />)}
          </div>
        ) : recentDocuments.length === 0 && recent.length === 0 ? (
          <div className="rounded-[0.875rem] bg-card px-4 py-8 text-center text-[0.8125rem] text-muted-foreground ring-1 ring-border/70">
            {t('noRecentActivity')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-[0.875rem] bg-card ring-1 ring-border/70">
              <div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
                <h3 className="text-[0.8125rem] font-semibold">{t('recentDocuments')}</h3>
                <Link href="/documents" className="text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground">{t('viewAll')}</Link>
              </div>
              {recentDocuments.length === 0 ? (
                <p className="px-4 py-6 text-[0.6875rem] text-muted-foreground">{t('noRecentDocuments')}</p>
              ) : recentDocuments.map((document) => (
                <div key={document.id} className="flex min-h-[3.75rem] items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{document.original_filename}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{shortDate.format(new Date(document.created_at))}</p>
                  </div>
                  <Badge variant="muted" className="shrink-0 text-[0.625rem]">{tDocStatus(document.status)}</Badge>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[0.875rem] bg-card ring-1 ring-border/70">
              <div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
                <h3 className="text-[0.8125rem] font-semibold">{t('recentApproved')}</h3>
                <Link href="/data" className="text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground">{t('viewAll')}</Link>
              </div>
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-[0.6875rem] text-muted-foreground">{t('noApprovedValues')}</p>
              ) : recent.slice(0, 3).map((value) => (
                <div key={value.id} className="flex min-h-[3.75rem] items-center gap-3 border-b border-border/70 px-4 py-2.5 last:border-0">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{labels[value.datapoint_id] ?? t('confirmedValue')}</p>
                    <p className="mt-0.5 text-[0.6875rem] tabular-nums text-muted-foreground">{value.reporting_period ?? client?.reporting_period ?? ''}</p>
                  </div>
                  <span className="max-w-[45%] truncate text-right text-[0.8125rem] font-semibold tabular-nums">
                    {formatDatapointValue(value)} {value.unit ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <GapResolveDialog
        open={activeGap !== null}
        onOpenChange={(o) => !o && setActiveGap(null)}
        gap={activeGap}
        label={activeGap?.label ?? ''}
        onResolved={() => {
          setActiveGap(null);
          setReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
