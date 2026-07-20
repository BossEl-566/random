import {
  JOURNAL_ENTRY_STATUS_OPTIONS,
  JOURNAL_ENTRY_TYPE_OPTIONS,
  type JournalEntry,
  type MoneyValue,
} from "@/types/journal-entry";

type JournalAction =
  | "post"
  | "void"
  | null;

type JournalEntryCardProps = {
  entry: JournalEntry;
  currency: string;
  accountNames: ReadonlyMap<
    string,
    string
  >;
  busyEntryId: string | null;
  busyAction: JournalAction;
  onEdit: (
    entry: JournalEntry,
  ) => void;
  onPost: (
    entry: JournalEntry,
  ) => void;
  onVoid: (
    entry: JournalEntry,
  ) => void;
};

function getOptionLabel(
  options: ReadonlyArray<{
    value: string;
    label: string;
  }>,
  value: string,
): string {
  return (
    options.find(
      (option) =>
        option.value === value,
    )?.label ?? value
  );
}

function formatDate(
  value: string,
): string {
  const date = new Date(
    `${value}T00:00:00`,
  );

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

function formatMoney(
  value: MoneyValue,
  currency: string,
): string {
  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  const formattedValue =
    Number.isFinite(numericValue)
      ? new Intl.NumberFormat(
          "en-GH",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        ).format(numericValue)
      : String(value);

  return `${currency} ${formattedValue}`;
}

export function JournalEntryCard({
  entry,
  currency,
  accountNames,
  busyEntryId,
  busyAction,
  onEdit,
  onPost,
  onVoid,
}: JournalEntryCardProps) {
  const isBusy =
    busyEntryId === entry.id;

  return (
    <article className="journal-entry-card">
      <header className="journal-entry-card__header">
        <div>
          <div className="journal-entry-card__badges">
            <span
              className={`journal-status journal-status--${entry.status}`}
            >
              {getOptionLabel(
                JOURNAL_ENTRY_STATUS_OPTIONS,
                entry.status,
              )}
            </span>

            <span className="journal-type-badge">
              {getOptionLabel(
                JOURNAL_ENTRY_TYPE_OPTIONS,
                entry.entry_type,
              )}
            </span>
          </div>

          <h3>{entry.description}</h3>

          <p>
            {entry.entry_number}
            {" · "}
            {formatDate(
              entry.entry_date,
            )}
          </p>
        </div>

        <div className="journal-entry-card__amount">
          <span>Entry total</span>

          <strong>
            {formatMoney(
              entry.total_debit,
              currency,
            )}
          </strong>
        </div>
      </header>

      <div className="journal-entry-card__metadata">
        <div>
          <span>Reference</span>
          <strong>
            {entry.reference ??
              "No reference"}
          </strong>
        </div>

        <div>
          <span>Source</span>
          <strong>
            {entry.source}
          </strong>
        </div>

        <div>
          <span>Lines</span>
          <strong>
            {entry.lines.length}
          </strong>
        </div>
      </div>

      <div className="journal-lines-table-wrapper">
        <table className="journal-lines-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Description</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>

          <tbody>
            {entry.lines.map(
              (line) => (
                <tr key={line.id}>
                  <td>
                    {accountNames.get(
                      line.ledger_account_id,
                    ) ??
                      "Unknown account"}
                  </td>

                  <td>
                    {line.description ??
                      "—"}
                  </td>

                  <td>
                    {Number(
                      line.debit,
                    ) > 0
                      ? formatMoney(
                          line.debit,
                          currency,
                        )
                      : "—"}
                  </td>

                  <td>
                    {Number(
                      line.credit,
                    ) > 0
                      ? formatMoney(
                          line.credit,
                          currency,
                        )
                      : "—"}
                  </td>
                </tr>
              ),
            )}
          </tbody>

          <tfoot>
            <tr>
              <th colSpan={2}>
                Totals
              </th>

              <th>
                {formatMoney(
                  entry.total_debit,
                  currency,
                )}
              </th>

              <th>
                {formatMoney(
                  entry.total_credit,
                  currency,
                )}
              </th>
            </tr>
          </tfoot>
        </table>
      </div>

      {entry.status === "voided" ? (
        <div className="journal-void-reason">
          <strong>
            Void reason
          </strong>

          <p>
            {entry.void_reason ??
              "No reason recorded"}
          </p>
        </div>
      ) : null}

      <footer className="journal-entry-card__actions">
        {entry.status === "draft" ? (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() =>
                onEdit(entry)
              }
            >
              Edit draft
            </button>

            <button
              className="journal-action--primary"
              type="button"
              disabled={isBusy}
              onClick={() =>
                onPost(entry)
              }
            >
              {isBusy &&
              busyAction === "post"
                ? "Posting..."
                : "Post entry"}
            </button>
          </>
        ) : null}

        {entry.status === "posted" ? (
          <button
            className="journal-action--danger"
            type="button"
            disabled={isBusy}
            onClick={() =>
              onVoid(entry)
            }
          >
            {isBusy &&
            busyAction === "void"
              ? "Voiding..."
              : "Void entry"}
          </button>
        ) : null}

        {entry.status === "voided" ? (
          <span className="journal-entry-locked">
            This entry is retained for audit
            history.
          </span>
        ) : null}
      </footer>
    </article>
  );
}