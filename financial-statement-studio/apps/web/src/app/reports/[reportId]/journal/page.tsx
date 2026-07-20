import type {
  Metadata,
} from "next";

import { JournalWorkspace } from "@/components/journal/journal-workspace";

export const metadata: Metadata = {
  title:
    "General Journal | Financial Statement Studio",
  description:
    "Create, post and review double-entry journal transactions.",
};

type JournalPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function JournalPage({
  params,
}: JournalPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <JournalWorkspace
      reportId={reportId}
    />
  );
}