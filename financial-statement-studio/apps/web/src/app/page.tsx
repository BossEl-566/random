import { BackendStatusCard } from "@/components/backend-status-card";
import { DesktopStatusCard } from "@/components/desktop-status-card";
import Link from "next/link";

const foundationItems = [
  {
    title: "Next.js frontend",
    description:
      "The user interface and financial-document workspace are ready.",
  },
  {
    title: "FastAPI backend",
    description:
      "The accounting API is running locally with structured routes.",
  },
  {
    title: "SQLite database",
    description:
      "Local offline storage is connected and responding correctly.",
  },
  {
    title: "Electron desktop",
    description:
      "The Windows desktop shell will be connected in the next checkpoint.",
  },
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero__content">
          <div className="brand-mark" aria-hidden="true">
            FS
          </div>

          <p className="eyebrow">Financial Statement Studio</p>

          <h1>
            Professional financial statements without the accounting
            confusion.
          </h1>

          <p className="hero__description">
            A guided desktop accounting workspace for preparing,
            validating, reviewing, and exporting financial statements for
            businesses in Ghana.
          </p>

          <div className="hero__actions">
            <Link
  className="primary-button"
  href="/companies"
>
  Manage companies
</Link>

            <span>
  Create a company profile before preparing its financial reports.
</span>
          </div>
        </div>

        <div className="hero__summary">
          <p className="eyebrow">Current phase</p>
          <strong>Phase 2</strong>
          <span>Project foundation and system integration</span>

          <div className="progress-track" aria-label="Foundation progress">
            <div className="progress-track__value" />
          </div>

          <small>Frontend, backend, and database completed</small>
        </div>
      </section>

      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Foundation status</p>
            <h2>Core system components</h2>
          </div>

          <p>
            Every component will be tested independently before accounting
            features are introduced.
          </p>
        </div>

        <div className="foundation-grid">
          {foundationItems.map((item, index) => (
            <article className="foundation-card" key={item.title}>
              <span className="foundation-card__number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <BackendStatusCard />
      </section>

      <section className="workspace-section">
  <DesktopStatusCard />
</section>

      <footer className="page-footer">
        <span>Financial Statement Studio</span>
        <span>Local-first financial accounting software</span>
      </footer>
    </main>
  );
}