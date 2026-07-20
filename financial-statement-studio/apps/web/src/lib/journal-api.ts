import { apiRequest } from "@/lib/api";
import type {
  JournalEntry,
  JournalEntryCreatePayload,
  JournalEntryListQuery,
  JournalEntryListResponse,
  JournalEntryUpdatePayload,
  JournalEntryVoidPayload,
  TrialBalance,
} from "@/types/journal-entry";

export async function listJournalEntries(
  reportId: string,
  query: JournalEntryListQuery = {},
): Promise<JournalEntryListResponse> {
  const searchParameters =
    new URLSearchParams();

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

  if (query.entryType) {
    searchParameters.set(
      "entry_type",
      query.entryType,
    );
  }

  if (query.dateFrom) {
    searchParameters.set(
      "date_from",
      query.dateFrom,
    );
  }

  if (query.dateTo) {
    searchParameters.set(
      "date_to",
      query.dateTo,
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

  return apiRequest<JournalEntryListResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/journal-entries${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export async function getJournalEntry(
  entryId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(
    `/api/journal-entries/${encodeURIComponent(
      entryId,
    )}`,
  );
}

export async function createJournalEntry(
  reportId: string,
  payload: JournalEntryCreatePayload,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/journal-entries`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateJournalEntry(
  entryId: string,
  payload: JournalEntryUpdatePayload,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(
    `/api/journal-entries/${encodeURIComponent(
      entryId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}

export async function postJournalEntry(
  entryId: string,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(
    `/api/journal-entries/${encodeURIComponent(
      entryId,
    )}/post`,
    {
      method: "POST",
    },
  );
}

export async function voidJournalEntry(
  entryId: string,
  payload: JournalEntryVoidPayload,
): Promise<JournalEntry> {
  return apiRequest<JournalEntry>(
    `/api/journal-entries/${encodeURIComponent(
      entryId,
    )}/void`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getTrialBalance(
  reportId: string,
  asOf?: string,
): Promise<TrialBalance> {
  const searchParameters =
    new URLSearchParams();

  if (asOf) {
    searchParameters.set(
      "as_of",
      asOf,
    );
  }

  const queryString =
    searchParameters.toString();

  return apiRequest<TrialBalance>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/trial-balance${
      queryString ? `?${queryString}` : ""
    }`,
  );
}