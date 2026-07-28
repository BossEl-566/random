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