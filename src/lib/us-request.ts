import type { SupabaseClient } from '@supabase/supabase-js';

// Same bucket as src/lib/storage.ts (not imported: that module pulls in the browser client).
const DOCUMENTS_BUCKET = 'documents';

// US buyer-request intake (pilot). The browser never chooses an actor or a path: it calls
// public.us_request_upload (actor = the logged-in user), receives the server-defined source key,
// and uploads the file there. A server-side worker copies and verifies it afterwards.

export const US_MAX_BYTES = 10 * 1024 * 1024;
// A reservation that is still waiting after this long is shown as stalled (upload likely interrupted).
export const US_STALL_MS = 60 * 60 * 1000;

const CONTENT_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

export type UsFileProblem = 'type' | 'size' | 'empty';

export function usContentType(filename: string): string | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return filename.includes('.') ? (CONTENT_TYPES[ext] ?? null) : null;
}

// Client-side convenience check only; the server sniffs the real content type again.
export function validateUsFile(file: { name: string; size: number }): UsFileProblem | null {
  if (file.size < 1) return 'empty';
  if (file.size > US_MAX_BYTES) return 'size';
  return usContentType(file.name) ? null : 'type';
}

export interface UsIds {
  operationId: string;
  documentId: string;
}
// UUIDs satisfy the server's operation-id rule (letters, digits, hyphen; 4-64 characters).
export function newUsIds(random: () => string = () => crypto.randomUUID()): UsIds {
  return { operationId: random(), documentId: random() };
}

export type UsPhase = 'reserved' | 'registered';
export interface UsRequestRow {
  operation_id: string;
  document_id: string;
  phase: UsPhase;
  created_at: string;
}
export interface UsOverview {
  enabled: boolean;
  requests: UsRequestRow[];
}

// waiting   = reserved, file being uploaded or copied
// stalled   = reserved for too long (probably interrupted)
// received  = file verified and registered, being checked
// ready     = a questionnaire exists for this request
export type UsStage = 'waiting' | 'stalled' | 'received' | 'ready';

export function usRequestStage(input: {
  phase: UsPhase;
  createdAt: string;
  now: number;
  isReady: boolean;
}): UsStage {
  if (input.isReady) return 'ready';
  if (input.phase === 'registered') return 'received';
  const age = input.now - new Date(input.createdAt).getTime();
  return Number.isFinite(age) && age > US_STALL_MS ? 'stalled' : 'waiting';
}

export type UsFailure = 'not_enabled' | 'invalid' | 'conflict' | 'unknown';

// Maps the database exception text to a user-facing category (the text itself is never shown).
export function classifyUsError(error: { message?: string; code?: string } | null | undefined): UsFailure {
  const text = `${error?.message ?? ''}`;
  if (/US_UNAUTHORIZED|US_PORTAL_FORBIDDEN/.test(text) || error?.code === '42501') return 'not_enabled';
  if (/US_MISSING_ID|US_INVALID/.test(text)) return 'invalid';
  if (/US_RESERVATION_CONFLICT/.test(text)) return 'conflict';
  return 'unknown';
}

export class UsRequestError extends Error {
  constructor(public readonly failure: UsFailure) {
    super(failure);
    this.name = 'UsRequestError';
  }
}

export interface UsReservation {
  sourceKey: string;
}

export async function reserveUsUpload(supabase: SupabaseClient, ids: UsIds): Promise<UsReservation> {
  const { data, error } = await supabase.rpc('us_request_upload', {
    p_operation_id: ids.operationId,
    p_document_id: ids.documentId,
  });
  if (error) throw new UsRequestError(classifyUsError(error));
  const sourceKey = (data as { source_key?: unknown } | null)?.source_key;
  if (typeof sourceKey !== 'string' || !sourceKey.startsWith('clients/')) throw new UsRequestError('unknown');
  return { sourceKey };
}

// Uploads to the server-defined key. "Already exists" means an earlier attempt of the SAME
// reservation got through, so a retry is safe and counts as success.
export async function uploadUsSource(supabase: SupabaseClient, sourceKey: string, file: File): Promise<void> {
  const contentType = usContentType(file.name);
  if (!contentType) throw new UsRequestError('invalid');
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(sourceKey, file, { upsert: false, contentType });
  if (!error) return;
  const status = (error as { statusCode?: string | number }).statusCode;
  if (String(status) === '409' || /already exists/i.test(error.message ?? '')) return;
  throw new UsRequestError('unknown');
}

export async function loadUsOverview(supabase: SupabaseClient): Promise<UsOverview> {
  const { data, error } = await supabase.rpc('us_my_requests');
  if (error) {
    if (classifyUsError(error) === 'not_enabled') return { enabled: false, requests: [] };
    throw new UsRequestError('unknown');
  }
  const o = data as Partial<UsOverview> | null;
  return { enabled: o?.enabled === true, requests: Array.isArray(o?.requests) ? o.requests : [] };
}

// Which of these requests already went through Gate B. The portal client may read its OWN documents rows
// (policy client_read) but not `questionnaires` (admin-only select), so "ready" is derived from the documents
// row that Gate B creates with the request's document id (status classified, doc_kind questionnaire).
export async function loadReadyDocumentIds(supabase: SupabaseClient, documentIds: string[]): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();
  const { data, error } = await supabase.from('documents').select('id').in('id', documentIds);
  if (error) throw new UsRequestError('unknown');
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}
