import type {
  JournalEntry,
} from "@/types/journal-entry";
export type TaxCalculationMethod =
  | "percentage"
  | "fixed_amount";

export type TaxRuleStatus =
  | "draft"
  | "active"
  | "retired";

export const TAX_CALCULATION_METHOD_OPTIONS = [
  {
    value: "percentage",
    label: "Percentage of tax base",
  },
  {
    value: "fixed_amount",
    label: "Fixed amount",
  },
] as const;

export const TAX_RULE_STATUS_OPTIONS = [
  {
    value: "draft",
    label: "Draft",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "retired",
    label: "Retired",
  },
] as const;

export type TaxProfile = {
  id: string;
  company_id: string;

  profile_code: string;
  profile_name: string;

  jurisdiction_country_code: string;
  jurisdiction_name: string;

  tax_identifier: string | null;
  taxpayer_category: string | null;
  description: string | null;

  is_default: boolean;
  is_active: boolean;

  created_at: string;
  updated_at: string;
};

export type TaxProfileCreatePayload = {
  company_id: string;

  profile_code: string;
  profile_name: string;

  jurisdiction_country_code?: string;
  jurisdiction_name?: string;

  tax_identifier?: string | null;
  taxpayer_category?: string | null;
  description?: string | null;

  is_default?: boolean;
  is_active?: boolean;
};

export type TaxProfileUpdatePayload = {
  profile_code?: string;
  profile_name?: string;

  jurisdiction_country_code?: string;
  jurisdiction_name?: string;

  tax_identifier?: string | null;
  taxpayer_category?: string | null;
  description?: string | null;
};

export type TaxProfileListResponse = {
  company_id: string;
  items: TaxProfile[];
  total: number;
};

export type TaxRule = {
  id: string;
  tax_profile_id: string;

  rule_code: string;
  rule_name: string;
  tax_type: string;

  calculation_method:
    TaxCalculationMethod;

  rate_percentage: string | null;
  fixed_amount: string | null;

  currency: string;

  effective_from: string;
  effective_to: string | null;

  taxpayer_category: string | null;
  business_activity: string | null;

  status: TaxRuleStatus;

  source_reference: string | null;
  notes: string | null;

  is_system_rule: boolean;
  display_order: number;

  created_at: string;
  updated_at: string;
};

export type TaxRuleCreatePayload = {
  rule_code: string;
  rule_name: string;
  tax_type: string;

  calculation_method:
    TaxCalculationMethod;

  rate_percentage: string | null;
  fixed_amount: string | null;

  currency: string;

  effective_from: string;
  effective_to?: string | null;

  taxpayer_category?: string | null;
  business_activity?: string | null;

  source_reference?: string | null;
  notes?: string | null;

  display_order?: number;
};

export type TaxRuleUpdatePayload =
  Partial<TaxRuleCreatePayload>;

export type TaxRuleListResponse = {
  tax_profile_id: string;
  items: TaxRule[];
  total: number;
};

export type TaxRuleRetirePayload = {
  effective_to: string;
};

export type TaxDecimal =
  | string
  | number;

export type TaxCalculationStatus =
  | "draft"
  | "confirmed";

export type TaxCalculationPreviewPayload = {
  tax_profile_id: string;
  rule_code: string;
  calculation_date: string;
  tax_base: string;
};

export type TaxCalculationPreview = {
  financial_report_id: string;
  tax_profile_id: string;
  tax_rule_id: string;

  calculation_date: string;

  rule_code: string;
  rule_name: string;
  tax_type: string;

  calculation_method:
    TaxCalculationMethod;

  tax_base: TaxDecimal;
  rate_applied: TaxDecimal | null;
  fixed_amount_applied:
    TaxDecimal | null;
  tax_amount: TaxDecimal;

  currency: string;
  generated_at: string;
};

export type TaxCalculation = {
  id: string;

  financial_report_id: string;
  tax_rule_id: string;

  calculation_date: string;

  tax_base: TaxDecimal;
  tax_amount: TaxDecimal;
  currency: string;

  rule_code_snapshot: string;
  rule_name_snapshot: string;
  tax_type_snapshot: string;

  calculation_method_snapshot:
    TaxCalculationMethod;

  rate_applied: TaxDecimal | null;
  fixed_amount_applied:
    TaxDecimal | null;

  calculation_details_json:
    string | null;

  status: TaxCalculationStatus;
  calculated_at: string;

  created_at: string;
  updated_at: string;
};

export type TaxCalculationListResponse = {
  financial_report_id: string;
  items: TaxCalculation[];
  total: number;
};

export type TaxReconciliationStatus =
  | "not_configured"
  | "reconciled"
  | "under_posted"
  | "over_posted";

export type TaxReconciliation = {
  financial_report_id: string;
  currency: string;
  as_of: string;

  profit_before_tax: TaxDecimal;

  ledger_taxation: TaxDecimal;
  configured_taxation: TaxDecimal;

  confirmed_configured_taxation:
    TaxDecimal;

  draft_configured_taxation:
    TaxDecimal;

  difference: TaxDecimal;

  ledger_profit_after_tax:
    TaxDecimal;

  configured_profit_after_tax:
    TaxDecimal;

  status: TaxReconciliationStatus;
  requires_attention: boolean;

  calculations: TaxCalculation[];

  generated_at: string;
};

export type PostTaxAdjustmentPayload = {
  tax_expense_account_id: string;
  tax_payable_account_id: string;

  entry_date: string | null;

  reason: string;

  acknowledge_existing_taxation:
    boolean;
};

export type PostTaxAdjustmentResponse = {
  journal_entry: JournalEntry;
  reconciliation: TaxReconciliation;
};