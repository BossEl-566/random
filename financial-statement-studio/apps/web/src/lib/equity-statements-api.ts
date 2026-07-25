import { apiRequest } from "@/lib/api";
import type {
  StatementOfChangesInEquity,
} from "@/types/equity-statement";

export async function getStatementOfChangesInEquity(
  reportId: string,
  asOf?: string,
): Promise<StatementOfChangesInEquity> {
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

  return apiRequest<StatementOfChangesInEquity>(
    `/api/financial-reports/${encodeURIComponent(
      reportId,
    )}/statements/changes-in-equity${
      queryString
        ? `?${queryString}`
        : ""
    }`,
  );
}