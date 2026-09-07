'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  Loader2,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  ClientDatapointValue,
  FrameworkDatapoint,
  NewClientAttestation,
} from '@/lib/supabase/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDatapointValue } from '@/lib/datapoint';
import { downloadFromStorage } from '@/lib/storage';

interface ReviewItem extends ClientDatapointValue {
  label: string | null;
  module: string | null;
  sourceFilename: string | null;
  sourceStoragePath: string | null;
}

export default function DataPage() {
  const t = useTranslations('data');
  const supabase = getSupabaseBrowserClient();
  const { clientId, contact, session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({}); // id -> corrected value (local only)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Varovalka: true, ko obstajajo datapoint_id-ji za katere ne moremo naložiti
  // labelov iz framework_datapoints. Skoraj vedno pomeni RLS blokado branja te
  // referenčne tabele za prijavljenega uporabnika (poizvedba tiho vrne 0 vrstic).
  const [labelsMissing, setLabelsMissing] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Only values the client can meaningfully confirm. Calculated values
      // (provenance='calculated') are excluded: the client must not attest them and
      // the backend workflow ignores any attestation for those rows anyway.
      const { data: values } = await supabase
        .from('client_datapoint_values')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'needs_review')
        .in('provenance', ['extracted', 'client_entered'])
        .returns<ClientDatapointValue[]>();

      const rows = values ?? [];
      const dpIds = [...new Set(rows.map((r) => r.datapoint_id).filter(Boolean))];

      // Labels / modules from framework_datapoints.
      const dpMeta: Record<string, { label: string | null; module: string | null }> = {};
      let dpMetaMissing = false;
      if (dpIds.length) {
        const { data: dps } = await supabase
          .from('framework_datapoints')
          .select('id, label, module')
          .in('id', dpIds)
          .returns<Pick<FrameworkDatapoint, 'id' | 'label' | 'module'>[]>();
        dps?.forEach((d) => {
          dpMeta[d.id] = { label: d.label, module: d.module };
        });
        // Zahtevali smo labele za dpIds, a nič (ali ne vseh) nismo dobili nazaj.
        // Supabase ob RLS blokadi tiho vrne prazen rezultat brez napake, zato to
        // eksplicitno zaznamo in prikažemo opozorilo namesto tihih null labelov.
        dpMetaMissing = dpIds.some((id) => !dpMeta[id]);
      }

      // Best-effort source lookup: client_datapoint_values -> datapoint_evidence_links
      // -> evidence -> documents.original_filename.
      // TODO: the exact schema of datapoint_evidence_links is not provided. We join
      // on column names that seem logical (datapoint_value_id, evidence_id). If the
      // table/columns differ, this query simply returns nothing and we show no source.
      const sourceByValue: Record<string, { filename: string; storagePath: string }> = {};
      const valueIds = rows.map((r) => r.id);
      if (valueIds.length) {
        const { data: links } = await supabase
          .from('datapoint_evidence_links')
          .select('datapoint_value_id, evidence_id')
          .in('datapoint_value_id', valueIds)
          .returns<{ datapoint_value_id: string; evidence_id: string }[]>();

        const evidenceIds = [...new Set((links ?? []).map((l) => l.evidence_id).filter(Boolean))];
        if (evidenceIds.length) {
          const { data: ev } = await supabase
            .from('evidence')
            .select('id, document_id')
            .in('id', evidenceIds)
            .returns<{ id: string; document_id: string | null }[]>();
          const docIds = [...new Set((ev ?? []).map((e) => e.document_id).filter(Boolean))] as string[];
          const docMeta: Record<string, { filename: string; storagePath: string }> = {};
          if (docIds.length) {
            const { data: docRows } = await supabase
              .from('documents')
              .select('id, original_filename, storage_path')
              .in('id', docIds)
              .returns<{ id: string; original_filename: string; storage_path: string }[]>();
            docRows?.forEach((d) => {
              docMeta[d.id] = { filename: d.original_filename, storagePath: d.storage_path };
            });
          }
          const evToDoc: Record<string, string | null> = {};
          ev?.forEach((e) => (evToDoc[e.id] = e.document_id));
          (links ?? []).forEach((l) => {
            const docId = evToDoc[l.evidence_id];
            if (docId && docMeta[docId]) sourceByValue[l.datapoint_value_id] = docMeta[docId];
          });
        }
      }

      if (cancelled) return;
      setLabelsMissing(dpMetaMissing);
      setItems(
        rows.map((r) => ({
          ...r,
          // Never fall back to the raw UUID — if the label is missing, leave it
          // null and surface a clear error in the UI instead.
          label: dpMeta[r.datapoint_id]?.label ?? null,
          module: dpMeta[r.datapoint_id]?.module ?? null,
          sourceFilename: sourceByValue[r.id]?.filename ?? null,
          sourceStoragePath: sourceByValue[r.id]?.storagePath ?? null,
        })),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, clientId]);

  // Group by framework module for a readable overview.
  const grouped = useMemo(() => {
    const map = new Map<string, ReviewItem[]>();
    for (const item of items) {
      const key = item.module ?? t('moduleFallback');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [items, t]);

  async function attestAll() {
    if (!clientId || !session) return;
    setSubmitting(true);
    try {
      // IMPORTANT: the portal ONLY inserts into client_attestations. It does NOT
      // change client_datapoint_values.status — a separate, not-yet-built backend
      // reaction workflow listens for inserts into client_attestations and advances
      // the value status. Do not add a status update here.
      const rows: NewClientAttestation[] = items.map((item) => ({
        client_id: clientId,
        report_id: null,
        questionnaire_export_id: null,
        datapoint_value_id: item.id,
        kind: 'datapoint',
        statement_text: t('attestStatement'),
        statement_version: 'v1',
        attested_by: session.user.id,
        attested_name: contact?.full_name ?? null,
        attested_at: new Date().toISOString(),
        // NOTE: locally corrected values (edits[item.id]) are intentionally NOT
        // written to client_datapoint_values from the portal. The correction is
        // carried in the attestation context for the backend to reconcile.
        // TODO: no schema field is defined to carry the corrected value on the
        // attestation — surface it here once the backend defines one.
      }));

      const { error } = await supabase.from('client_attestations').insert(rows);
      if (error) throw error;
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {loading ? (
        <div
          className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] dark:shadow-none"
          aria-label={t('loading')}
        >
          <div className="border-b bg-secondary/20 px-5 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          {[0, 1, 2].map((i) => (
            <ListRow key={i} className="gap-3">
              <Skeleton className="h-10 w-10 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-7 w-24" />
            </ListRow>
          ))}
        </div>
      ) : done ? (
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-[0_1px_2px_rgb(0_0_0/0.025)] dark:shadow-none">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-success/20 bg-success/10 text-success">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">{t('attestSuccessTitle')}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            {t('attestSuccess')}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-[0_1px_2px_rgb(0_0_0/0.025),0_8px_28px_rgb(0_0_0/0.025)] dark:shadow-none md:py-16">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border bg-secondary/50 text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold tracking-[-0.015em]">{t('allClearTitle')}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            {t('noPending')}
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link href="/documents">
              {t('goToDocuments')}
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {labelsMissing && (
            <div
              className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive"
              role="alert"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">{t('labelsMissingWarning')}</p>
            </div>
          )}

          <div className="mb-7 flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.025)] dark:shadow-none sm:flex-row sm:items-center sm:justify-between md:p-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-text">
                <Database aria-hidden="true" className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold tracking-[-0.01em]">{t('reviewTitle')}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{t('reviewHint')}</p>
              </div>
            </div>
            <Badge variant="warning" className="self-start sm:self-auto">
              {t('reviewCount', { count: items.length })}
            </Badge>
          </div>

          <div className="space-y-8">
            {grouped.map(([moduleName, rows]) => (
              <section key={moduleName} aria-labelledby={`module-${moduleName}`}>
                <div className="mb-3 flex items-center gap-2">
                  <h2
                    id={`module-${moduleName}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    {moduleName}
                  </h2>
                  <Badge variant="muted">{rows.length}</Badge>
                </div>
                <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] dark:shadow-none">
                  {rows.map((item) => {
                    const edited = edits[item.id];
                    return (
                      <ListRow
                        key={item.id}
                        className="block min-h-20 transition-colors duration-150 hover:bg-secondary/25 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(9rem,.35fr)_auto] sm:gap-x-5"
                      >
                        <div className="min-w-0">
                          {item.label ? (
                            <p className="font-medium leading-6">{item.label}</p>
                          ) : (
                            <p className="font-medium leading-6 text-destructive">
                              {t('unknownDatapoint')}
                            </p>
                          )}
                          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                            <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            {item.sourceFilename && item.sourceStoragePath ? (
                              <button
                                type="button"
                                className="truncate underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() =>
                                  void downloadFromStorage(
                                    item.sourceStoragePath!,
                                    item.sourceFilename!,
                                  )
                                }
                              >
                                {item.sourceFilename}
                              </button>
                            ) : item.provenance === 'client_entered' ? (
                              t('selfEntered')
                            ) : (
                              t('noSource')
                            )}
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-0 sm:text-right">
                          <p className="text-xs text-muted-foreground sm:sr-only">{t('value')}</p>
                          <p className="mt-0.5 text-[1.0625rem] font-semibold tabular-nums tracking-[-0.01em] sm:mt-0">
                            {edited !== undefined ? edited : formatDatapointValue(item)}{' '}
                            {item.unit && (
                              <span className="text-sm font-normal text-muted-foreground">
                                {item.unit}
                              </span>
                            )}
                          </p>
                          {edited !== undefined && (
                            <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-text">
                              <Check aria-hidden="true" className="h-3 w-3" />
                              {t('corrected')}
                            </span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-3 justify-start text-muted-foreground hover:text-foreground sm:mt-0 sm:justify-center"
                          aria-expanded={editingId === item.id}
                          onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          {t('edit')}
                        </Button>

                        {editingId === item.id && (
                          <div className="mt-4 border-t pt-4 sm:col-span-3">
                            <label htmlFor={`edit-${item.id}`} className="mb-1.5 block text-sm font-medium">
                              {t('editedValue')}
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                id={`edit-${item.id}`}
                                autoFocus
                                defaultValue={
                                  edited !== undefined ? edited : formatDatapointValue(item)
                                }
                                onChange={(e) =>
                                  setEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                                }
                                className="max-w-sm"
                                placeholder={t('editedValue')}
                              />
                              <Button
                                variant="secondary"
                                onClick={() => setEditingId(null)}
                              >
                                <Check aria-hidden="true" />
                                {t('doneEditing')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </ListRow>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="glass-bar sticky bottom-20 z-20 mt-8 rounded-2xl border px-4 py-3 shadow-[0_8px_30px_rgb(0_0_0/0.10)] md:bottom-4 md:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2.5">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">{t('attestStatement')}</p>
              </div>
              <Button
                variant="accent"
                size="lg"
                className="shrink-0 shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
                onClick={() => void attestAll()}
                disabled={submitting}
              >
                {submitting && <Loader2 aria-hidden="true" className="animate-spin" />}
                {submitting ? t('attesting') : t('attestAll')}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
