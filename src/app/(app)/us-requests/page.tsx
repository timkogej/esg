'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Check, FileText, Loader2, Lock, UploadCloud } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { DOC_STATUS_POLL_MS } from '@/lib/config';
import {
  UsRequestError,
  loadReadyDocumentIds,
  loadUsOverview,
  newUsIds,
  reserveUsUpload,
  uploadUsSource,
  usRequestStage,
  validateUsFile,
  type UsFailure,
  type UsIds,
  type UsOverview,
  type UsStage,
} from '@/lib/us-request';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusNotice } from '@/components/ui/status-notice';

// An interrupted upload keeps its reservation: retrying reuses the same ids and key, so the
// server treats it as the same request (no duplicates).
interface PendingUpload {
  ids: UsIds;
  file: File;
  sourceKey: string | null;
}

const STAGE_VARIANT: Record<UsStage, 'muted' | 'warning' | 'success'> = {
  waiting: 'muted',
  stalled: 'warning',
  received: 'muted',
  ready: 'success',
};

export default function UsRequestsPage() {
  const t = useTranslations('usRequests');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();

  const [overview, setOverview] = useState<UsOverview | null>(null);
  const [readyDocs, setReadyDocs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const o = await loadUsOverview(supabase);
        setOverview(o);
        setReadyDocs(await loadReadyDocumentIds(supabase, o.requests.map((r) => r.document_id)));
        setLoadError(false);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [supabase],
  );

  // Initial load, then poll so the stage advances while the backend works.
  useEffect(() => {
    void load(true);
    const id = setInterval(() => void load(), DOC_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const failureText = useCallback(
    (f: UsFailure) =>
      f === 'not_enabled' ? t('errNotEnabled') : f === 'invalid' ? t('errInvalid') : f === 'conflict' ? t('errConflict') : t('errUpload'),
    [t],
  );

  const run = useCallback(
    async (job: PendingUpload) => {
      setUploading(true);
      setProblem(null);
      try {
        const sourceKey = job.sourceKey ?? (await reserveUsUpload(supabase, job.ids)).sourceKey;
        const next = { ...job, sourceKey };
        setPending(next); // keep the reservation in case the upload below fails
        await uploadUsSource(supabase, sourceKey, job.file);
        setPending(null);
        await load();
      } catch (e) {
        setProblem(failureText(e instanceof UsRequestError ? e.failure : 'unknown'));
      } finally {
        setUploading(false);
      }
    },
    [supabase, load, failureText],
  );

  function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const bad = validateUsFile(file);
    if (bad) {
      setProblem(bad === 'type' ? t('errType') : bad === 'size' ? t('errSize') : t('errEmpty'));
      return;
    }
    void run({ ids: newUsIds(), file, sourceKey: null });
  }

  const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const now = Date.now();

  return (
    <div className="mx-auto max-w-[1040px]">
      <header className="mb-6">
        <h1 className="font-didot text-[1.625rem] font-normal leading-tight tracking-[-0.025em] md:text-[1.75rem]">{t('title')}</h1>
        <p className="mt-1 max-w-2xl font-didot text-sm leading-5 text-muted-foreground">{t('subtitle')}</p>
      </header>

      {loading ? (
        <ListSkeleton label={t('loading')} />
      ) : loadError ? (
        <StatePanel
          icon={AlertCircle}
          tone="error"
          title={t('loadError')}
          action={
            <Button variant="secondary" size="sm" onClick={() => void load(true)}>
              {tCommon('retry')}
            </Button>
          }
        />
      ) : !overview?.enabled ? (
        <StatePanel icon={Lock} title={t('notEnabledTitle')} description={t('notEnabledHint')} />
      ) : (
        <>
          <section
            aria-labelledby="us-upload-title"
            className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none"
          >
            <div className="m-1.5 flex min-h-40 flex-col items-center justify-center rounded-[0.625rem] bg-secondary/25 px-6 py-6 text-center" aria-busy={uploading}>
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-[0_1px_3px_rgb(0_0_0/0.07)]">
                {uploading ? <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin text-brand-text" /> : <UploadCloud aria-hidden="true" className="h-[18px] w-[18px]" />}
              </div>
              <h2 id="us-upload-title" className="text-sm font-semibold tracking-[-0.01em]">{t('addTitle')}</h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{uploading ? t('uploading') : t('addHint')}</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.docx,.pdf"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => {
                  onPick(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button variant="accent" size="sm" className="mt-3 min-w-32" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading && <Loader2 aria-hidden="true" className="animate-spin" />}
                {t('chooseFile')}
              </Button>
              <p className="mt-2.5 max-w-md text-[0.6875rem] text-muted-foreground">{t('privacyNote')}</p>
            </div>
          </section>

          {problem && (
            <StatusNotice className="mt-4">
              <span>{problem}</span>
              {pending && !uploading && (
                <Button variant="secondary" size="sm" className="ml-3" onClick={() => void run(pending)}>
                  {t('retryUpload', { name: pending.file.name })}
                </Button>
              )}
            </StatusNotice>
          )}

          <section className="mt-8" aria-labelledby="us-recent-title">
            <div className="mb-3.5">
              <div className="flex items-center gap-2">
                <h2 id="us-recent-title" className="font-didot text-base font-semibold tracking-[-0.015em]">{t('recent')}</h2>
                <Badge variant="muted" className="px-2 text-[0.6875rem]">{overview.requests.length}</Badge>
              </div>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('recentHint')}</p>
            </div>
            <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
              {overview.requests.length === 0 ? (
                <StatePanel icon={FileText} title={t('noRequests')} description={t('emptyHint')} className="rounded-none py-14 ring-0" />
              ) : (
                overview.requests.map((r) => {
                  const stage = usRequestStage({
                    phase: r.phase,
                    createdAt: r.created_at,
                    now,
                    isReady: readyDocs.has(r.document_id),
                  });
                  return (
                    <ListRow key={r.operation_id} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium">{t('requestLabel', { id: r.operation_id.slice(0, 8) })}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{dateFormatter.format(new Date(r.created_at))}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t(`stageHint.${stage}`)}</p>
                      </div>
                      <Badge variant={STAGE_VARIANT[stage]} className="min-h-5 gap-1 whitespace-nowrap px-2 text-[0.6875rem]">
                        {stage === 'ready' && <Check aria-hidden="true" className="h-3 w-3" />}
                        {t(`stage.${stage}`)}
                      </Badge>
                    </ListRow>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
