import type {
  BusinessType,
} from "@/types/company";

export const REPORT_TYPE_OPTIONS = [
  {
    value: "annual_financial_statements",
    label: "Annual financial statements",
  },
  {
    value: "management_accounts",
    label: "Management accounts",
  },
  {
    value: "tax_computation",
    label: "Tax computation",
  },
  {
    value: "custom_report",
    label: "Custom financial report",
  },
] as const;

export const REPORT_STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "incomplete",
    label: "Incomplete",
  },
  {
    value: "ready_for_review",
    label: "Ready for review",
  },
  {
    value: "finalised",
    label: "Finalised",
  },
  {
    value: "printed",
    label: "Printed",
  },
  {
    value: "archived",
    label: "Archived",
  },
] as const;

export type ReportType =
  (typeof REPORT_TYPE_OPTIONS)[number]["value"];

export type ReportStatus =
  (typeof REPORT_STATUS_OPTIONS)[number]["value"];

export type FinancialReport = {
  id: string;
  company_id: string;
  comparison_report_id: string | null;

  title: string;
  report_type: ReportType;

  period_start: string;
  period_end: string;
  financial_year: number;

  currency: string;
  business_template: BusinessType;
  status: ReportStatus;

  accountant_report_text: string | null;
  finalised_at: string | null;

  created_at: string;
  updated_at: string;
};

export type FinancialReportListResponse = {
  items: FinancialReport[];
  total: number;
  offset: number;
  limit: number;
};

export type FinancialReportCreatePayload = {
  company_id: string;
  title?: string | null;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  currency?: string | null;
  business_template?: BusinessType | null;
  comparison_report_id?: string | null;
  accountant_report_text?: string | null;
};

export type FinancialReportUpdatePayload = {
  title?: string | null;
  report_type?: ReportType;
  period_start?: string;
  period_end?: string;
  currency?: string | null;
  business_template?: BusinessType | null;
  comparison_report_id?: string | null;
  accountant_report_text?: string | null;
};

export type FinancialReportListQuery = {
  companyId?: string;
  search?: string;
  status?: ReportStatus;
  includeArchived?: boolean;
  offset?: number;
  limit?: number;
};