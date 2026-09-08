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
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusNotice } from '@/components/ui/status-notice';

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
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(false);
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
      if (reportRes.error || exportRes.error) {
        setReports([]);
        setExports([]);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setReports(reportRes.data ?? []);
      setExports(exportRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, clientId, reloadKey]);

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
        <h1 className="font-didot text-[1.625rem] font-normal leading-tight tracking-[-0.025em] md:text-[1.75rem]">
          {t('title')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{t('subtitle')}</p>
      </header>

      {error && (
        <StatusNotice className="mb-5">{error}</StatusNotice>
      )}

      {loading ? (
        <ListSkeleton label={t('loading')} header />
      ) : loadError ? (
        <StatePanel
          icon={AlertCircle}
          tone="error"
          title={t('loadError')}
          action={
            <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
              {tCommon('retry')}
            </Button>
          }
        />
      ) : reports.length === 0 && exports.length === 0 ? (
        <StatePanel icon={Download} title={t('emptyTitle')} description={t('emptyHint')} />
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
              <StatePanel icon={FileText} title={t('noItems')} compact />
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
              <StatePanel icon={FileSpreadsheet} title={t('noItems')} compact />
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
