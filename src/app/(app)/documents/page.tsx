'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { UploadCloud, Loader2, FileText, Download, Eye } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { DOCUMENTS_BUCKET, downloadFromStorage, sha256Hex } from '@/lib/storage';
import { DOC_STATUS_POLL_MS } from '@/lib/config';
import type { DbLocation, DocumentRow } from '@/lib/supabase/types';
import { resolveDocumentUploadLocation } from '@/lib/document-upload-location';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DocStatusBadge } from '@/components/documents/doc-status-badge';
import { cn } from '@/lib/utils';

function isPdf(doc: DocumentRow): boolean {
  return doc.mime_type === 'application/pdf' || doc.original_filename.toLowerCase().endsWith('.pdf');
}

export default function DocumentsPage() {
  const t = useTranslations('documents');
  const supabase = getSupabaseBrowserClient();
  const { clientId } = useAuth();

  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [locations, setLocations] = useState<DbLocation[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'kind'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(25)
      .returns<DocumentRow[]>();
    setDocs(data ?? []);
  }, [supabase, clientId]);

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

  async function handlePreview(storagePath: string) {
    const { data } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  // Initial load + poll every ~10s so statuses update as the backend processes
  // uploads (no realtime websocket needed in this phase).
  useEffect(() => {
    void loadDocs();
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
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploadDisabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
          dragging ? 'border-accent bg-accent/10' : 'border-border bg-card/50',
          uploadDisabled && 'cursor-not-allowed opacity-70',
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">{uploading ? t('uploading') : t('dropzone')}</p>
        <p className="text-xs text-muted-foreground">{t('or')}</p>
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
          variant="accent"
          onClick={() => inputRef.current?.click()}
          disabled={uploadDisabled || uploading}
        >
          {t('chooseFile')}
        </Button>
      </div>

      {!locationsLoading && locations.length === 1 && uploadLocation.kind === 'ready' && (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('locationAutomatic', { location: uploadLocation.location.name })}
        </p>
      )}

      {!locationsLoading && locations.length > 1 && (
        <div className="mt-4 max-w-md">
          <label htmlFor="document-location" className="mb-1.5 block text-sm font-medium">
            {t('locationLabel')}
          </label>
          <select
            id="document-location"
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            required
            disabled={uploading}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">{t('locationPlaceholder')}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
                {location.address ? ` - ${location.address}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {!locationsLoading && uploadLocation.kind === 'missing' && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('locationUnavailable')}
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Recently uploaded list with live status. */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t('recent')}</h2>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'kind')}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="date">{t('sortByDate')}</option>
            <option value="kind">{t('sortByKind')}</option>
          </select>
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noDocuments')}</p>
        ) : (
          <div className="space-y-2">
            {filteredAndSorted.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{doc.original_filename}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DocStatusBadge status={doc.status} />
                    {isPdf(doc) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={t('preview')}
                        onClick={() => void handlePreview(doc.storage_path)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('download')}
                      onClick={() => void downloadFromStorage(doc.storage_path, doc.original_filename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
