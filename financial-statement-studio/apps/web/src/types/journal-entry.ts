export const JOURNAL_ENTRY_TYPE_OPTIONS = [
  {
    value: "opening_balance",
    label: "Opening balance",
  },
  {
    value: "standard",
    label: "Standard transaction",
  },
  {
    value: "adjusting",
    label: "Adjusting entry",
  },
  {
    value: "closing",
    label: "Closing entry",
  },
] as const;

export const JOURNAL_ENTRY_STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "posted",
    label: "Posted",
  },
  {
    value: "voided",
    label: "Voided",
  },
] as const;

export const JOURNAL_SOURCE_OPTIONS = [
  {
    value: "manual",
    label: "Manual entry",
  },
  {
    value: "imported",
    label: "Imported entry",
  },
  {
    value: "system",
    label: "System-generated entry",
  },
] as const;

export type JournalEntryType =
  (typeof JOURNAL_ENTRY_TYPE_OPTIONS)[number]["value"];

export type JournalEntryStatus =
  (typeof JOURNAL_ENTRY_STATUS_OPTIONS)[number]["value"];

export type JournalSource =
  (typeof JOURNAL_SOURCE_OPTIONS)[number]["value"];

export type MoneyValue =
  | string
  | number;

export type JournalLineInput = {
  ledger_account_id: string;
  description?: string | null;
  debit: string;
  credit: string;
};

export type JournalLine = {
  id: string;
  journal_entry_id: string;
  ledger_account_id: string;
  line_number: number;
  description: string | null;
  debit: MoneyValue;
  credit: MoneyValue;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  company_id: string;
  financial_report_id: string;

  sequence_number: number;
  entry_number: string;
  entry_date: string;
  entry_type: JournalEntryType;
  status: JournalEntryStatus;
  source: JournalSource;

  description: string;
  reference: string | null;

  posted_at: string | null;
  voided_at: string | null;
  void_reason: string | null;

  lines: JournalLine[];

  total_debit: MoneyValue;
  total_credit: MoneyValue;

  created_at: string;
  updated_at: string;
};

export type JournalEntryCreatePayload = {
  entry_date: string;
  entry_type: JournalEntryType;
  source: JournalSource;
  description: string;
  reference?: string | null;
  lines: JournalLineInput[];
};

export type JournalEntryUpdatePayload =
  Partial<JournalEntryCreatePayload>;

export type JournalEntryVoidPayload = {
  reason: string;
};

export type JournalEntryListResponse = {
  items: JournalEntry[];
  total: number;
  offset: number;
  limit: number;
};

export type JournalEntryListQuery = {
  search?: string;
  status?: JournalEntryStatus;
  entryType?: JournalEntryType;
  dateFrom?: string;
  dateTo?: string;
  offset?: number;
  limit?: number;
};

export type TrialBalanceLine = {
  ledger_account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  report_category: string;
  normal_balance: string;

  movement_debit: MoneyValue;
  movement_credit: MoneyValue;

  debit_balance: MoneyValue;
  credit_balance: MoneyValue;
};

export type TrialBalance = {
  financial_report_id: string;
  company_id: string;
  currency: string;
  as_of: string;

  posted_entry_count: number;

  items: TrialBalanceLine[];

  total_debit: MoneyValue;
  total_credit: MoneyValue;
  is_balanced: boolean;

  generated_at: string;
};