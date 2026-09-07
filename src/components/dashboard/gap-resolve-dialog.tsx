'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import type {
  DataGap,
  DataGapReason,
  FrameworkDatapoint,
  NewClientDatapointValue,
  QuestionnaireQuestion,
} from '@/lib/supabase/types';

// Reasons whose natural resolution is uploading a document rather than typing a value.
const DOCUMENT_REASONS: DataGapReason[] = ['expired_evidence', 'needs_site_data'];

function isBooleanType(dataType: string | null): boolean {
  const dt = (dataType ?? '').toLowerCase();
  return dt.includes('bool');
}

function isNumericType(dataType: string | null): boolean {
  const dt = (dataType ?? '').toLowerCase();
  return ['number', 'numeric', 'decimal', 'integer', 'int', 'float', 'percent'].some((k) =>
    dt.includes(k),
  );
}

function isIntegerType(dataType: string | null): boolean {
  const dt = (dataType ?? '').toLowerCase();
  // Catch integer, int, bigint, smallint — but not "point" (which also contains "int").
  return dt.includes('int') && !dt.includes('point');
}

function isPercentType(dataType: string | null): boolean {
  const dt = (dataType ?? '').toLowerCase();
  return dt.includes('percent') || dt.includes('%');
}

// Parse the free-text field into a number, tolerating a comma decimal separator.
// Returns null when the field is empty or not a finite number.
function parseNumeric(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

type DatapointMeta = Pick<FrameworkDatapoint, 'data_type' | 'unit'>;

export function GapResolveDialog({
  open,
  onOpenChange,
  gap,
  label,
  onResolved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gap: DataGap | null;
  label: string;
  onResolved?: () => void;
}) {
  const t = useTranslations('dashboard');
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { clientId, client } = useAuth();

  const [textValue, setTextValue] = useState('');
  const [boolValue, setBoolValue] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [meta, setMeta] = useState<DatapointMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = gap?.reason ?? null;
  const isDocumentReason = reason ? DOCUMENT_REASONS.includes(reason) : false;
  // Value entry is only possible when the gap references a catalog datapoint.
  const canEnterValue = !!gap?.datapoint_id && !isDocumentReason;
  const isFreeTextReason = !gap?.datapoint_id && !isDocumentReason;
  const isBoolean = isBooleanType(meta?.data_type ?? null);
  const isNumeric = isNumericType(meta?.data_type ?? null);
  const isInteger = isIntegerType(meta?.data_type ?? null);
  const isPercent = isPercentType(meta?.data_type ?? null);

  // Client-side validation of the current field value. Returns a translated error
  // message (to show before submit), or null when the value is acceptable.
  function validate(): string | null {
    if (isBoolean) return null;
    if (!isNumeric) return null;

    const n = parseNumeric(textValue);
    if (n === null) return t('valueInvalid');
    if (n < 0) return t('valueNegative');
    if (isInteger && !Number.isInteger(n)) return t('valueNotInteger');
    if (isPercent && n > 100) return t('valuePercentRange');
    return null;
  }

  // Load the datapoint's data_type up front so we can render the correct control
  // (a real toggle for booleans, a text/number field otherwise).
  useEffect(() => {
    if (!open || !gap?.datapoint_id || isDocumentReason) return;
    let cancelled = false;
    setMetaLoading(true);
    setError(null);
    setTextValue('');
    setBoolValue(false);
    (async () => {
      const { data } = await supabase
        .from('framework_datapoints')
        .select('data_type, unit')
        .eq('id', gap.datapoint_id)
        .maybeSingle<DatapointMeta>();
      if (cancelled) return;
      setMeta(data ?? null);
      setMetaLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, gap?.datapoint_id, isDocumentReason, supabase]);

  function goToUpload() {
    onOpenChange(false);
    router.push('/documents');
  }

  async function submitValue(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !gap?.datapoint_id) return;

    // Validate before touching the database so the user gets an immediate,
    // readable message rather than waiting for a CHECK-constraint rejection.
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      // Resolve dimensions: if the gap is tied to a questionnaire question, carry
      // that question's dimension_filter onto the value; otherwise empty object.
      let dimensions: Record<string, unknown> = {};
      if (gap.question_id) {
        const { data: q } = await supabase
          .from('questionnaire_questions')
          .select('dimension_filter')
          .eq('id', gap.question_id)
          .maybeSingle<Pick<QuestionnaireQuestion, 'dimension_filter'>>();
        dimensions = q?.dimension_filter ?? {};
      }

      // Choose the typed value column from the datapoint's data_type.
      const valueColumns: Pick<
        NewClientDatapointValue,
        'value_num' | 'value_bool' | 'value_text'
      > = isBoolean
        ? { value_bool: boolValue }
        : isNumeric
          ? { value_num: parseNumeric(textValue) }
          : { value_text: textValue };

      const payload: NewClientDatapointValue = {
        client_id: clientId,
        datapoint_id: gap.datapoint_id,
        reporting_period: client?.reporting_period ?? null,
        dimensions,
        ...valueColumns,
        unit: meta?.unit ?? null,
        applicability_status: 'applicable',
        provenance: 'client_entered',
        // The backend QA workflow only picks up 'needs_review' rows — a 'draft'
        // would silently stall without review.
        status: 'needs_review',
        site_id: null, // MVP: single location
      };

      const { error: insErr } = await supabase.from('client_datapoint_values').insert(payload);
      if (insErr) throw insErr;

      // We do NOT change data_gaps.status here — a backend workflow reacts to the
      // new client_datapoint_values row and closes the gap.
      onOpenChange(false);
      onResolved?.();
    } catch (err) {
      // Never surface the raw Postgres/Supabase message to the user. A CHECK
      // constraint violation (code 23514) means the value was rejected by the
      // database's own rules — show a readable, value-specific message; anything
      // else is a generic save failure.
      const code =
        err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      setError(code === '23514' ? t('valueRejected') : t('resolveError'));
    } finally {
      setSaving(false);
    }
  }

  async function submitFreeText(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !gap?.id) return;
    setError(null);
    setSaving(true);
    try {
      if (gap.question_id) {
        const { error: ansErr } = await supabase.from('questionnaire_answers').insert({
          client_id: clientId,
          question_id: gap.question_id,
          answer: { text: freeText.trim() },
          source_kind: 'manual_client_text',
        });
        if (ansErr) throw ansErr;
      }
      const { error: jobErr } = await supabase.from('job_queue').insert({
        type: 'close_manual_gap',
        payload: { gap_id: gap.id, client_id: clientId },
        dedupe_key: `close_manual_gap:${gap.id}:${Date.now()}`,
      });
      if (jobErr) throw jobErr;
      onOpenChange(false);
      onResolved?.();
    } catch {
      setError(t('resolveError'));
    } finally {
      setSaving(false);
    }
  }

  const submitDisabled = saving || metaLoading || (!isBoolean && textValue.trim() === '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {canEnterValue || isFreeTextReason ? t('provideData') : t('uploadDocument')}
          </DialogDescription>
        </DialogHeader>

        {canEnterValue ? (
          <form onSubmit={submitValue} className="space-y-4">
            {metaLoading ? (
              <div className="flex h-10 items-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : isBoolean ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="gap-bool">{t('provideData')}</Label>
                <Switch id="gap-bool" checked={boolValue} onCheckedChange={setBoolValue} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="gap-value">{t('provideData')}</Label>
                <Input
                  id="gap-value"
                  type={isNumeric ? 'number' : 'text'}
                  inputMode={isNumeric ? (isInteger ? 'numeric' : 'decimal') : 'text'}
                  min={isNumeric ? 0 : undefined}
                  max={isPercent ? 100 : undefined}
                  step={isNumeric ? (isInteger ? 1 : 'any') : undefined}
                  value={textValue}
                  onChange={(e) => {
                    setTextValue(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                />
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" variant="accent" disabled={submitDisabled}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('resolve')}
              </Button>
            </DialogFooter>
          </form>
        ) : isFreeTextReason ? (
          <form onSubmit={submitFreeText} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gap-free-text">{t('provideData')}</Label>
              <textarea
                id="gap-free-text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                autoFocus
              />
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="submit" variant="accent" disabled={saving || freeText.trim() === ''}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('resolve')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <Button variant="accent" className="w-full" onClick={goToUpload}>
              <Upload className="h-4 w-4" />
              {t('uploadDocument')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
