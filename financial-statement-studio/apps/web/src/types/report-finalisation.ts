import type {
  FinancialReport,
} from "@/types/financial-report";

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

export type FinancialReportVersionDetail =
  FinancialReportVersionSummary & {
    approval_notes: string | null;

    snapshot_json: string;
    snapshot: Record<string, unknown>;
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