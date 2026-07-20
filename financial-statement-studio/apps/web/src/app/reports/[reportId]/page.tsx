import type {
  Metadata,
} from "next";

import { FinancialReportOverview } from "@/components/financial-reports/financial-report-overview";

export const metadata: Metadata = {
  title:
    "Report Workspace | Financial Statement Studio",
};

type ReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ReportPage({
  params,
}: ReportPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <FinancialReportOverview
      reportId={reportId}
    />
  );
}