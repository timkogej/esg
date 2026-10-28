import { describe, expect, it } from 'vitest';
import {
  US_MAX_BYTES,
  US_STALL_MS,
  classifyUsError,
  newUsIds,
  usContentType,
  usRequestStage,
  validateUsFile,
} from './us-request';

describe('validateUsFile', () => {
  it('accepts xlsx, docx and pdf up to the limit', () => {
    for (const name of ['a.xlsx', 'B.DOCX', 'c.pdf']) expect(validateUsFile({ name, size: 1000 })).toBeNull();
    expect(validateUsFile({ name: 'a.pdf', size: US_MAX_BYTES })).toBeNull();
  });
  it('rejects other types, empty and oversize files', () => {
    expect(validateUsFile({ name: 'a.csv', size: 10 })).toBe('type');
    expect(validateUsFile({ name: 'noext', size: 10 })).toBe('type');
    expect(validateUsFile({ name: 'a.xlsm', size: 10 })).toBe('type');
    expect(validateUsFile({ name: 'a.pdf', size: 0 })).toBe('empty');
    expect(validateUsFile({ name: 'a.pdf', size: US_MAX_BYTES + 1 })).toBe('size');
  });
  it('maps extensions to the bucket content types', () => {
    expect(usContentType('x.xlsx')).toContain('spreadsheetml');
    expect(usContentType('x.exe')).toBeNull();
  });
});

describe('newUsIds', () => {
  it('produces ids that fit the server rule', () => {
    const { operationId, documentId } = newUsIds();
    expect(operationId).toMatch(/^[A-Za-z0-9-]{4,64}$/);
    expect(documentId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(operationId).not.toBe(documentId);
  });
});

describe('usRequestStage', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const fresh = new Date(now - 60_000).toISOString();
  const old = new Date(now - US_STALL_MS - 1000).toISOString();
  it('a questionnaire always wins', () => {
    expect(usRequestStage({ phase: 'reserved', createdAt: old, now, isReady: true })).toBe('ready');
  });
  it('registered without questionnaire is received', () => {
    expect(usRequestStage({ phase: 'registered', createdAt: old, now, isReady: false })).toBe('received');
  });
  it('reserved is waiting, then stalled after the limit', () => {
    expect(usRequestStage({ phase: 'reserved', createdAt: fresh, now, isReady: false })).toBe('waiting');
    expect(usRequestStage({ phase: 'reserved', createdAt: old, now, isReady: false })).toBe('stalled');
  });
  it('an unreadable date never claims stalled', () => {
    expect(usRequestStage({ phase: 'reserved', createdAt: 'nonsense', now, isReady: false })).toBe('waiting');
  });
});

describe('classifyUsError', () => {
  it('groups database exceptions into user-facing categories', () => {
    expect(classifyUsError({ message: 'US_UNAUTHORIZED' })).toBe('not_enabled');
    expect(classifyUsError({ message: 'x', code: '42501' })).toBe('not_enabled');
    expect(classifyUsError({ message: 'US_MISSING_ID' })).toBe('invalid');
    expect(classifyUsError({ message: 'US_RESERVATION_CONFLICT' })).toBe('conflict');
    expect(classifyUsError({ message: 'boom' })).toBe('unknown');
    expect(classifyUsError(null)).toBe('unknown');
  });
});
