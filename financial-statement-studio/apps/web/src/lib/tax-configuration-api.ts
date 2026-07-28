import { apiRequest } from "@/lib/api";
import type {
  TaxProfile,
  TaxProfileCreatePayload,
  TaxProfileListResponse,
  TaxProfileUpdatePayload,
  TaxRule,
  TaxRuleCreatePayload,
  TaxRuleListResponse,
  TaxRuleRetirePayload,
  TaxRuleStatus,
  TaxRuleUpdatePayload,
} from "@/types/tax-configuration";

export async function listTaxProfiles(
  companyId: string,
  includeInactive = false,
): Promise<TaxProfileListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (includeInactive) {
    searchParameters.set(
      "include_inactive",
      "true",
    );
  }

  const queryString =
    searchParameters.toString();

  return apiRequest<TaxProfileListResponse>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}/tax-profiles${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function getTaxProfile(
  profileId: string,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}`,
  );
}

export async function createTaxProfile(
  payload: TaxProfileCreatePayload,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    "/api/tax-profiles",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateTaxProfile(
  profileId: string,
  payload: TaxProfileUpdatePayload,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function setDefaultTaxProfile(
  profileId: string,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}/set-default`,
    {
      method: "POST",
    },
  );
}

export async function deactivateTaxProfile(
  profileId: string,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function reactivateTaxProfile(
  profileId: string,
): Promise<TaxProfile> {
  return apiRequest<TaxProfile>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}/reactivate`,
    {
      method: "POST",
    },
  );
}

export async function listTaxRules(
  profileId: string,
  ruleStatus?: TaxRuleStatus,
): Promise<TaxRuleListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (ruleStatus) {
    searchParameters.set(
      "status",
      ruleStatus,
    );
  }

  const queryString =
    searchParameters.toString();

  return apiRequest<TaxRuleListResponse>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}/rules${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function getTaxRule(
  ruleId: string,
): Promise<TaxRule> {
  return apiRequest<TaxRule>(
    `/api/tax-rules/${encodeURIComponent(
      ruleId,
    )}`,
  );
}

export async function createTaxRule(
  profileId: string,
  payload: TaxRuleCreatePayload,
): Promise<TaxRule> {
  return apiRequest<TaxRule>(
    `/api/tax-profiles/${encodeURIComponent(
      profileId,
    )}/rules`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateTaxRule(
  ruleId: string,
  payload: TaxRuleUpdatePayload,
): Promise<TaxRule> {
  return apiRequest<TaxRule>(
    `/api/tax-rules/${encodeURIComponent(
      ruleId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function activateTaxRule(
  ruleId: string,
): Promise<TaxRule> {
  return apiRequest<TaxRule>(
    `/api/tax-rules/${encodeURIComponent(
      ruleId,
    )}/activate`,
    {
      method: "POST",
    },
  );
}

export async function retireTaxRule(
  ruleId: string,
  payload: TaxRuleRetirePayload,
): Promise<TaxRule> {
  return apiRequest<TaxRule>(
    `/api/tax-rules/${encodeURIComponent(
      ruleId,
    )}/retire`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}