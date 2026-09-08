'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  ClientDatapointValue,
  DataGap,
  DataGapReason,
  FrameworkDatapoint,
  QuestionnaireQuestion,
} from '@/lib/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListRow } from '@/components/ui/list-row';
import { Progress } from '@/components/ui/progress';
import { GapResolveDialog } from '@/components/dashboard/gap-resolve-dialog';
import { formatDatapointValue } from '@/lib/datapoint';

interface EnrichedGap extends DataGap {
  label: string;
}

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tReason = useTranslations('gapReason');
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const { clientId, client } = useAuth();

  const [loading, setLoading] = useState(true);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({}); // datapoint_id/question_id -> label
  const [recent, setRecent] = useState<ClientDatapointValue[]>([]);
  const [activeGap, setActiveGap] = useState<EnrichedGap | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!clientId || !client?.reporting_period) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Gaps for the client's current reporting period only.
      // "closed" = status in ('filled','waived'); denominator = gaps in this period.
      const { data: gapRows } = await supabase
        .from('data_gaps')
        .select('*')
        .eq('client_id', clientId)
        .eq('reporting_period', client.reporting_period)
        .returns<DataGap[]>();

      const allGaps = gapRows ?? [];

      // Resolve human-readable labels: framework_datapoints.label for datapoint
      // gaps, questionnaire_questions.question_text when question_id is set.
      const dpIds = [...new Set(allGaps.map((g) => g.datapoint_id).filter(Boolean))] as string[];
      const qIds = [...new Set(allGaps.map((g) => g.question_id).filter(Boolean))] as string[];

      const labelMap: Record<string, string> = {};

      if (dpIds.length) {
        const { data: dps } = await supabase
          .from('framework_datapoints')
          .select('id, label')
          .in('id', dpIds)
          .returns<Pick<FrameworkDatapoint, 'id' | 'label'>[]>();
        dps?.forEach((d) => {
          if (d.label) labelMap[d.id] = d.label;
        });
      }
      if (qIds.length) {
        const { data: qs } = await supabase
          .from('questionnaire_questions')
          .select('id, question_text, question_text_translations')
          .in('id', qIds)
          .returns<
            (Pick<QuestionnaireQuestion, 'id' | 'question_text'> & {
              question_text_translations: Record<string, string> | null;
            })[]
          >();
        qs?.forEach((q) => {
          const translated = q.question_text_translations?.[locale];
          const text = translated || q.question_text;
          if (text) labelMap[q.id] = text;
        });
      }

      // A short list of recently confirmed datapoints (qa_approved).
      const { data: approved } = await supabase
        .from('client_datapoint_values')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'qa_approved')
        .limit(5)
        .returns<ClientDatapointValue[]>();

      if (cancelled) return;
      setGaps(allGaps);
      setLabels(labelMap);
      setRecent(approved ?? []);
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

  return (
    <div>
      <header className="mb-7 md:mb-9">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{t('welcome')}</p>
          {client?.reporting_period && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {client.reporting_period}
            </span>
          )}
        </div>
        <h1 className="mt-1 max-w-4xl font-didot text-[1.75rem] font-normal leading-[1.15] tracking-[-0.025em] md:text-[2.25rem]">
          {client?.name ?? '—'}
        </h1>
      </header>

      <section className="mb-10 md:mb-12" aria-label={t('progressLabel')}>
        <Card>
          <CardContent className="p-5 md:p-6">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-44" />
                <Skeleton className="h-2.5 w-full" />
              </div>
            ) : total === 0 ? (
              <div className="flex min-h-20 items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="font-semibold">{t('noRequirements')}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t('allDone')}</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center md:gap-8">
                <div className="flex items-baseline gap-3">
                  <span className="font-didot text-5xl font-normal leading-none tracking-[-0.03em] tabular-nums">
                    {closedCount}/{total}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{t('progressLabel')}</span>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-end text-xs font-medium text-muted-foreground">
                    <span className="tabular-nums">{completionPercent}%</span>
                  </div>
                  <Progress value={closedCount} max={total} label={t('progressLabel')} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="open-gaps-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="open-gaps-title" className="text-xl font-semibold tracking-[-0.015em]">
              {t('openGapsTitle')}
            </h2>
            <p className="mt-1 text-[0.9375rem] text-muted-foreground">{t('openGapsSubtitle')}</p>
          </div>
          {!loading && openGaps.length > 0 && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
              {openGaps.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            {[0, 1, 2].map((i) => (
              <ListRow key={i}>
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </ListRow>
            ))}
          </div>
        ) : openGaps.length === 0 ? (
          <div className="flex min-h-28 items-center gap-4 rounded-xl border bg-card px-5 py-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">{t('allDone')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {openGaps.map((g) => (
              <ListRow key={g.id} className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium leading-6">{gapLabel(g)}</p>
                    <div className="mt-1.5">
                      <Badge variant="muted">
                        {t('reasonLabel')}: {reasonLabel(g.reason)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-brand/50 text-brand-text hover:bg-brand/10 sm:self-center"
                  onClick={() => setActiveGap({ ...g, label: gapLabel(g) })}
                >
                  <CircleAlert className="h-4 w-4" />
                  {t('resolve')}
                </Button>
              </ListRow>
            ))}
          </div>
        )}
      </section>

      {!loading && openGaps.length === 0 && recent.length > 0 && (
        <section className="mt-10 md:mt-12" aria-labelledby="recent-approved-title">
          <h2 id="recent-approved-title" className="mb-4 text-xl font-semibold tracking-[-0.015em]">
            {t('recentApproved')}
          </h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            {recent.map((v) => (
              <ListRow key={v.id} className="justify-between">
                <span className="text-sm tabular-nums text-muted-foreground">{v.reporting_period ?? ''}</span>
                <span className="text-right text-sm font-semibold tabular-nums">
                  {formatDatapointValue(v)} {v.unit ?? ''}
                </span>
              </ListRow>
            ))}
          </div>
        </section>
      )}

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
