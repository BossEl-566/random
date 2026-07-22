import type { Metadata } from "next";

import { FinancialPositionWorkspace } from "@/components/financial-statements/financial-position-workspace";

export const metadata: Metadata = {
  title:
    "Statement of Financial Position | Financial Statement Studio",
  description:
    "Review assets, liabilities and equity calculated from posted journal entries.",
};

type FinancialPositionPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function FinancialPositionPage({
  params,
}: FinancialPositionPageProps) {
  const { reportId } = await params;

  return (
    <FinancialPositionWorkspace
      reportId={reportId}
    />
  );
}