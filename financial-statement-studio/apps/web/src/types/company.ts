export const BUSINESS_TYPE_OPTIONS = [
  {
    value: "trading",
    label: "Trading",
  },
  {
    value: "service",
    label: "Service",
  },
  {
    value: "manufacturing",
    label: "Manufacturing",
  },
  {
    value: "retail",
    label: "Retail",
  },
  {
    value: "transport_logistics",
    label: "Transport and logistics",
  },
  {
    value: "church_nonprofit",
    label: "Church or nonprofit",
  },
  {
    value: "school",
    label: "School or educational institution",
  },
  {
    value: "other",
    label: "Other business",
  },
] as const;

export const REPORTING_BASIS_OPTIONS = [
  {
    value: "accrual",
    label: "Accrual basis",
  },
  {
    value: "cash",
    label: "Cash basis",
  },
  {
    value: "modified_cash",
    label: "Modified cash basis",
  },
] as const;

export type BusinessType =
  (typeof BUSINESS_TYPE_OPTIONS)[number]["value"];

export type ReportingBasis =
  (typeof REPORTING_BASIS_OPTIONS)[number]["value"];

export type Company = {
  id: string;
  name: string;
  business_type: BusinessType;
  registration_number: string | null;
  tin: string | null;
  ghana_card_number: string | null;
  address: string | null;
  telephone: string | null;
  email: string | null;
  default_currency: string;
  reporting_basis: ReportingBasis;
  logo_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyListResponse = {
  items: Company[];
  total: number;
  offset: number;
  limit: number;
};

export type CompanyCreatePayload = {
  name: string;
  business_type: BusinessType;
  registration_number?: string | null;
  tin?: string | null;
  ghana_card_number?: string | null;
  address?: string | null;
  telephone?: string | null;
  email?: string | null;
  default_currency: string;
  reporting_basis: ReportingBasis;
  logo_path?: string | null;
};

export type CompanyUpdatePayload =
  Partial<CompanyCreatePayload>;

export type CompanyListQuery = {
  search?: string;
  includeInactive?: boolean;
  offset?: number;
  limit?: number;
};