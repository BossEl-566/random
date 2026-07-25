import type { Metadata } from "next";

import { EquityStatementWorkspace } from "@/components/financial-statements/equity-statement-workspace";

export const metadata: Metadata = {
  title:
    "Statement of Changes in Equity | Financial Statement Studio",
  description:
    "Review opening equity, direct owner movements, profit or loss and closing equity.",
};

type EquityStatementPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function EquityStatementPage({
  params,
}: EquityStatementPageProps) {
  const { reportId } = await params;

  return (
    <EquityStatementWorkspace
      reportId={reportId}
    />
  );
}