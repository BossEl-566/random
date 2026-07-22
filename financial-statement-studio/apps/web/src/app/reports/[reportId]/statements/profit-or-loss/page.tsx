import type { Metadata } from "next";

import { ProfitOrLossWorkspace } from "@/components/financial-statements/profit-or-loss-workspace";

export const metadata: Metadata = {
  title:
    "Statement of Profit or Loss | Financial Statement Studio",
  description:
    "Review revenue, expenses and profit calculated from posted journal entries.",
};

type ProfitOrLossPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function ProfitOrLossPage({
  params,
}: ProfitOrLossPageProps) {
  const { reportId } = await params;

  return (
    <ProfitOrLossWorkspace
      reportId={reportId}
    />
  );
}