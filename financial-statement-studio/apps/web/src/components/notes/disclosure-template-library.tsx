"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { DisclosureTemplateEditorDialog } from "@/components/notes/disclosure-template-editor-dialog";
import {
  createDisclosureTemplate,
  deactivateDisclosureTemplate,
  initializeDisclosureTemplates,
  listDisclosureTemplates,
  reactivateDisclosureTemplate,
  updateDisclosureTemplate,
} from "@/lib/notes-api";
import type {
  DisclosureTemplate,
  DisclosureTemplateCreatePayload,
  NoteType,
} from "@/types/notes";
import {
  NOTE_TYPE_LABELS,
  NOTE_TYPE_OPTIONS,
  STATEMENT_NAME_LABELS,
} from "@/types/notes";

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
      template: DisclosureTemplate;
    }
  | null;

type StatusMessage = {
  type:
    | "success"
    | "error"
    | "info";
  text: string;
} | null;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export function DisclosureTemplateLibrary() {
  const [
    templates,
    setTemplates,
  ] = useState<
    DisclosureTemplate[]
  >([]);

  const [
    resourceState,
    setResourceState,
  ] = useState<ResourceState>(
    "loading",
  );

  const [
    loadError,
    setLoadError,
  ] = useState<string | null>(
    null,
  );

  const [
    includeInactive,
    setIncludeInactive,
  ] = useState(false);

  const [
    selectedNoteType,
    setSelectedNoteType,
  ] = useState<
    NoteType | "all"
  >("all");

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    reloadVersion,
    setReloadVersion,
  ] = useState(0);

  const [
    editorState,
    setEditorState,
  ] = useState<EditorState>(
    null,
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    isInitializing,
    setIsInitializing,
  ] = useState(false);

  const [
    activeActionId,
    setActiveActionId,
  ] = useState<string | null>(
    null,
  );

  const [
    statusMessage,
    setStatusMessage,
  ] = useState<StatusMessage>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    listDisclosureTemplates({
      includeInactive,
      noteType:
        selectedNoteType === "all"
          ? undefined
          : selectedNoteType,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTemplates(
          response.items,
        );

        setResourceState(
          "ready",
        );
      })
      .catch(
        (error: unknown) => {
          if (cancelled) {
            return;
          }

          setLoadError(
            getErrorMessage(
              error,
              "Disclosure templates could not be loaded.",
            ),
          );

          setResourceState(
            "error",
          );
        },
      );

    return () => {
      cancelled = true;
    };
  }, [
    includeInactive,
    reloadVersion,
    selectedNoteType,
  ]);

  const filteredTemplates =
    useMemo(() => {
      const normalizedSearch =
        searchText
          .trim()
          .toLowerCase();

      return [...templates]
        .filter((template) => {
          if (!normalizedSearch) {
            return true;
          }

          return [
            template.template_key,
            template.title,
            template.default_content,
            template.statement_line_key ??
              "",
          ].some((value) =>
            value
              .toLowerCase()
              .includes(
                normalizedSearch,
              ),
          );
        })
        .sort(
          (
            firstTemplate,
            secondTemplate,
          ) =>
            firstTemplate
              .display_order -
              secondTemplate
                .display_order ||
            firstTemplate.title
              .localeCompare(
                secondTemplate.title,
              ),
        );
    }, [
      searchText,
      templates,
    ]);

  const activeCount =
    templates.filter(
      (template) =>
        template.is_active,
    ).length;

  const inactiveCount =
    templates.length -
    activeCount;

  function requestReload(): void {
    setResourceState(
      "loading",
    );

    setLoadError(null);

    setReloadVersion(
      (currentVersion) =>
        currentVersion + 1,
    );
  }

  async function handleInitialize(): Promise<void> {
    setIsInitializing(true);
    setStatusMessage(null);

    try {
      const response =
        await initializeDisclosureTemplates();

      setStatusMessage({
        type: "success",
        text:
          response.created_count > 0
            ? `${response.created_count} system templates were created.`
            : `No new templates were required. ${response.skipped_count} existing templates were preserved.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "System templates could not be initialized.",
        ),
      });
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleSave(
    payload: DisclosureTemplateCreatePayload,
  ): Promise<void> {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      if (
        editorState?.mode ===
        "edit"
      ) {
        await updateDisclosureTemplate(
          editorState.template.id,
          payload,
        );

        setStatusMessage({
          type: "success",
          text: "The disclosure template was updated.",
        });
      } else {
        await createDisclosureTemplate(
          payload,
        );

        setStatusMessage({
          type: "success",
          text: "The disclosure template was created.",
        });
      }

      setEditorState(null);
      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The disclosure template could not be saved.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate(
    template: DisclosureTemplate,
  ): Promise<void> {
    setActiveActionId(
      template.id,
    );

    setStatusMessage(null);

    try {
      await deactivateDisclosureTemplate(
        template.id,
      );

      setStatusMessage({
        type: "success",
        text: `${template.title} was deactivated.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The template could not be deactivated.",
        ),
      });
    } finally {
      setActiveActionId(null);
    }
  }

  async function handleReactivate(
    template: DisclosureTemplate,
  ): Promise<void> {
    setActiveActionId(
      template.id,
    );

    setStatusMessage(null);

    try {
      await reactivateDisclosureTemplate(
        template.id,
      );

      setStatusMessage({
        type: "success",
        text: `${template.title} was reactivated.`,
      });

      requestReload();
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: getErrorMessage(
          error,
          "The template could not be reactivated.",
        ),
      });
    } finally {
      setActiveActionId(null);
    }
  }

  return (
    <main className="template-library-page">
      <header className="app-topbar">
        <Link
          className="app-brand"
          href="/reports"
        >
          <span>FS</span>

          <div>
            <strong>
              Financial Statement Studio
            </strong>

            <small>
              Disclosure Template Library
            </small>
          </div>
        </Link>

        <div className="app-topbar__right">
          <Link
            className="topbar-link"
            href="/companies"
          >
            Companies
          </Link>

          <Link
            className="topbar-link"
            href="/reports"
          >
            Financial reports
          </Link>
        </div>
      </header>

      <section className="template-library-hero">
        <div>
          <p className="eyebrow">
            Reusable disclosures
          </p>

          <h1>
            Disclosure Template Library
          </h1>

          <p>
            Maintain accounting policies,
            explanatory notes and statement
            disclosures that can be reused
            across multiple financial reports.
          </p>
        </div>

        <div className="template-library-hero__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isInitializing}
            onClick={() => {
              void handleInitialize();
            }}
          >
            {isInitializing
              ? "Initializing..."
              : "Initialize system templates"}
          </button>

          <button
            className="primary-button"
            type="button"
            disabled={
              resourceState !==
              "ready"
            }
            onClick={() =>
              setEditorState({
                mode: "create",
              })
            }
          >
            Create template
          </button>
        </div>
      </section>

      <section className="template-library-content">
        <section className="template-library-summary">
          <article>
            <span>
              Loaded templates
            </span>

            <strong>
              {templates.length}
            </strong>
          </article>

          <article>
            <span>
              Active
            </span>

            <strong>
              {activeCount}
            </strong>
          </article>

          <article>
            <span>
              Inactive
            </span>

            <strong>
              {inactiveCount}
            </strong>
          </article>
        </section>

        {statusMessage ? (
          <div
            className={`notes-status notes-status--${statusMessage.type}`}
            role={
              statusMessage.type ===
              "error"
                ? "alert"
                : "status"
            }
          >
            {statusMessage.text}
          </div>
        ) : null}

        <section className="template-library-filters">
          <label>
            <span>
              Search templates
            </span>

            <input
              type="search"
              value={searchText}
              placeholder="Search by title, key or content"
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
            />
          </label>

          <label>
            <span>
              Note type
            </span>

            <select
              value={selectedNoteType}
              onChange={(event) => {
                setResourceState(
                  "loading",
                );

                setSelectedNoteType(
                  event.target
                    .value as
                    | NoteType
                    | "all",
                );
              }}
            >
              <option value="all">
                All note types
              </option>

              {NOTE_TYPE_OPTIONS.map(
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

          <label className="template-library-checkbox">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => {
                setResourceState(
                  "loading",
                );

                setIncludeInactive(
                  event.target.checked,
                );
              }}
            />

            <span>
              Show inactive templates
            </span>
          </label>

          <button
            className="secondary-button"
            type="button"
            disabled={
              resourceState ===
              "loading"
            }
            onClick={requestReload}
          >
            Refresh
          </button>
        </section>

        {resourceState ===
        "loading" ? (
          <div className="financial-statement-loading">
            <div />
            <div />
            <div />
            <div />
          </div>
        ) : null}

        {resourceState ===
        "error" ? (
          <div className="journal-state-card journal-state-card--error">
            <span>
              Templates unavailable
            </span>

            <h2>
              Disclosure templates could
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

        {resourceState ===
        "ready" ? (
          <div className="template-library-grid">
            {filteredTemplates.length >
            0 ? (
              filteredTemplates.map(
                (template) => (
                  <article
                    className={[
                      "template-library-card",
                      template.is_active
                        ? ""
                        : "template-library-card--inactive",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={template.id}
                  >
                    <header>
                      <div>
                        <span>
                          {
                            NOTE_TYPE_LABELS[
                              template.note_type
                            ]
                          }
                        </span>

                        <h2>
                          {template.title}
                        </h2>

                        <small>
                          {template.template_key}
                        </small>
                      </div>

                      <div className="template-library-card__badges">
                        <span>
                          {template
                            .is_system_template
                            ? "System"
                            : "Custom"}
                        </span>

                        <span>
                          {template.is_required
                            ? "Required"
                            : "Optional"}
                        </span>

                        <span>
                          {template.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                    </header>

                    <div className="template-library-card__content">
                      <p>
                        {template.default_content ||
                          "No default disclosure content has been entered."}
                      </p>

                      <dl>
                        <div>
                          <dt>
                            Display order
                          </dt>

                          <dd>
                            {
                              template.display_order
                            }
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Statement
                          </dt>

                          <dd>
                            {template.statement_name
                              ? STATEMENT_NAME_LABELS[
                                  template
                                    .statement_name
                                ]
                              : "General"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Line reference
                          </dt>

                          <dd>
                            {template
                              .statement_line_key ||
                              "None"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <footer>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          activeActionId ===
                          template.id
                        }
                        onClick={() =>
                          setEditorState({
                            mode: "edit",
                            template,
                          })
                        }
                      >
                        Edit template
                      </button>

                      {template.is_active ? (
                        <button
                          className="template-danger-button"
                          type="button"
                          disabled={
                            activeActionId ===
                            template.id
                          }
                          onClick={() => {
                            void handleDeactivate(
                              template,
                            );
                          }}
                        >
                          {activeActionId ===
                          template.id
                            ? "Updating..."
                            : "Deactivate"}
                        </button>
                      ) : (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={
                            activeActionId ===
                            template.id
                          }
                          onClick={() => {
                            void handleReactivate(
                              template,
                            );
                          }}
                        >
                          {activeActionId ===
                          template.id
                            ? "Updating..."
                            : "Reactivate"}
                        </button>
                      )}
                    </footer>
                  </article>
                ),
              )
            ) : (
              <div className="template-library-empty">
                <span>
                  No templates found
                </span>

                <h2>
                  Create or initialize
                  disclosure templates
                </h2>

                <p>
                  Templates will appear here
                  and can then be reused when
                  preparing report notes.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {editorState ? (
        <DisclosureTemplateEditorDialog
          key={
            editorState.mode ===
            "edit"
              ? editorState.template.id
              : "new-template"
          }
          initialTemplate={
            editorState.mode ===
            "edit"
              ? editorState.template
              : undefined
          }
          isSaving={isSaving}
          onCancel={() =>
            setEditorState(null)
          }
          onSave={handleSave}
        />
      ) : null}
    </main>
  );
}