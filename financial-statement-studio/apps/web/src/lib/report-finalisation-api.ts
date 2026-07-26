import { apiRequest } from "@/lib/api";
import type {
  CreateFinancialReportRevisionPayload,
  FinalisationFinancialReport,
  FinaliseFinancialReportPayload,
  FinaliseFinancialReportResponse,
  FinancialReportVersionDetail,
  FinancialReportVersionListResponse,
  ReportFinalisationReadiness,
} from "@/types/report-finalisation";

function jsonRequest(
  method: "POST" | "PATCH",
  payload: unknown,
): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

export async function getReportFinalisationReadiness(
  reportId: string,
): Promise<ReportFinalisationReadiness> {
  return apiRequest<ReportFinalisationReadiness>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/finalisation-readiness`,
  );
}

export async function finaliseFinancialReport(
  reportId: string,
  payload: FinaliseFinancialReportPayload,
): Promise<FinaliseFinancialReportResponse> {
  return apiRequest<FinaliseFinancialReportResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/finalise`,
    jsonRequest(
      "POST",
      payload,
    ),
  );
}

export async function listFinancialReportVersions(
  reportId: string,
): Promise<FinancialReportVersionListResponse> {
  return apiRequest<FinancialReportVersionListResponse>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/versions`,
  );
}

export async function getFinancialReportVersion(
  versionId: string,
): Promise<FinancialReportVersionDetail> {
  return apiRequest<FinancialReportVersionDetail>(
    `/api/financial-report-versions/${encodeURIComponent(
      versionId,
    )}`,
  );
}

export async function createFinancialReportRevision(
  reportId: string,
  payload: CreateFinancialReportRevisionPayload,
): Promise<FinalisationFinancialReport> {
  return apiRequest<FinalisationFinancialReport>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/revisions`,
    jsonRequest(
      "POST",
      payload,
    ),
  );
}