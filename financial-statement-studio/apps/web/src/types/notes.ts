export const NOTE_TYPE_OPTIONS = [
  {
    value: "accounting_policy",
    label: "Accounting policy",
  },
  {
    value: "statement_note",
    label: "Statement note",
  },
  {
    value: "general_disclosure",
    label: "General disclosure",
  },
] as const;

export const STATEMENT_NAME_OPTIONS = [
  {
    value: "profit_or_loss",
    label: "Profit or Loss",
  },
  {
    value: "financial_position",
    label: "Financial Position",
  },
  {
    value: "cash_flows",
    label: "Cash Flows",
  },
  {
    value: "changes_in_equity",
    label: "Changes in Equity",
  },
] as const;

export type NoteType =
  (typeof NOTE_TYPE_OPTIONS)[number]["value"];

export type StatementName =
  (typeof STATEMENT_NAME_OPTIONS)[number]["value"];

export const NOTE_TYPE_LABELS: Record<
  NoteType,
  string
> = {
  accounting_policy: "Accounting policy",
  statement_note: "Statement note",
  general_disclosure: "General disclosure",
};

export const STATEMENT_NAME_LABELS: Record<
  StatementName,
  string
> = {
  profit_or_loss: "Profit or Loss",
  financial_position: "Financial Position",
  cash_flows: "Cash Flows",
  changes_in_equity: "Changes in Equity",
};

export type DisclosureTemplate = {
  id: string;

  template_key: string;
  title: string;
  note_type: NoteType;

  statement_name: StatementName | null;
  statement_line_key: string | null;

  default_content: string;

  is_system_template: boolean;
  is_required: boolean;
  is_active: boolean;

  display_order: number;

  created_at: string;
  updated_at: string;
};

export type DisclosureTemplateListResponse = {
  items: DisclosureTemplate[];
  total: number;
};

export type DisclosureTemplateInitializationResponse = {
  created_count: number;
  skipped_count: number;
  items: DisclosureTemplate[];
};

export type DisclosureTemplateCreatePayload = {
  template_key: string;
  title: string;
  note_type: NoteType;

  statement_name?: StatementName | null;
  statement_line_key?: string | null;

  default_content?: string;

  is_required?: boolean;
  is_active?: boolean;

  display_order?: number;
};

export type DisclosureTemplateUpdatePayload =
  Partial<DisclosureTemplateCreatePayload>;

export type FinancialReportNote = {
  id: string;
  financial_report_id: string;
  template_id: string | null;

  note_number: number;

  title: string;
  note_type: NoteType;

  statement_name: StatementName | null;
  statement_line_key: string | null;

  content: string;

  is_active: boolean;

  created_at: string;
  updated_at: string;
};

export type FinancialReportNoteListResponse = {
  financial_report_id: string;
  items: FinancialReportNote[];
  total: number;
};

export type ReportNotesInitializationResponse = {
  financial_report_id: string;
  created_count: number;
  skipped_count: number;
  items: FinancialReportNote[];
};

export type FinancialReportNoteCreatePayload = {
  template_id?: string | null;
  note_number?: number;

  title?: string;
  note_type?: NoteType;

  statement_name?: StatementName | null;
  statement_line_key?: string | null;

  content?: string;

  is_active?: boolean;
};

export type FinancialReportNoteUpdatePayload =
  Partial<FinancialReportNoteCreatePayload>;

export type ReorderFinancialReportNotesPayload = {
  note_ids: string[];
};