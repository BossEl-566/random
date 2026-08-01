import type {
  Metadata,
} from "next";

import { TaxComputationReportWorkspace } from "@/components/tax/tax-computation-report-workspace";

export const metadata: Metadata = {
  title:
    "Tax Computation Report | Financial Statement Studio",
};

type TaxComputationPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function TaxComputationPage({
  params,
}: TaxComputationPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <TaxComputationReportWorkspace
      reportId={reportId}
    />
  );
}