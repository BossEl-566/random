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