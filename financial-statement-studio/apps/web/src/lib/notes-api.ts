import { apiRequest } from "@/lib/api";
import type {
  DisclosureTemplateInitializationResponse,
  DisclosureTemplateListResponse,
  FinancialReportNote,
  FinancialReportNoteCreatePayload,
  FinancialReportNoteListResponse,
  FinancialReportNoteUpdatePayload,
  NoteType,
  ReorderFinancialReportNotesPayload,
  ReportNotesInitializationResponse,
} from "@/types/notes";

function jsonRequest(
  method: "POST" | "PATCH",
  payload?: unknown,
): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body:
      payload === undefined
        ? undefined
        : JSON.stringify(payload),
  };
}

export async function initializeDisclosureTemplates(): Promise<DisclosureTemplateInitializationResponse> {
  return apiRequest<DisclosureTemplateInitializationResponse>(
    "/api/disclosure-templates/initialize",
    {
      method: "POST",
    },
  );
}

export async function listDisclosureTemplates(
  options: {
    includeInactive?: boolean;
    noteType?: NoteType;
  } = {},
): Promise<DisclosureTemplateListResponse> {
  const searchParameters =
    new URLSearchParams();

  if (options.includeInactive) {
    searchParameters.set(
      "include_inactive",
      "true",
    );
  }

  if (options.noteType) {
    searchParameters.set(
      "note_type",
      options.noteType,
    );
  }

  const queryString =
    searchParameters.toString();

  return apiRequest<DisclosureTemplateListResponse>(
    `/api/disclosure-templates${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function listFinancialReportNotes(
  reportId: string,
  includeInactive = false,
): Promise<FinancialReportNoteListResponse> {
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

  return apiRequest<FinancialReportNoteListResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/notes${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}

export async function initializeFinancialReportNotes(
  reportId: string,
  includeOptional: boolean,
): Promise<ReportNotesInitializationResponse> {
  return apiRequest<ReportNotesInitializationResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/notes/initialize`,
    jsonRequest(
      "POST",
      {
        include_optional: includeOptional,
      },
    ),
  );
}

export async function createFinancialReportNote(
  reportId: string,
  payload: FinancialReportNoteCreatePayload,
): Promise<FinancialReportNote> {
  return apiRequest<FinancialReportNote>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/notes`,
    jsonRequest(
      "POST",
      payload,
    ),
  );
}

export async function updateFinancialReportNote(
  noteId: string,
  payload: FinancialReportNoteUpdatePayload,
): Promise<FinancialReportNote> {
  return apiRequest<FinancialReportNote>(
    `/api/financial-report-notes/${encodeURIComponent(
      noteId,
    )}`,
    jsonRequest(
      "PATCH",
      payload,
    ),
  );
}

export async function deactivateFinancialReportNote(
  noteId: string,
): Promise<FinancialReportNote> {
  return apiRequest<FinancialReportNote>(
    `/api/financial-report-notes/${encodeURIComponent(
      noteId,
    )}/deactivate`,
    {
      method: "POST",
    },
  );
}

export async function reactivateFinancialReportNote(
  noteId: string,
): Promise<FinancialReportNote> {
  return apiRequest<FinancialReportNote>(
    `/api/financial-report-notes/${encodeURIComponent(
      noteId,
    )}/reactivate`,
    {
      method: "POST",
    },
  );
}

export async function reorderFinancialReportNotes(
  reportId: string,
  payload: ReorderFinancialReportNotesPayload,
): Promise<FinancialReportNoteListResponse> {
  return apiRequest<FinancialReportNoteListResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/notes/reorder`,
    jsonRequest(
      "PATCH",
      payload,
    ),
  );
}