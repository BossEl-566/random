import Link from "next/link";

type ReportLockBannerProps = {
  reportId: string;
  status: string;
};

export function ReportLockBanner({
  reportId,
  status,
}: ReportLockBannerProps) {
  const statusLabel =
    status.charAt(0).toUpperCase() +
    status.slice(1);

  return (
    <section className="report-lock-banner">
      <div>
        <span>
          Locked financial report
        </span>

        <h2>
          This report is {statusLabel}
        </h2>

        <p>
          Report metadata, journal entries and
          disclosures can no longer be changed.
          Corrections must be made through a new
          controlled revision.
        </p>
      </div>

      <Link
        className="secondary-button"
        href={`/reports/${reportId}/finalisation`}
      >
        Review finalisation
      </Link>
    </section>
  );
}