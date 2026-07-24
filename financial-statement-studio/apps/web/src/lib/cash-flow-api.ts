import { apiRequest } from "@/lib/api";
import type {
  CashFlowReadiness,
  StatementOfCashFlows,
} from "@/types/cash-flow";

export async function getCashFlowReadiness(
  reportId: string,
): Promise<CashFlowReadiness> {
  return apiRequest<CashFlowReadiness>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/cash-flow-readiness`,
  );
}

export async function getStatementOfCashFlows(
  reportId: string,
  asOf?: string,
): Promise<StatementOfCashFlows> {
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

  return apiRequest<StatementOfCashFlows>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/statements/cash-flows${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}