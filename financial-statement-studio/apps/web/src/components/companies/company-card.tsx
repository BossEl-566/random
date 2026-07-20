import Link from "next/link";
import {
  BUSINESS_TYPE_OPTIONS,
  REPORTING_BASIS_OPTIONS,
  type Company,
} from "@/types/company";

type CompanyCardProps = {
  company: Company;
  isDeactivating: boolean;
  onEdit: (company: Company) => void;
  onDeactivate: (
    company: Company,
  ) => void;
};

function getBusinessTypeLabel(
  company: Company,
): string {
  return (
    BUSINESS_TYPE_OPTIONS.find(
      (option) =>
        option.value ===
        company.business_type,
    )?.label ?? company.business_type
  );
}

function getReportingBasisLabel(
  company: Company,
): string {
  return (
    REPORTING_BASIS_OPTIONS.find(
      (option) =>
        option.value ===
        company.reporting_basis,
    )?.label ?? company.reporting_basis
  );
}

function formatDate(
  value: string,
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GH",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

export function CompanyCard({
  company,
  isDeactivating,
  onEdit,
  onDeactivate,
}: CompanyCardProps) {
  const initials = company.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <article className="company-card">
      <div className="company-card__header">
        <div
          className="company-card__identity"
          aria-hidden="true"
        >
          {initials || "CO"}
        </div>

        <div className="company-card__heading">
          <div className="company-card__badges">
            <span className="company-type-badge">
              {getBusinessTypeLabel(
                company,
              )}
            </span>

            <span className="company-active-badge">
              Active
            </span>
          </div>

          <h3>{company.name}</h3>

          <p>
            {company.address ??
              "No business address added"}
          </p>
        </div>
      </div>

      <dl className="company-card__details">
        <div>
          <dt>Currency</dt>
          <dd>
            {company.default_currency}
          </dd>
        </div>

        <div>
          <dt>Accounting basis</dt>
          <dd>
            {getReportingBasisLabel(
              company,
            )}
          </dd>
        </div>

        <div>
          <dt>TIN</dt>
          <dd>
            {company.tin ??
              "Not provided"}
          </dd>
        </div>

        <div>
          <dt>Last updated</dt>
          <dd>
            {formatDate(
              company.updated_at,
            )}
          </dd>
        </div>
      </dl>

      <div className="company-card__contact">
        <p>
          <span>Email</span>
          {company.email ??
            "Not provided"}
        </p>

        <p>
          <span>Telephone</span>
          {company.telephone ??
            "Not provided"}
        </p>
      </div>

      <div className="company-card__actions">
  <Link
    className="company-action-button company-action-button--link"
    href={`/reports?company_id=${company.id}`}
  >
    Reports
  </Link>

  <button
    className="company-action-button"
    type="button"
    onClick={() =>
      onEdit(company)
    }
  >
    Edit
  </button>

  <button
    className="company-action-button company-action-button--danger"
    type="button"
    disabled={isDeactivating}
    onClick={() =>
      onDeactivate(company)
    }
  >
    {isDeactivating
      ? "Deactivating..."
      : "Deactivate"}
  </button>
</div>
    </article>
  );
}