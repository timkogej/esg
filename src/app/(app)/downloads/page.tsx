'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { QuestionnaireExport, ReportRow } from '@/lib/supabase/types';
import { downloadFromStorage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ListRow } from '@/components/ui/list-row';
import { Skeleton } from '@/components/ui/skeleton';

// output_mode is ALWAYS 'aligned_draft' in year 1 — never 'compliant'. We never
// render the words "compliant"/"skladno" anywhere in the UI.
const ALIGNED_DRAFT = 'aligned_draft';

export default function DownloadsPage() {
  const t = useTranslations('downloads');
  const tCommon = useTranslations('common');
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [exports, setExports] = useState<QuestionnaireExport[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [reportRes, exportRes] = await Promise.all([
        supabase
          .from('reports')
          .select('*')
          .eq('client_id', clientId)
          .in('status', ['sent_to_client', 'released'])
          .returns<ReportRow[]>(),
        supabase
          .from('questionnaire_exports')
          .select('*')
          .eq('client_id', clientId)
          .in('status', ['qa_approved', 'delivered'])
          .returns<QuestionnaireExport[]>(),
      ]);
      if (cancelled) return;
      setReports(reportRes.data ?? []);
      setExports(exportRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, clientId]);

  async function download(path: string | null, filename: string) {
    if (!path) return;
    setError(null);
    try {
      await downloadFromStorage(path, filename);
    } catch {
      setError(t('downloadError'));
    }
  }

  return (
    <div className="mx-auto max-w-[1040px]">
      <header className="mb-6">
        <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.025em] md:text-[1.75rem]">
          {t('title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{t('subtitle')}</p>
      </header>

      {error && (
        <p
          className="mb-5 flex items-start gap-2.5 rounded-xl bg-destructive/10 px-3.5 py-3 text-[0.8125rem] leading-5 text-destructive ring-1 ring-destructive/15"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <div
          className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none"
          aria-label={t('loading')}
        >
          <div className="border-b border-border/70 bg-secondary/15 px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-52 max-w-full" />
          </div>
          {[0, 1, 2].map((i) => (
            <ListRow key={i} className="min-h-14 gap-3 px-4 py-2.5">
              <Skeleton className="h-8 w-8 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-24" />
            </ListRow>
          ))}
        </div>
      ) : reports.length === 0 && exports.length === 0 ? (
        <div className="rounded-[0.875rem] bg-card px-6 py-12 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <Download aria-hidden="true" className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold tracking-[-0.015em]">{t('emptyTitle')}</h2>
          <p className="mx-auto mt-1 max-w-md text-[0.8125rem] leading-5 text-muted-foreground">
            {t('emptyHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          <section aria-labelledby="reports-title">
            <div className="mb-2.5">
              <div className="flex items-center gap-2">
                <h2 id="reports-title" className="text-base font-semibold tracking-[-0.015em]">
                  {t('reports')}
                </h2>
                <Badge variant="muted" className="px-2 text-[0.6875rem]">
                  {reports.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('reportsHint')}</p>
            </div>

            {reports.length === 0 ? (
              <div className="rounded-[0.875rem] bg-card px-4 py-7 text-center text-[0.8125rem] text-muted-foreground ring-1 ring-border/70">
                {t('noItems')}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
                {reports.map((report) => {
                  const path = report.storage_path_pdf ?? report.storage_path_docx;
                  const filename = `report_${report.reporting_period ?? ''}_v${report.version ?? 1}`;
                  return (
                    <ListRow
                      key={report.id}
                      className="group/row min-h-16 gap-3 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-secondary/25"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-150 group-hover/row:text-foreground">
                        <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium">
                          {t('reports')} · {report.reporting_period ?? ''}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                          <span>
                            {t('version')} {report.version ?? 1}
                          </span>
                          {report.output_mode === ALIGNED_DRAFT && (
                            <Badge variant="muted" className="min-h-5 px-2 text-[0.6875rem]">
                              {t('alignedDraftBadge')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-xs text-muted-foreground transition-opacity duration-150 hover:text-foreground md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
                        disabled={!path}
                        onClick={() => void download(path, filename)}
                      >
                        <Download aria-hidden="true" className="h-3.5 w-3.5" />
                        {tCommon('download')}
                      </Button>
                    </ListRow>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="questionnaires-title">
            <div className="mb-2.5">
              <div className="flex items-center gap-2">
                <h2
                  id="questionnaires-title"
                  className="text-base font-semibold tracking-[-0.015em]"
                >
                  {t('questionnaires')}
                </h2>
                <Badge variant="muted" className="px-2 text-[0.6875rem]">
                  {exports.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {t('questionnairesHint')}
              </p>
            </div>

            {exports.length === 0 ? (
              <div className="rounded-[0.875rem] bg-card px-4 py-7 text-center text-[0.8125rem] text-muted-foreground ring-1 ring-border/70">
                {t('noItems')}
              </div>
            ) : (
              <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
                {exports.map((item) => {
                  const filename = `questionnaire_${item.id}${item.format ? '.' + item.format : ''}`;
                  return (
                    <ListRow
                      key={item.id}
                      className="group/row min-h-16 gap-3 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-secondary/25"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-150 group-hover/row:text-foreground">
                        <FileSpreadsheet aria-hidden="true" className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium">
                          {t('questionnaires')}
                          {item.format ? ` · ${item.format.toUpperCase()}` : ''}
                        </p>
                        {item.output_mode === ALIGNED_DRAFT && (
                          <div className="mt-0.5">
                            <Badge variant="muted" className="min-h-5 px-2 text-[0.6875rem]">
                              {t('alignedDraftBadge')}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2 text-xs text-muted-foreground transition-opacity duration-150 hover:text-foreground md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100"
                        disabled={!item.storage_path}
                        onClick={() => void download(item.storage_path, filename)}
                      >
                        <Download aria-hidden="true" className="h-3.5 w-3.5" />
                        {tCommon('download')}
                      </Button>
                    </ListRow>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
