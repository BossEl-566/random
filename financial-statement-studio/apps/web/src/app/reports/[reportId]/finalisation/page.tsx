import type {
  Metadata,
} from "next";

import { ReportFinalisationWorkspace } from "@/components/report-finalisation/report-finalisation-workspace";

export const metadata: Metadata = {
  title:
    "Report Finalisation | Financial Statement Studio",
  description:
    "Review readiness, finalise reports and manage immutable revisions.",
};

type ReportFinalisationPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ReportFinalisationPage({
  params,
}: ReportFinalisationPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <ReportFinalisationWorkspace
      reportId={reportId}
    />
  );
}