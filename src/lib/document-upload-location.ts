import type { DbLocation } from './supabase/types';

export type DocumentUploadLocationState =
  | { kind: 'ready'; location: DbLocation }
  | { kind: 'selection_required' }
  | { kind: 'invalid_selection' }
  | { kind: 'missing' };

export function resolveDocumentUploadLocation(
  locations: DbLocation[],
  selectedLocationId: string,
): DocumentUploadLocationState {
  if (locations.length === 0) return { kind: 'missing' };

  if (locations.length === 1) {
    return locations[0].is_primary
      ? { kind: 'ready', location: locations[0] }
      : { kind: 'missing' };
  }

  if (!selectedLocationId) return { kind: 'selection_required' };

  const selected = locations.find((location) => location.id === selectedLocationId);
  return selected
    ? { kind: 'ready', location: selected }
    : { kind: 'invalid_selection' };
}
