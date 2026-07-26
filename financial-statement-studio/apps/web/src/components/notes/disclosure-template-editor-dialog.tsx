"use client";

import {
  type FormEvent,
  useState,
} from "react";

import type {
  DisclosureTemplate,
  DisclosureTemplateCreatePayload,
  NoteType,
  StatementName,
} from "@/types/notes";
import {
  NOTE_TYPE_OPTIONS,
  STATEMENT_NAME_OPTIONS,
} from "@/types/notes";

type DisclosureTemplateEditorDialogProps = {
  initialTemplate?: DisclosureTemplate;
  isSaving: boolean;

  onCancel(): void;

  onSave(
    payload: DisclosureTemplateCreatePayload,
  ): Promise<void>;
};

export function DisclosureTemplateEditorDialog({
  initialTemplate,
  isSaving,
  onCancel,
  onSave,
}: DisclosureTemplateEditorDialogProps) {
  const [templateKey, setTemplateKey] =
    useState(
      initialTemplate
        ?.template_key ?? "",
    );

  const [title, setTitle] =
    useState(
      initialTemplate?.title ?? "",
    );

  const [noteType, setNoteType] =
    useState<NoteType>(
      initialTemplate
        ?.note_type ??
        "general_disclosure",
    );

  const [
    statementName,
    setStatementName,
  ] = useState<
    StatementName | ""
  >(
    initialTemplate
      ?.statement_name ?? "",
  );

  const [
    statementLineKey,
    setStatementLineKey,
  ] = useState(
    initialTemplate
      ?.statement_line_key ?? "",
  );

  const [defaultContent, setDefaultContent] =
    useState(
      initialTemplate
        ?.default_content ?? "",
    );

  const [isRequired, setIsRequired] =
    useState(
      initialTemplate
        ?.is_required ?? false,
    );

  const [isActive, setIsActive] =
    useState(
      initialTemplate
        ?.is_active ?? true,
    );

  const [displayOrder, setDisplayOrder] =
    useState(
      String(
        initialTemplate
          ?.display_order ?? 0,
      ),
    );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    await onSave({
      template_key:
        templateKey.trim(),

      title: title.trim(),

      note_type: noteType,

      statement_name:
        statementName || null,

      statement_line_key:
        statementLineKey.trim() ||
        null,

      default_content:
        defaultContent.trim(),

      is_required:
        isRequired,

      is_active:
        isActive,

      display_order:
        Math.max(
          0,
          Number(
            displayOrder || "0",
          ),
        ),
    });
  }

  const statementIsRequired =
    noteType === "statement_note";

  return (
    <div
      className="notes-dialog-backdrop"
      role="presentation"
    >
      <section
        className="notes-dialog disclosure-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-editor-title"
      >
        <header>
          <div>
            <span>
              {initialTemplate
                ? initialTemplate
                    .is_system_template
                  ? "System template"
                  : "Custom template"
                : "New reusable template"}
            </span>

            <h2 id="template-editor-title">
              {initialTemplate
                ? "Edit disclosure template"
                : "Create disclosure template"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close template editor"
            disabled={isSaving}
            onClick={onCancel}
          >
            ×
          </button>
        </header>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className="notes-form-grid">
            <label className="notes-form-field">
              <span>
                Template key
              </span>

              <input
                required
                maxLength={120}
                value={templateKey}
                disabled={
                  isSaving ||
                  Boolean(
                    initialTemplate
                      ?.is_system_template,
                  )
                }
                placeholder="revenue-recognition"
                onChange={(event) =>
                  setTemplateKey(
                    event.target.value,
                  )
                }
              />

              <small>
                A unique internal identifier.
                System-template keys cannot
                be changed.
              </small>
            </label>

            <label className="notes-form-field">
              <span>
                Display order
              </span>

              <input
                min="0"
                type="number"
                value={displayOrder}
                disabled={isSaving}
                onChange={(event) =>
                  setDisplayOrder(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Template title
              </span>

              <input
                required
                maxLength={255}
                value={title}
                disabled={isSaving}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-field">
              <span>
                Note type
              </span>

              <select
                required
                value={noteType}
                disabled={isSaving}
                onChange={(event) =>
                  setNoteType(
                    event.target
                      .value as NoteType,
                  )
                }
              >
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

            <label className="notes-form-field">
              <span>
                Statement reference
              </span>

              <select
                required={
                  statementIsRequired
                }
                value={statementName}
                disabled={isSaving}
                onChange={(event) => {
                  const value =
                    event.target
                      .value as
                      | StatementName
                      | "";

                  setStatementName(
                    value,
                  );

                  if (!value) {
                    setStatementLineKey(
                      "",
                    );
                  }
                }}
              >
                <option value="">
                  No statement reference
                </option>

                {STATEMENT_NAME_OPTIONS.map(
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

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Statement line key
              </span>

              <input
                maxLength={100}
                value={
                  statementLineKey
                }
                disabled={
                  isSaving ||
                  !statementName
                }
                placeholder="Example: revenue"
                onChange={(event) =>
                  setStatementLineKey(
                    event.target.value,
                  )
                }
              />

              <small>
                Optional internal
                cross-reference used to
                associate the template with
                a particular statement line.
              </small>
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Default disclosure content
              </span>

              <textarea
                rows={11}
                value={
                  defaultContent
                }
                disabled={isSaving}
                onChange={(event) =>
                  setDefaultContent(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-checkbox">
              <input
                type="checkbox"
                checked={isRequired}
                disabled={isSaving}
                onChange={(event) =>
                  setIsRequired(
                    event.target.checked,
                  )
                }
              />

              <span>
                Required disclosure
              </span>
            </label>

            <label className="notes-form-checkbox">
              <input
                type="checkbox"
                checked={isActive}
                disabled={isSaving}
                onChange={(event) =>
                  setIsActive(
                    event.target.checked,
                  )
                }
              />

              <span>
                Template is active
              </span>
            </label>
          </div>

          <footer>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={onCancel}
            >
              Cancel
            </button>

            <button
              className="primary-button"
              type="submit"
              disabled={
                isSaving ||
                !templateKey.trim() ||
                !title.trim()
              }
            >
              {isSaving
                ? "Saving template..."
                : initialTemplate
                  ? "Save changes"
                  : "Create template"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}