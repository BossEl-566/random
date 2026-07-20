import type { Metadata } from "next";

import { CompanyWorkspace } from "@/components/companies/company-workspace";

export const metadata: Metadata = {
  title:
    "Companies | Financial Statement Studio",
  description:
    "Create and manage company workspaces for financial statements.",
};

export default function CompaniesPage() {
  return <CompanyWorkspace />;
}