import type {
  Metadata,
} from "next";

import { FinancialReportWorkspace } from "@/components/financial-reports/financial-report-workspace";

export const metadata: Metadata = {
  title:
    "Financial Reports | Financial Statement Studio",
  description:
    "Create and manage financial statement documents.",
};

type ReportsPageProps = {
  searchParams: Promise<{
    company_id?:
      | string
      | string[];
  }>;
};

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps) {
  const resolvedSearchParams =
    await searchParams;

  const rawCompanyId =
    resolvedSearchParams.company_id;

  const initialCompanyId =
    Array.isArray(rawCompanyId)
      ? rawCompanyId[0]
      : rawCompanyId;

  return (
    <FinancialReportWorkspace
      initialCompanyId={
        initialCompanyId ?? ""
      }
    />
  );
}