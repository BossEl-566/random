import type {
  Metadata,
} from "next";

import {
  CompleteReportWorkspace,
} from "@/components/complete-report/complete-report-workspace";

export const metadata: Metadata = {
  title:
    "Complete Financial Statements | Financial Statement Studio",
};

type CompleteReportPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function CompleteReportPage({
  params,
}: CompleteReportPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <CompleteReportWorkspace
      reportId={reportId}
    />
  );
}