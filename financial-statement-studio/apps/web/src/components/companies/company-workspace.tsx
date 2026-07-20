"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import { CompanyCard } from "@/components/companies/company-card";
import { CompanyEditor } from "@/components/companies/company-editor";
import {
  deactivateCompany,
  listCompanies,
} from "@/lib/companies-api";
import type {
  Company,
  CompanyListResponse,
} from "@/types/company";

type EditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      company: Company;
    }
  | null;

type LoadingState =
  | "loading"
  | "ready"
  | "error";

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function CompanyWorkspace() {
  const [companies, setCompanies] =
    useState<Company[]>([]);

  const [total, setTotal] =
    useState(0);

  const [loadingState, setLoadingState] =
    useState<LoadingState>("loading");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [reloadVersion, setReloadVersion] =
    useState(0);

  const [editorState, setEditorState] =
    useState<EditorState>(null);

  const [
    deactivatingCompanyId,
    setDeactivatingCompanyId,
  ] = useState<string | null>(null);

  /*
   * Load companies when the search value or explicit reload version
   * changes. The Effect starts a network request, and state updates happen
   * only after the Promise resolves or rejects.
   */
  useEffect(() => {
    let cancelled = false;

    listCompanies({
      search:
        appliedSearch || undefined,
      offset: 0,
      limit: 100,
    })
      .then(
        (
          response: CompanyListResponse,
        ) => {
          if (cancelled) {
            return;
          }

          setCompanies(response.items);
          setTotal(response.total);
          setLoadingState("ready");
        },
      )
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadingState("error");

        setLoadError(
          getErrorMessage(
            error,
            "Companies could not be loaded.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedSearch,
    reloadVersion,
  ]);

  function requestReload(): void {
    setLoadingState("loading");
    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  function handleSearch(
    event: FormEvent<HTMLFormElement>,
  ): void {
    event.preventDefault();

    const nextSearch =
      searchInput.trim();

    setLoadingState("loading");
    setLoadError(null);

    if (nextSearch === appliedSearch) {
      setReloadVersion(
        (currentVersion) =>
          currentVersion + 1,
      );

      return;
    }

    setAppliedSearch(nextSearch);
  }

  function clearSearch(): void {
    setSearchInput("");
    setLoadingState("loading");
    setLoadError(null);

    if (appliedSearch === "") {
      setReloadVersion(
        (currentVersion) =>
          currentVersion + 1,
      );

      return;
    }

    setAppliedSearch("");
  }

  function handleCompanySaved(): void {
    setEditorState(null);
    setActionError(null);
    requestReload();
  }

  async function handleDeactivate(
    company: Company,
  ): Promise<void> {
    const confirmed = window.confirm(
      [
        `Deactivate ${company.name}?`,
        "",
        "The company will disappear from the active list, but its historical records will not be deleted.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);

    setDeactivatingCompanyId(
      company.id,
    );

    try {
      await deactivateCompany(
        company.id,
      );

      requestReload();
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "The company could not be deactivated.",
        ),
      );
    } finally {
      setDeactivatingCompanyId(null);
    }
  }

  const isSearching =
    appliedSearch.length > 0;

  return (
    <main className="company-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href="/"
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Company workspace
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
  <span className="desktop-mode-badge">
    Local desktop workspace
  </span>

  <Link
    className="topbar-link"
    href="/reports"
  >
    Financial reports
  </Link>

  <Link
    className="topbar-link"
    href="/"
  >
    Foundation status
  </Link>
</div>
      </header>

      <section className="company-page__hero">
        <div>
          <p className="eyebrow">
            Company management
          </p>

          <h1>
            Your business workspaces
          </h1>

          <p>
            Create one company profile for
            each business or organisation.
            Financial reports created later
            will belong to the selected
            company.
          </p>
        </div>

        <div className="company-page__summary">
          <span>
            Active companies
          </span>

          <strong>
            {loadingState === "ready"
              ? total
              : "—"}
          </strong>

          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setEditorState({
                mode: "create",
              })
            }
          >
            Add new company
          </button>
        </div>
      </section>

      <section className="company-toolbar">
        <form
          className="company-search"
          onSubmit={handleSearch}
        >
          <label htmlFor="company-search">
            Search companies
          </label>

          <div className="company-search__controls">
            <input
              id="company-search"
              type="search"
              value={searchInput}
              placeholder="Search by company name"
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
            />

            <button
              className="company-search__button"
              type="submit"
            >
              Search
            </button>

            {searchInput ||
            appliedSearch ? (
              <button
                className="company-search__clear"
                type="button"
                onClick={clearSearch}
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>

        <div className="company-toolbar__information">
          {isSearching ? (
            <p>
              Showing results for{" "}
              <strong>
                “{appliedSearch}”
              </strong>
            </p>
          ) : (
            <p>
              Showing all active companies
            </p>
          )}

          <button
            className="text-button"
            type="button"
            disabled={
              loadingState === "loading"
            }
            onClick={requestReload}
          >
            Refresh list
          </button>
        </div>
      </section>

      {actionError ? (
        <div
          className="workspace-alert workspace-alert--error"
          role="alert"
        >
          <div>
            <strong>
              Company action failed
            </strong>

            <p>{actionError}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              setActionError(null)
            }
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section
        className="company-content"
        aria-busy={
          loadingState === "loading"
        }
      >
        {loadingState === "loading" ? (
          <div className="company-loading-grid">
            {[1, 2, 3].map(
              (placeholder) => (
                <div
                  className="company-card company-card--loading"
                  key={placeholder}
                >
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
              ),
            )}
          </div>
        ) : null}

        {loadingState === "error" ? (
          <div className="company-state-card company-state-card--error">
            <span>
              Connection problem
            </span>

            <h2>
              Companies could not be loaded
            </h2>

            <p>{loadError}</p>

            <button
              className="primary-button"
              type="button"
              onClick={requestReload}
            >
              Try again
            </button>
          </div>
        ) : null}

        {loadingState === "ready" &&
        companies.length === 0 ? (
          <div className="company-state-card">
            <span>
              {isSearching
                ? "No search results"
                : "No companies yet"}
            </span>

            <h2>
              {isSearching
                ? "No matching company was found"
                : "Create your first business workspace"}
            </h2>

            <p>
              {isSearching
                ? "Try another company name or clear the current search."
                : "A company profile stores the business details that will later appear in its financial statements."}
            </p>

            {isSearching ? (
              <button
                className="secondary-button"
                type="button"
                onClick={clearSearch}
              >
                Clear search
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  setEditorState({
                    mode: "create",
                  })
                }
              >
                Create first company
              </button>
            )}
          </div>
        ) : null}

        {loadingState === "ready" &&
        companies.length > 0 ? (
          <>
            <div className="company-content__heading">
              <div>
                <p className="eyebrow">
                  Active records
                </p>

                <h2>
                  {total === 1
                    ? "1 company"
                    : `${total} companies`}
                </h2>
              </div>

              <p>
                Select Edit company to
                complete or correct business
                information.
              </p>
            </div>

            <div className="company-grid">
              {companies.map(
                (company) => (
                  <CompanyCard
                    company={company}
                    isDeactivating={
                      deactivatingCompanyId ===
                      company.id
                    }
                    key={company.id}
                    onEdit={(
                      selectedCompany,
                    ) =>
                      setEditorState({
                        mode: "edit",
                        company:
                          selectedCompany,
                      })
                    }
                    onDeactivate={
                      handleDeactivate
                    }
                  />
                ),
              )}
            </div>
          </>
        ) : null}
      </section>

      <footer className="company-page__footer">
        <span>
          Financial Statement Studio
        </span>

        <span>
          Company information is stored
          locally in SQLite.
        </span>
      </footer>

      {editorState ? (
        <CompanyEditor
          key={
            editorState.mode === "edit"
              ? editorState.company.id
              : "create-company"
          }
          company={
            editorState.mode === "edit"
              ? editorState.company
              : null
          }
          onClose={() =>
            setEditorState(null)
          }
          onSaved={
            handleCompanySaved
          }
        />
      ) : null}
    </main>
  );
}