import { apiRequest } from "@/lib/api";
import type {
  ChartInitializationResponse,
  LedgerAccount,
  LedgerAccountCreatePayload,
  LedgerAccountListQuery,
  LedgerAccountListResponse,
  LedgerAccountUpdatePayload,
} from "@/types/ledger-account";

export async function listLedgerAccounts(
  companyId: string,
  query: LedgerAccountListQuery = {},
): Promise<LedgerAccountListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (query.search) {
    searchParameters.set(
      "search",
      query.search,
    );
  }

  if (query.accountType) {
    searchParameters.set(
      "account_type",
      query.accountType,
    );
  }

  if (query.reportCategory) {
    searchParameters.set(
      "report_category",
      query.reportCategory,
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

  return apiRequest<LedgerAccountListResponse>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}/chart-of-accounts${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function initializeChartOfAccounts(
  companyId: string,
): Promise<ChartInitializationResponse> {
  return apiRequest<ChartInitializationResponse>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}/chart-of-accounts/initialize`,
    {
      method: "POST",
    },
  );
}

export async function createLedgerAccount(
  companyId: string,
  payload: LedgerAccountCreatePayload,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>(
    `/api/companies/${encodeURIComponent(
      companyId,
    )}/chart-of-accounts`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateLedgerAccount(
  accountId: string,
  payload: LedgerAccountUpdatePayload,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>(
    `/api/ledger-accounts/${encodeURIComponent(
      accountId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function deactivateLedgerAccount(
  accountId: string,
): Promise<LedgerAccount> {
  return apiRequest<LedgerAccount>(
    `/api/ledger-accounts/${encodeURIComponent(
      accountId,
    )}/deactivate`,
    {
      method: "PATCH",
    },
  );
}