import type {
  Metadata,
} from "next";

import { TaxConfigurationWorkspace } from "@/components/tax/tax-configuration-workspace";

export const metadata: Metadata = {
  title:
    "Tax Configuration | Financial Statement Studio",
  description:
    "Manage company tax profiles, jurisdictions and taxpayer classifications.",
};

type TaxConfigurationPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function TaxConfigurationPage({
  params,
}: TaxConfigurationPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <TaxConfigurationWorkspace
      reportId={reportId}
    />
  );
}