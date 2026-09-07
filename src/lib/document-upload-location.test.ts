import { describe, expect, it } from 'vitest';
import type { DbLocation } from './supabase/types';
import { resolveDocumentUploadLocation } from './document-upload-location';

const primary: DbLocation = {
  id: 'location-primary',
  client_id: 'client-a',
  name: 'Primary',
  address: null,
  country: 'SI',
  is_primary: true,
};

const secondary: DbLocation = {
  ...primary,
  id: 'location-secondary',
  name: 'Secondary',
  is_primary: false,
};

describe('resolveDocumentUploadLocation', () => {
  it('automatically resolves one primary location', () => {
    expect(resolveDocumentUploadLocation([primary], '')).toEqual({
      kind: 'ready',
      location: primary,
    });
  });

  it('requires a selection when multiple locations exist', () => {
    expect(resolveDocumentUploadLocation([primary, secondary], '')).toEqual({
      kind: 'selection_required',
    });

    expect(
      resolveDocumentUploadLocation([primary, secondary], secondary.id),
    ).toEqual({ kind: 'ready', location: secondary });
  });

  it('rejects a selected location outside the client location set', () => {
    expect(
      resolveDocumentUploadLocation([primary, secondary], 'foreign-location'),
    ).toEqual({ kind: 'invalid_selection' });
  });

  it('rejects a client without a usable primary location', () => {
    expect(resolveDocumentUploadLocation([], '')).toEqual({ kind: 'missing' });
    expect(resolveDocumentUploadLocation([secondary], '')).toEqual({ kind: 'missing' });
  });
});
