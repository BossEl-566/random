import type {
  Metadata,
} from "next";

import { DisclosureTemplateLibrary } from "@/components/notes/disclosure-template-library";

export const metadata: Metadata = {
  title:
    "Disclosure Template Library | Financial Statement Studio",
  description:
    "Create and manage reusable accounting policy and disclosure templates.",
};

export default function DisclosureTemplatesPage() {
  return (
    <DisclosureTemplateLibrary />
  );
}