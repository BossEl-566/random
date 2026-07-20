import { apiRequest } from "@/lib/api";
import type {
  Company,
  CompanyCreatePayload,
  CompanyListQuery,
  CompanyListResponse,
  CompanyUpdatePayload,
} from "@/types/company";

export async function listCompanies(
  query: CompanyListQuery = {},
): Promise<CompanyListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (query.search) {
    searchParameters.set(
      "search",
      query.search,
    );
  }

  if (query.includeInactive) {
    searchParameters.set(
      "include_inactive",
      "true",
    );
  }

  if (query.offset !== undefined) {
    searchParameters.set(
      "offset",
      String(query.offset),
    );
  }

  if (query.limit !== undefined) {
    searchParameters.set(
      "limit",
      String(query.limit),
    );
  }

  const queryString =
    searchParameters.toString();

  return apiRequest<CompanyListResponse>(
    `/api/companies${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function createCompany(
  payload: CompanyCreatePayload,
): Promise<Company> {
  return apiRequest<Company>(
    "/api/companies",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateCompany(
  companyId: string,
  payload: CompanyUpdatePayload,
): Promise<Company> {
  return apiRequest<Company>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deactivateCompany(
  companyId: string,
): Promise<Company> {
  return apiRequest<Company>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}/deactivate`,
    {
      method: "PATCH",
    },
  );
}