import type {
  Metadata,
} from "next";

import { TrialBalanceWorkspace } from "@/components/journal/trial-balance-workspace";

export const metadata: Metadata = {
  title:
    "Trial Balance | Financial Statement Studio",
  description:
    "Review posted ledger balances and verify debit and credit totals.",
};

type TrialBalancePageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function TrialBalancePage({
  params,
}: TrialBalancePageProps) {
  const {
    reportId,
  } = await params;

  return (
    <TrialBalanceWorkspace
      reportId={reportId}
    />
  );
}