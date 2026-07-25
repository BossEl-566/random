import type {
  Metadata,
} from "next";

import { NotesWorkspace } from "@/components/notes/notes-workspace";

export const metadata: Metadata = {
  title:
    "Notes and Disclosures | Financial Statement Studio",
  description:
    "Prepare accounting policies, financial statement notes and general disclosures.",
};

type NotesPageProps = {
  params: Promise<{
    reportId: string;
  }>;
};

export default async function NotesPage({
  params,
}: NotesPageProps) {
  const {
    reportId,
  } = await params;

  return (
    <NotesWorkspace
      reportId={reportId}
    />
  );
}