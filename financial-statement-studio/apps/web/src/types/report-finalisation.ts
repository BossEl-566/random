import type {
  FinancialReport,
} from "@/types/financial-report";

export type SnapshotDecimal =
  | string
  | number;

export type ReportRevisionMetadata = {
  revision_series_id: string | null;
  revision_number: number;

  supersedes_report_id: string | null;
  revision_reason: string | null;

  accountant_name: string | null;
  finalised_by: string | null;
  finalised_at: string | null;
};

export type FinalisationFinancialReport =
  FinancialReport &
    ReportRevisionMetadata;

export type FinalisationCheck = {
  code: string;
  title: string;
  detail: string;
};

export type ReportFinalisationReadiness = {
  financial_report_id: string;
  report_status: string;

  can_finalise: boolean;

  posted_entry_count: number;
  draft_entry_count: number;
  active_note_count: number;

  trial_balance_is_balanced: boolean;

  tax_calculation_count: number;
  draft_tax_calculation_count: number;

  tax_reconciliation_status: string;

  tax_reconciliation_difference:
    SnapshotDecimal;

  blockers: FinalisationCheck[];
  warnings: FinalisationCheck[];

  checked_at: string;
};

export type FinaliseFinancialReportPayload = {
  accountant_name: string;
  finalised_by: string;
  approval_notes?: string | null;
};

export type FinancialReportVersionSummary = {
  id: string;
  financial_report_id: string;

  revision_series_id: string;
  revision_number: number;

  finalised_at: string;
  finalised_by: string;
  accountant_name: string;

  snapshot_checksum: string;

  created_at: string;
};

export type FinalisationTaxCalculationSnapshot = {
  id: string;

  financial_report_id: string;
  tax_rule_id: string;

  calculation_date: string;

  tax_base: SnapshotDecimal;
  tax_amount: SnapshotDecimal;

  currency: string;

  rule_code_snapshot: string;
  rule_name_snapshot: string;
  tax_type_snapshot: string;

  calculation_method_snapshot:
    | "percentage"
    | "fixed_amount"
    | string;

  rate_applied:
    | SnapshotDecimal
    | null;

  fixed_amount_applied:
    | SnapshotDecimal
    | null;

  calculation_details_json:
    | string
    | null;

  status: string;
  calculated_at: string;
};

export type FinalisationTaxReconciliationSnapshot = {
  financial_report_id: string;
  currency: string;
  as_of: string;

  profit_before_tax:
    SnapshotDecimal;

  ledger_taxation:
    SnapshotDecimal;

  configured_taxation:
    SnapshotDecimal;

  confirmed_configured_taxation:
    SnapshotDecimal;

  draft_configured_taxation:
    SnapshotDecimal;

  difference:
    SnapshotDecimal;

  ledger_profit_after_tax:
    SnapshotDecimal;

  configured_profit_after_tax:
    SnapshotDecimal;

  status: string;
  requires_attention: boolean;
};

export type FinancialReportSnapshot = {
  snapshot_format_version?: number;

  tax_calculations?:
    FinalisationTaxCalculationSnapshot[];

  tax_reconciliation?:
    FinalisationTaxReconciliationSnapshot;

  [key: string]: unknown;
};

export type FinancialReportVersionDetail =
  FinancialReportVersionSummary & {
    approval_notes: string | null;

    snapshot_json: string;
    snapshot: FinancialReportSnapshot;
  };

export type FinancialReportVersionListResponse = {
  financial_report_id: string;
  revision_series_id: string;

  items: FinancialReportVersionSummary[];
  total: number;
};

export type FinaliseFinancialReportResponse = {
  financial_report_id: string;
  report_status: string;

  revision_series_id: string;
  revision_number: number;

  finalised_at: string;
  accountant_name: string;
  finalised_by: string;

  version: FinancialReportVersionSummary;
};

export type CreateFinancialReportRevisionPayload = {
  revision_reason: string;
  title?: string | null;
};