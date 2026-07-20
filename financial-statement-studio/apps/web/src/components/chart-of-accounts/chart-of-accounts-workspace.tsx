"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { LedgerAccountEditor } from "@/components/chart-of-accounts/ledger-account-editor";
import { LedgerAccountRow } from "@/components/chart-of-accounts/ledger-account-row";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  deactivateLedgerAccount,
  initializeChartOfAccounts,
  listLedgerAccounts,
} from "@/lib/ledger-accounts-api";
import type {
  Company,
} from "@/types/company";
import {
  ACCOUNT_TYPE_OPTIONS,
  REPORT_CATEGORY_OPTIONS,
  type AccountType,
  type ChartInitializationResponse,
  type LedgerAccount,
  type ReportCategory,
} from "@/types/ledger-account";

type ChartOfAccountsWorkspaceProps = {
  companyId: string;
};

type ResourceState =
  | "loading"
  | "ready"
  | "error";

type EditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      account: LedgerAccount;
    }
  | null;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function ChartOfAccountsWorkspace({
  companyId,
}: ChartOfAccountsWorkspaceProps) {
  const [company, setCompany] =
    useState<Company | null>(null);

  const [accounts, setAccounts] =
    useState<LedgerAccount[]>([]);

  const [total, setTotal] =
    useState(0);

  const [resourceState, setResourceState] =
    useState<ResourceState>("loading");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [
    initializationMessage,
    setInitializationMessage,
  ] = useState<string | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [
    selectedAccountType,
    setSelectedAccountType,
  ] = useState<AccountType | "">("");

  const [
    selectedReportCategory,
    setSelectedReportCategory,
  ] = useState<
    ReportCategory | ""
  >("");

  const [
    includeInactive,
    setIncludeInactive,
  ] = useState(false);

  const [reloadVersion, setReloadVersion] =
    useState(0);

  const [editorState, setEditorState] =
    useState<EditorState>(null);

  const [
    isInitializing,
    setIsInitializing,
  ] = useState(false);

  const [
    deactivatingAccountId,
    setDeactivatingAccountId,
  ] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getCompany(companyId),
      listLedgerAccounts(
        companyId,
        {
          search:
            appliedSearch || undefined,
          accountType:
            selectedAccountType ||
            undefined,
          reportCategory:
            selectedReportCategory ||
            undefined,
          includeInactive,
          offset: 0,
          limit: 500,
        },
      ),
    ])
      .then(
        ([
          companyResponse,
          accountResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setCompany(
            companyResponse,
          );

          setAccounts(
            accountResponse.items,
          );

          setTotal(
            accountResponse.total,
          );

          setResourceState("ready");
        },
      )
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setResourceState("error");

        setLoadError(
          getErrorMessage(
            error,
            "The Chart of Accounts could not be loaded.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedSearch,
    companyId,
    includeInactive,
    reloadVersion,
    selectedAccountType,
    selectedReportCategory,
  ]);

  const parentNames =
    useMemo(() => {
      return new Map(
        accounts.map((account) => [
          account.id,
          account.account_name,
        ]),
      );
    }, [accounts]);

  const accountGroups =
    useMemo(() => {
      return ACCOUNT_TYPE_OPTIONS
        .map((accountType) => ({
          ...accountType,
          accounts: accounts.filter(
            (account) =>
              account.account_type ===
              accountType.value,
          ),
        }))
        .filter(
          (group) =>
            group.accounts.length > 0,
        );
    }, [accounts]);

  function requestReload(): void {
    setResourceState("loading");
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

    setResourceState("loading");
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

  function handleAccountTypeFilter(
    accountType: AccountType | "",
  ): void {
    setResourceState("loading");
    setLoadError(null);
    setSelectedAccountType(accountType);
  }

  function handleReportCategoryFilter(
    reportCategory:
      | ReportCategory
      | "",
  ): void {
    setResourceState("loading");
    setLoadError(null);
    setSelectedReportCategory(
      reportCategory,
    );
  }

  function handleIncludeInactive(
    nextIncludeInactive: boolean,
  ): void {
    setResourceState("loading");
    setLoadError(null);
    setIncludeInactive(
      nextIncludeInactive,
    );
  }

  function clearFilters(): void {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedAccountType("");
    setSelectedReportCategory("");
    setIncludeInactive(false);
    setResourceState("loading");
    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  async function handleInitialize(): Promise<void> {
    if (!company) {
      return;
    }

    setActionError(null);
    setInitializationMessage(null);
    setIsInitializing(true);

    try {
      const response:
        ChartInitializationResponse =
        await initializeChartOfAccounts(
          company.id,
        );

      const message =
        response.created_count > 0
          ? `${response.created_count} default accounts were added. ${response.skipped_count} existing accounts were skipped.`
          : `No new accounts were required. ${response.skipped_count} default accounts already exist.`;

      setInitializationMessage(
        message,
      );

      requestReload();
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "The default Chart of Accounts could not be initialized.",
        ),
      );
    } finally {
      setIsInitializing(false);
    }
  }

  function handleAccountSaved(): void {
    setEditorState(null);
    setActionError(null);
    requestReload();
  }

  async function handleDeactivate(
    account: LedgerAccount,
  ): Promise<void> {
    const confirmed = window.confirm(
      [
        `Deactivate ${account.account_code} — ${account.account_name}?`,
        "",
        "The account will be hidden from the active Chart of Accounts but will remain stored for historical accounting records.",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeactivatingAccountId(
      account.id,
    );

    try {
      await deactivateLedgerAccount(
        account.id,
      );

      requestReload();
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "The ledger account could not be deactivated.",
        ),
      );
    } finally {
      setDeactivatingAccountId(null);
    }
  }

  const filtersApplied =
    Boolean(
      appliedSearch ||
      selectedAccountType ||
      selectedReportCategory ||
      includeInactive,
    );

  return (
    <main className="ledger-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href="/companies"
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Chart of Accounts
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports?company_id=${companyId}`}
          >
            Financial reports
          </Link>

          <Link
            className="topbar-link"
            href="/companies"
          >
            Companies
          </Link>
        </div>
      </header>

      <section className="ledger-hero">
        <div>
          <p className="eyebrow">
            Chart of Accounts
          </p>

          <h1>
            {company?.name ??
              "Company accounts"}
          </h1>

          <p>
            The Chart of Accounts defines
            every financial category the
            business can use. Each account is
            mapped to the correct financial
            statement section.
          </p>
        </div>

        <div className="ledger-hero__summary">
          <span>
            Available accounts
          </span>

          <strong>
            {resourceState === "ready"
              ? total
              : "—"}
          </strong>

          <div className="ledger-hero__actions">
            <button
              className="primary-button"
              type="button"
              disabled={
                !company ||
                !company.is_active
              }
              onClick={() =>
                setEditorState({
                  mode: "create",
                })
              }
            >
              Add custom account
            </button>

            <button
              className="ledger-initialize-button"
              type="button"
              disabled={
                isInitializing ||
                !company ||
                !company.is_active
              }
              onClick={() => {
                void handleInitialize();
              }}
            >
              {isInitializing
                ? "Adding defaults..."
                : "Add default accounts"}
            </button>
          </div>
        </div>
      </section>

      <section className="ledger-toolbar">
        <form
          className="ledger-search"
          onSubmit={handleSearch}
        >
          <label htmlFor="ledger-search">
            Search accounts
          </label>

          <div className="ledger-search__controls">
            <input
              id="ledger-search"
              type="search"
              value={searchInput}
              placeholder="Search by code or account name"
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
            />

            <button type="submit">
              Search
            </button>
          </div>
        </form>

        <label className="ledger-filter">
          <span>Account type</span>

          <select
            value={selectedAccountType}
            onChange={(event) =>
              handleAccountTypeFilter(
                event.target
                  .value as
                  | AccountType
                  | "",
              )
            }
          >
            <option value="">
              All account types
            </option>

            {ACCOUNT_TYPE_OPTIONS.map(
              (option) => (
                <option
                  value={option.value}
                  key={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="ledger-filter">
          <span>
            Statement category
          </span>

          <select
            value={
              selectedReportCategory
            }
            onChange={(event) =>
              handleReportCategoryFilter(
                event.target
                  .value as
                  | ReportCategory
                  | "",
              )
            }
          >
            <option value="">
              All categories
            </option>

            {REPORT_CATEGORY_OPTIONS.map(
              (option) => (
                <option
                  value={option.value}
                  key={option.value}
                >
                  {option.label}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="ledger-toolbar__right">
          <label className="ledger-inactive-control">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) =>
                handleIncludeInactive(
                  event.target.checked,
                )
              }
            />

            <span>
              Show inactive
            </span>
          </label>

          <button
            className="text-button"
            type="button"
            disabled={
              resourceState === "loading"
            }
            onClick={requestReload}
          >
            Refresh
          </button>

          {filtersApplied ? (
            <button
              className="text-button"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      {initializationMessage ? (
        <div
          className="workspace-alert ledger-alert--success"
          role="status"
        >
          <div>
            <strong>
              Chart updated
            </strong>

            <p>
              {initializationMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setInitializationMessage(
                null,
              )
            }
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {actionError ? (
        <div
          className="workspace-alert workspace-alert--error"
          role="alert"
        >
          <div>
            <strong>
              Account action failed
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
        className="ledger-content"
        aria-busy={
          resourceState === "loading"
        }
      >
        {resourceState === "loading" ? (
          <div className="ledger-loading-card">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState === "error" ? (
          <div className="ledger-state-card ledger-state-card--error">
            <span>
              Account data unavailable
            </span>

            <h2>
              The Chart of Accounts could
              not be loaded
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

        {resourceState === "ready" &&
        accounts.length === 0 ? (
          <div className="ledger-state-card">
            <span>
              {filtersApplied
                ? "No matching accounts"
                : "Chart not initialized"}
            </span>

            <h2>
              {filtersApplied
                ? "No account matches the selected filters"
                : "Add the company’s default accounts"}
            </h2>

            <p>
              {filtersApplied
                ? "Change or clear the search and filters to view other accounts."
                : "The system can create a professional starting Chart of Accounts based on the company’s business type."}
            </p>

            <div className="ledger-state-card__actions">
              {filtersApplied ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              ) : (
                <>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      isInitializing ||
                      !company?.is_active
                    }
                    onClick={() => {
                      void handleInitialize();
                    }}
                  >
                    Initialize default accounts
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={
                      !company?.is_active
                    }
                    onClick={() =>
                      setEditorState({
                        mode: "create",
                      })
                    }
                  >
                    Add a custom account
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {resourceState === "ready" &&
        accounts.length > 0 ? (
          <div className="ledger-groups">
            {accountGroups.map(
              (group) => (
                <section
                  className="ledger-group"
                  key={group.value}
                >
                  <header className="ledger-group__header">
                    <div>
                      <p className="eyebrow">
                        Account group
                      </p>

                      <h2>
                        {group.label}
                      </h2>
                    </div>

                    <span>
                      {group.accounts.length}
                      {group.accounts.length === 1
                        ? " account"
                        : " accounts"}
                    </span>
                  </header>

                  <div className="ledger-table-wrapper">
                    <table className="ledger-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Account</th>
                          <th>
                            Statement category
                          </th>
                          <th>
                            Normal balance
                          </th>
                          <th>
                            Cash flow
                          </th>
                          <th>
                            Parent account
                          </th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {group.accounts.map(
                          (account) => (
                            <LedgerAccountRow
                              account={
                                account
                              }
                              parentName={
                                account.parent_account_id
                                  ? parentNames.get(
                                      account.parent_account_id,
                                    ) ??
                                    "Parent account"
                                  : null
                              }
                              isDeactivating={
                                deactivatingAccountId ===
                                account.id
                              }
                              key={
                                account.id
                              }
                              onEdit={(
                                selectedAccount,
                              ) =>
                                setEditorState(
                                  {
                                    mode: "edit",
                                    account:
                                      selectedAccount,
                                  },
                                )
                              }
                              onDeactivate={
                                handleDeactivate
                              }
                            />
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ),
            )}
          </div>
        ) : null}
      </section>

      <footer className="company-page__footer">
        <span>
          Financial Statement Studio
        </span>

        <span>
          Account classifications feed the
          general ledger and financial
          statements.
        </span>
      </footer>

      {editorState && company ? (
        <LedgerAccountEditor
          key={
            editorState.mode === "edit"
              ? editorState.account.id
              : "new-ledger-account"
          }
          company={company}
          accounts={accounts}
          account={
            editorState.mode === "edit"
              ? editorState.account
              : null
          }
          onClose={() =>
            setEditorState(null)
          }
          onSaved={
            handleAccountSaved
          }
        />
      ) : null}
    </main>
  );
}