import type {
  Metadata,
} from "next";

import { ChartOfAccountsWorkspace } from "@/components/chart-of-accounts/chart-of-accounts-workspace";

export const metadata: Metadata = {
  title:
    "Chart of Accounts | Financial Statement Studio",
  description:
    "Initialize and manage a company Chart of Accounts.",
};

type ChartOfAccountsPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

export default async function ChartOfAccountsPage({
  params,
}: ChartOfAccountsPageProps) {
  const {
    companyId,
  } = await params;

  return (
    <ChartOfAccountsWorkspace
      companyId={companyId}
    />
  );
}