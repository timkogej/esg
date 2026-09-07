'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Pencil, FileText, AlertTriangle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  ClientDatapointValue,
  FrameworkDatapoint,
  NewClientAttestation,
} from '@/lib/supabase/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : done ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <p className="text-sm">{t('attestSuccess')}</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">{t('noPending')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {labelsMissing && (
            <Card className="mb-6 border-destructive/50">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{t('labelsMissingWarning')}</p>
              </CardContent>
            </Card>
          )}
          <div className="space-y-8">
            {grouped.map(([moduleName, rows]) => (
              <section key={moduleName}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {moduleName}
                </h2>
                <div className="space-y-2">
                  {rows.map((item) => {
                    const edited = edits[item.id];
                    return (
                      <Card key={item.id}>
                        <CardContent className="py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              {item.label ? (
                                <p className="font-medium">{item.label}</p>
                              ) : (
                                <p className="font-medium text-destructive">
                                  {t('unknownDatapoint')}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                <span>
                                  {t('value')}:{' '}
                                  <span className="font-medium text-foreground">
                                    {edited !== undefined
                                      ? edited
                                      : formatDatapointValue(item)}{' '}
                                    {item.unit ?? ''}
                                  </span>
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5" />
                                  {item.sourceFilename && item.sourceStoragePath ? (
                                    <button
                                      type="button"
                                      className="underline underline-offset-2 hover:text-foreground"
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
                                </span>
                              </div>

                              {editingId === item.id && (
                                <div className="mt-3 flex items-center gap-2">
                                  <Input
                                    autoFocus
                                    defaultValue={
                                      edited !== undefined ? edited : formatDatapointValue(item)
                                    }
                                    onChange={(e) =>
                                      setEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    className="max-w-xs"
                                    placeholder={t('editedValue')}
                                  />
                                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                                    OK
                                  </Button>
                                </div>
                              )}
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0"
                              onClick={() => setEditingId(editingId === item.id ? null : item.id)}
                            >
                              <Pencil className="h-4 w-4" />
                              {t('edit')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="sticky bottom-20 mt-8 md:bottom-4">
            <Button
              variant="accent"
              size="lg"
              className="w-full shadow-lg"
              onClick={() => void attestAll()}
              disabled={submitting}
            >
              {submitting ? t('attesting') : t('attestAll')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
