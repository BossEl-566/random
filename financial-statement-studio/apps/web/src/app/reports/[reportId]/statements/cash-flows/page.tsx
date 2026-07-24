import type {
  Metadata,
} from "next";

import { CashFlowWorkspace } from "@/components/financial-statements/cash-flow-workspace";

export const metadata: Metadata = {
  title:
    "Statement of Cash Flows | Financial Statement Studio",
  description:
    "Review operating, investing and financing cash flows calculated using the indirect method.",
};

type CashFlowPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function CashFlowPage({
  params,
}: CashFlowPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <CashFlowWorkspace
      reportId={reportId}
    />
  );
}