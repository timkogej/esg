'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Search,
  UploadCloud,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DOCUMENTS_BUCKET, downloadFromStorage, sha256Hex } from '@/lib/storage';
import { DOC_STATUS_POLL_MS } from '@/lib/config';
import type { DbLocation, DocumentRow } from '@/lib/supabase/types';
import { resolveDocumentUploadLocation } from '@/lib/document-upload-location';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { DocStatusBadge } from '@/components/documents/doc-status-badge';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { SelectField } from '@/components/ui/select-field';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function isPdf(doc: DocumentRow): boolean {
  return doc.mime_type === 'application/pdf' || doc.original_filename.toLowerCase().endsWith('.pdf');
}

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [locations, setLocations] = useState<DbLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'kind'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(
    async (showLoading = false) => {
      if (!clientId) return;
      if (showLoading) setDocsLoading(true);
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(25)
        .returns<DocumentRow[]>();
      setDocs(data ?? []);
      if (showLoading) setDocsLoading(false);
    },
    [supabase, clientId],
  );

  const loadLocations = useCallback(async () => {
    if (!clientId) return;
    setLocationsLoading(true);
    const { data, error: locationsError } = await supabase
      .from('locations')
      .select('id, client_id, name, address, country, is_primary')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('name', { ascending: true })
      .returns<DbLocation[]>();

    if (locationsError) {
      setLocations([]);
      setError(t('locationLoadError'));
    } else {
      setLocations(data ?? []);
      setSelectedLocationId((current) =>
        (data ?? []).some((location) => location.id === current) ? current : '',
      );
    }
    setLocationsLoading(false);
  }, [supabase, clientId, t]);

  const uploadLocation = useMemo(
    () => resolveDocumentUploadLocation(locations, selectedLocationId),
    [locations, selectedLocationId],
  );

  const uploadDisabled = locationsLoading || uploadLocation.kind !== 'ready';

  const filteredAndSorted = useMemo(() => {
    let result = docs;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.original_filename.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sortBy === 'kind') {
        return (a.doc_kind ?? '').localeCompare(b.doc_kind ?? '');
      }
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
  }, [docs, sortBy, searchQuery]);

  const locationNames = useMemo(
    () => new Map(locations.map((location) => [location.id, location.name])),
    [locations],
  );

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );

  async function handlePreview(storagePath: string) {
    const { data } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  // Initial load + poll every ~10s so statuses update as the backend processes
  // uploads (no realtime websocket needed in this phase).
  useEffect(() => {
    void loadDocs(true);
    void loadLocations();
    const id = setInterval(() => void loadDocs(), DOC_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [loadDocs, loadLocations]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!clientId) return;
      if (uploadLocation.kind !== 'ready') {
        setError(
          uploadLocation.kind === 'selection_required'
            ? t('locationRequired')
            : t('locationUnavailable'),
        );
        return;
      }
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          const ts = Date.now();
          // Storage path convention for portal uploads.
          const path = `clients/${clientId}/uploads/${ts}_${file.name}`;

          // documents.sha256 is NOT NULL — compute it client-side before the insert.
          const sha256 = await sha256Hex(file);

          const { error: upErr } = await supabase.storage
            .from(DOCUMENTS_BUCKET)
            .upload(path, file, { upsert: false, contentType: file.type || undefined });
          if (upErr) throw upErr;

          // Insert the document row. doc_kind and reporting_period are left null —
          // backend classification fills those in later. storage_path,
          // original_filename and sha256 are the NOT NULL columns and are all set here.
          const { error: insErr } = await supabase.from('documents').insert({
            client_id: clientId,
            location_id: uploadLocation.location.id,
            storage_path: path,
            original_filename: file.name,
            sha256,
            mime_type: file.type || null,
            status: 'uploaded',
          });
          if (insErr) throw insErr;
        }
        await loadDocs();
      } catch {
        setError(t('uploadError'));
      } finally {
        setUploading(false);
      }
    },
    [supabase, clientId, uploadLocation, loadDocs, t],
  );

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!uploadDisabled && e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {/* Drag-and-drop zone + explicit file picker, both available at once. */}
      {!locationsLoading && locations.length > 1 && (
        <div className="mb-4 max-w-md">
          <label htmlFor="document-location" className="mb-1.5 block text-sm font-medium">
            {t('locationLabel')}
          </label>
          <SelectField
            id="document-location"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            required
            disabled={uploading}
          >
            <option value="">{t('locationPlaceholder')}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.address ? ` - ${location.address}` : ''}
              </option>
            ))}
          </SelectField>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploadDisabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-7 text-center transition-[border-color,background-color] duration-150 md:min-h-48',
          dragging ? 'border-brand bg-brand/5' : 'border-input bg-card',
          uploadDisabled && 'cursor-not-allowed opacity-70',
        )}
        aria-busy={uploading}
      >
        {uploading ? (
          <Loader2 className="h-7 w-7 animate-spin text-brand-text" />
        ) : (
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{uploading ? t('uploading') : t('dropzone')}</p>
        <p className="text-xs text-muted-foreground">{t('supportedTypes')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={uploadDisabled || uploading}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          variant="outline"
          className="mt-1 border-brand/40 text-brand-text hover:bg-brand/5 hover:text-brand-text"
          onClick={() => inputRef.current?.click()}
          disabled={uploadDisabled || uploading}
        >
          {t('chooseFile')}
        </Button>
      </div>

      {!locationsLoading && locations.length === 1 && uploadLocation.kind === 'ready' && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
          {t('locationAutomatic', { location: uploadLocation.location.name })}
        </p>
      )}

      {!locationsLoading && uploadLocation.kind === 'missing' && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {t('locationUnavailable')}
        </p>
      )}

      {error && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Recently uploaded list with live status. */}
      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('recent')}</h2>
          {!docsLoading && <Badge variant="muted">{docs.length}</Badge>}
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="pl-9"
            />
          </div>
          <SelectField
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'kind')}
            aria-label={t('sortLabel')}
            className="sm:w-44"
          >
            <option value="date">{t('sortByDate')}</option>
            <option value="kind">{t('sortByKind')}</option>
          </SelectField>
        </div>

        {docsLoading ? (
          <div className="overflow-hidden rounded-xl border bg-card" aria-label={t('loading')}>
            {[0, 1, 2].map((item) => (
              <ListRow key={item} className="gap-3">
                <Skeleton className="h-9 w-9 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3 md:hidden" />
                </div>
                <Skeleton className="h-6 w-20" />
              </ListRow>
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('noDocuments')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('emptyHint')}</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            {t('noSearchResults')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,.45fr)_8.5rem_8rem_5.5rem] gap-4 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
              <span>{t('filename')}</span>
              <span>{t('location')}</span>
              <span>{t('status')}</span>
              <span>{t('date')}</span>
              <span className="text-right">{t('actions')}</span>
            </div>
            {filteredAndSorted.map((doc) => (
              <ListRow
                key={doc.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(8rem,.45fr)_8.5rem_8rem_5.5rem] md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.original_filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:hidden">
                      <span>{locationNames.get(doc.location_id ?? '') ?? '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{dateFormatter.format(new Date(doc.created_at))}</span>
                      <DocStatusBadge status={doc.status} />
                    </div>
                  </div>
                </div>
                <span className="hidden truncate text-sm text-muted-foreground md:block">
                  {locationNames.get(doc.location_id ?? '') ?? '—'}
                </span>
                <div className="hidden md:block">
                  <DocStatusBadge status={doc.status} />
                </div>
                <span className="hidden text-sm text-muted-foreground md:block">
                  {dateFormatter.format(new Date(doc.created_at))}
                </span>
                <div className="flex shrink-0 justify-end gap-1 self-start md:self-center">
                  {isPdf(doc) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('preview')}
                      aria-label={`${t('preview')}: ${doc.original_filename}`}
                      onClick={() => void handlePreview(doc.storage_path)}
                    >
                      <Eye aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title={t('download')}
                    aria-label={`${t('download')}: ${doc.original_filename}`}
                    onClick={() => void downloadFromStorage(doc.storage_path, doc.original_filename)}
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              </ListRow>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
