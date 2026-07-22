import { apiRequest } from "@/lib/api";
import type {
  ProfitOrLossStatement,
  StatementOfFinancialPosition,
} from "@/types/financial-statement";

function buildAsOfQuery(
  asOf?: string,
): string {
  if (!asOf) {
    return "";
  }

  const searchParameters =
    new URLSearchParams();

  searchParameters.set(
    "as_of",
    asOf,
  );

  return `?${searchParameters.toString()}`;
}

export async function getProfitOrLossStatement(
  reportId: string,
  asOf?: string,
): Promise<ProfitOrLossStatement> {
  return apiRequest<ProfitOrLossStatement>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/statements/profit-or-loss${buildAsOfQuery(
      asOf,
    )}`,
  );
}

export async function getStatementOfFinancialPosition(
  reportId: string,
  asOf?: string,
): Promise<StatementOfFinancialPosition> {
  return apiRequest<StatementOfFinancialPosition>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/statements/financial-position${buildAsOfQuery(
      asOf,
    )}`,
  );
}