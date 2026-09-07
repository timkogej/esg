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

  function reasonLabel(reason: DataGapReason | null): string {
    return reason ? tReason(reason) : tReason('unknown');
  }

  function gapLabel(g: DataGap): string {
    const key = g.question_id ?? g.datapoint_id ?? '';
    return labels[key] ?? reasonLabel(g.reason);
  }

  return (
    <div>
      {/* Progress indicator — big Didot number. */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">{t('welcome')}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight" style={{ fontWeight: 700 }}>
          {client?.name ?? '—'}
        </h1>

        <Card className="mt-4 overflow-hidden">
          <CardContent className="flex items-center gap-4 py-6">
            {loading ? (
              <Skeleton className="h-14 w-40" />
            ) : (
              <>
                <div className="font-display text-5xl font-bold text-foreground" style={{ fontWeight: 700 }}>
                  {closedCount}/{total}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('progressLabel')}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: total ? `${(closedCount / total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open gaps */}
      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold">{t('openGapsTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('openGapsSubtitle')}</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : openGaps.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-8">
              <CheckCircle2 className="h-6 w-6 text-accent" />
              <p className="text-sm">{t('allDone')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {openGaps.map((g) => (
              <Card key={g.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{gapLabel(g)}</p>
                      <div className="mt-1">
                        <Badge variant="muted">
                          {t('reasonLabel')}: {reasonLabel(g.reason)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="accent"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setActiveGap({ ...g, label: gapLabel(g) })}
                  >
                    {t('resolve')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Recently confirmed (shown when there are no open gaps) */}
      {!loading && openGaps.length === 0 && recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t('recentApproved')}</h2>
          <div className="space-y-2">
            {recent.map((v) => (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">{v.reporting_period ?? ''}</span>
                  <span className="text-sm font-medium">
                    {formatDatapointValue(v)} {v.unit ?? ''}
                  </span>
                </CardContent>
              </Card>
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
