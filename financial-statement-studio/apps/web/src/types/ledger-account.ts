export const ACCOUNT_TYPE_OPTIONS = [
  {
    value: "asset",
    label: "Assets",
  },
  {
    value: "liability",
    label: "Liabilities",
  },
  {
    value: "equity",
    label: "Equity",
  },
  {
    value: "revenue",
    label: "Revenue and income",
  },
  {
    value: "expense",
    label: "Expenses",
  },
] as const;

export const REPORT_CATEGORY_OPTIONS = [
  {
    value: "revenue",
    label: "Revenue",
  },
  {
    value: "cost_of_sales",
    label: "Cost of sales",
  },
  {
    value: "direct_service_costs",
    label: "Direct service costs",
  },
  {
    value: "manufacturing_costs",
    label: "Manufacturing costs",
  },
  {
    value: "other_income",
    label: "Other income",
  },
  {
    value: "administrative_expenses",
    label: "Administrative expenses",
  },
  {
    value: "selling_distribution_expenses",
    label: "Selling and distribution expenses",
  },
  {
    value: "finance_costs",
    label: "Finance costs",
  },
  {
    value: "taxation",
    label: "Taxation",
  },
  {
    value: "current_assets",
    label: "Current assets",
  },
  {
    value: "non_current_assets",
    label: "Non-current assets",
  },
  {
    value: "current_liabilities",
    label: "Current liabilities",
  },
  {
    value: "non_current_liabilities",
    label: "Non-current liabilities",
  },
  {
    value: "equity",
    label: "Equity",
  },
] as const;

export const CASH_FLOW_CATEGORY_OPTIONS = [
  {
    value: "operating",
    label: "Operating activity",
  },
  {
    value: "investing",
    label: "Investing activity",
  },
  {
    value: "financing",
    label: "Financing activity",
  },
  {
    value: "non_cash",
    label: "Non-cash item",
  },
  {
    value: "not_applicable",
    label: "Not applicable",
  },
] as const;

export const NORMAL_BALANCE_OPTIONS = [
  {
    value: "debit",
    label: "Debit",
  },
  {
    value: "credit",
    label: "Credit",
  },
] as const;

export type AccountType =
  (typeof ACCOUNT_TYPE_OPTIONS)[number]["value"];

export type ReportCategory =
  (typeof REPORT_CATEGORY_OPTIONS)[number]["value"];

export type CashFlowCategory =
  (typeof CASH_FLOW_CATEGORY_OPTIONS)[number]["value"];

export type NormalBalance =
  (typeof NORMAL_BALANCE_OPTIONS)[number]["value"];

export const REPORT_CATEGORY_ACCOUNT_TYPE: Record<
  ReportCategory,
  AccountType
> = {
  revenue: "revenue",
  other_income: "revenue",

  cost_of_sales: "expense",
  direct_service_costs: "expense",
  manufacturing_costs: "expense",
  administrative_expenses: "expense",
  selling_distribution_expenses: "expense",
  finance_costs: "expense",
  taxation: "expense",

  current_assets: "asset",
  non_current_assets: "asset",

  current_liabilities: "liability",
  non_current_liabilities: "liability",

  equity: "equity",
};

export const ACCOUNT_TYPE_DEFAULT_NORMAL_BALANCE: Record<
  AccountType,
  NormalBalance
> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  equity: "credit",
  revenue: "credit",
};

export type LedgerAccount = {
  id: string;
  company_id: string;
  parent_account_id: string | null;

  account_code: string;
  account_name: string;

  account_type: AccountType;
  report_category: ReportCategory;
  cash_flow_category: CashFlowCategory | null;
  normal_balance: NormalBalance;

  description: string | null;

  is_system_account: boolean;
  is_cash_equivalent: boolean;
  is_active: boolean;
  display_order: number;

  created_at: string;
  updated_at: string;
};

export type LedgerAccountListResponse = {
  items: LedgerAccount[];
  total: number;
  offset: number;
  limit: number;
};

export type ChartInitializationResponse = {
  company_id: string;
  business_template: string;
  created_count: number;
  skipped_count: number;
  items: LedgerAccount[];
};

export type LedgerAccountCreatePayload = {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  report_category: ReportCategory;
  cash_flow_category?: CashFlowCategory | null;
  is_cash_equivalent?: boolean;
  normal_balance: NormalBalance;
  parent_account_id?: string | null;
  description?: string | null;
  display_order: number;
};

export type LedgerAccountUpdatePayload = Partial<
  LedgerAccountCreatePayload
>;

export type LedgerAccountListQuery = {
  search?: string;
  accountType?: AccountType;
  reportCategory?: ReportCategory;
  includeInactive?: boolean;
  offset?: number;
  limit?: number;
};