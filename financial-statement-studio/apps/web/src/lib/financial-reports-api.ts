import { apiRequest } from "@/lib/api";
import type {
  FinancialReport,
  FinancialReportCreatePayload,
  FinancialReportListQuery,
  FinancialReportListResponse,
  FinancialReportUpdatePayload,
} from "@/types/financial-report";

export async function listFinancialReports(
  query: FinancialReportListQuery = {},
): Promise<FinancialReportListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (query.companyId) {
    searchParameters.set(
      "company_id",
      query.companyId,
    );
  }

  if (query.search) {
    searchParameters.set(
      "search",
      query.search,
    );
  }

  if (query.status) {
    searchParameters.set(
      "status",
      query.status,
    );
  }

  if (query.includeArchived) {
    searchParameters.set(
      "include_archived",
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

  return apiRequest<FinancialReportListResponse>(
    `/api/financial-reports${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function getFinancialReport(
  reportId: string,
): Promise<FinancialReport> {
  return apiRequest<FinancialReport>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}`,
  );
}

export async function createFinancialReport(
  payload: FinancialReportCreatePayload,
): Promise<FinancialReport> {
  return apiRequest<FinancialReport>(
    "/api/financial-reports",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateFinancialReport(
  reportId: string,
  payload: FinancialReportUpdatePayload,
): Promise<FinancialReport> {
  return apiRequest<FinancialReport>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}