// Hand-written types mirroring the Supabase tables/columns the portal reads.
// Only columns documented in the spec are declared here — nothing invented.
// Where the exact schema of a joined table is not fully specified, the type is
// intentionally loose and flagged with a TODO.

export type DocumentStatus =
  | 'uploaded'
  | 'classified'
  | 'extracting'
  | 'extracted'
  | 'failed'
  | 'archived';

export type DatapointValueStatus =
  | 'draft'
  | 'needs_review'
  | 'qa_approved'
  | 'superseded'
  | 'rejected';

export type DataGapStatus = 'open' | 'requested' | 'filled' | 'waived';

export type DataGapReason =
  | 'missing_value'
  | 'expired_evidence'
  | 'conflict'
  | 'needs_site_data'
  | 'no_datapoint_in_catalog';

export interface Contact {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string | null;
  is_portal_user: boolean;
  auth_user_id: string | null;
  language: string | null; // char(2)
  email_status: string | null;
}

export interface Client {
  id: string;
  name: string;
  registration_no: string | null;
  vat_no: string | null;
  country: string | null;
  address: string | null;
  nace_code: string | null;
  employee_band: string | null;
  legal_form: string | null;
  reporting_basis: string | null;
  main_country: string | null;
  total_assets_eur: number | null;
  revenue_eur: number | null;
  phase: string | null;
  reporting_period: string | null;
}

export interface DbLocation {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  country: string | null;
  is_primary: boolean;
}

export interface DocumentRow {
  id: string;
  client_id: string;
  location_id: string | null;
  storage_path: string;
  original_filename: string;
  sha256: string;
  mime_type: string | null;
  doc_kind: string | null;
  reporting_period: string | null;
  status: DocumentStatus;
  created_at: string;
}

export interface Evidence {
  id: string;
  client_id: string;
  document_id: string | null;
  kind: string | null;
  title: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  status: string | null;
}

export interface FrameworkDatapoint {
  id: string;
  code: string | null;
  module: string | null;
  label: string | null;
  unit: string | null;
  data_type: string | null;
  // TODO: exact framework_datapoints schema not fully specified — add columns as needed.
}

export interface ClientDatapointValue {
  id: string;
  client_id: string;
  datapoint_id: string;
  reporting_period: string | null;
  dimensions: Record<string, unknown> | null;
  value_num: number | null;
  value_bool: boolean | null;
  value_text: string | null;
  value_json: unknown | null;
  unit: string | null;
  applicability_status: string | null;
  provenance: string | null;
  sensitivity: string | null;
  status: DatapointValueStatus;
  site_id?: string | null;
}

// Payload the portal inserts for a client-entered value (fills a data gap).
export type NewClientDatapointValue = {
  client_id: string;
  datapoint_id: string;
  reporting_period: string | null;
  dimensions: Record<string, unknown>;
  value_num?: number | null;
  value_bool?: boolean | null;
  value_text?: string | null;
  unit?: string | null;
  applicability_status: string;
  provenance: string;
  status: DatapointValueStatus;
  site_id: string | null;
};

export interface QuestionnaireQuestion {
  id: string;
  question_text: string | null;
  dimension_filter: Record<string, unknown> | null;
  // TODO: exact questionnaire_questions schema not fully specified.
}

export interface DataGap {
  id: string;
  client_id: string;
  context_kind: string | null;
  context_id: string | null;
  datapoint_id: string | null;
  question_id: string | null;
  reporting_period: string | null;
  reason: DataGapReason | null;
  status: DataGapStatus;
  requested_from_contact: string | null;
}

export interface Questionnaire {
  id: string;
  client_id: string;
  buyer_name: string | null;
  due_date: string | null;
  status: string | null;
}

export interface QuestionnaireExport {
  id: string;
  questionnaire_id: string | null;
  client_id: string;
  format: string | null;
  storage_path: string | null;
  output_mode: string | null;
  status: string | null;
}

export interface ReportRow {
  id: string;
  client_id: string;
  reporting_period: string | null;
  version: number | null;
  language: string | null;
  output_mode: string | null; // always 'aligned_draft' in year 1
  status: string | null;
  storage_path_docx: string | null;
  storage_path_pdf: string | null;
}

export interface PortalNotification {
  id: string;
  client_id: string;
  contact_id: string | null;
  kind: string | null;
  title: string | null;
  body: string | null;
  read_at: string | null;
}

export interface ClientAttestation {
  id: string;
  client_id: string;
  report_id: string | null;
  questionnaire_export_id: string | null;
  datapoint_value_id: string | null;
  kind: string | null;
  statement_text: string | null;
  statement_version: string | null;
  attested_by: string | null;
  attested_name: string | null;
  attested_at: string | null;
}

// New attestation rows the portal inserts (id/attested_at set by DB defaults where applicable).
export type NewClientAttestation = Omit<ClientAttestation, 'id'>;
