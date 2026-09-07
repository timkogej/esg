'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type { QuestionnaireExport, ReportRow } from '@/lib/supabase/types';
import { downloadFromStorage } from '@/lib/storage';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Reports */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('reports')}</h2>
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noItems')}</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  // Prefer PDF, fall back to DOCX.
                  const path = r.storage_path_pdf ?? r.storage_path_docx;
                  const filename = `report_${r.reporting_period ?? ''}_v${r.version ?? 1}`;
                  return (
                    <Card key={r.id}>
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {t('reports')} · {r.reporting_period ?? ''}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {t('version')} {r.version ?? 1}
                              </span>
                              {r.output_mode === ALIGNED_DRAFT && (
                                <Badge variant="accent">{t('alignedDraftBadge')}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="accent"
                          size="sm"
                          disabled={!path}
                          onClick={() => void download(path, filename)}
                        >
                          <Download className="h-4 w-4" />
                          {tCommon('download')}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Questionnaire exports */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">{t('questionnaires')}</h2>
            {exports.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noItems')}</p>
            ) : (
              <div className="space-y-2">
                {exports.map((x) => {
                  const filename = `questionnaire_${x.id}${x.format ? '.' + x.format : ''}`;
                  return (
                    <Card key={x.id}>
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {t('questionnaires')}
                              {x.format ? ` · ${x.format.toUpperCase()}` : ''}
                            </p>
                            {x.output_mode === ALIGNED_DRAFT && (
                              <div className="mt-1">
                                <Badge variant="accent">{t('alignedDraftBadge')}</Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="accent"
                          size="sm"
                          disabled={!x.storage_path}
                          onClick={() => void download(x.storage_path, filename)}
                        >
                          <Download className="h-4 w-4" />
                          {tCommon('download')}
                        </Button>
                      </CardContent>
                    </Card>
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
