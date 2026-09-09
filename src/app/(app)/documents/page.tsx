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
import { Button } from '@/components/ui/button';
import { DocStatusBadge } from '@/components/documents/doc-status-badge';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { SelectField } from '@/components/ui/select-field';
import { Skeleton } from '@/components/ui/skeleton';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { StatePanel } from '@/components/ui/state-panel';
import { StatusNotice } from '@/components/ui/status-notice';
import { cn } from '@/lib/utils';

function isPdf(doc: DocumentRow): boolean {
  return doc.mime_type === 'application/pdf' || doc.original_filename.toLowerCase().endsWith('.pdf');
}

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsLoadError, setDocsLoadError] = useState(false);
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
      const { data, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(25)
        .returns<DocumentRow[]>();
      if (docsError) {
        if (showLoading) setDocsLoadError(true);
      } else {
        setDocs(data ?? []);
        setDocsLoadError(false);
      }
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
    <div className="mx-auto max-w-[1040px]">
      <header className="mb-6">
        <h1 className="font-didot text-[1.625rem] font-normal leading-tight tracking-[-0.025em] md:text-[1.75rem]">
          {t('title')}
        </h1>
        <p className="mt-1 max-w-2xl font-didot text-sm leading-5 text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* A single calm upload surface keeps the primary task and its context together. */}
      <section
        aria-labelledby="upload-title"
        className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_20px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none"
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploadDisabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'group m-1.5 flex min-h-40 flex-col items-center justify-center rounded-[0.625rem] px-6 py-6 text-center outline-none transition-[background-color,box-shadow] duration-200 ease-out focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 focus-within:ring-offset-card md:min-h-44',
            dragging
              ? 'bg-brand/5 shadow-[inset_0_0_0_1px_rgb(var(--brand)/0.35)]'
              : 'bg-secondary/25 hover:bg-secondary/35',
            !locationsLoading && uploadLocation.kind !== 'ready' && 'cursor-not-allowed opacity-70',
          )}
          aria-busy={uploading}
        >
          <div
            className={cn(
              'mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-[0_1px_3px_rgb(0_0_0/0.07)] transition-[color,transform] duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none',
              dragging && 'scale-[1.04] text-brand-text',
            )}
          >
            {uploading ? (
              <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin text-brand-text" />
            ) : (
              <UploadCloud aria-hidden="true" className="h-[18px] w-[18px]" />
            )}
          </div>
          <h2 id="upload-title" className="text-sm font-semibold tracking-[-0.01em]">
            {t('addTitle')}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
            {uploading ? t('uploading') : t('dropzone')}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={uploadDisabled || uploading}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="accent"
            size="sm"
            className="mt-3 min-w-32 shadow-[0_1px_2px_rgb(0_0_0/0.10)]"
            onClick={() => inputRef.current?.click()}
            disabled={uploadDisabled || uploading}
          >
            {uploading && <Loader2 aria-hidden="true" className="animate-spin" />}
            {t('chooseFile')}
          </Button>
          <p className="mt-2.5 text-[0.6875rem] text-muted-foreground">{t('supportedTypes')}</p>
          {uploading && (
            <span className="sr-only" role="status" aria-live="polite">
              {t('uploading')}
            </span>
          )}
        </div>

        <div className="border-t border-border/70 bg-card px-4 py-2.5">
          {locationsLoading ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : locations.length > 1 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="document-location" className="text-[0.8125rem] font-medium">
                {t('locationLabel')}
              </label>
              <SelectField
                id="document-location"
                value={selectedLocationId}
                onChange={(event) => setSelectedLocationId(event.target.value)}
                required
                disabled={uploading}
                className="h-9 text-[0.8125rem] sm:w-80"
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
          ) : uploadLocation.kind === 'ready' ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
              {t('locationAutomatic', { location: uploadLocation.location.name })}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-[0.8125rem] text-destructive">
              <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
              {t('locationUnavailable')}
            </p>
          )}
        </div>
      </section>

      {error && (
        <StatusNotice className="mt-4">{error}</StatusNotice>
      )}

      {/* Recently uploaded list with live status. */}
      <section className="mt-8" aria-labelledby="recent-title">
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="recent-title" className="text-base font-semibold tracking-[-0.015em]">
                {t('recent')}
              </h2>
              {!docsLoading && <Badge variant="muted" className="px-2 text-[0.6875rem]">{docs.length}</Badge>}
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{t('recentHint')}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-[0_1px_2px_rgb(0_0_0/0.025)] ring-1 ring-border/70 dark:shadow-none">
          <div className="flex flex-col gap-2 border-b border-border/70 bg-secondary/15 p-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                aria-label={t('search')}
                className="h-9 bg-card pl-8 text-[0.8125rem]"
              />
            </div>
            <SelectField
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'kind')}
              aria-label={t('sortLabel')}
              className="h-9 bg-card text-[0.8125rem] sm:w-40"
            >
              <option value="date">{t('sortByDate')}</option>
              <option value="kind">{t('sortByKind')}</option>
            </SelectField>
          </div>

          {docsLoading ? (
            <ListSkeleton label={t('loading')} contained={false} />
          ) : docsLoadError ? (
            <StatePanel
              icon={AlertCircle}
              tone="error"
              title={t('loadError')}
              action={
                <Button variant="secondary" size="sm" onClick={() => void loadDocs(true)}>
                  {tCommon('retry')}
                </Button>
              }
              className="rounded-none py-12 ring-0"
            />
          ) : docs.length === 0 ? (
            <StatePanel
              icon={FileText}
              title={t('noDocuments')}
              description={t('emptyHint')}
              className="rounded-none py-14 ring-0"
            />
          ) : filteredAndSorted.length === 0 ? (
            <StatePanel
              icon={Search}
              title={t('noSearchResults')}
              compact
              className="rounded-none py-12 ring-0"
            />
          ) : (
            <div>
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,.45fr)_8rem_7.5rem_5rem] gap-4 border-b border-border/70 bg-secondary/20 px-4 py-2 text-[0.6875rem] font-medium text-muted-foreground md:grid">
                <span>{t('filename')}</span>
                <span>{t('location')}</span>
                <span>{t('status')}</span>
                <span>{t('date')}</span>
                <span className="text-right">{t('actions')}</span>
              </div>
              {filteredAndSorted.map((doc) => (
                <ListRow
                  key={doc.id}
                  className="group/row grid min-h-14 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 px-4 py-2.5 transition-colors duration-150 ease-out hover:bg-secondary/25 md:grid-cols-[minmax(0,1fr)_minmax(8rem,.45fr)_8rem_7.5rem_5rem] md:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors duration-150 group-hover/row:text-foreground">
                      <FileText aria-hidden="true" className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium">{doc.original_filename}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:hidden">
                        <span>{locationNames.get(doc.location_id ?? '') ?? '—'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dateFormatter.format(new Date(doc.created_at))}</span>
                        <DocStatusBadge status={doc.status} />
                      </div>
                    </div>
                  </div>
                  <span className="hidden truncate text-[0.8125rem] text-muted-foreground md:block">
                    {locationNames.get(doc.location_id ?? '') ?? '—'}
                  </span>
                  <div className="hidden md:block">
                    <DocStatusBadge status={doc.status} />
                  </div>
                  <span className="hidden text-[0.8125rem] text-muted-foreground md:block">
                    {dateFormatter.format(new Date(doc.created_at))}
                  </span>
                  <div className="flex shrink-0 justify-end gap-0.5 self-start transition-opacity duration-150 ease-out md:self-center md:opacity-0 md:group-hover/row:opacity-100 md:group-focus-within/row:opacity-100">
                    {isPdf(doc) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                      className="h-8 w-8"
                      title={t('download')}
                      aria-label={`${t('download')}: ${doc.original_filename}`}
                      onClick={() =>
                        void downloadFromStorage(doc.storage_path, doc.original_filename)
                      }
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </ListRow>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
