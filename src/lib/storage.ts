'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SIGNED_URL_TTL } from '@/lib/config';

export const DOCUMENTS_BUCKET = 'documents';

// Some stored paths (e.g. reports.storage_path_docx / questionnaire_exports.storage_path)
// include a leading `documents/` bucket prefix, which would be duplicated when passed to
// storage.from('documents').createSignedUrl(...). Strip it first — the same normalization
// the existing n8n workflows apply before calling the Storage API.
export function normalizeDocumentPath(path: string): string {
  return path.replace(/^documents\//, '');
}

// Compute the SHA-256 of a file as a lowercase hex string, using the Web Crypto
// API. documents.sha256 is NOT NULL, so the portal must supply it on insert.
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Always use signed URLs for the private `documents` bucket — never public URLs.
export async function createSignedDocumentUrl(path: string, ttl = SIGNED_URL_TTL) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(normalizeDocumentPath(path), ttl);
  if (error || !data?.signedUrl) throw error ?? new Error('Failed to create signed URL');
  return data.signedUrl;
}

// Create a signed URL and trigger a browser download.
export async function downloadFromStorage(path: string, filename?: string) {
  const url = await createSignedDocumentUrl(path);
  const a = document.createElement('a');
  a.href = url;
  if (filename) a.download = filename;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
