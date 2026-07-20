"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { JournalEntryCard } from "@/components/journal/journal-entry-card";
import { JournalEntryEditor } from "@/components/journal/journal-entry-editor";
import {
  getCompany,
} from "@/lib/companies-api";
import {
  getFinancialReport,
} from "@/lib/financial-reports-api";
import {
  listJournalEntries,
  postJournalEntry,
  voidJournalEntry,
} from "@/lib/journal-api";
import {
  listLedgerAccounts,
} from "@/lib/ledger-accounts-api";
import type {
  Company,
} from "@/types/company";
import type {
  FinancialReport,
} from "@/types/financial-report";
import {
  JOURNAL_ENTRY_STATUS_OPTIONS,
  JOURNAL_ENTRY_TYPE_OPTIONS,
  type JournalEntry,
  type JournalEntryStatus,
  type JournalEntryType,
} from "@/types/journal-entry";
import type {
  LedgerAccount,
} from "@/types/ledger-account";

type JournalWorkspaceProps = {
  reportId: string;
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
      entry: JournalEntry;
    }
  | null;

type BusyAction =
  | "post"
  | "void"
  | null;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function JournalWorkspace({
  reportId,
}: JournalWorkspaceProps) {
  const [report, setReport] =
    useState<FinancialReport | null>(
      null,
    );

  const [company, setCompany] =
    useState<Company | null>(null);

  const [accounts, setAccounts] =
    useState<LedgerAccount[]>([]);

  const [entries, setEntries] =
    useState<JournalEntry[]>([]);

  const [total, setTotal] =
    useState(0);

  const [resourceState, setResourceState] =
    useState<ResourceState>("loading");

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [actionError, setActionError] =
    useState<string | null>(null);

  const [searchInput, setSearchInput] =
    useState("");

  const [appliedSearch, setAppliedSearch] =
    useState("");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState<
    JournalEntryStatus | ""
  >("");

  const [
    selectedEntryType,
    setSelectedEntryType,
  ] = useState<
    JournalEntryType | ""
  >("");

  const [dateFrom, setDateFrom] =
    useState("");

  const [dateTo, setDateTo] =
    useState("");

  const [reloadVersion, setReloadVersion] =
    useState(0);

  const [editorState, setEditorState] =
    useState<EditorState>(null);

  const [busyEntryId, setBusyEntryId] =
    useState<string | null>(null);

  const [busyAction, setBusyAction] =
    useState<BusyAction>(null);

  useEffect(() => {
    let cancelled = false;

    getFinancialReport(reportId)
      .then(
        (reportResponse) =>
          Promise.all([
            Promise.resolve(
              reportResponse,
            ),
            getCompany(
              reportResponse.company_id,
            ),
            listLedgerAccounts(
              reportResponse.company_id,
              {
                includeInactive: true,
                offset: 0,
                limit: 500,
              },
            ),
            listJournalEntries(
              reportId,
              {
                search:
                  appliedSearch ||
                  undefined,
                status:
                  selectedStatus ||
                  undefined,
                entryType:
                  selectedEntryType ||
                  undefined,
                dateFrom:
                  dateFrom ||
                  undefined,
                dateTo:
                  dateTo ||
                  undefined,
                offset: 0,
                limit: 500,
              },
            ),
          ]),
      )
      .then(
        ([
          reportResponse,
          companyResponse,
          accountResponse,
          entryResponse,
        ]) => {
          if (cancelled) {
            return;
          }

          setReport(
            reportResponse,
          );

          setCompany(
            companyResponse,
          );

          setAccounts(
            accountResponse.items,
          );

          setEntries(
            entryResponse.items,
          );

          setTotal(
            entryResponse.total,
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
            "The journal could not be loaded.",
          ),
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    appliedSearch,
    dateFrom,
    dateTo,
    reloadVersion,
    reportId,
    selectedEntryType,
    selectedStatus,
  ]);

  const accountNames =
    useMemo(
      () =>
        new Map(
          accounts.map(
            (account) => [
              account.id,
              `${account.account_code} — ${account.account_name}`,
            ],
          ),
        ),
      [accounts],
    );

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

    if (
      nextSearch ===
      appliedSearch
    ) {
      setReloadVersion(
        (currentVersion) =>
          currentVersion + 1,
      );

      return;
    }

    setAppliedSearch(nextSearch);
  }

  function clearFilters(): void {
    setSearchInput("");
    setAppliedSearch("");
    setSelectedStatus("");
    setSelectedEntryType("");
    setDateFrom("");
    setDateTo("");
    setResourceState("loading");
    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  function handleEntrySaved(): void {
    setEditorState(null);
    setActionError(null);
    requestReload();
  }

  async function handlePost(
    entry: JournalEntry,
  ): Promise<void> {
    const confirmed =
      window.confirm(
        [
          `Post ${entry.entry_number}?`,
          "",
          "Posted entries become part of the Trial Balance and can no longer be edited.",
        ].join("\n"),
      );

    if (!confirmed) {
      return;
    }

    setActionError(null);
    setBusyEntryId(entry.id);
    setBusyAction("post");

    try {
      await postJournalEntry(
        entry.id,
      );

      requestReload();
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "The journal entry could not be posted.",
        ),
      );
    } finally {
      setBusyEntryId(null);
      setBusyAction(null);
    }
  }

  async function handleVoid(
    entry: JournalEntry,
  ): Promise<void> {
    const reason =
      window.prompt(
        [
          `Void ${entry.entry_number}`,
          "",
          "Enter the audit reason for voiding this posted entry:",
        ].join("\n"),
      );

    if (reason === null) {
      return;
    }

    const cleanedReason =
      reason.trim();

    if (
      cleanedReason.length < 3
    ) {
      setActionError(
        "Void reason must contain at least three characters.",
      );
      return;
    }

    setActionError(null);
    setBusyEntryId(entry.id);
    setBusyAction("void");

    try {
      await voidJournalEntry(
        entry.id,
        {
          reason:
            cleanedReason,
        },
      );

      requestReload();
    } catch (error) {
      setActionError(
        getErrorMessage(
          error,
          "The journal entry could not be voided.",
        ),
      );
    } finally {
      setBusyEntryId(null);
      setBusyAction(null);
    }
  }

  const filtersApplied =
    Boolean(
      appliedSearch ||
      selectedStatus ||
      selectedEntryType ||
      dateFrom ||
      dateTo,
    );

  const activeAccountCount =
    accounts.filter(
      (account) =>
        account.is_active,
    ).length;

  return (
    <main className="journal-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href={`/reports/${reportId}`}
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              General journal
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href={`/reports/${reportId}/trial-balance`}
          >
            Trial balance
          </Link>

          {report ? (
            <Link
              className="topbar-link"
              href={`/companies/${report.company_id}/chart-of-accounts`}
            >
              Chart of accounts
            </Link>
          ) : null}

          <Link
            className="topbar-link"
            href={`/reports/${reportId}`}
          >
            Report overview
          </Link>
        </div>
      </header>

      <section className="journal-hero">
        <div>
          <p className="eyebrow">
            General journal
          </p>

          <h1>
            {report?.title ??
              "Financial report journal"}
          </h1>

          <p>
            Record each transaction using
            equal debit and credit lines.
            Draft entries may be edited;
            posted entries feed the Trial
            Balance.
          </p>
        </div>

        <div className="journal-hero__summary">
          <span>
            Journal entries
          </span>

          <strong>
            {resourceState === "ready"
              ? total
              : "—"}
          </strong>

          <button
            className="primary-button"
            type="button"
            disabled={
              !report ||
              activeAccountCount < 2
            }
            onClick={() =>
              setEditorState({
                mode: "create",
              })
            }
          >
            New journal entry
          </button>
        </div>
      </section>

      <section className="journal-toolbar">
        <form
          className="journal-search"
          onSubmit={handleSearch}
        >
          <label htmlFor="journal-search">
            Search journal
          </label>

          <div className="journal-search__controls">
            <input
              id="journal-search"
              type="search"
              value={searchInput}
              placeholder="Entry number, description or reference"
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

        <label className="journal-filter">
          <span>Status</span>

          <select
            value={selectedStatus}
            onChange={(event) => {
              setResourceState(
                "loading",
              );

              setSelectedStatus(
                event.target
                  .value as
                  | JournalEntryStatus
                  | "",
              );
            }}
          >
            <option value="">
              All statuses
            </option>

            {JOURNAL_ENTRY_STATUS_OPTIONS.map(
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

        <label className="journal-filter">
          <span>Entry type</span>

          <select
            value={
              selectedEntryType
            }
            onChange={(event) => {
              setResourceState(
                "loading",
              );

              setSelectedEntryType(
                event.target
                  .value as
                  | JournalEntryType
                  | "",
              );
            }}
          >
            <option value="">
              All entry types
            </option>

            {JOURNAL_ENTRY_TYPE_OPTIONS.map(
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

        <label className="journal-filter">
          <span>Date from</span>

          <input
            type="date"
            min={
              report?.period_start
            }
            max={
              report?.period_end
            }
            value={dateFrom}
            onChange={(event) => {
              setResourceState(
                "loading",
              );

              setDateFrom(
                event.target.value,
              );
            }}
          />
        </label>

        <label className="journal-filter">
          <span>Date to</span>

          <input
            type="date"
            min={
              report?.period_start
            }
            max={
              report?.period_end
            }
            value={dateTo}
            onChange={(event) => {
              setResourceState(
                "loading",
              );

              setDateTo(
                event.target.value,
              );
            }}
          />
        </label>

        <div className="journal-toolbar__actions">
          <button
            className="text-button"
            type="button"
            disabled={
              resourceState ===
              "loading"
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

      {actionError ? (
        <div
          className="workspace-alert workspace-alert--error"
          role="alert"
        >
          <div>
            <strong>
              Journal action failed
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
        className="journal-content"
        aria-busy={
          resourceState ===
          "loading"
        }
      >
        {resourceState === "loading" ? (
          <div className="journal-loading-grid">
            {[1, 2].map(
              (placeholder) => (
                <div
                  className="journal-entry-card journal-entry-card--loading"
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

        {resourceState === "error" ? (
          <div className="journal-state-card journal-state-card--error">
            <span>
              Journal unavailable
            </span>

            <h2>
              Journal entries could not be
              loaded
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
        activeAccountCount < 2 ? (
          <div className="journal-state-card">
            <span>
              Accounts required
            </span>

            <h2>
              Initialize the Chart of
              Accounts first
            </h2>

            <p>
              At least two active ledger
              accounts are required before a
              balanced journal can be
              recorded.
            </p>

            {report ? (
              <Link
                className="primary-button"
                href={`/companies/${report.company_id}/chart-of-accounts`}
              >
                Open Chart of Accounts
              </Link>
            ) : null}
          </div>
        ) : null}

        {resourceState === "ready" &&
        activeAccountCount >= 2 &&
        entries.length === 0 ? (
          <div className="journal-state-card">
            <span>
              {filtersApplied
                ? "No matching entries"
                : "No journal entries"}
            </span>

            <h2>
              {filtersApplied
                ? "No entry matches the selected filters"
                : "Record the first accounting transaction"}
            </h2>

            <p>
              {filtersApplied
                ? "Change or clear the current filters to view other journal entries."
                : "Create an opening balance or standard journal entry using equal debit and credit totals."}
            </p>

            {filtersApplied ? (
              <button
                className="secondary-button"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
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
                Create first journal entry
              </button>
            )}
          </div>
        ) : null}

        {resourceState === "ready" &&
        entries.length > 0 ? (
          <>
            <div className="journal-content__heading">
              <div>
                <p className="eyebrow">
                  Accounting entries
                </p>

                <h2>
                  {total === 1
                    ? "1 journal entry"
                    : `${total} journal entries`}
                </h2>
              </div>

              <p>
                Only posted entries are
                included in the Trial Balance.
              </p>
            </div>

            <div className="journal-entry-list">
              {entries.map(
                (entry) => (
                  <JournalEntryCard
                    entry={entry}
                    currency={
                      report?.currency ??
                      "GHS"
                    }
                    accountNames={
                      accountNames
                    }
                    busyEntryId={
                      busyEntryId
                    }
                    busyAction={
                      busyAction
                    }
                    key={entry.id}
                    onEdit={(
                      selectedEntry,
                    ) =>
                      setEditorState({
                        mode: "edit",
                        entry:
                          selectedEntry,
                      })
                    }
                    onPost={
                      handlePost
                    }
                    onVoid={
                      handleVoid
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
          {company?.name ??
            "Financial Statement Studio"}
        </span>

        <span>
          Draft entries are excluded until
          they are posted.
        </span>
      </footer>

      {editorState && report ? (
        <JournalEntryEditor
          key={
            editorState.mode === "edit"
              ? editorState.entry.id
              : "new-journal-entry"
          }
          report={report}
          accounts={accounts}
          entry={
            editorState.mode === "edit"
              ? editorState.entry
              : null
          }
          onClose={() =>
            setEditorState(null)
          }
          onSaved={
            handleEntrySaved
          }
        />
      ) : null}
    </main>
  );
}