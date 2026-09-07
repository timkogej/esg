import type { ClientDatapointValue } from '@/lib/supabase/types';

// Render a datapoint value for display based on which typed column is populated.
export function formatDatapointValue(v: Pick<
  ClientDatapointValue,
  'value_num' | 'value_bool' | 'value_text' | 'value_json'
>): string {
  if (v.value_num !== null && v.value_num !== undefined) {
    return new Intl.NumberFormat().format(v.value_num);
  }
  if (v.value_bool !== null && v.value_bool !== undefined) {
    return v.value_bool ? '✓' : '✕';
  }
  if (v.value_text) return v.value_text;
  if (v.value_json !== null && v.value_json !== undefined) {
    return typeof v.value_json === 'string'
      ? v.value_json
      : JSON.stringify(v.value_json);
  }
  return '—';
}
