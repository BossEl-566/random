"use client";

import {
  type FormEvent,
  useState,
} from "react";

import type {
  DisclosureTemplate,
  FinancialReportNote,
  FinancialReportNoteCreatePayload,
  NoteType,
  StatementName,
} from "@/types/notes";
import {
  NOTE_TYPE_OPTIONS,
  STATEMENT_NAME_OPTIONS,
} from "@/types/notes";

type NoteEditorDialogProps = {
  templates: DisclosureTemplate[];
  initialNote?: FinancialReportNote;
  isSaving: boolean;

  onCancel(): void;

  onSave(
    payload: FinancialReportNoteCreatePayload,
  ): Promise<void>;
};

export function NoteEditorDialog({
  templates,
  initialNote,
  isSaving,
  onCancel,
  onSave,
}: NoteEditorDialogProps) {
  const [templateId, setTemplateId] =
    useState(
      initialNote?.template_id ?? "",
    );

  const [noteNumber, setNoteNumber] =
    useState(
      initialNote
        ? String(
            initialNote.note_number,
          )
        : "",
    );

  const [title, setTitle] =
    useState(
      initialNote?.title ?? "",
    );

  const [noteType, setNoteType] =
    useState<NoteType>(
      initialNote?.note_type ??
        "general_disclosure",
    );

  const [
    statementName,
    setStatementName,
  ] = useState<
    StatementName | ""
  >(
    initialNote?.statement_name ??
      "",
  );

  const [
    statementLineKey,
    setStatementLineKey,
  ] = useState(
    initialNote
      ?.statement_line_key ??
      "",
  );

  const [content, setContent] =
    useState(
      initialNote?.content ?? "",
    );

  const [isActive, setIsActive] =
    useState(
      initialNote?.is_active ??
        true,
    );

  function applyTemplate(
    selectedTemplateId: string,
  ): void {
    setTemplateId(
      selectedTemplateId,
    );

    const selectedTemplate =
      templates.find(
        (template) =>
          template.id ===
          selectedTemplateId,
      );

    if (!selectedTemplate) {
      return;
    }

    setTitle(
      selectedTemplate.title,
    );

    setNoteType(
      selectedTemplate.note_type,
    );

    setStatementName(
      selectedTemplate
        .statement_name ?? "",
    );

    setStatementLineKey(
      selectedTemplate
        .statement_line_key ?? "",
    );

    setContent(
      selectedTemplate
        .default_content,
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const parsedNoteNumber =
      noteNumber.trim()
        ? Number(noteNumber)
        : undefined;

    await onSave({
      template_id:
        templateId || null,

      note_number:
        parsedNoteNumber,

      title: title.trim(),

      note_type: noteType,

      statement_name:
        statementName || null,

      statement_line_key:
        statementLineKey.trim() ||
        null,

      content: content.trim(),

      is_active: isActive,
    });
  }

  const statementIsRequired =
    noteType ===
    "statement_note";

  return (
    <div
      className="notes-dialog-backdrop"
      role="presentation"
    >
      <section
        className="notes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-editor-title"
      >
        <header>
          <div>
            <span>
              {initialNote
                ? `Note ${initialNote.note_number}`
                : "New disclosure"}
            </span>

            <h2 id="note-editor-title">
              {initialNote
                ? "Edit report note"
                : "Add report note"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Close note editor"
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
            <label className="notes-form-field notes-form-field--wide">
              <span>
                Start from template
              </span>

              <select
                value={templateId}
                disabled={isSaving}
                onChange={(event) =>
                  applyTemplate(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Custom note
                </option>

                {templates.map(
                  (template) => (
                    <option
                      value={template.id}
                      key={template.id}
                    >
                      {template.title}
                      {template.is_required
                        ? " — Required"
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="notes-form-field">
              <span>
                Note number
              </span>

              <input
                min="1"
                type="number"
                value={noteNumber}
                disabled={isSaving}
                placeholder="Automatic"
                onChange={(event) =>
                  setNoteNumber(
                    event.target.value,
                  )
                }
              />

              <small>
                Leave blank to place it
                last.
              </small>
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

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Note title
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
                Statement reference
              </span>

              <select
                required={
                  statementIsRequired
                }
                value={statementName}
                disabled={isSaving}
                onChange={(event) =>
                  setStatementName(
                    event.target
                      .value as
                      | StatementName
                      | "",
                  )
                }
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

            <label className="notes-form-field">
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
                cross-reference.
              </small>
            </label>

            <label className="notes-form-field notes-form-field--wide">
              <span>
                Note content
              </span>

              <textarea
                rows={10}
                value={content}
                disabled={isSaving}
                onChange={(event) =>
                  setContent(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="notes-form-checkbox notes-form-field--wide">
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
                Include this note in the
                financial statements
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
                !title.trim()
              }
            >
              {isSaving
                ? "Saving note..."
                : initialNote
                  ? "Save changes"
                  : "Add note"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}